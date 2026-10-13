package com.metronet.backend.service;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Progreso por cuenta, independiente de campañas y de diseños eliminados. */
@Service
public class ExtrasModoLibreService {
    private final JdbcTemplate jdbc;
    public ExtrasModoLibreService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Estado(boolean desbloqueado, boolean bienvenidaVista, List<Integer> visitadas,
                         boolean premioObtenido, TrofeosService.Trofeo nuevoTrofeo) {}

    public Estado consultar(Usuario usuario) {
        var filas = jdbc.query("SELECT bienvenida_vista,premio_obtenido_en IS NOT NULL FROM aprendizaje_extra_usuario WHERE id_usuario=?",
            (r, n) -> new boolean[]{r.getBoolean(1), r.getBoolean(2)}, usuario.getIdUsuario());
        if (filas.isEmpty()) return new Estado(false, false, List.of(), false, null);
        return new Estado(true, filas.getFirst()[0], jdbc.queryForList(
            "SELECT tarjeta FROM aprendizaje_extra_visita WHERE id_usuario=? ORDER BY tarjeta", Integer.class, usuario.getIdUsuario()),
            usuario.getRol() != Rol.ADMIN && filas.getFirst()[1], null);
    }

    @Transactional
    public Estado ingresar(Usuario usuario) {
        Estado previo = consultar(usuario);
        if (previo.desbloqueado()) return previo;
        boolean permitido = usuario.getRol() == Rol.ADMIN || Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT campana_completada_historicamente FROM usuario WHERE id_usuario=?", Boolean.class, usuario.getIdUsuario()));
        boolean redLibre = Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM intento i JOIN escenario e USING(id_escenario)
              WHERE i.id_usuario=? AND e.modo='EDICION_LIBRE')
            """, Boolean.class, usuario.getIdUsuario()));
        if (!permitido || !redLibre) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ingresá a Modo Libre para desbloquear Extras");
        jdbc.update("INSERT INTO aprendizaje_extra_usuario(id_usuario) VALUES (?) ON CONFLICT DO NOTHING", usuario.getIdUsuario());
        return consultar(usuario);
    }

    @Transactional
    public Estado bienvenida(Usuario usuario) {
        bloquear(usuario);
        jdbc.update("UPDATE aprendizaje_extra_usuario SET bienvenida_vista=TRUE WHERE id_usuario=?", usuario.getIdUsuario());
        return consultar(usuario);
    }

    @Transactional
    public Estado visitar(Usuario usuario, int tarjeta) {
        if (tarjeta < 1 || tarjeta > 7) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        bloquear(usuario); // Serializa visitas concurrentes y la entrega del premio.
        jdbc.update("INSERT INTO aprendizaje_extra_visita(id_usuario,tarjeta) VALUES (?,?) ON CONFLICT DO NOTHING", usuario.getIdUsuario(), tarjeta);
        boolean nuevo = usuario.getRol() != Rol.ADMIN && jdbc.update("""
            UPDATE aprendizaje_extra_usuario SET premio_obtenido_en=CURRENT_TIMESTAMP
            WHERE id_usuario=? AND premio_obtenido_en IS NULL
              AND (SELECT COUNT(*) FROM aprendizaje_extra_visita WHERE id_usuario=?)=7
            """, usuario.getIdUsuario(), usuario.getIdUsuario()) == 1;
        Estado estado = consultar(usuario);
        return new Estado(estado.desbloqueado(), estado.bienvenidaVista(), estado.visitadas(), estado.premioObtenido(),
            nuevo ? TrofeosService.trofeoExtras(true) : null);
    }

    private void bloquear(Usuario usuario) {
        var filas = jdbc.queryForList("SELECT id_usuario FROM aprendizaje_extra_usuario WHERE id_usuario=? FOR UPDATE", Integer.class, usuario.getIdUsuario());
        if (filas.isEmpty()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Extras todavía bloqueados");
    }
}
