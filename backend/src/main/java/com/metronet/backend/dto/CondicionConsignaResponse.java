package com.metronet.backend.dto;

public record CondicionConsignaResponse(
    String clave,
    String texto,
    Integer actual,
    Integer requerido,
    boolean completado,
    boolean textoPersonalizado
) {
    public CondicionConsignaResponse(String clave, String texto, Integer actual, Integer requerido, boolean completado) {
        this(clave, texto, actual, requerido, completado, false);
    }
}
