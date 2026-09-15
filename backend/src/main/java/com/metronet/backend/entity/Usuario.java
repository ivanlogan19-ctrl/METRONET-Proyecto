package com.metronet.backend.entity;

import com.metronet.backend.enums.Rol;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuario")
public class Usuario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idUsuario;

    @Column(nullable = false)
    private String nombre;

    private String apellido;

    @Column(name = "identificador_administrador", unique = true)
    private String identificadorAdministrador;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "fecha_creacion", insertable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rol rol;

    @Column(name = "acepta_datos")
    private Boolean aceptaDatos;

    @Column(name = "fecha_consentimiento")
    private LocalDateTime fechaConsentimiento;

    public Integer getIdUsuario() {
        return idUsuario;
    }

    public void setIdUsuario(Integer idUsuario) {
        this.idUsuario = idUsuario;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getApellido() {
        return apellido;
    }

    public String getIdentificadorAdministrador() {
        return identificadorAdministrador;
    }

    public void setIdentificadorAdministrador(String identificadorAdministrador) {
        this.identificadorAdministrador = identificadorAdministrador;
    }

    public void setApellido(String apellido) {
        this.apellido = apellido;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    public Rol getRol() {
        return rol;
    }

    public void setRol(Rol rol) {
        this.rol = rol;
    }

    public Boolean getAceptaDatos() {
        return aceptaDatos;
    }

    public void setAceptaDatos(Boolean aceptaDatos) {
        this.aceptaDatos = aceptaDatos;
    }

    public LocalDateTime getFechaConsentimiento() {
        return fechaConsentimiento;
    }

    public void setFechaConsentimiento(LocalDateTime fechaConsentimiento) {
        this.fechaConsentimiento = fechaConsentimiento;
    }
}
