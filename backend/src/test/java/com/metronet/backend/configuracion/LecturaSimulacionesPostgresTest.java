package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.dto.*;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.ServicioCorreo;
import com.metronet.backend.service.SimulacionService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {"spring.datasource.hikari.maximum-pool-size=1", "spring.datasource.hikari.connection-timeout=1000"})
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class LecturaSimulacionesPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username", () -> System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password", () -> System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired SimulacionService simulaciones;
    @MockitoBean ServicioCorreo correo;

    @Test void reabreLaRedYSusResultadosConUnaSolaConexionDisponible() {
        int usuario = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Lectura QA','lectura-simulaciones@example.test','!sin-acceso','ADMIN') RETURNING id_usuario", Integer.class);
        int diseno = simulaciones.crearSimulacion(usuario, Rol.ADMIN, new CrearSimulacionRequest("Lectura de resultados")).idDiseno();
        for (int i=0; i<2; i++) simulaciones.crearEstacion(usuario, diseno,
            new CrearEstacionSimulacionRequest("E"+i, BigDecimal.valueOf(610+i*15), BigDecimal.valueOf(430)));
        simulaciones.crearLinea(usuario, diseno, new CrearLineaSimulacionRequest("Azul", List.of("E0", "E1")));
        simulaciones.crearUnidadMetro(usuario, diseno, new CrearUnidadMetroSimulacionRequest("Azul", 300, BigDecimal.ONE));
        simulaciones.guardarDiseno(usuario, diseno);
        assertTrue(simulaciones.validarDiseno(usuario, diseno).preparadoParaSimular());
        var resultado = simulaciones.ejecutarSimulacion(usuario, diseno, new EjecutarSimulacionRequest(BigDecimal.ONE, 6));
        assertEquals(List.of(resultado), simulaciones.listarResultados(usuario, diseno));
        assertEquals(List.of(resultado), simulaciones.obtenerSimulacion(usuario, diseno).resultados());
    }
}
