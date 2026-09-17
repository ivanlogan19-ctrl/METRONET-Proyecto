package com.metronet.backend.dto;

import java.math.BigDecimal;

public record PuntoInteresObjetivoResponse(
    Integer idPunto,
    String nombrePunto,
    BigDecimal posicionX,
    BigDecimal posicionY,
    BigDecimal radioCobertura
) {}
