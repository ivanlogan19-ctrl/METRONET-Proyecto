package com.metronet.backend.dto;

import java.math.BigDecimal;

public record EstacionResponse(
    String nombre,
    BigDecimal posicionX,
    BigDecimal posicionY,
    boolean transbordo,
    boolean modificable
) {}
