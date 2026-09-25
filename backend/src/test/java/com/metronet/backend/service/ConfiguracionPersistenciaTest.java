package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.dto.ActualizarConfiguracionRequest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.web.server.ResponseStatusException;

class ConfiguracionPersistenciaTest {
    @Test
    void guardaRecargaValidaYDesactivaSinCambiarLaEstructura() {
        var fuente = new SingleConnectionDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "", true);
        try {
            var jdbc = new JdbcTemplate(fuente);
            // Esquema aislado de prueba, no ejecuta migraciones ni usa PostgreSQL real.
            jdbc.execute("CREATE TABLE configuracion(clave VARCHAR PRIMARY KEY, valor VARCHAR NOT NULL, descripcion VARCHAR)");
            jdbc.update("INSERT INTO configuracion VALUES ('modo_mantenimiento', 'desactivado', 'Estado de mantenimiento')");
            var servicio = new ConfiguracionService(jdbc);
            assertFalse(servicio.estaModoMantenimientoActivo());
            assertEquals("activado", servicio.actualizarConfiguracion("modo_mantenimiento", new ActualizarConfiguracionRequest(" ACTIVADO ")).valor());
            var recargado = new ConfiguracionService(new JdbcTemplate(fuente));
            assertTrue(recargado.estaModoMantenimientoActivo());
            assertEquals("activado", recargado.listarConfiguraciones().getFirst().valor());
            for (String invalido : new String[]{"true", "false", "1", "0", "cualquier texto", ""}) {
                var error = assertThrows(ResponseStatusException.class, () -> recargado.actualizarConfiguracion("modo_mantenimiento", new ActualizarConfiguracionRequest(invalido)));
                assertEquals(400, error.getStatusCode().value());
                assertTrue(recargado.estaModoMantenimientoActivo());
            }
            recargado.actualizarConfiguracion("modo_mantenimiento", new ActualizarConfiguracionRequest("desactivado"));
            assertFalse(servicio.estaModoMantenimientoActivo());
            assertEquals("desactivado", servicio.listarConfiguraciones().getFirst().valor());
            assertEquals("Estado de mantenimiento", servicio.listarConfiguraciones().getFirst().descripcion());
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM configuracion", Integer.class));
        } finally { fuente.destroy(); }
    }
}
