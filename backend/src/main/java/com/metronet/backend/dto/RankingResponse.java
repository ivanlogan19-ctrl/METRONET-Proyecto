package com.metronet.backend.dto;

import java.util.List;

public record RankingResponse(List<Entrada> jugadores, Integer tuPosicion, int puntajeTotal, int puntajeMaximo) {
    public record Entrada(int posicion, String jugador, int puntajeTotal, int nivelesCompletados, boolean sosVos) {}
}
