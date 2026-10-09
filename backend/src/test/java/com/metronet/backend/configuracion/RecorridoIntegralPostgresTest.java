package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.service.*;
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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class RecorridoIntegralPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username",()->System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password",()->System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto",()->"validate");
    }
    @Autowired RecorridoIntegralService recorrido;
    @Autowired JdbcTemplate jdbc;
    @Autowired JuegoEducativoService juego;
    @Autowired ContenidoPublicadoNivelService contenido;
    @Autowired CriterioUvUtService criterios;
    @MockitoBean ServicioCorreo correo;
    @Autowired AdministracionNivelesService borradores;
    @Autowired PublicacionNivelService publicador;

    @Test void publicaDiezReferenciasViablesSinReinterpretarIntentosNiCrearProgreso() throws Exception {
        int admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('QA Recorrido','recorrido-qa@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1",Integer.class);
        var anterior=juego.iniciarEscenario(admin,escenario);
        var historia=contenido.deIntento(anterior.idIntento(),admin);
        int intentos=jdbc.queryForObject("SELECT COUNT(*) FROM intento",Integer.class);
        int ejecuciones=jdbc.queryForObject("SELECT COUNT(*) FROM simulacion",Integer.class);
        var publicaciones=recorrido.publicar(admin);
        assertEquals(10,publicaciones.size());
        assertEquals(PoliticaPuntuacion.VERSION,
            new com.fasterxml.jackson.databind.ObjectMapper().readTree(jdbc.queryForObject(
                "SELECT reglas_exito::text FROM escenario WHERE progresivo AND numero=1",String.class))
                .path("puntuacion").path("version").asText());
        for (var publicada:publicaciones) {
            assertNull(publicada.versionCriterioUvUt(),"El recorrido usa horas; los presupuestos UT históricos no se heredan");
            assertEquals(RecorridoIntegralService.VERSION,contenido.actual(publicada.numero()).desafio().path("recorrido").asText());
        }
        assertEquals(historia,contenido.deIntento(anterior.idIntento(),admin));
        assertEquals(intentos,jdbc.queryForObject("SELECT COUNT(*) FROM intento",Integer.class));
        assertEquals(ejecuciones,jdbc.queryForObject("SELECT COUNT(*) FROM simulacion",Integer.class));
        assertTrue(recorrido.publicar(admin).isEmpty(),"La publicación explícita es idempotente");
        int escenario4=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=4",Integer.class);
        var nuevo=juego.iniciarEscenario(admin,escenario4);
        assertNull(criterios.configuracionIntento(nuevo.idIntento()));
        assertFalse(criterios.presentacion(null,escenario4,"objetivo","horas","{}").instrucciones().contains("máximo"));
        var nivel4=juego.obtenerResumenProgreso(admin).escenarios().stream().filter(n->Integer.valueOf(4).equals(n.numero())).findFirst().orElseThrow();
        assertEquals(1,nivel4.cantidadIntentosCampana());
        assertEquals(RecorridoIntegralService.VERSION,nivel4.recorrido());
        assertNotNull(nivel4.relato());
        assertFalse(juego.iniciarEscenario(admin,escenario4).mostrarTutorial(),"Reingresar conserva el intento y no repite la introducción");
        var reinicio=juego.reiniciarRecorrido(admin,nuevo.numeroCampana());
        assertEquals(0,reinicio.escenarios().stream().filter(n->Integer.valueOf(4).equals(n.numero())).findFirst().orElseThrow().cantidadIntentosCampana());
        assertTrue(juego.iniciarEscenario(admin,escenario4).mostrarTutorial(),"Una campaña nueva vuelve a ofrecer la introducción");
        assertEquals(historia,contenido.deIntento(anterior.idIntento(),admin),"Reiniciar no reescribe el contenido histórico");
    }

    @Test void adoptaSoloPuntuacionSobreElRecorridoExistenteYConservaElIntentoAnterior() throws Exception {
        int admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('QA Anterior','anterior-puntos@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        recorrido.publicar(admin);
        var actual=borradores.versiones(1).getFirst();
        var historico=borradores.prepararReversion(1,2,admin);
        com.fasterxml.jackson.databind.node.ObjectNode reglas=actual.contenido().path("reglasExito").deepCopy();
        reglas.set("puntuacion",historico.contenido().path("reglasExito").path("puntuacion"));
        var c=actual.contenido();
        var guardado=borradores.guardar(1,new com.metronet.backend.dto.EdicionNivelRequest(historico.versionBase(),historico.revision(),
            c.path("desafio"),reglas,c.path("herramientasHabilitadas"),c.path("criterioUvUt"),
            actual.redReferencia(),c.path("ayudas"),actual.tarjetas()),admin);
        var vista=publicador.previsualizar(1,admin);
        publicador.publicar(1,new com.metronet.backend.dto.PublicarNivelRequest(guardado.versionBase(),guardado.revision(),vista.diagnostico().huella(),true),admin);
        int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1",Integer.class);
        var intento=juego.iniciarEscenario(admin,escenario);
        var contenidoAnterior=contenido.deIntento(intento.idIntento(),admin);
        assertNull(juego.obtenerDesempeno(admin,intento.idDiseno()).desglosePuntuacion());
        assertEquals(1,recorrido.publicar(admin).size());
        assertEquals(contenidoAnterior,contenido.deIntento(intento.idIntento(),admin));
        assertNull(juego.obtenerDesempeno(admin,intento.idDiseno()).desglosePuntuacion());
        var nueva=borradores.versiones(1).getFirst();
        assertEquals(actual.redReferencia(),nueva.redReferencia());
        assertEquals(actual.tarjetas(),nueva.tarjetas());
        assertEquals(c.path("desafio"),nueva.contenido().path("desafio"));
        assertTrue(recorrido.publicar(admin).isEmpty());
    }

    @Test void noPublicaConUnaCuentaJugador() {
        int jugador=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('QA Jugador','recorrido-jugador@example.test','!sin-acceso','JUGADOR') RETURNING id_usuario",Integer.class);
        var rechazo=assertThrows(org.springframework.web.server.ResponseStatusException.class,()->recorrido.publicar(jugador));
        assertEquals(403,rechazo.getStatusCode().value());
    }
}
