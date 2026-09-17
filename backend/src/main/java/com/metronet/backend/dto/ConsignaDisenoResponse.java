package com.metronet.backend.dto;

import java.util.List;

public record ConsignaDisenoResponse(
    String estadoGlobal,
    Integer progreso,
    List<CondicionConsignaResponse> condiciones,
    List<ReferenciaObjetivoConsignaResponse> referenciasObjetivo
) {
    public ConsignaDisenoResponse {
        condiciones = condiciones == null ? List.of() : List.copyOf(condiciones);
        referenciasObjetivo = referenciasObjetivo == null ? List.of() : List.copyOf(referenciasObjetivo);
    }
}
