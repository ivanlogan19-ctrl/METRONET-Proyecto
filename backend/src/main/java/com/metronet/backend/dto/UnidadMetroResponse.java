package com.metronet.backend.dto;

import java.math.BigDecimal;

public record UnidadMetroResponse(Integer idTren, String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio) {}
