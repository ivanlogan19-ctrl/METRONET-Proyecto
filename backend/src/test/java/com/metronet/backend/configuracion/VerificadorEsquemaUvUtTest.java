package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;

class VerificadorEsquemaUvUtTest {
    @Test
    void detieneElArranqueAntesDeEscribirSiFaltaLaMigracion() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        var error = assertThrows(IllegalStateException.class,
            () -> new VerificadorEsquemaUvUt().verificarEsquemaUvUt(jdbc).run());
        assertTrue(error.getMessage().contains("017_criterio_uv_ut_v2.sql"));
        verify(jdbc).queryForObject(eq("SELECT to_regclass(?)::text"), eq(String.class), eq("criterio_uv_ut"));
        verifyNoMoreInteractions(jdbc);
        assertEquals(Ordered.HIGHEST_PRECEDENCE,
            VerificadorEsquemaUvUt.class.getDeclaredMethod("verificarEsquemaUvUt", JdbcTemplate.class)
                .getAnnotation(Order.class).value());
    }
}
