package com.metronet.backend.dto;

public record EvaluacionEscenarioResponse(
    boolean completado,
    Integer progreso,
    Integer puntaje,
    String mensaje,
    Integer idSiguienteEscenario,
    boolean modoLibreDesbloqueado,
    DesempenoNivelResponse desempeno
) {
    public EvaluacionEscenarioResponse(boolean completado, Integer progreso, Integer puntaje, String mensaje, Integer idSiguienteEscenario, boolean modoLibreDesbloqueado) {
        this(completado, progreso, puntaje, mensaje, idSiguienteEscenario, modoLibreDesbloqueado, null);
    }
}
