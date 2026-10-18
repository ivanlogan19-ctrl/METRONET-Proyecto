package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ExtrasModoLibreRepository {
    private final JdbcTemplate jdbc;

    public ExtrasModoLibreRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> estadoUsuario(RowMapper<T> mapeador, Integer idUsuario) {
        return jdbc.query("SELECT bienvenida_vista,premio_obtenido_en IS NOT NULL FROM aprendizaje_extra_usuario WHERE id_usuario=?", mapeador, idUsuario);
    }

    public List<Integer> tarjetasVisitadas(Integer idUsuario) {
        return jdbc.queryForList("SELECT tarjeta FROM aprendizaje_extra_visita WHERE id_usuario=? ORDER BY tarjeta", Integer.class, idUsuario);
    }

    public Boolean campanaCompletada(Integer idUsuario) {
        return jdbc.queryForObject("SELECT campana_completada_historicamente FROM usuario WHERE id_usuario=?", Boolean.class, idUsuario);
    }

    public Boolean tieneIntentoLibre(Integer idUsuario) {
        return jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM intento i JOIN escenario e USING(id_escenario)
              WHERE i.id_usuario=? AND e.modo='EDICION_LIBRE')
            """, Boolean.class, idUsuario);
    }

    public int registrarIngreso(Integer idUsuario) {
        return jdbc.update("INSERT INTO aprendizaje_extra_usuario(id_usuario) VALUES (?) ON CONFLICT DO NOTHING", idUsuario);
    }

    public int registrarBienvenida(Integer idUsuario) {
        return jdbc.update("UPDATE aprendizaje_extra_usuario SET bienvenida_vista=TRUE WHERE id_usuario=?", idUsuario);
    }

    public int registrarVisita(Integer idUsuario, int tarjeta) {
        return jdbc.update("INSERT INTO aprendizaje_extra_visita(id_usuario,tarjeta) VALUES (?,?) ON CONFLICT DO NOTHING", idUsuario, tarjeta);
    }

    public int otorgarPremioCompleto(Integer idUsuario, Integer idUsuarioVisitas) {
        return jdbc.update("""
            UPDATE aprendizaje_extra_usuario SET premio_obtenido_en=CURRENT_TIMESTAMP
            WHERE id_usuario=? AND premio_obtenido_en IS NULL
              AND (SELECT COUNT(*) FROM aprendizaje_extra_visita WHERE id_usuario=?)=7
            """, idUsuario, idUsuarioVisitas);
    }

    public List<Integer> bloquearUsuario(Integer idUsuario) {
        return jdbc.queryForList("SELECT id_usuario FROM aprendizaje_extra_usuario WHERE id_usuario=? FOR UPDATE", Integer.class, idUsuario);
    }
}
