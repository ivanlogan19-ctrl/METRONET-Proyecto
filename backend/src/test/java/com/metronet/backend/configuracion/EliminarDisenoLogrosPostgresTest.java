package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.repository.*;
import com.metronet.backend.service.*;
import java.sql.DriverManager;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/** Regresión sobre el esquema real del clúster descartable, sin datos del jugador. */
@EnabledIfEnvironmentVariable(named = "METRONET_TEST_POSTGRES_URL",
    matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class EliminarDisenoLogrosPostgresTest {
    @Test
    void borrarLosDiezDisenosConservaIntentosResultadosRankingYDesbloqueos() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv("METRONET_TEST_POSTGRES_USER"), System.getenv("METRONET_TEST_POSTGRES_PASSWORD"))) {
            conexion.setAutoCommit(false);
            try {
                var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
                var mapper = new ObjectMapper();
                var geo = new GeografiaService(mapper);
                var restricciones = new RestriccionesGeograficasService(new RestriccionesGeograficasRepository(jdbc), mapper, geo);
                var juego = ServiciosPrueba.crearJuegoEducativo(jdbc, mapper, new ObjetivosPuntosInteresService(mapper, geo),
                    new CondicionesGeograficasService(new CondicionesGeograficasRepository(jdbc), mapper, geo, restricciones));
                var administracion = new DisenoAdministracionService(new DisenoAdministracionRepository(jdbc), restricciones, new com.metronet.backend.repository.ConexionesLineasRepository(jdbc));
                var puntuacion = ServiciosPrueba.crearPuntuacion(jdbc, mapper);
                int usuario = jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol,campana_completada_historicamente)
                    VALUES ('Prueba logros','logros@example.invalid','!sin-acceso','JUGADOR',TRUE) RETURNING id_usuario
                    """, Integer.class);
                var disenos = new ArrayList<Integer>();
                for (int numero = 1; numero <= 10; numero++) {
                    int diseno = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
                    disenos.add(diseno);
                    int intento = jdbc.queryForObject("""
                        INSERT INTO intento(id_usuario,id_escenario,id_diseno,estado,puntaje,progreso)
                        SELECT ?,id_escenario,?,'COMPLETADO',?,100 FROM escenario
                        WHERE progresivo=TRUE AND modo='NIVEL' AND numero=? RETURNING id_intento
                        """, Integer.class, usuario, diseno, 60 + numero, numero);
                    int simulacion = jdbc.queryForObject("""
                        INSERT INTO simulacion(id_intento,velocidad,duracion,puntaje,comentarios)
                        VALUES (?,1,2,?,'Resultado conservado') RETURNING id_simulacion
                        """, Integer.class, intento, 60 + numero);
                    jdbc.update("""
                        INSERT INTO resultado_uv_ut(id_simulacion,version,huella_problema,huella_ejecucion,
                            limite_ut,presupuesto_uv,ut_ejecutadas,suma_uv,completo,unidades)
                        VALUES (?,2,'problema','ejecucion',2,3,2,1,TRUE,'[]')
                        """, simulacion);
                    jdbc.update("INSERT INTO estacion(id_diseno,nombre,posicion_x,posicion_y) VALUES (?,'A',500,400)", diseno);
                }
                var progreso = juego.obtenerResumenProgreso(usuario);
                var ranking = puntuacion.ranking(usuario);
                var trofeos = new TrofeosService(new TrofeosRepository(jdbc), puntuacion);
                var premios = trofeos.consultar(usuario);
                var intentos = jdbc.queryForList("SELECT to_jsonb(i)-'id_diseno' AS datos FROM intento i WHERE id_usuario=? ORDER BY id_intento", usuario);
                var resultados = jdbc.queryForList("SELECT to_jsonb(s) AS datos, to_jsonb(r) AS criterio FROM simulacion s JOIN intento i USING(id_intento) JOIN resultado_uv_ut r USING(id_simulacion) WHERE i.id_usuario=? ORDER BY id_simulacion", usuario);
                for (int diseno : disenos) administracion.eliminarDiseno(diseno);
                assertEquals(intentos, jdbc.queryForList("SELECT to_jsonb(i)-'id_diseno' AS datos FROM intento i WHERE id_usuario=? ORDER BY id_intento", usuario));
                assertEquals(resultados, jdbc.queryForList("SELECT to_jsonb(s) AS datos, to_jsonb(r) AS criterio FROM simulacion s JOIN intento i USING(id_intento) JOIN resultado_uv_ut r USING(id_simulacion) WHERE i.id_usuario=? ORDER BY id_simulacion", usuario));
                assertEquals(10, jdbc.queryForObject("SELECT count(*) FROM intento WHERE id_usuario=? AND id_diseno IS NULL", Integer.class, usuario));
                assertEquals(progreso, juego.obtenerResumenProgreso(usuario));
                assertEquals(ranking, puntuacion.ranking(usuario));
                assertEquals(premios, trofeos.consultar(usuario));
                assertTrue(new SimulacionRepository(jdbc).listarSimulaciones((r, f) -> r.getInt("id_diseno"), usuario).isEmpty());
                for (int numero = 1; numero <= 10; numero++) assertTrue(juego.puedeConsultarContenidoActual(usuario, numero));
                for (int diseno : disenos) {
                    assertFalse(new DisenoAdministracionRepository(jdbc).existeDiseno(diseno));
                    assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM estacion WHERE id_diseno=?", Integer.class, diseno));
                }
                int escenario = progreso.escenarios().getFirst().idEscenario();
                var repeticion = juego.volverAJugar(usuario, escenario);
                assertNotNull(repeticion.idDiseno());
                assertFalse(disenos.contains(repeticion.idDiseno()));
                assertEquals(10, juego.obtenerResumenProgreso(usuario).nivelesCompletados());
                var reinicio = juego.reiniciarRecorrido(usuario, 1);
                assertEquals(2, reinicio.numeroCampanaActual());
                assertTrue(reinicio.modoLibreDesbloqueado());
                assertEquals(ranking, puntuacion.ranking(usuario));
                assertEquals(premios, trofeos.consultar(usuario));
            } finally {
                conexion.rollback();
            }
        }
    }

    @Test
    void noConservaPartidasSinCompletarNiModoLibreYRechazaIntentosActivosSinRed() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv("METRONET_TEST_POSTGRES_USER"), System.getenv("METRONET_TEST_POSTGRES_PASSWORD"))) {
            conexion.setAutoCommit(false);
            try {
                var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
                int usuario = jdbc.queryForObject("SELECT min(id_usuario) FROM usuario", Integer.class);
                for (boolean libre : new boolean[]{false, true}) {
                    int escenario = libre ? jdbc.queryForObject("INSERT INTO escenario(nombre,modo) VALUES ('Libre temporal','EDICION_LIBRE') RETURNING id_escenario", Integer.class)
                        : jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND numero=1", Integer.class);
                    int diseno = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
                    int intento = jdbc.queryForObject("INSERT INTO intento(id_usuario,id_escenario,id_diseno,estado) VALUES (?,?,?,?) RETURNING id_intento", Integer.class,
                        usuario, escenario, diseno, libre ? "COMPLETADO" : "EN_DESARROLLO");
                    jdbc.update("INSERT INTO simulacion(id_intento) VALUES (?)", intento);
                    if (!libre) {
                        var punto = conexion.setSavepoint();
                        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                            () -> jdbc.update("UPDATE intento SET id_diseno=NULL WHERE id_intento=?", intento));
                        conexion.rollback(punto);
                    }
                    new DisenoAdministracionService(new DisenoAdministracionRepository(jdbc), null, new com.metronet.backend.repository.ConexionesLineasRepository(jdbc)).eliminarDiseno(diseno);
                    assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM intento WHERE id_intento=?", Integer.class, intento));
                    assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM simulacion WHERE id_intento=?", Integer.class, intento));
                    if (libre) assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM escenario WHERE id_escenario=?", Integer.class, escenario));
                }
            } finally { conexion.rollback(); }
        }
    }
}
