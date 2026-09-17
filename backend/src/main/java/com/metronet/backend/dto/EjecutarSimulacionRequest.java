package com.metronet.backend.dto;

import java.math.BigDecimal;

public record EjecutarSimulacionRequest(BigDecimal velocidad, Integer duracion) {}
