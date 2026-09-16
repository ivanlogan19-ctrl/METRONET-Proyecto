package com.metronet.backend.service;

import com.metronet.backend.dto.SolicitudRecuperacionResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.repository.UsuarioRepository;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class RecuperacionContrasenaService {
    private final JdbcTemplate jdbcTemplate;
    private final UsuarioRepository usuarioRepository;

    public RecuperacionContrasenaService(JdbcTemplate jdbcTemplate, UsuarioRepository usuarioRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.usuarioRepository = usuarioRepository;
    }

    public void solicitarRecuperacion(String email) {
        if (email == null || email.isBlank()) {
            return;
        }

        usuarioRepository.findByEmailIgnoreCase(email.trim()).ifPresent(this::registrarSolicitudSiNoExiste);
    }

    public List<SolicitudRecuperacionResponse> listarSolicitudes() {
        return jdbcTemplate.query("""
            SELECT s.id_solicitud, CONCAT_WS(' ', u.nombre, u.apellido) AS nombre_usuario,
                   u.email, s.fecha_solicitud, s.estado
            FROM solicitud_recuperacion_contrasena s
            JOIN usuario u ON u.id_usuario = s.id_usuario
            ORDER BY CASE s.estado WHEN 'PENDIENTE' THEN 0 ELSE 1 END, s.fecha_solicitud DESC
            """, (resultado, fila) -> new SolicitudRecuperacionResponse(
                resultado.getInt("id_solicitud"),
                resultado.getString("nombre_usuario"),
                resultado.getString("email"),
                resultado.getTimestamp("fecha_solicitud").toLocalDateTime(),
                resultado.getString("estado")
            ));
    }

    public void marcarAtendida(Integer idSolicitud) {
        jdbcTemplate.update("UPDATE solicitud_recuperacion_contrasena SET estado = 'ATENDIDA' WHERE id_solicitud = ?", idSolicitud);
    }

    private void registrarSolicitudSiNoExiste(Usuario usuario) {
        Boolean existePendiente = jdbcTemplate.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM solicitud_recuperacion_contrasena WHERE id_usuario = ? AND estado = 'PENDIENTE')
            """, Boolean.class, usuario.getIdUsuario());

        if (!Boolean.TRUE.equals(existePendiente)) {
            jdbcTemplate.update("INSERT INTO solicitud_recuperacion_contrasena (id_usuario) VALUES (?)", usuario.getIdUsuario());
        }
    }
}
