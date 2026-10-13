package com.metronet.backend.dto;

public record TramoSimulacionResponse(String nombreLinea, String estacionA, String estacionB, Double distanciaKm) {
    public TramoSimulacionResponse(String nombreLinea, String estacionA, String estacionB) {
        this(nombreLinea, estacionA, estacionB, null);
    }
}
