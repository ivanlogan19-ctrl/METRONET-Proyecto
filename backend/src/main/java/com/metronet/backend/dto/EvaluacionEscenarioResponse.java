package com.metronet.backend.dto;

public record EvaluacionEscenarioResponse(
    boolean completado,
    Integer progreso,
    Integer puntaje,
    String mensaje,
    Integer idSiguienteEscenario,
    boolean modoLibreDesbloqueado
) {}
