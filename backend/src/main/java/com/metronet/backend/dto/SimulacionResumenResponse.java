package com.metronet.backend.dto;

public record SimulacionResumenResponse(
    Integer idDiseno,
    Integer idEscenario,
    String nombre,
    String estado,
    String modo,
    String dificultad,
    String objetivo,
    String instrucciones,
    Integer idDisenoBase
) {
}
