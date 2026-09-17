package com.metronet.backend.dto;

import java.util.List;

public record ActualizarLineaSimulacionRequest(String nombre, List<String> estaciones) {}
