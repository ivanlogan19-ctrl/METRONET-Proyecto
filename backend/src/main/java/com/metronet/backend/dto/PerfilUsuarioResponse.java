package com.metronet.backend.dto;

import com.metronet.backend.enums.Rol;
import java.time.LocalDateTime;

public record PerfilUsuarioResponse(
    String nombre,
    String apellido,
    String email,
    Rol rol,
    LocalDateTime fechaCreacion
) {}
