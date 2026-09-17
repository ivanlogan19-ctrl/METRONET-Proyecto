package com.metronet.backend.dto;

public record CrearEscenarioRequest(
    String nombre,
    String modo,
    String dificultad,
    String objetivo,
    String instrucciones
) {}
