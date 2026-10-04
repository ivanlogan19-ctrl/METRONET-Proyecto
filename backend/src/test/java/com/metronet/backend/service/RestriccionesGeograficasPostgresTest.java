package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.*;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.web.server.ResponseStatusException;

/** Prueba optativa sobre un esquema existente: no crea tablas, no usa secuencias y revierte todas las escrituras. */
@EnabledIfEnvironmentVariable(named = "METRONET_TEST_POSTGRES_URL", matches = "jdbc:postgresql:.*")
class RestriccionesGeograficasPostgresTest {
    @Test
    void guardaRecuperaYRechazaFueraDelTerritorioEnPostgresConRollback() throws Exception {
        String url = System.getenv("METRONET_TEST_POSTGRES_URL");
        String usuario = System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres");
        String clave = System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", "");
        int id = -ThreadLocalRandom.current().nextInt(100_000, 1_000_000_000);
        try (var conexion = DriverManager.getConnection(url, usuario, clave)) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                Integer idUsuario = jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol)
                    VALUES ('Jugador territorial QA',?,'hash-de-prueba','JUGADOR') RETURNING id_usuario
                    """, Integer.class, "territorial-" + java.util.UUID.randomUUID() + "@local.test");
                jdbc.update("INSERT INTO diseno(id_diseno) VALUES (?)", id);
                jdbc.update("INSERT INTO escenario(id_escenario,nombre,modo,progresivo,reglas_exito) VALUES (?,'Prueba territorial temporal','EDICION_LIBRE',FALSE,'{}'::jsonb)", id);
                jdbc.update("INSERT INTO intento(id_intento,id_usuario,id_escenario,id_diseno,estado) VALUES (?,?,?,?,'EN_DISENO')", id, idUsuario, id, id);
                var mapper = new ObjectMapper();
                var geografia = new GeografiaService(mapper);
                var restricciones = new RestriccionesGeograficasService(jdbc, mapper, geografia);
                var admin = new DisenoAdministracionService(jdbc, restricciones);
                var simulacion = new SimulacionService(jdbc, admin, new ObjetivosPuntosInteresService(mapper, geografia), org.mockito.Mockito.mock(JuegoEducativoService.class), restricciones);
                simulacion.crearEstacion(idUsuario, id, new CrearEstacionSimulacionRequest("Válida", new BigDecimal("710.1234"), new BigDecimal("460")));
                var error = assertThrows(ResponseStatusException.class, () -> simulacion.crearEstacion(idUsuario, id,
                    new CrearEstacionSimulacionRequest("Fuera", new BigDecimal("600"), new BigDecimal("600"))));
                assertEquals(400, error.getStatusCode().value());
                assertThrows(ResponseStatusException.class, () -> admin.actualizarEstacion(id, "Válida",
                    new ActualizarEstacionRequest("Válida", new BigDecimal("600"), new BigDecimal("600"), false)));
                simulacion.guardarDiseno(idUsuario, id);
                assertEquals("GUARDADO", jdbc.queryForObject("SELECT estado FROM intento WHERE id_diseno=?", String.class, id));
                assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno=?", Integer.class, id));
                assertEquals(new BigDecimal("710.12"), jdbc.queryForObject("SELECT posicion_x FROM estacion WHERE id_diseno=?", BigDecimal.class, id));
                jdbc.update("UPDATE escenario SET reglas_exito=?::jsonb WHERE id_escenario=?",
                    "{\"restriccionesGeograficas\":[{\"tipo\":\"barrio\",\"nombre\":\"AGUADA\",\"prohibirEstaciones\":true}]}", id);
                assertEquals("AGUADA", restricciones.obtenerConfiguracion(id).areas().getFirst().nombre());
                assertThrows(ResponseStatusException.class, () -> admin.crearEstacion(id,
                    new CrearEstacionAdministracionRequest("Restringida", new BigDecimal("595.82"), new BigDecimal("492.99"), false)));
            } finally {
                conexion.rollback();
            }
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM diseno WHERE id_diseno=?", Integer.class, id));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM escenario WHERE id_escenario=?", Integer.class, id));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM intento WHERE id_intento=?", Integer.class, id));
        }
    }
}
