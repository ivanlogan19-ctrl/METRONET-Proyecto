package com.metronet.backend.dto;

import java.util.List;

public record SimulacionDetalleResponse(
    SimulacionResumenResponse simulacion,
    List<EstacionSimulacionResponse> estaciones,
    List<LineaSimulacionResponse> lineas,
    List<TramoSimulacionResponse> tramos,
    List<UnidadMetroSimulacionResponse> unidadesMetro,
    List<ResultadoSimulacionResponse> resultados
) {
}
