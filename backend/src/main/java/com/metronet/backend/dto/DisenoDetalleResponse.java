package com.metronet.backend.dto;

import java.util.List;

public record DisenoDetalleResponse(
    DisenoResumenResponse diseno,
    List<LineaMetroResponse> lineas,
    List<EstacionResponse> estaciones,
    List<ConexionResponse> conexiones
) {}
