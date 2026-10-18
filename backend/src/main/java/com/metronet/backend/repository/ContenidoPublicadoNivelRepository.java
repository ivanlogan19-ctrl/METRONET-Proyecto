package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ContenidoPublicadoNivelRepository {
    private final JdbcTemplate jdbc;

    public ContenidoPublicadoNivelRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> publicacionActual(RowMapper<T> mapeador, int numero) {
        return jdbc.query("""
            SELECT p.id_nivel_publicacion,e.numero,p.numero_version,p.contenido::text
            FROM escenario e JOIN nivel_publicacion p ON p.id_escenario=e.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            ORDER BY p.numero_version DESC LIMIT 1
            """, mapeador, numero);
    }

    public <T> List<T> publicacionDeIntento(RowMapper<T> mapeador, int idIntento, int idUsuario) {
        return jdbc.query("""
            SELECT p.id_nivel_publicacion,e.numero,p.numero_version,p.contenido::text
            FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
              JOIN nivel_publicacion p ON p.id_nivel_publicacion=i.id_nivel_publicacion
            WHERE i.id_intento=? AND i.id_usuario=? AND e.progresivo=TRUE AND e.modo='NIVEL'
            """, mapeador, idIntento, idUsuario);
    }

    public void consultarTarjetas(RowCallbackHandler lector, long id) {
        jdbc.query("""
                SELECT id_tarjeta,titulo,texto,aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo
                FROM nivel_publicacion_tarjeta WHERE id_nivel_publicacion=? ORDER BY posicion
                """, lector, id);
    }
}
