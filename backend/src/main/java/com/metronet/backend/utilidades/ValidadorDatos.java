package com.metronet.backend.utilidades;

import java.util.regex.Pattern;

public final class ValidadorDatos {
    private static final Pattern PATRON_CORREO_ELECTRONICO = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private ValidadorDatos() {
    }

    public static boolean esCorreoElectronicoValido(String correoElectronico) {
        return correoElectronico != null && PATRON_CORREO_ELECTRONICO.matcher(correoElectronico.trim()).matches();
    }
}
