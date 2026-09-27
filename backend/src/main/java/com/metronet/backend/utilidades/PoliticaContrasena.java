package com.metronet.backend.utilidades;

import java.nio.charset.StandardCharsets;

public final class PoliticaContrasena {
    public static final String MENSAJE = "La contraseña debe tener al menos 6 caracteres, una mayúscula y un carácter especial, y no superar 72 bytes UTF-8";
    private PoliticaContrasena() {}
    public static boolean esValida(String valor) {
        return valor != null && valor.length() >= 6 && admiteBCrypt(valor)
            && valor.matches(".*[A-Z].*") && valor.matches(".*[^A-Za-z0-9].*");
    }
    public static boolean admiteBCrypt(String valor) {
        return valor != null && valor.getBytes(StandardCharsets.UTF_8).length <= 72;
    }
}
