package com.metronet.backend.dto;

import java.math.BigDecimal;

public record CrearEstacionSimulacionRequest(String nombre, BigDecimal posicionX, BigDecimal posicionY) {
}
