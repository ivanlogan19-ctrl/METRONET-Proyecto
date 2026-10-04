package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.*;
import java.sql.DriverManager;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/** Reproduce un intento V1 abierto antes de editar el catálogo; todo se revierte. */
@EnabledIfEnvironmentVariable(named = "METRONET_TEST_POSTGRES_URL", matches = "jdbc:postgresql:.*")
class CatalogoV1PostgresTest {
    @Test
    void intentoV1ConservaReglasTextosYHerramientasTrasEditarCatalogo() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            try {
                var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
                int usuarioId = jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol)
                    VALUES ('Prueba V1',?,'!acceso-inhabilitado','JUGADOR') RETURNING id_usuario
                    """, Integer.class, UUID.randomUUID() + "@example.invalid");
                int escenarioId = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND numero=1", Integer.class);
                int disenoId = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
                int intentoId = jdbc.queryForObject("""
                    INSERT INTO intento(id_usuario,id_escenario,id_diseno,estado,progreso)
                    VALUES (?,?,?,'EN_DESARROLLO',0) RETURNING id_intento
                    """, Integer.class, usuarioId, escenarioId, disenoId);
                assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM intento_catalogo_v1 WHERE id_intento=?", Integer.class, intentoId),
                    "El disparador congela los intentos nuevos");
                // Recrea el estado de un intento previo a 017 y ejecuta el backfill real de la migración.
                jdbc.update("DELETE FROM intento_catalogo_v1 WHERE id_intento=?", intentoId);
                jdbc.update("UPDATE escenario SET objetivo='Objetivo conocido al corte' WHERE id_escenario=?", escenarioId);
                String migracion = Files.readString(Path.of("../database/017_criterio_uv_ut_v2.sql"));
                int inicio = migracion.indexOf("INSERT INTO intento_catalogo_v1(id_intento,reglas_exito,herramientas_habilitadas,objetivo,instrucciones)");
                int fin = migracion.indexOf("ON CONFLICT (id_intento) DO NOTHING;", inicio);
                assertTrue(inicio >= 0 && fin > inicio);
                jdbc.execute(migracion.substring(inicio, fin + "ON CONFLICT (id_intento) DO NOTHING;".length()));
                var anterior = jdbc.queryForMap("""
                    SELECT reglas_exito::text reglas,herramientas_habilitadas::text herramientas,objetivo,instrucciones
                    FROM intento_catalogo_v1 WHERE id_intento=?
                    """, intentoId);
                assertEquals("Objetivo conocido al corte", anterior.get("objetivo"));
                assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM intento_uv_ut WHERE id_intento=?", Integer.class, intentoId));

                jdbc.update("""
                    UPDATE escenario SET reglas_exito='{"minimoEstaciones":9}'::jsonb,
                      herramientas_habilitadas='{"estaciones":false}'::jsonb,
                      objetivo='Objetivo posterior',instrucciones='Instrucciones posteriores'
                    WHERE id_escenario=?
                    """, escenarioId);
                assertEquals(anterior.get("reglas"), jdbc.queryForObject(
                    "SELECT reglas_exito::text FROM intento_catalogo_v1 WHERE id_intento=?", String.class, intentoId));

                var mapper = new ObjectMapper();
                var geografia = new GeografiaService(mapper);
                var restricciones = new RestriccionesGeograficasService(jdbc, mapper, geografia);
                var objetivos = new ObjetivosPuntosInteresService(mapper, geografia);
                var juego = new JuegoEducativoService(jdbc, mapper, objetivos,
                    new CondicionesGeograficasService(jdbc, mapper, geografia, restricciones));
                var usuario = new Usuario(); usuario.setIdUsuario(usuarioId); usuario.setRol(Rol.JUGADOR);
                var consigna = juego.obtenerConsigna(usuario, disenoId);
                assertTrue(consigna.condiciones().stream().anyMatch(c -> c.clave().equals("minimoEstaciones") && c.requerido() == 2));
                var nivel = juego.obtenerResumenProgreso(usuarioId).escenarios().stream()
                    .filter(e -> e.idEscenario().equals(escenarioId)).findFirst().orElseThrow();
                assertEquals(anterior.get("objetivo"), nivel.objetivo());
                assertEquals(anterior.get("instrucciones"), nivel.instrucciones());
                assertTrue(nivel.herramientasHabilitadas().get("estaciones"));
                var simulaciones = new SimulacionService(jdbc, mock(DisenoAdministracionService.class), objetivos, juego, restricciones);
                var resumen = simulaciones.listarSimulaciones(usuarioId).stream()
                    .filter(s -> s.idDiseno().equals(disenoId)).findFirst().orElseThrow();
                assertEquals(anterior.get("objetivo"), resumen.objetivo());
                assertEquals(anterior.get("instrucciones"), resumen.instrucciones());

                int libreId = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='EDICION_LIBRE' LIMIT 1", Integer.class);
                int disenoLibre = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
                int intentoLibre = jdbc.queryForObject("""
                    INSERT INTO intento(id_usuario,id_escenario,id_diseno,estado,progreso)
                    VALUES (?,?,?,'EN_DESARROLLO',0) RETURNING id_intento
                    """, Integer.class, usuarioId, libreId, disenoLibre);
                assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM intento_catalogo_v1 WHERE id_intento=?", Integer.class, intentoLibre),
                    "Modo Libre no se congela como nivel");
                jdbc.update("UPDATE escenario SET instrucciones='Modo Libre editable' WHERE id_escenario=?", libreId);
                assertEquals("Modo Libre editable", simulaciones.listarSimulaciones(usuarioId).stream()
                    .filter(s -> s.idDiseno().equals(disenoLibre)).findFirst().orElseThrow().instrucciones());
            } finally { conexion.rollback(); }
        }
    }
}
