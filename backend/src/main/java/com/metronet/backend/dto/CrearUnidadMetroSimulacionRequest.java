package com.metronet.backend.dto;

import java.math.BigDecimal;

public record CrearUnidadMetroSimulacionRequest(String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio, Long idConexion) {
    public CrearUnidadMetroSimulacionRequest(String linea, Integer capacidad, BigDecimal velocidad) {
        this(linea, capacidad, velocidad, null);
    }
}
