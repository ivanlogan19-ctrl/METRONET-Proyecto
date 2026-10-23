package com.metronet.backend.dto;

public record ConexionLineasResponse(long idConexion, String lineaA, String estacionA, String lineaB, String estacionB, Double distanciaKm) {
    public ConexionLineasResponse(long id, String lineaA, String estacionA, String lineaB, String estacionB) {
        this(id, lineaA, estacionA, lineaB, estacionB, null);
    }
}
