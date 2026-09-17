package com.metronet.backend.dto;

public record VerificarCodigoRecuperacionRequest(String email, Integer idSolicitud, String codigo) {}
