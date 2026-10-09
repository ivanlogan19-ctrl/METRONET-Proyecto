package com.metronet.backend.dto;

import java.util.List;

/** Evidencia calculada por el servidor, una fila por ejecución penalizada. */
public record DesglosePuntuacionResponse(String version, int puntosBase, int practicasGratuitas,
        int descuentoPorEjecucion, int descuentoMaximo, int puntajeMinimoAprobacion,
        int totalDescontado, int total, List<Descuento> descuentos) {
    public record Descuento(int idSimulacion, int numeroEjecucion, int puntos, List<String> motivos, List<String> excesos) {}
}
