package com.metronet.backend.dto;

import java.util.List;

public record CrearLineaSimulacionRequest(String nombre, List<String> estaciones) {
}
