package com.metronet.backend.dto;

import java.math.BigDecimal;

public record UnidadMetroSimulacionResponse(Integer idTren, String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio, Integer duracionUt) {
    public UnidadMetroSimulacionResponse(Integer idTren, String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio) {
        this(idTren, nombreLinea, capacidad, velocidadPromedio, null);
    }
}
