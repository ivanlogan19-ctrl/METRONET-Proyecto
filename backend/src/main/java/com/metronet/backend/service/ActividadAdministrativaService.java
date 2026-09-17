package com.metronet.backend.service;

import com.metronet.backend.dto.ActividadAdministrativaResponse;
import com.metronet.backend.entity.Usuario;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ActividadAdministrativaService {
    private final JdbcTemplate jdbcTemplate;

    public ActividadAdministrativaService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void registrarActividad(Usuario administrador, String accion, String detalle) {
        jdbcTemplate.update(
            "INSERT INTO actividad_administrativa (id_administrador, accion, detalle) VALUES (?, ?, ?)",
            administrador.getIdUsuario(),
            accion,
            detalle
        );
    }

    public List<ActividadAdministrativaResponse> listarActividades() {
        return jdbcTemplate.query("""
            SELECT a.id_actividad, COALESCE(u.identificador_administrador, u.nombre) AS administrador,
                   a.accion, a.detalle, a.fecha
            FROM actividad_administrativa a
            JOIN usuario u ON u.id_usuario = a.id_administrador
            ORDER BY a.fecha DESC, a.id_actividad DESC
            LIMIT 100
            """, (resultado, fila) -> new ActividadAdministrativaResponse(
                resultado.getInt("id_actividad"),
                resultado.getString("administrador"),
                resultado.getString("accion"),
                resultado.getString("detalle"),
                resultado.getTimestamp("fecha").toLocalDateTime()
            ));
    }
}
