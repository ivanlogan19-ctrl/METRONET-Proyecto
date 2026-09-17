package com.metronet.backend.dto;

public record ActualizarUsuarioRequest(
    String nombre,
    String apellido,
    String email,
    String nuevaContrasena,
    String identificadorAdministrador
) {}
