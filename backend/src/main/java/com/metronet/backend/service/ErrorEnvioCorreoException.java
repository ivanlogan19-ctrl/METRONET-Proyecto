package com.metronet.backend.service;

public class ErrorEnvioCorreoException extends RuntimeException {
    public ErrorEnvioCorreoException(String mensaje) {
        super(mensaje);
    }

    public ErrorEnvioCorreoException(String mensaje, Throwable causa) {
        super(mensaje, causa);
    }
}
