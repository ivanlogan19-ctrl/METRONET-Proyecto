package com.metronet.backend.dto;

import java.util.List;

public record ProgresoJuegoResponse(
    List<EscenarioJuegoResponse> escenarios,
    int numeroCampanaActual,
    int cantidadNiveles,
    int nivelesCompletados,
    boolean campanaCompletada,
    boolean campanaCompletadaHistoricamente,
    boolean modoLibreDesbloqueado
) {}
