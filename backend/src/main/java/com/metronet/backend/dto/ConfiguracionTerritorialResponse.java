package com.metronet.backend.dto;

import java.util.List;

public record ConfiguracionTerritorialResponse(List<AreaTerritorialResponse> areas, List<String> errores) {
    public ConfiguracionTerritorialResponse {
        areas = List.copyOf(areas);
        errores = List.copyOf(errores);
    }
}
