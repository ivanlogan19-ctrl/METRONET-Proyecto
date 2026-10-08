package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.service.*;
import java.nio.file.Path;
import java.util.UUID;
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
@EnabledIfEnvironmentVariable(named="METRONET_E2E_RECORRIDO",matches="true")
class RecorridoIntegralE2EPostgresTest {
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

    @Test void jugadorCompletaCampanaSoloMedianteLaInterfaz() throws Exception {
        assertTrue(System.getenv("METRONET_TEST_POSTGRES_URL").matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas"));
        int admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Editor QA','editor-e2e@example.test','!sin-login','ADMIN') RETURNING id_usuario",Integer.class);
        recorrido.publicar(admin);
        String email="campana-"+UUID.randomUUID()+"@example.test", clave="CampanaQA!7";
        int jugador=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Campaña UI',?,?, 'JUGADOR') RETURNING id_usuario",Integer.class,email,encoder.encode(clave));
        var proceso=new ProcessBuilder("node","--test","tests/recorrido-integral-e2e.test.cjs")
            .directory(Path.of("../frontend").toFile()).redirectErrorStream(true)
            .redirectOutput(Path.of("/tmp/metronet-recorrido-browser.log").toFile());
        proceso.environment().put("METRONET_API_PRUEBAS","http://127.0.0.1:"+puerto);
        proceso.environment().put("METRONET_URL_PRUEBAS","http://127.0.0.1:5198");
        proceso.environment().put("METRONET_E2E_EMAIL",email);
        proceso.environment().put("METRONET_E2E_CLAVE",clave);
        var ejecucion=proceso.start();
        boolean termino=ejecucion.waitFor(20,TimeUnit.MINUTES);
        if (!termino) ejecucion.destroyForcibly();
        assertTrue(termino,"Tiempo máximo de campaña excedido");
        System.out.println(java.nio.file.Files.readString(Path.of("/tmp/metronet-recorrido-browser.log")));
        assertEquals(0,ejecucion.exitValue(),"Falló un recorrido real de navegador");
        assertEquals(10,jdbc.queryForObject("SELECT COUNT(*) FROM intento WHERE id_usuario=? AND estado='COMPLETADO' AND progreso=100",Integer.class,jugador));
        assertEquals(850,jdbc.queryForObject("SELECT SUM(puntaje) FROM intento WHERE id_usuario=? AND estado='COMPLETADO'",Integer.class,jugador));
        assertEquals(java.util.List.of(100,90,80,70,100,100,100,60,90,60),jdbc.queryForList(
            "SELECT i.puntaje FROM intento i JOIN escenario e USING(id_escenario) WHERE i.id_usuario=? AND i.estado='COMPLETADO' ORDER BY e.numero",Integer.class,jugador));
        assertTrue(jdbc.queryForObject("SELECT campana_completada_historicamente FROM usuario WHERE id_usuario=?",Boolean.class,jugador));
        assertTrue(jdbc.queryForObject("SELECT COUNT(*) FROM simulacion s JOIN intento i USING(id_intento) WHERE i.id_usuario=?",Integer.class,jugador)>=19);
    }
}
