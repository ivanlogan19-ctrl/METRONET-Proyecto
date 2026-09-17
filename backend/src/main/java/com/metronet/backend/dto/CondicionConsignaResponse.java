package com.metronet.backend.dto;

public record CondicionConsignaResponse(
    String clave,
    String texto,
    Integer actual,
    Integer requerido,
    boolean completado
) {}
