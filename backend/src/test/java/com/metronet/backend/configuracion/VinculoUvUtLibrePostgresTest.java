package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.service.*;
import java.nio.file.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class VinculoUvUtLibrePostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username",()->System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password",()->System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto",()->"validate");
        r.add("METRONET_CORS_ORIGENES",()->"http://127.0.0.1:5198");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired RecorridoIntegralService recorrido;
    @MockitoBean ServicioCorreo correo;
    @LocalServerPort int puerto;

    @Test void navegadorApiPersistenciaYRegresionNiveles() throws Exception {
        int admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Vinculo admin','vinculo-admin@example.test',?,'ADMIN') RETURNING id_usuario",Integer.class,encoder.encode("VinculoQA!7"));
        recorrido.publicar(admin);
        jdbc.update("INSERT INTO usuario(nombre,email,password,rol,campana_completada_historicamente) VALUES ('Vinculo QA','vinculo-browser@example.test',?,'JUGADOR',TRUE)",encoder.encode("VinculoQA!7"));
        var salida=Path.of("/tmp/metronet-vinculo-browser.log");
        var proceso=new ProcessBuilder("node","--test","tests/vinculo-uv-ut-e2e.test.cjs")
            .directory(Path.of("../frontend").toFile()).redirectErrorStream(true).redirectOutput(salida.toFile());
        proceso.environment().put("METRONET_API_PRUEBAS","http://127.0.0.1:"+puerto);
        var ejecucion=proceso.start();
        boolean termino=ejecucion.waitFor(5,TimeUnit.MINUTES);
        if(!termino)ejecucion.destroyForcibly();
        System.out.println(Files.readString(salida));
        assertTrue(termino);assertEquals(0,ejecucion.exitValue());
        var filas=jdbc.queryForList("SELECT m.velocidad_promedio,m.duracion_ut,m.referencia_uv_ut FROM metro m JOIN intento i USING(id_diseno) JOIN usuario u USING(id_usuario) WHERE u.email='vinculo-browser@example.test' ORDER BY m.id_tren");
        assertEquals(2,filas.size());
        assertEquals("UT",filas.get(0).get("referencia_uv_ut"));
        assertEquals(1.5,((Number)filas.get(0).get("duracion_ut")).doubleValue());
        assertNotEquals(filas.get(0).get("velocidad_promedio"),filas.get(1).get("velocidad_promedio"));
    }
}
