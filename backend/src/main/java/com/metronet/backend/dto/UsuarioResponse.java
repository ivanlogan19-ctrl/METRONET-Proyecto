package com.metronet.backend.dto;

import com.metronet.backend.enums.Rol;

public class UsuarioResponse {
    public Integer idUsuario;
    public String nombre;
    public String email;
    public Rol rol;

    public UsuarioResponse(Integer idUsuario, String nombre, String email, Rol rol) {
        this.idUsuario = idUsuario;
        this.nombre = nombre;
        this.email = email;
        this.rol = rol;
    }
}