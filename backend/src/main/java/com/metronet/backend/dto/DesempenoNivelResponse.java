package com.metronet.backend.dto;

import java.util.List;

public record DesempenoNivelResponse(
    int puntaje, int puntajeMaximo, int puntosResolucion, int puntosEficiencia, int puntosVelocidad,
    boolean redResuelta, boolean velocidadCumplida, boolean simulacionActual,
    Double velocidadObjetivoKmh, Double toleranciaKmh, String etapa, String explicacion,
    List<MedicionUnidad> unidades
) {
    public record MedicionUnidad(int idTren, String linea, double velocidadKmh, double distanciaKm, double tiempoMinutos) {}
}
