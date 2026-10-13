package com.metronet.backend.dto;

import java.math.BigDecimal;

/** velocidad es el ritmo visual ×; duracion es el respaldo UT entero para metros sin duración individual. */
public record EjecutarSimulacionRequest(BigDecimal velocidad,
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = HorasSimuladasDeserializer.class) Integer duracion) {}
