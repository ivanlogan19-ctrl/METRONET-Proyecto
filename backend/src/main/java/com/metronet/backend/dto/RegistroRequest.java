package com.metronet.backend.dto;

public record RegistroRequest(
    String nombre,
    String apellido,
    String email,
    String password,
    boolean aceptaDatos
) {}
