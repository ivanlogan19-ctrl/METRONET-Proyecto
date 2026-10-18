package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class AdministracionNivelesRepository {
    private final JdbcTemplate jdbc;

    public AdministracionNivelesRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> listar(RowMapper<T> mapeador) {
        return jdbc.query("""
            SELECT e.numero,e.nombre,p.numero_version,b.revision FROM escenario e
            JOIN LATERAL (SELECT numero_version FROM nivel_publicacion WHERE id_escenario=e.id_escenario
              ORDER BY numero_version DESC LIMIT 1) p ON TRUE
            JOIN nivel_borrador b ON b.id_escenario=e.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10 ORDER BY e.numero
            """, mapeador);
    }

    public <T> List<T> borrador(RowMapper<T> mapeador, int numero) {
        return jdbc.query("""
            SELECT b.version_base,b.revision,b.contenido::text,b.red_referencia::text,b.tarjetas::text
            FROM nivel_borrador b JOIN escenario e ON e.id_escenario=b.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            """, mapeador, numero);
    }

    public int guardar(String contenido, String redReferencia, String tarjetas, Integer idAdmin, int id, int revision, int vigente) {
        return jdbc.update("""
            UPDATE nivel_borrador SET contenido=CAST(? AS jsonb),red_referencia=CAST(? AS jsonb),
              tarjetas=CAST(? AS jsonb),revision=revision+1,autor_id=?,actualizado_en=clock_timestamp()
            WHERE id_escenario=? AND revision=? AND version_base=?
            """, contenido, redReferencia, tarjetas, idAdmin, id, revision, vigente);
    }

    public <T> List<T> versiones(RowMapper<T> mapeador, int numero) {
        return jdbc.query("""
            SELECT p.numero_version,p.version_criterio_uv_ut,p.contenido::text,p.red_referencia::text,
              p.huella,p.publicado_en::text,p.id_nivel_publicacion
            FROM nivel_publicacion p JOIN escenario e ON e.id_escenario=p.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=? ORDER BY p.numero_version DESC
            """, mapeador, numero);
    }

    public <T> List<T> versionesSinUso(RowMapper<T> mapeador, int id, int vigente) {
        return jdbc.query("""
            SELECT p.id_nivel_publicacion,p.numero_version FROM nivel_publicacion p
            WHERE p.id_escenario=? AND p.numero_version<?
              AND NOT EXISTS (SELECT 1 FROM intento i WHERE i.id_nivel_publicacion=p.id_nivel_publicacion)
              AND NOT EXISTS (SELECT 1 FROM nivel_borrador b
                WHERE b.id_escenario=p.id_escenario AND b.version_base=p.numero_version)
            ORDER BY p.numero_version
            """, mapeador, id, vigente);
    }

    public int borrarTarjetasVersion(long idPublicacion) {
        return jdbc.update("DELETE FROM nivel_publicacion_tarjeta WHERE id_nivel_publicacion=?", idPublicacion);
    }

    public int borrarVersion(long idPublicacion) {
        return jdbc.update("DELETE FROM nivel_publicacion WHERE id_nivel_publicacion=?", idPublicacion);
    }

    public int registrarBorrado(Integer idAdmin, String accion, String detalle) {
        return jdbc.update("""
            INSERT INTO actividad_administrativa(id_administrador,accion,detalle) VALUES (?,?,?)
            """, idAdmin, accion, detalle);
    }

    public Integer contarVersiones(int id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM nivel_publicacion WHERE id_escenario=?", Integer.class, id);
    }

    public int prepararReversion(int vigente, String contenido, String redReferencia, String tarjetas, Integer idAdmin, int id, int revision) {
        return jdbc.update("""
            UPDATE nivel_borrador SET version_base=?,revision=revision+1,contenido=CAST(? AS jsonb),
              red_referencia=CAST(? AS jsonb),tarjetas=CAST(? AS jsonb),autor_id=?,actualizado_en=clock_timestamp()
            WHERE id_escenario=? AND revision=?
            """, vigente, contenido, redReferencia, tarjetas, idAdmin, id, revision);
    }

    public void tarjetas(RowCallbackHandler lector, long idPublicacion) {
        jdbc.query("""
            SELECT id_tarjeta,titulo,texto,aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo
            FROM nivel_publicacion_tarjeta WHERE id_nivel_publicacion=? ORDER BY posicion
            """, lector, idPublicacion);
    }

    public Integer versionVigente(int idEscenario) {
        return jdbc.queryForObject("SELECT MAX(numero_version) FROM nivel_publicacion WHERE id_escenario=?", Integer.class, idEscenario);
    }
    public List<Integer> idEscenario(int numero, boolean bloquear) {
        String sql = "SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=?"
            + (bloquear ? " FOR UPDATE" : "");
        return jdbc.query(sql, (resultado, fila) -> resultado.getInt(1), numero);
    }
}
