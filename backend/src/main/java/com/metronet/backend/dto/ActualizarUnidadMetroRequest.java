package com.metronet.backend.dto;

import java.math.BigDecimal;

public record ActualizarUnidadMetroRequest(String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio) {}
