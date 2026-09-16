package com.metronet.backend.dto;

import java.time.LocalDateTime;

public record SolicitudRecuperacionResponse(Integer idSolicitud, String nombreUsuario, String email, LocalDateTime fechaSolicitud, String estado) {}
