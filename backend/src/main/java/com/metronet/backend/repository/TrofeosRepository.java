package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class TrofeosRepository {
    private final JdbcTemplate jdbc;

    public TrofeosRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Boolean esAdministrador(Integer idUsuario) {
        return jdbc.queryForObject("SELECT rol = 'ADMIN' FROM usuario WHERE id_usuario=?", Boolean.class, idUsuario);
    }

    public <T> List<T> logrosPorNivel(RowMapper<T> mapeador, Integer idUsuario) {
        return jdbc.query("""
            SELECT e.numero,e.reglas_exito::text,MAX(i.id_intento) AS intento_completado,MAX(i.puntaje) AS mejor
            FROM escenario e LEFT JOIN intento i ON i.id_escenario=e.id_escenario
              AND i.id_usuario=? AND i.estado='COMPLETADO'
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10
            GROUP BY e.id_escenario,e.numero,e.reglas_exito ORDER BY e.numero
            """, mapeador, idUsuario);
    }

    public Boolean premioExtrasObtenido(Integer idUsuario) {
        return jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM aprendizaje_extra_usuario WHERE id_usuario=? AND premio_obtenido_en IS NOT NULL)", Boolean.class, idUsuario);
    }
}
