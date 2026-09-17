package com.metronet.backend.dto;

import java.math.BigDecimal;

public record UnidadMetroSimulacionResponse(Integer idTren, String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio) {}
