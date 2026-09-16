package com.metronet.backend.dto;

import java.math.BigDecimal;

public record CrearUnidadMetroSimulacionRequest(String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio) {}
