package com.metronet.backend.dto;

public record ReferenciaObjetivoConsignaResponse(
    Integer idPunto,
    String nombrePunto,
    boolean cubierto
) {}
