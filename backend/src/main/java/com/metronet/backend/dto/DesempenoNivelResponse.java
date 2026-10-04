package com.metronet.backend.dto;

import java.util.List;

public record DesempenoNivelResponse(
    int puntaje, int puntajeMaximo, int puntosResolucion, int puntosEficiencia, int puntosVelocidad,
    boolean redResuelta, boolean aprendizajeCumplido, boolean simulacionActual,
    String etapa, String explicacion,
    List<MedicionUnidad> unidades,
    com.metronet.backend.service.CriterioUvUtService.Resultado resultadoUvUt,
    com.metronet.backend.service.CriterioUvUtService.Configuracion configuracionUvUt
) {
    public DesempenoNivelResponse(int puntaje, int puntajeMaximo, int puntosResolucion, int puntosEficiencia, int puntosVelocidad,
            boolean redResuelta, boolean aprendizajeCumplido, boolean simulacionActual,
            String etapa, String explicacion, List<MedicionUnidad> unidades) {
        this(puntaje, puntajeMaximo, puntosResolucion, puntosEficiencia, puntosVelocidad,
            redResuelta, aprendizajeCumplido, simulacionActual, etapa, explicacion, unidades, null, null);
    }
    public record MedicionUnidad(int idTren, String linea, double velocidad, int tramos) {}
}
