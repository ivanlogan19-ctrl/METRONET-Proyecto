package com.metronet.backend.dto;

public record EvaluacionEscenarioResponse(
    boolean completado,
    Integer progreso,
    Integer puntaje,
    String mensaje,
    Integer idSiguienteEscenario,
    boolean modoLibreDesbloqueado,
    DesempenoNivelResponse desempeno,
    java.util.List<com.metronet.backend.service.TrofeosService.Trofeo> trofeosNuevos
) {
    public EvaluacionEscenarioResponse(boolean completado, Integer progreso, Integer puntaje, String mensaje, Integer idSiguienteEscenario, boolean modoLibreDesbloqueado, DesempenoNivelResponse desempeno) {
        this(completado, progreso, puntaje, mensaje, idSiguienteEscenario, modoLibreDesbloqueado, desempeno, java.util.List.of());
    }
    public EvaluacionEscenarioResponse(boolean completado, Integer progreso, Integer puntaje, String mensaje, Integer idSiguienteEscenario, boolean modoLibreDesbloqueado) {
        this(completado, progreso, puntaje, mensaje, idSiguienteEscenario, modoLibreDesbloqueado, null);
    }
}
