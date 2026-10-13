package com.metronet.backend.dto;

import java.util.List;

public record DesempenoNivelResponse(
    int puntaje, int puntajeMaximo, int puntosResolucion, int puntosEficiencia, int puntosVelocidad,
    boolean redResuelta, boolean aprendizajeCumplido, boolean simulacionActual,
    String etapa, String explicacion,
    List<MedicionUnidad> unidades,
    com.metronet.backend.service.CriterioUvUtService.Resultado resultadoUvUt,
    com.metronet.backend.service.CriterioUvUtService.Configuracion configuracionUvUt,
    DesglosePuntuacionResponse desglosePuntuacion
) {
    public DesempenoNivelResponse(int puntaje, int puntajeMaximo, int puntosResolucion, int puntosEficiencia, int puntosVelocidad,
            boolean redResuelta, boolean aprendizajeCumplido, boolean simulacionActual, String etapa, String explicacion,
            List<MedicionUnidad> unidades, com.metronet.backend.service.CriterioUvUtService.Resultado resultadoUvUt,
            com.metronet.backend.service.CriterioUvUtService.Configuracion configuracionUvUt) {
        this(puntaje, puntajeMaximo, puntosResolucion, puntosEficiencia, puntosVelocidad, redResuelta,
            aprendizajeCumplido, simulacionActual, etapa, explicacion, unidades, resultadoUvUt, configuracionUvUt, null);
    }
    public DesempenoNivelResponse(int puntaje, int puntajeMaximo, int puntosResolucion, int puntosEficiencia, int puntosVelocidad,
            boolean redResuelta, boolean aprendizajeCumplido, boolean simulacionActual,
            String etapa, String explicacion, List<MedicionUnidad> unidades) {
        this(puntaje, puntajeMaximo, puntosResolucion, puntosEficiencia, puntosVelocidad,
            redResuelta, aprendizajeCumplido, simulacionActual, etapa, explicacion, unidades, null, null);
    }
    public record MedicionUnidad(int idTren, String linea, double velocidad, int tramos, Integer duracionUt, Double distanciaKm, Double distanciaRecorridaKm, Double utLlegada) {
        public MedicionUnidad(int idTren, String linea, double velocidad, int tramos, Integer duracionUt) {
            this(idTren, linea, velocidad, tramos, duracionUt, null, null, null);
        }
        public MedicionUnidad(int idTren, String linea, double velocidad, int tramos) { this(idTren, linea, velocidad, tramos, null); }
        public int tiempoEfectivo(int global) { return duracionUt == null ? global : duracionUt; }
    }
}
