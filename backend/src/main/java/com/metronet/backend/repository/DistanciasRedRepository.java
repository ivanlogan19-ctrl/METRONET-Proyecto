package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class DistanciasRedRepository {
    private final JdbcTemplate jdbc;

    public DistanciasRedRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> tramos(RowMapper<T> mapeador, int idDiseno) {
        return jdbc.query("""
            SELECT t.nombre_linea,t.nombre_estacion_a,t.nombre_estacion_b,
                a.posicion_x ax,a.posicion_y ay,b.posicion_x bx,b.posicion_y lat_b
            FROM tramo t JOIN estacion a ON a.id_diseno=t.id_diseno AND a.nombre=t.nombre_estacion_a
            JOIN estacion b ON b.id_diseno=t.id_diseno AND b.nombre=t.nombre_estacion_b
            WHERE t.id_diseno=? ORDER BY t.nombre_linea,t.nombre_estacion_a,t.nombre_estacion_b
            """, mapeador, idDiseno);
    }
    public <T> List<T> conexiones(RowMapper<T> mapeador, int idDiseno) {
        return jdbc.query("""
            SELECT '@conexion:' || c.id_conexion, c.estacion_a, c.estacion_b,
                a.posicion_x ax,a.posicion_y ay,b.posicion_x bx,b.posicion_y lat_b
            FROM conexion_lineas c JOIN estacion a ON a.id_diseno=c.id_diseno AND a.nombre=c.estacion_a
            JOIN estacion b ON b.id_diseno=c.id_diseno AND b.nombre=c.estacion_b
            WHERE c.id_diseno=? ORDER BY c.id_conexion
            """, mapeador, idDiseno);
    }

}
