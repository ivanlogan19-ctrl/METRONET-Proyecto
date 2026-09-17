package com.metronet.backend.dto;

import java.math.BigDecimal;

public record ActualizarEstacionRequest(
    String nombre,
    BigDecimal posicionX,
    BigDecimal posicionY,
    boolean transbordo
) {}
