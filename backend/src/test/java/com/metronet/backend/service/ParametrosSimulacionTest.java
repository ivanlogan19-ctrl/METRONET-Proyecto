package com.metronet.backend.service;

import com.metronet.backend.dto.EjecutarSimulacionRequest;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class ParametrosSimulacionTest {
    @Test void pu03HorasPositivasSinMinimoAntiguoNiMaximoArtificial() {
        for (int horas : new int[]{1, 6, 9, 10, 25, Integer.MAX_VALUE}) {
            for (String ritmo : new String[]{"0.5", "1", "2.00", "4"}) {
                var solicitud = new EjecutarSimulacionRequest(new BigDecimal(ritmo), horas);
                assertDoesNotThrow(() -> ParametrosSimulacion.validar(solicitud));
                assertEquals(horas, solicitud.duracion());
            }
        }
        for (Integer horas : new Integer[]{null, 0, -1}) {
            assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> ParametrosSimulacion.validar(new EjecutarSimulacionRequest(BigDecimal.ONE, horas))).getStatusCode().value());
        }
        assertThrows(ResponseStatusException.class, () -> ParametrosSimulacion.validar(null));
        assertThrows(ResponseStatusException.class, () -> ParametrosSimulacion.validar(new EjecutarSimulacionRequest(null, 6)));
        assertThrows(ResponseStatusException.class, () -> ParametrosSimulacion.validar(new EjecutarSimulacionRequest(new BigDecimal("3"), 6)));
    }

    @Test void uvPositivaYRepresentableSinRedondeoSilencioso() {
        assertFalse(ParametrosSimulacion.velocidadValida(null));
        for (String invalida : new String[]{"0", "-1", "0.001", "10000"}) assertFalse(ParametrosSimulacion.velocidadValida(new BigDecimal(invalida)));
        for (String valida : new String[]{"0.01", "4", "6.00", "9999.99"}) assertTrue(ParametrosSimulacion.velocidadValida(new BigDecimal(valida)));
    }
}
