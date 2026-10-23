package com.metronet.backend.utilidades;

/** Clave de transporte compatible con los selectores existentes; no crea líneas ficticias. */
public final class IdentidadRecorrido {
    public static final String PREFIJO_CONEXION = "@conexion:";
    private IdentidadRecorrido() {}
    public static String conexion(long id) { return PREFIJO_CONEXION + id; }
    public static Long idConexion(String clave) {
        if (clave == null || !clave.startsWith(PREFIJO_CONEXION)) return null;
        try {
            long id = Long.parseLong(clave.substring(PREFIJO_CONEXION.length()));
            if (id > 0) return id;
        } catch (NumberFormatException ignorada) { }
        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "La conexión seleccionada no es válida");
    }
    public static String linea(String clave) { return idConexion(clave) == null ? clave : null; }
}
