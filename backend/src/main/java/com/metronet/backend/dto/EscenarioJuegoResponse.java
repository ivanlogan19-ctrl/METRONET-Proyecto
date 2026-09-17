package com.metronet.backend.dto;

import java.util.Map;

public record EscenarioJuegoResponse(
    Integer idEscenario,
    Integer numero,
    String nombre,
    String objetivo,
    String dificultad,
    String instrucciones,
    String estado,
    Integer progreso,
    boolean desbloqueado,
    Map<String, Boolean> herramientasHabilitadas,
    boolean completadoEnCampanaActual,
    Integer cantidadIntentos,
    Integer mejorPuntaje,
    Integer ultimoPuntaje
) {}
