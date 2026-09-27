package com.metronet.backend.dto;

import java.math.BigDecimal;

/** velocidad es el ritmo visual ×; duracion son horas simuladas enteras. UV pertenece al Metro. */
public record EjecutarSimulacionRequest(BigDecimal velocidad,
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = HorasSimuladasDeserializer.class) Integer duracion) {}
