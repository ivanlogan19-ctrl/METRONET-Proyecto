package com.metronet.backend.dto;

import java.math.BigDecimal;

public record CrearEstacionAdministracionRequest(String nombre, BigDecimal posicionX, BigDecimal posicionY, Boolean transbordo) {}
