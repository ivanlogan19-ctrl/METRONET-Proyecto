package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class CondicionesGeograficasRepository {
    private final JdbcTemplate jdbc;

    public CondicionesGeograficasRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Integer contarEstaciones(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarEstacionesDeIntercambio(Integer idDiseno, boolean porConexion) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) FROM estacion e WHERE e.id_diseno = ?
                  AND (? OR e.transbordo = TRUE)
                  AND (SELECT COUNT(DISTINCT t.nombre_linea) FROM tramo t
                       WHERE t.id_diseno = e.id_diseno
                         AND (t.nombre_estacion_a = e.nombre OR t.nombre_estacion_b = e.nombre)) >= 2
                """, Integer.class, idDiseno, porConexion);
    }

    public <T> List<T> estaciones(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("SELECT nombre, posicion_x, posicion_y FROM estacion WHERE id_diseno = ?", mapeador, idDiseno);
    }

    public <T> List<T> tramos(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("SELECT nombre_linea, nombre_estacion_a, nombre_estacion_b FROM tramo WHERE id_diseno = ?", mapeador, idDiseno);
    }
}
