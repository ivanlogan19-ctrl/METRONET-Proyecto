package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.dto.*;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.*;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class ConexionesLineasPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username", () -> System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password", () -> System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired SimulacionService simulaciones;
    @Autowired DisenoAdministracionService administracion;
    @MockitoBean ServicioCorreo correo;

    @Test void metroPropioDeConexionPersisteConfiguraYExigeSuPresencia() {
        int usuario = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Metro QA','metro-conexion@example.test','!sin-acceso','ADMIN') RETURNING id_usuario", Integer.class);
        int diseno = simulaciones.crearSimulacion(usuario, Rol.ADMIN, new CrearSimulacionRequest("Metro de conexión")).idDiseno();
        for (int i = 0; i < 4; i++) simulaciones.crearEstacion(usuario, diseno,
            new CrearEstacionSimulacionRequest("E" + i, BigDecimal.valueOf(610 + i * 15), BigDecimal.valueOf(430)));
        simulaciones.crearLinea(usuario, diseno, new CrearLineaSimulacionRequest("Azul", List.of("E0", "E1")));
        simulaciones.crearLinea(usuario, diseno, new CrearLineaSimulacionRequest("Verde", List.of("E2", "E3")));
        var conexion = simulaciones.crearConexionLineas(usuario, diseno, new ConexionLineasRequest("Azul", "E1", "Verde", "E2"));
        for (String linea : List.of("Azul", "Verde")) simulaciones.crearUnidadMetro(usuario, diseno,
            new CrearUnidadMetroSimulacionRequest(linea, 300, BigDecimal.ONE));
        assertTrue(simulaciones.validarDiseno(usuario, diseno).observacionesSimulacion().stream().anyMatch(t -> t.contains("cada conexión")));
        var metro = simulaciones.crearUnidadMetro(usuario, diseno,
            new CrearUnidadMetroSimulacionRequest(null, 300, BigDecimal.ONE, conexion.idConexion()));
        String clave = "@conexion:" + conexion.idConexion();
        assertEquals(clave, metro.nombreLinea());
        assertNull(jdbc.queryForObject("SELECT nombre_linea FROM metro WHERE id_tren=?", String.class, metro.idTren()));
        assertEquals(conexion.idConexion(), jdbc.queryForObject("SELECT id_conexion FROM metro WHERE id_tren=?", Long.class, metro.idTren()));
        simulaciones.actualizarUnidadMetro(usuario, diseno, metro.idTren(), new ActualizarUnidadMetroRequest(clave, 300, new BigDecimal("2"), null, "UV"));
        simulaciones.guardarDiseno(usuario, diseno);
        var reabierto = simulaciones.obtenerSimulacion(usuario, diseno);
        var guardado = reabierto.unidadesMetro().stream().filter(u -> u.idTren().equals(metro.idTren())).findFirst().orElseThrow();
        double km = reabierto.conexionesLineas().getFirst().distanciaKm();
        assertEquals(km / 2, guardado.duracionUt(), 0.000001);
        simulaciones.actualizarUnidadMetro(usuario, diseno, metro.idTren(), new ActualizarUnidadMetroRequest(clave, 300, guardado.velocidadPromedio(), 2.0, "UT"));
        guardado = simulaciones.obtenerSimulacion(usuario, diseno).unidadesMetro().stream().filter(u -> u.idTren().equals(metro.idTren())).findFirst().orElseThrow();
        assertEquals(km / 2, guardado.velocidadPromedio().doubleValue(), 0.000001);
        assertTrue(simulaciones.validarDiseno(usuario, diseno).preparadoParaSimular());
        int copia = simulaciones.crearEscenario(usuario, diseno,
            new CrearEscenarioRequest("Copia conexión", "NIVEL", "Inicial", null, null)).idDiseno();
        var redCopiada = simulaciones.obtenerSimulacion(usuario, copia);
        long conexionCopiada = redCopiada.conexionesLineas().getFirst().idConexion();
        assertNotEquals(conexion.idConexion(), conexionCopiada);
        assertEquals(1, redCopiada.unidadesMetro().stream().filter(u -> u.nombreLinea().equals("@conexion:" + conexionCopiada)).count());
        simulaciones.ejecutarSimulacion(usuario, diseno, new EjecutarSimulacionRequest(BigDecimal.ONE, 2.0));
        int otro = simulaciones.crearSimulacion(usuario, Rol.ADMIN, new CrearSimulacionRequest("Otro diseño")).idDiseno();
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> simulaciones.crearUnidadMetro(usuario, otro,
            new CrearUnidadMetroSimulacionRequest(null, 300, BigDecimal.ONE, conexion.idConexion()))).getStatusCode().value());
        simulaciones.eliminarConexionLineas(usuario, diseno, conexion.idConexion());
        assertEquals(2, simulaciones.obtenerSimulacion(usuario, diseno).unidadesMetro().size());
    }

    @Test void conservaIdentidadesAlExtenderConectarGuardarReabrirRenombrarYEliminar() {
        int usuario = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Conexiones QA','conexiones@example.test','!sin-acceso','ADMIN') RETURNING id_usuario", Integer.class);
        int diseno = simulaciones.crearSimulacion(usuario, Rol.ADMIN, new CrearSimulacionRequest("Prueba conexiones")).idDiseno();
        for (int i=0; i<5; i++) simulaciones.crearEstacion(usuario, diseno,
            new CrearEstacionSimulacionRequest("E"+i, BigDecimal.valueOf(610+i*15), BigDecimal.valueOf(430)));
        simulaciones.crearLinea(usuario, diseno, new CrearLineaSimulacionRequest("Azul", List.of("E0","E1")));
        simulaciones.extenderLinea(usuario, diseno, new ActualizarTramoRequest("Azul","E1","E2"));
        simulaciones.crearLinea(usuario, diseno, new CrearLineaSimulacionRequest("Verde", List.of("E3","E4")));
        var antes = simulaciones.obtenerSimulacion(usuario, diseno);
        var conexion = simulaciones.crearConexionLineas(usuario, diseno, new ConexionLineasRequest("Azul","E2","Verde","E3"));
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> simulaciones.crearConexionLineas(
            usuario, diseno, new ConexionLineasRequest("Verde", "E4", "Azul", "E0"))).getStatusCode().value());
        simulaciones.guardarDiseno(usuario, diseno);
        var reabierto = simulaciones.obtenerSimulacion(usuario, diseno);
        assertEquals(antes.tramos(), reabierto.tramos());
        assertEquals(antes.lineas(), reabierto.lineas());
        assertEquals(conexion.idConexion(), reabierto.conexionesLineas().getFirst().idConexion());
        assertTrue(reabierto.conexionesLineas().getFirst().distanciaKm() > 0);
        assertEquals(conexion.idConexion(), administracion.obtenerDiseno(diseno).conexionesLineas().getFirst().idConexion());
        assertEquals(404, assertThrows(ResponseStatusException.class,
            () -> simulaciones.eliminarConexionLineas(usuario+10000, diseno, conexion.idConexion())).getStatusCode().value());
        simulaciones.actualizarLinea(usuario, diseno, "Azul", new ActualizarLineaSimulacionRequest("Celeste", null));
        assertEquals("Celeste", simulaciones.obtenerSimulacion(usuario, diseno).conexionesLineas().getFirst().lineaA());
        simulaciones.actualizarEstacion(usuario, diseno, "E2", new ActualizarEstacionRequest("Final", BigDecimal.valueOf(640), BigDecimal.valueOf(430), false));
        assertEquals("Final", simulaciones.obtenerSimulacion(usuario, diseno).conexionesLineas().getFirst().estacionA());
        simulaciones.actualizarLinea(usuario, diseno, "Celeste", new ActualizarLineaSimulacionRequest("Celeste", List.of("E0", "E1", "Final")));
        assertEquals(1, simulaciones.obtenerSimulacion(usuario, diseno).conexionesLineas().size(),
            "Reordenar conservando el extremo no borra su conexión");
        simulaciones.eliminarConexionLineas(usuario, diseno, conexion.idConexion());
        assertEquals(3, simulaciones.obtenerSimulacion(usuario, diseno).tramos().size());
        assertTrue(simulaciones.obtenerSimulacion(usuario, diseno).conexionesLineas().isEmpty());
        simulaciones.crearConexionLineas(usuario, diseno, new ConexionLineasRequest("Celeste","Final","Verde","E3"));
        simulaciones.eliminarLinea(usuario, diseno, "Verde");
        assertTrue(simulaciones.obtenerSimulacion(usuario, diseno).conexionesLineas().isEmpty());
        assertEquals(2, simulaciones.obtenerSimulacion(usuario, diseno).tramos().size());
    }
}
