package com.metronet.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ResultadoSimulacionResponse(
    Integer idSimulacion,
    BigDecimal velocidad,
    Integer duracion,
    String estado,
    Integer puntaje,
    String comentarios,
    LocalDateTime fechaEjecucion
) {}
