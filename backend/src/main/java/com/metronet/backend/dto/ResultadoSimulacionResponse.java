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
    LocalDateTime fechaEjecucion,
    String escala,
    java.util.List<DesempenoNivelResponse.MedicionUnidad> unidades,
    com.metronet.backend.service.CriterioUvUtService.Resultado resultadoUvUt
) {
    public ResultadoSimulacionResponse(Integer idSimulacion, BigDecimal velocidad, Integer duracion, String estado,
            Integer puntaje, String comentarios, LocalDateTime fechaEjecucion, String escala,
            java.util.List<DesempenoNivelResponse.MedicionUnidad> unidades) {
        this(idSimulacion, velocidad, duracion, estado, puntaje, comentarios, fechaEjecucion, escala, unidades, null);
    }
}
