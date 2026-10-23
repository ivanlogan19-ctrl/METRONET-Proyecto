package com.metronet.backend.repository;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class VinculoUvUtLibreRepository {
    private final JdbcTemplate jdbc;

    public VinculoUvUtLibreRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Boolean aplica(int diseno) {
        return jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
             WHERE i.id_diseno=? AND (e.modo IN ('LIBRE','EDICION_LIBRE') OR (e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10)))
            """, Boolean.class, diseno);
    }

    public Integer bloquearDiseno(int diseno) {
        return jdbc.queryForObject("SELECT id_diseno FROM diseno WHERE id_diseno=? FOR UPDATE", Integer.class, diseno);
    }

    public void configuraciones(RowCallbackHandler lector, int diseno) {
        jdbc.query("SELECT COALESCE(nombre_linea, '@conexion:' || id_conexion),velocidad_promedio,duracion_ut,referencia_uv_ut FROM metro WHERE id_diseno=? ORDER BY id_tren", lector, diseno);
    }

    public <T> List<T> configuracionUnidad(RowMapper<T> mapeador, int diseno, int tren) {
        return jdbc.query("SELECT COALESCE(nombre_linea, '@conexion:' || id_conexion),velocidad_promedio,duracion_ut FROM metro WHERE id_diseno=? AND id_tren=?", mapeador, diseno, tren);
    }

    public <T> List<T> configuracionDestino(RowMapper<T> mapeador, int diseno, String nombreLinea, int tren) {
        return jdbc.query("SELECT COALESCE(nombre_linea, '@conexion:' || id_conexion),velocidad_promedio,duracion_ut,referencia_uv_ut FROM metro WHERE id_diseno=? AND COALESCE(nombre_linea, '@conexion:' || id_conexion)=? AND id_tren<>? ORDER BY id_tren LIMIT 1", mapeador, diseno, nombreLinea, tren);
    }

    public int guardarLinea(BigDecimal velocidad, Double duracionUt, String referenciaUvUt, int diseno, String nombreLinea) {
        return jdbc.update("UPDATE metro SET velocidad_promedio=?,duracion_ut=?,referencia_uv_ut=? WHERE id_diseno=? AND COALESCE(nombre_linea, '@conexion:' || id_conexion)=?", velocidad, duracionUt, referenciaUvUt, diseno, nombreLinea);
    }
}
