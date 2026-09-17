package com.metronet.backend.dto;

import java.util.List;

public record ValidacionDisenoResponse(
    boolean valido,
    List<String> observaciones,
    boolean preparadoParaSimular,
    List<String> observacionesSimulacion
) {}
