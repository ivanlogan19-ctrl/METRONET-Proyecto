package com.metronet.backend.service;

public interface ServicioCorreo {
    boolean estaDisponible();

    void enviarCodigoRecuperacion(String destinatario, String codigo);
}
