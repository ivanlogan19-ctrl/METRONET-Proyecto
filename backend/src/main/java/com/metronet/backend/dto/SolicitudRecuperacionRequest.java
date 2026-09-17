package com.metronet.backend.dto;

public record SolicitudRecuperacionRequest(String email, Integer idSolicitud) {
    public SolicitudRecuperacionRequest(String email) {
        this(email, null);
    }
}
