package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.service.RecorridoIntegralService;
import com.metronet.backend.service.ServicioCorreo;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named="METRONET_E2E_CALLES", matches="true")
class CallesModoLibreE2EPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username", () -> System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password", () -> System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        r.add("metronet.trafico.directorio", () -> System.getProperty("java.io.tmpdir") + "/metronet-trafico-e2e-" + ProcessHandle.current().pid());
        r.add("METRONET_CORS_ORIGENES", () -> "http://127.0.0.1:5198");
    }
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;
    @Autowired java.time.Clock reloj;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired RecorridoIntegralService recorrido;
    @MockitoBean ServicioCorreo correo;
    @LocalServerPort int puerto;

    @Test void construirSobreCallesYRecuperarRedPersistida() throws Exception {
        assertTrue(System.getenv("METRONET_TEST_POSTGRES_URL").matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas"));
        // Ejecuta el actualizador empaquetado contra el catálogo oficial real.
        Path trafico = Path.of(System.getProperty("java.io.tmpdir"), "metronet-trafico-e2e-" + ProcessHandle.current().pid());
        String snapshotReal = System.getenv("METRONET_TRAFICO_PRUEBA_ACTUAL");
        if (snapshotReal != null) {
            Files.createDirectories(trafico);
            Files.copy(Path.of(snapshotReal), trafico.resolve("actual.json"), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        var actualizador = new com.metronet.backend.service.TraficoHistoricoService(mapper, reloj, trafico.toString(), true, "python3");
        try {
            actualizador.comprobarActualizacion();
            var estado = mapper.readTree(Files.readAllBytes(trafico.resolve("estado.json")));
            assertNotEquals("error", estado.path("resultado").asText());
            assertTrue(Files.exists(trafico.resolve("estado.json")));
            var respuesta = java.net.http.HttpClient.newHttpClient().send(
                java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:"+puerto+"/api/trafico/historico")).build(),
                java.net.http.HttpResponse.BodyHandlers.ofString());
            assertEquals(200, respuesta.statusCode());
            assertEquals(actualizador.consultar().path("periodo").asText(), mapper.readTree(respuesta.body()).path("periodo").asText());
            if (snapshotReal != null) assertFalse(mapper.readTree(respuesta.body()).path("actualizadoEl").asText().isBlank());
            System.out.println("Actualizador empaquetado + catálogo oficial + endpoint real: PASS " + estado.path("resultado").asText());
        } finally {
            // El estado temporal no debe impedir comprobar la fuente en una nueva ejecución.
            Files.deleteIfExists(trafico.resolve("estado.json"));
            Files.deleteIfExists(trafico.resolve("actualizacion.lock"));
        }
        String clave = "CallesQA!7";
        int admin = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol,identificador_administrador) VALUES ('Calles QA','calles-e2e@example.test',?,'ADMIN','calles-e2e') RETURNING id_usuario", Integer.class, encoder.encode(clave));
        jdbc.update("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Fuentes QA','fuentes-e2e@example.test',?,'JUGADOR')", encoder.encode(clave));
        recorrido.publicar(admin);
        var salida = Path.of("/tmp/metronet-calles-browser.log");
        var proceso = new ProcessBuilder("node", "--test", "tests/calles-modo-libre-e2e.test.cjs")
            .directory(Path.of("../frontend").toFile()).redirectErrorStream(true).redirectOutput(salida.toFile());
        proceso.environment().put("METRONET_API_PRUEBAS", "http://127.0.0.1:" + puerto);
        proceso.environment().put("METRONET_E2E_CLAVE", clave);
        var ejecucion = proceso.start();
        boolean termino = ejecucion.waitFor(6, TimeUnit.MINUTES);
        if (!termino) ejecucion.destroyForcibly();
        System.out.println(Files.readString(salida));
        assertTrue(termino, "La prueba real excedió su tiempo máximo");
        assertEquals(0, ejecucion.exitValue(), "Falló la prueba de navegador");
        int diseno = jdbc.queryForObject("SELECT i.id_diseno FROM intento i JOIN escenario e USING(id_escenario) WHERE i.id_usuario=? AND e.modo='EDICION_LIBRE' ORDER BY i.id_intento DESC LIMIT 1", Integer.class, admin);
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno=?", Integer.class, diseno));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM linea WHERE id_diseno=?", Integer.class, diseno));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM tramo WHERE id_diseno=?", Integer.class, diseno));
    }
}
