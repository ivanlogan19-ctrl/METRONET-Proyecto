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
        var objetivosUnicos = new java.util.HashSet<Integer>();
        for (var publicada:publicaciones) {
            var version = borradores.versiones(publicada.numero()).getFirst();
            var reglas = version.contenido().path("reglasExito");
            var red = version.redReferencia();
            var geo = new GeografiaService(new com.fasterxml.jackson.databind.ObjectMapper());
            var estaciones = new java.util.HashMap<String,com.metronet.backend.utilidades.GeometriaTerritorial.Punto>();
            for (var e : red.path("estaciones")) estaciones.put(e.path("nombre").asText(),geo.coordenadaGeografica(e.path("x").decimalValue(),e.path("y").decimalValue()));
            var km = new java.util.HashMap<String,Double>();
            for (var t : red.path("tramos")) km.merge(t.path("linea").asText(),DistanciasRedService.kilometros(
                estaciones.get(t.path("a").asText()),estaciones.get(t.path("b").asText())),Double::sum);
            for (var ejecucion : red.path("ejecuciones")) {
                for (int i=0;i<red.path("unidades").size();i++) {
                    double longitud = km.get(red.path("unidades").get(i).path("linea").asText());
                    var calculo = VinculoUvUtLibre.calcular(longitud, ejecucion.path("unidades").get(i).path("uv").decimalValue(),
                        ejecucion.path("duracion").asDouble(), ejecucion.path("parametroReferencia").asText("UV"));
                    assertTrue(calculo.uv().doubleValue() * calculo.ut() + 1e-7 >= longitud,
                        "Nivel " + publicada.numero() + ": el cálculo proporcional completa el recorrido");
                }
            }
            var puntos = reglas.path("puntosInteresObjetivo");
            assertEquals(publicada.numero() < 6 ? 0 : 3, puntos.size());
            for (var punto : puntos) assertTrue(objetivosUnicos.add(punto.path("idPunto").asInt()), "POI repetido");
            assertNull(publicada.versionCriterioUvUt(),"El recorrido usa horas; los presupuestos UT históricos no se heredan");
            assertEquals(RecorridoIntegralService.VERSION,contenido.actual(publicada.numero()).desafio().path("recorrido").asText());
        }
        assertEquals(15, objetivosUnicos.size());
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

    @Test void adaptaLaConsignaActivaAnteriorSinTocarLaCampanaCompletada() throws Exception {
        int admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Actualización QA','actualizacion-qa@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        int otro=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Histórico QA','historia-qa@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        recorrido.publicar(admin);
        int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=4",Integer.class);
        // Fixture de la versión anterior, sin ejecutar sus reglas con el motor nuevo.
        jdbc.update("UPDATE nivel_publicacion SET contenido=jsonb_set(contenido,'{desafio,recorrido}',to_jsonb('integral-2026-10-objetivos-reales-km-v3'::text)) WHERE id_escenario=?",escenario);
        var completo=juego.iniciarEscenario(otro,escenario);
        jdbc.update("UPDATE intento SET estado='COMPLETADO',puntaje=80,fecha_finalizacion=now() WHERE id_intento=?",completo.idIntento());
        var historia=contenido.deIntento(completo.idIntento(),otro);
        var activo=juego.iniciarEscenario(admin,escenario);
        long versionAnterior=contenido.deIntento(activo.idIntento(),admin).idNivelPublicacion();
        recorrido.publicar(admin);
        assertEquals(historia,contenido.deIntento(completo.idIntento(),otro));
        assertEquals(80,jdbc.queryForObject("SELECT puntaje FROM intento WHERE id_intento=?",Integer.class,completo.idIntento()));
        assertNotEquals(versionAnterior,contenido.deIntento(activo.idIntento(),admin).idNivelPublicacion());
        assertEquals(RecorridoIntegralService.VERSION,contenido.deIntento(activo.idIntento(),admin).desafio().path("recorrido").asText());
        assertEquals(jdbc.queryForObject("SELECT reglas_exito::text FROM escenario WHERE id_escenario=?",String.class,escenario),
            jdbc.queryForObject("SELECT reglas_exito::text FROM intento_catalogo_v1 WHERE id_intento=?",String.class,activo.idIntento()));
        assertTrue(recorrido.publicar(admin).isEmpty());
    }

    @Test void noPublicaConUnaCuentaJugador() {
        int jugador=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('QA Jugador','recorrido-jugador@example.test','!sin-acceso','JUGADOR') RETURNING id_usuario",Integer.class);
        var rechazo=assertThrows(org.springframework.web.server.ResponseStatusException.class,()->recorrido.publicar(jugador));
        assertEquals(403,rechazo.getStatusCode().value());
        var rechazoRelatos=assertThrows(org.springframework.web.server.ResponseStatusException.class,()->recorrido.publicarRelatos(jugador));
        assertEquals(403,rechazoRelatos.getStatusCode().value());
    }

    @Test void actualizarRelatosConservaReglasReferenciasTarjetasEIntentos() throws Exception {
        int admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Relatos QA','relatos-qa@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        recorrido.publicar(admin);
        // Recrea publicaciones anteriores a la revisión editorial, sin tocar sus reglas.
        jdbc.update("""
            UPDATE nivel_publicacion SET contenido=jsonb_set(contenido,'{desafio,relato}','"Relato anterior"'::jsonb)
            WHERE id_nivel_publicacion IN (SELECT MAX(id_nivel_publicacion) FROM nivel_publicacion GROUP BY id_escenario)
            """);
        var anteriores=new java.util.ArrayList<AdministracionNivelesService.Version>();
        for(int numero=1;numero<=10;numero++) {
            var version=borradores.versiones(numero).getFirst();
            anteriores.add(version);
            borradores.prepararReversion(numero,version.version(),admin);
        }
        int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1",Integer.class);
        var intento=juego.iniciarEscenario(admin,escenario);
        var historia=contenido.deIntento(intento.idIntento(),admin);
        assertEquals(10,recorrido.publicarRelatos(admin).size());
        for(int numero=1;numero<=10;numero++) {
            var antes=anteriores.get(numero-1);
            var despues=borradores.versiones(numero).getFirst();
            assertEquals(antes.version()+1,despues.version());
            assertEquals(antes.redReferencia(),despues.redReferencia());
            assertEquals(antes.tarjetas(),despues.tarjetas());
            var esperado=antes.contenido().deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode)esperado).set("desafio",despues.contenido().path("desafio"));
            assertEquals(esperado,despues.contenido(),"La edición no altera reglas, ayudas ni herramientas");
            for(String campo:java.util.List.of("objetivo","instrucciones","nombre","recorrido","dificultad"))
                assertEquals(antes.contenido().path("desafio").path(campo),despues.contenido().path("desafio").path(campo));
            assertEquals(antes,borradores.versiones(numero).get(1),"La publicación anterior permanece intacta");
        }
        assertEquals(historia,contenido.deIntento(intento.idIntento(),admin),"Una revisión editorial no reinterpreta una partida");
        assertTrue(recorrido.publicarRelatos(admin).isEmpty(),"Repetir la operación no crea versiones duplicadas");
    }

    @Test void actualizarRelatosNoDescartaBorradoresPendientes() throws Exception {
        int admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Borrador QA','borrador-relato@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        recorrido.publicar(admin);
        jdbc.update("UPDATE nivel_publicacion SET contenido=jsonb_set(contenido,'{desafio,relato}','\"Relato anterior\"'::jsonb)");
        var borrador=borradores.borrador(1);
        var versiones=borradores.versiones(1);
        assertThrows(IllegalStateException.class,()->recorrido.publicarRelatos(admin));
        assertEquals(borrador,borradores.borrador(1));
        assertEquals(versiones,borradores.versiones(1));
    }
}
