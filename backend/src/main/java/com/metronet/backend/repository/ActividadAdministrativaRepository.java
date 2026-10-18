package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ActividadAdministrativaRepository {
    private final JdbcTemplate jdbc;

    public ActividadAdministrativaRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int registrarActividad(Integer idAdministrador, String accion, String detalle) {
        return jdbc.update("INSERT INTO actividad_administrativa (id_administrador, accion, detalle) VALUES (?, ?, ?)", idAdministrador, accion, detalle);
    }

    public <T> List<T> listarActividades(RowMapper<T> mapeador) {
        return jdbc.query("""
            SELECT a.id_actividad, COALESCE(u.identificador_administrador, u.nombre) AS administrador,
                   a.accion, a.detalle, a.fecha
            FROM actividad_administrativa a
            JOIN usuario u ON u.id_usuario = a.id_administrador
            ORDER BY a.fecha DESC, a.id_actividad DESC
            LIMIT 100
            """, mapeador);
    }

    public int borrarActividad(int idActividad) {
        return jdbc.update("DELETE FROM actividad_administrativa WHERE id_actividad = ?", idActividad);
    }

    public int borrarTodasLasActividades() {
        return jdbc.update("DELETE FROM actividad_administrativa");
    }
}
