package com.metronet.backend.dto;

public record DisenoResumenResponse(
    Integer idDiseno,
    String propietario,
    String correoPropietario,
    Integer idEscenario,
    String modoEscenario,
    String estado
) {}
