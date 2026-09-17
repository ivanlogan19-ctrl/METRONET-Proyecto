package com.metronet.backend.dto;

public record CambiarContrasenaRecuperacionRequest(
    Integer idSolicitud,
    String tokenRecuperacion,
    String nuevaContrasena,
    String confirmarNuevaContrasena
) {}
