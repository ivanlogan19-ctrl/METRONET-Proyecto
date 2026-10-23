package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class RestriccionesGeograficasRepository {
    private final JdbcTemplate jdbc;

    public RestriccionesGeograficasRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> reglasDeIntento(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT e.reglas_exito::text AS reglas_exito FROM intento i
            JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_diseno = ? ORDER BY i.id_intento DESC LIMIT 1
            """, mapeador, idDiseno);
    }

    public Integer bloquearDiseno(Integer idDiseno) {
        return jdbc.queryForObject("SELECT id_diseno FROM diseno WHERE id_diseno = ? FOR UPDATE", Integer.class, idDiseno);
    }

    public <T> List<T> estaciones(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("SELECT nombre, posicion_x, posicion_y FROM estacion WHERE id_diseno = ?", mapeador, idDiseno);
    }

    public <T> List<T> tramos(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("SELECT nombre_estacion_a, nombre_estacion_b FROM tramo WHERE id_diseno = ? UNION ALL SELECT estacion_a,estacion_b FROM conexion_lineas WHERE id_diseno=?", mapeador, idDiseno, idDiseno);
    }
}
