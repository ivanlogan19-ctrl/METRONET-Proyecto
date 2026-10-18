package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class AprendizajeRepository {
    private final JdbcTemplate jdbc;

    public AprendizajeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> numerosCompletados(RowMapper<T> mapeador, Integer idUsuario) {
        return jdbc.query("""
            SELECT DISTINCT e.numero FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
            WHERE i.id_usuario=? AND i.estado='COMPLETADO' AND e.progresivo=TRUE
              AND e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10
            """, mapeador, idUsuario);
    }

    public Boolean nivelCompletado(Integer idUsuario, int numero) {
        return jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
                WHERE i.id_usuario=? AND i.estado='COMPLETADO' AND e.progresivo=TRUE
                  AND e.modo='NIVEL' AND e.numero=?)
            """, Boolean.class, idUsuario, numero);
    }
}
