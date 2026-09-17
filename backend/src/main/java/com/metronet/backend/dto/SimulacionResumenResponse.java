package com.metronet.backend.dto;

import java.util.List;

public record SimulacionResumenResponse(
    Integer idDiseno,
    Integer idEscenario,
    String nombre,
    String estado,
    String modo,
    String dificultad,
    String objetivo,
    String instrucciones,
    Integer idDisenoBase,
    List<PuntoInteresObjetivoResponse> puntosInteresObjetivo
) {
    public SimulacionResumenResponse {
        puntosInteresObjetivo = puntosInteresObjetivo == null ? List.of() : List.copyOf(puntosInteresObjetivo);
    }

    public SimulacionResumenResponse(
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
        this(idDiseno, idEscenario, nombre, estado, modo, dificultad, objetivo, instrucciones, idDisenoBase, List.of());
    }
}
