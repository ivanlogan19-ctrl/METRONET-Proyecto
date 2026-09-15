package com.metronet.backend.dto;

import com.metronet.backend.enums.Rol;

public record UsuarioResponse(Integer idUsuario, String nombre, String apellido, String email, Rol rol) {}
