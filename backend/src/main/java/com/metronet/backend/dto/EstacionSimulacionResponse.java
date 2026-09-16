package com.metronet.backend.dto;

import java.math.BigDecimal;

public record EstacionSimulacionResponse(String nombre, BigDecimal posicionX, BigDecimal posicionY, boolean transbordo) {
}
