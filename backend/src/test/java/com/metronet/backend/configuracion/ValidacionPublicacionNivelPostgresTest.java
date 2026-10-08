package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.EdicionNivelRequest;
import com.metronet.backend.dto.PublicarNivelRequest;
import com.metronet.backend.service.*;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/** El ensayo llama al evaluador del jugador y revierte sus filas transitorias. */
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql:.*")
class ValidacionPublicacionNivelPostgresTest {
    @Test
    void redInicialViableNoDejaPartidaNiResultado() throws Exception {
        try (var conexion=DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER","postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD",""))) {
            conexion.setAutoCommit(false);
            try {
                var datos=new SingleConnectionDataSource(conexion,true);
                var jdbc=new JdbcTemplate(datos);
                var mapper=new ObjectMapper();
                var geo=new GeografiaService(mapper);
                var restricciones=new RestriccionesGeograficasService(jdbc,mapper,geo);
                var objetivos=new ObjetivosPuntosInteresService(mapper,geo);
                var condiciones=new CondicionesGeograficasService(jdbc,mapper,geo,restricciones);
                var juego=new JuegoEducativoService(jdbc,mapper,objetivos,condiciones);
                var simulaciones=new SimulacionService(jdbc,org.mockito.Mockito.mock(DisenoAdministracionService.class),
                    objetivos,juego,restricciones);
                var validador=new ValidacionPublicacionNivelService(jdbc,datos,mapper,juego,simulaciones);
                int admin=jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol) VALUES
                      ('Admin Referencia','admin-referencia-qa@local.test','hash-de-prueba','ADMIN') RETURNING id_usuario
                    """,Integer.class);
                int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=1",Integer.class);
                var contenido=mapper.readTree(jdbc.queryForObject("""
                    SELECT contenido::text FROM nivel_publicacion WHERE id_escenario=? AND numero_version=1
                    """,String.class,escenario));
                // La publicación V1 histórica conserva esta regla retirada; el ensayo
                // de una nueva publicación usa las reglas que acepta el motor actual.
                ((ObjectNode)contenido.path("reglasExito")).remove("requiereRedValida");
                var tarjetas=mapper.readTree(jdbc.queryForObject("SELECT tarjetas::text FROM nivel_borrador WHERE id_escenario=?",String.class,escenario));
                ObjectNode red=(ObjectNode)mapper.readTree("""
                    {"estaciones":[{"nombre":"A","x":660,"y":460},{"nombre":"B","x":665,"y":460}],
                     "lineas":[{"nombre":"Principal"}],"tramos":[{"linea":"Principal","a":"A","b":"B"}],
                     "unidades":[],"ejecuciones":[]}
                    """);
                int intentos=jdbc.queryForObject("SELECT COUNT(*) FROM intento",Integer.class);
                int disenos=jdbc.queryForObject("SELECT COUNT(*) FROM diseno",Integer.class);
                int simulacionesPrevias=jdbc.queryForObject("SELECT COUNT(*) FROM simulacion",Integer.class);
                var resultado=validador.validar(escenario,admin,contenido,red,tarjetas);
                assertTrue(resultado.viable(),resultado.mensaje());
                assertFalse(contenido.path("herramientasHabilitadas").path("conexiones").asBoolean(),
                    "Una línea inicial con un tramo se crea sin habilitar Conexiones");
                assertEquals(intentos,jdbc.queryForObject("SELECT COUNT(*) FROM intento",Integer.class));
                assertEquals(disenos,jdbc.queryForObject("SELECT COUNT(*) FROM diseno",Integer.class));
                assertEquals(simulacionesPrevias,jdbc.queryForObject("SELECT COUNT(*) FROM simulacion",Integer.class));
                assertEquals(64,resultado.huella().length());

                int escenario4=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=4",Integer.class);
                var contenido4=mapper.readTree(jdbc.queryForObject("""
                    SELECT contenido::text FROM nivel_publicacion WHERE id_escenario=? AND numero_version=1
                    """,String.class,escenario4));
                ((ObjectNode)contenido4.path("reglasExito")).remove("requiereRedValida");
                ((ObjectNode)contenido4.path("reglasExito")).remove("requiereCoberturaPuntosInteres");
                var tarjetas4=mapper.readTree(jdbc.queryForObject("SELECT tarjetas::text FROM nivel_borrador WHERE id_escenario=?",String.class,escenario4));
                var puntos=contenido4.path("reglasExito").path("puntosInteresObjetivo");
                var puntoA=geo.resolverPunto(puntos.get(0).path("idPunto").asInt(),null);
                var puntoB=geo.resolverPunto(puntos.get(1).path("idPunto").asInt(),null);
                var red4=mapper.readTree("""
                    {"estaciones":[{"nombre":"A","x":%s,"y":%s},{"nombre":"B","x":%s,"y":%s},
                      {"nombre":"C","x":660,"y":460}],"lineas":[{"nombre":"Principal"}],
                     "tramos":[{"linea":"Principal","a":"A","b":"B"},{"linea":"Principal","a":"B","b":"C"}],
                     "unidades":[{"linea":"Principal","capacidad":300,"uv":1}],"ejecuciones":[]}
                    """.formatted(geo.posicionX(puntoA),geo.posicionY(puntoA),
                      geo.posicionX(puntoB),geo.posicionY(puntoB)));
                var sinEjecuciones=validador.validar(escenario4,admin,contenido4,red4,tarjetas4);
                assertFalse(sinEjecuciones.viable(),"Sin ejecución no se acredita simulación ni UV/UT");
                assertTrue(sinEjecuciones.condiciones().stream().anyMatch(c -> !c.completado()
                    && (c.clave().equals("simulacionActual") || c.clave().equals("criterioUvUt"))));
                ((ObjectNode)red4).set("ejecuciones",mapper.readTree("""
                    [{"duracion":2,"velocidad":1,"unidades":[{"uv":0.5}]},
                     {"duracion":2,"velocidad":1,"unidades":[{"uv":1}]}]
                    """));
                var conEjecuciones=validador.validar(escenario4,admin,contenido4,red4,tarjetas4);
                assertTrue(conEjecuciones.viable(),conEjecuciones.mensaje());
                for (String herramienta : new String[]{"estaciones","lineas","conexiones","metros","simulacion"}) {
                    ObjectNode bloqueado=contenido4.deepCopy();
                    ((ObjectNode)bloqueado.path("herramientasHabilitadas")).put(herramienta,false);
                    var imposible=validador.validar(escenario4,admin,bloqueado,red4,tarjetas4);
                    assertFalse(imposible.viable(),"La referencia requiere " + herramienta);
                    assertTrue(imposible.mensaje().contains("herramientas deshabilitadas"));
                }
                assertEquals(intentos,jdbc.queryForObject("SELECT COUNT(*) FROM intento",Integer.class));
                assertEquals(simulacionesPrevias,jdbc.queryForObject("SELECT COUNT(*) FROM simulacion",Integer.class));
                var borradores=new AdministracionNivelesService(jdbc,mapper);
                var publicador=new PublicacionNivelService(jdbc,borradores,validador,mapper);
                ObjectNode contenidoImposible=contenido.deepCopy();
                ((ObjectNode)contenidoImposible.path("herramientasHabilitadas")).put("estaciones",false);
                var borradorImposible=borradores.borrador(1);
                var guardadoImposible=borradores.guardar(1,new EdicionNivelRequest(
                    borradorImposible.versionBase(),borradorImposible.revision(),
                    contenidoImposible.path("desafio"),contenidoImposible.path("reglasExito"),
                    contenidoImposible.path("herramientasHabilitadas"),contenidoImposible.path("criterioUvUt"),
                    red,contenidoImposible.path("ayudas"),tarjetas),admin);
                var vistaImposible=publicador.previsualizar(1,admin);
                assertFalse(vistaImposible.diagnostico().viable());
                assertTrue(vistaImposible.diagnostico().mensaje().contains("Estaciones"));
                var rechazoImposible=assertThrows(org.springframework.web.server.ResponseStatusException.class,
                    ()->publicador.publicar(1,new PublicarNivelRequest(vistaImposible.versionPublicada(),
                        guardadoImposible.revision(),vistaImposible.diagnostico().huella(),true),admin));
                assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST,rechazoImposible.getStatusCode());
                var borrador4=borradores.borrador(4);
                var criterio4=contenido4.path("criterioUvUt");
                borradores.guardar(4,new EdicionNivelRequest(borrador4.versionBase(),borrador4.revision(),
                    contenido4.path("desafio"),contenido4.path("reglasExito"),
                    contenido4.path("herramientasHabilitadas"),criterio4,red4,contenido4.path("ayudas"),tarjetas4),admin);
                var publicadoUvUt=publicador.publicarCriterioUvUt(4,new AdministracionUvUtService.Cambio(
                    criterio4.path("limiteUt").asInt(),criterio4.path("presupuestoUv").decimalValue(),1),admin);
                assertEquals(3,publicadoUvUt.version());
                assertEquals(2,publicadoUvUt.versionCriterioUvUt());
                assertEquals(3,lectorVersion(jdbc,4));
                int jugador=jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol) VALUES
                      ('Jugador QA','jugador-version-qa@local.test','hash-de-prueba','JUGADOR') RETURNING id_usuario
                    """,Integer.class);
                var intentoAnterior=juego.iniciarEscenario(jugador,escenario);
                var lector=new ContenidoPublicadoNivelService(jdbc,mapper);
                assertEquals(2,lector.deIntento(intentoAnterior.idIntento(),jugador).version());
                var previo=borradores.borrador(1);
                ((ObjectNode)contenido.path("desafio")).put("objetivo","Conectá dos estaciones con una línea revisada.");
                var edicion=new EdicionNivelRequest(previo.versionBase(),previo.revision(),
                    contenido.path("desafio"),contenido.path("reglasExito"),contenido.path("herramientasHabilitadas"),
                    contenido.path("criterioUvUt"),red,contenido.path("ayudas"),tarjetas);
                var guardado=borradores.guardar(1,edicion,admin);
                var vista=publicador.previsualizar(1,admin);
                assertTrue(vista.diagnostico().viable(),vista.diagnostico().mensaje());
                jdbc.update("""
                    UPDATE nivel_borrador SET tarjetas=jsonb_set(tarjetas,'{0,urlFuente}',to_jsonb(CAST(? AS text)))
                    WHERE id_escenario=?
                    ""","https:foo",escenario);
                var previewConFuenteInvalida=assertThrows(org.springframework.web.server.ResponseStatusException.class,
                    ()->publicador.previsualizar(1,admin));
                assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST,previewConFuenteInvalida.getStatusCode());
                var publicacionConFuenteInvalida=assertThrows(org.springframework.web.server.ResponseStatusException.class,
                    ()->publicador.publicar(1,new PublicarNivelRequest(vista.versionPublicada(),
                        guardado.revision(),vista.diagnostico().huella(),true),admin));
                assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST,publicacionConFuenteInvalida.getStatusCode());
                jdbc.update("UPDATE nivel_borrador SET tarjetas=CAST(? AS jsonb) WHERE id_escenario=?",
                    tarjetas.toString(),escenario);
                var publicado=publicador.publicar(1,new PublicarNivelRequest(vista.versionPublicada(),
                    guardado.revision(),vista.diagnostico().huella(),true),admin);
                assertEquals(3,publicado.version());
                var reversionInicial=borradores.prepararReversion(1,1,admin);
                assertEquals(3,reversionInicial.versionBase());
                assertEquals(2,reversionInicial.redReferencia().path("estaciones").size(),
                    "La versión inicial sin referencia usa una red publicada, no una red vacía");
                var vistaReversion=publicador.previsualizar(1,admin);
                assertTrue(vistaReversion.diagnostico().viable(),vistaReversion.diagnostico().mensaje());
                assertEquals(3,lectorVersion(jdbc,1),"Preparar reversión no publica ni borra versiones");
                assertEquals(2,lector.deIntento(intentoAnterior.idIntento(),jugador).version());
                assertEquals(3,lector.actual(1).version());
                assertNotEquals(lector.actual(1).desafio().path("objetivo").asText(),
                    lector.deIntento(intentoAnterior.idIntento(),jugador).desafio().path("objetivo").asText());
                jdbc.update("UPDATE intento SET estado='COMPLETADO',progreso=100,puntaje=100 WHERE id_intento=?",
                    intentoAnterior.idIntento());
                var intentoNuevo=juego.volverAJugar(jugador,escenario,publicado.version());
                assertEquals(publicado.version(),lector.deIntento(intentoNuevo.idIntento(),jugador).version());
                assertEquals(publicado.version(),jdbc.queryForObject("""
                    SELECT p.numero_version FROM intento i JOIN nivel_publicacion p ON p.id_nivel_publicacion=i.id_nivel_publicacion
                    WHERE i.id_intento=?
                    """,Integer.class,intentoNuevo.idIntento()));
                int jugadorNuevo=jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol) VALUES
                      ('Jugador nuevo QA','jugador-nuevo-version-qa@local.test','hash-de-prueba','JUGADOR') RETURNING id_usuario
                    """,Integer.class);
                var preparacionObsoleta=assertThrows(org.springframework.web.server.ResponseStatusException.class,
                    ()->juego.iniciarEscenario(jugadorNuevo,escenario,1));
                assertEquals(org.springframework.http.HttpStatus.CONFLICT,preparacionObsoleta.getStatusCode());
                assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM intento WHERE id_usuario=?",Integer.class,jugadorNuevo));
                assertEquals(7,jdbc.queryForObject("""
                    SELECT COUNT(*) FROM nivel_publicacion_tarjeta t JOIN nivel_publicacion p USING(id_nivel_publicacion)
                    WHERE p.id_escenario=? AND p.numero_version=3
                    """,Integer.class,escenario));
                assertEquals(intentos+2,jdbc.queryForObject("SELECT COUNT(*) FROM intento",Integer.class));
                assertEquals(simulacionesPrevias,jdbc.queryForObject("SELECT COUNT(*) FROM simulacion",Integer.class));
                var conflicto=assertThrows(org.springframework.web.server.ResponseStatusException.class,
                    ()->publicador.publicar(1,new PublicarNivelRequest(vista.versionPublicada(),
                        guardado.revision(),vista.diagnostico().huella(),true),admin));
                assertEquals(org.springframework.http.HttpStatus.CONFLICT,conflicto.getStatusCode());
            } finally { conexion.rollback(); }
        }
    }

    private int lectorVersion(JdbcTemplate jdbc,int numero) {
        return jdbc.queryForObject("""
            SELECT MAX(p.numero_version) FROM nivel_publicacion p JOIN escenario e USING(id_escenario)
            WHERE e.numero=? AND e.progresivo=TRUE
            """,Integer.class,numero);
    }
}
