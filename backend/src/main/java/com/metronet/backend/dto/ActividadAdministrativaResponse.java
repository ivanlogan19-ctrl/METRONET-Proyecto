package com.metronet.backend.dto;

import java.time.LocalDateTime;

public record ActividadAdministrativaResponse(
    Integer idActividad,
    String administrador,
    String accion,
    String detalle,
    LocalDateTime fecha
) {}
