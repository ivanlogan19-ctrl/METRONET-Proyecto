package com.metronet.backend.dto;

import java.math.BigDecimal;

public record ActualizarUnidadMetroRequest(String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio,
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = HorasSimuladasDeserializer.class) Integer duracionUt) {
    public ActualizarUnidadMetroRequest(String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio) {
        this(nombreLinea, capacidad, velocidadPromedio, null);
    }
}
