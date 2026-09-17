package com.metronet.backend.entity;

import com.metronet.backend.enums.EstadoRecuperacionContrasena;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "solicitud_recuperacion_contrasena")
public class RecuperacionContrasena {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_solicitud")
    private Integer idSolicitud;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    @Column(name = "codigo_hash", length = 255)
    private String codigoHash;

    @Column(name = "token_recuperacion_hash", length = 255)
    private String tokenRecuperacionHash;

    @Column(name = "fecha_solicitud", nullable = false)
    private LocalDateTime fechaSolicitud;

    @Column(name = "fecha_expiracion")
    private LocalDateTime fechaExpiracion;

    @Column(name = "fecha_ultimo_envio")
    private LocalDateTime fechaUltimoEnvio;

    @Column(name = "fecha_verificacion")
    private LocalDateTime fechaVerificacion;

    @Column(name = "fecha_expiracion_autorizacion")
    private LocalDateTime fechaExpiracionAutorizacion;

    @Column(name = "intentos_fallidos", nullable = false)
    private int intentosFallidos;

    @Column(nullable = false)
    private boolean utilizado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoRecuperacionContrasena estado;

    public Integer getIdSolicitud() { return idSolicitud; }

    public void setIdSolicitud(Integer idSolicitud) { this.idSolicitud = idSolicitud; }

    public Usuario getUsuario() { return usuario; }

    public void setUsuario(Usuario usuario) { this.usuario = usuario; }

    public String getCodigoHash() { return codigoHash; }

    public void setCodigoHash(String codigoHash) { this.codigoHash = codigoHash; }

    public String getTokenRecuperacionHash() { return tokenRecuperacionHash; }

    public void setTokenRecuperacionHash(String tokenRecuperacionHash) { this.tokenRecuperacionHash = tokenRecuperacionHash; }

    public LocalDateTime getFechaSolicitud() { return fechaSolicitud; }

    public void setFechaSolicitud(LocalDateTime fechaSolicitud) { this.fechaSolicitud = fechaSolicitud; }

    public LocalDateTime getFechaExpiracion() { return fechaExpiracion; }

    public void setFechaExpiracion(LocalDateTime fechaExpiracion) { this.fechaExpiracion = fechaExpiracion; }

    public LocalDateTime getFechaUltimoEnvio() { return fechaUltimoEnvio; }

    public void setFechaUltimoEnvio(LocalDateTime fechaUltimoEnvio) { this.fechaUltimoEnvio = fechaUltimoEnvio; }

    public LocalDateTime getFechaVerificacion() { return fechaVerificacion; }

    public void setFechaVerificacion(LocalDateTime fechaVerificacion) { this.fechaVerificacion = fechaVerificacion; }

    public LocalDateTime getFechaExpiracionAutorizacion() { return fechaExpiracionAutorizacion; }

    public void setFechaExpiracionAutorizacion(LocalDateTime fechaExpiracionAutorizacion) { this.fechaExpiracionAutorizacion = fechaExpiracionAutorizacion; }

    public int getIntentosFallidos() { return intentosFallidos; }

    public void setIntentosFallidos(int intentosFallidos) { this.intentosFallidos = intentosFallidos; }

    public boolean isUtilizado() { return utilizado; }

    public void setUtilizado(boolean utilizado) { this.utilizado = utilizado; }

    public EstadoRecuperacionContrasena getEstado() { return estado; }

    public void setEstado(EstadoRecuperacionContrasena estado) { this.estado = estado; }
}
