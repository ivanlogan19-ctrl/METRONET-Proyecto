package com.metronet.backend.service;

import com.metronet.backend.dto.EjecutarSimulacionRequest;
import java.math.BigDecimal;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class ParametrosSimulacion {
    private ParametrosSimulacion() {}
    private static final Set<BigDecimal> RITMOS = Set.of(new BigDecimal("0.5"), BigDecimal.ONE, new BigDecimal("2"), new BigDecimal("4"));

    public static void validar(EjecutarSimulacionRequest solicitud) {
        validar(solicitud, false);
    }

    public static void validar(EjecutarSimulacionRequest solicitud, boolean escalaUt) {
        validar(solicitud, escalaUt, false);
    }

    public static void validar(EjecutarSimulacionRequest solicitud, boolean escalaUt, boolean libre) {
        if (solicitud == null || solicitud.velocidad() == null || !RITMOS.contains(solicitud.velocidad().stripTrailingZeros())
            || solicitud.duracion() == null || !Double.isFinite(solicitud.duracion()) || solicitud.duracion() <= 0
            || (libre && !VinculoUvUtLibre.tiempoValido(solicitud.duracion()))
            || (!libre && solicitud.duracion() != Math.rint(solicitud.duracion()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí un ritmo de 0.5×, 1×, 2× o 4× y "
                + (escalaUt ? "UT enteras mayores que cero" : "horas simuladas enteras mayores que cero"));
        }
    }

    public static boolean velocidadValida(BigDecimal uv) {
        // Límites de representabilidad de NUMERIC(6,2), no una velocidad óptima o física.
        return uv != null && uv.signum() > 0 && uv.compareTo(new BigDecimal("9999.99")) <= 0 && uv.stripTrailingZeros().scale() <= 2;
    }
}
