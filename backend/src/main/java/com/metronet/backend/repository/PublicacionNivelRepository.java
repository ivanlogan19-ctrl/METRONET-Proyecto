package com.metronet.backend.repository;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class PublicacionNivelRepository {
    private final JdbcTemplate jdbc;

    public PublicacionNivelRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Integer versionCriterioActual(int id) {
        return jdbc.queryForObject("SELECT version FROM criterio_uv_ut WHERE id_escenario=? FOR UPDATE", Integer.class, id);
    }

    public Integer siguienteVersionCriterio(int id) {
        return jdbc.queryForObject("SELECT version+1 FROM criterio_uv_ut WHERE id_escenario=? FOR UPDATE", Integer.class, id);
    }

    public Long crearPublicacion(
        int id,
        int siguiente,
        Integer versionCriterio,
        String contenido,
        String redReferencia,
        String huella,
        int idAdmin
    ) {
        return jdbc.queryForObject("""
            INSERT INTO nivel_publicacion(id_escenario,numero_version,version_criterio_uv_ut,contenido,
              red_referencia,huella,autor_id,confirmacion_editorial)
            VALUES (?,?,?,CAST(? AS jsonb),CAST(? AS jsonb),?,?,TRUE) RETURNING id_nivel_publicacion
            """, Long.class, id, siguiente, versionCriterio, contenido, redReferencia, huella, idAdmin);
    }

    public int crearTarjeta(
        long publicacion,
        int posicion,
        String idTarjeta,
        String titulo,
        String texto,
        String aprendizaje,
        String fuente,
        String urlFuente,
        String descripcionImagen,
        String imagen,
        String hash
    ) {
        return jdbc.update("""
                INSERT INTO nivel_publicacion_tarjeta(id_nivel_publicacion,posicion,id_tarjeta,titulo,texto,
                  aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo,sha256_svg)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """, publicacion, posicion, idTarjeta, titulo, texto, aprendizaje, fuente, urlFuente, descripcionImagen, imagen, hash);
    }

    public int actualizarEscenario(String nombre, String objetivo, String instrucciones, String dificultad, String reglasExito, String herramientasHabilitadas, int id) {
        return jdbc.update("""
            UPDATE escenario SET nombre=?,objetivo=?,instrucciones=?,dificultad=?,
              reglas_exito=CAST(? AS jsonb),herramientas_habilitadas=CAST(? AS jsonb)
            WHERE id_escenario=?
            """, nombre, objetivo, instrucciones, dificultad, reglasExito, herramientasHabilitadas, id);
    }

    public int actualizarCriterio(Integer versionCriterio, int limiteUt, BigDecimal presupuestoUv, int id) {
        return jdbc.update("""
            UPDATE criterio_uv_ut SET version=?,limite_ut=?,presupuesto_uv=? WHERE id_escenario=?
            """, versionCriterio, limiteUt, presupuestoUv, id);
    }

    public int actualizarVersionBorrador(int siguiente, int id) {
        return jdbc.update("UPDATE nivel_borrador SET version_base=?,revision=revision+1 WHERE id_escenario=?", siguiente, id);
    }

    public int registrarPublicacion(int idAdmin, String detalle) {
        return jdbc.update("""
            INSERT INTO actividad_administrativa(id_administrador,accion,detalle)
            VALUES (?,'PUBLICAR_NIVEL',?)
            """, idAdmin, detalle);
    }

    public <T> List<T> idEscenario(boolean bloquear, RowMapper<T> mapeador, int numero) {
        return jdbc.query("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=?"
            +(bloquear?" FOR UPDATE":" FOR SHARE"), mapeador, numero);
    }

    public Integer version(int idEscenario) {
        return jdbc.queryForObject("SELECT MAX(numero_version) FROM nivel_publicacion WHERE id_escenario=?", Integer.class, idEscenario);
    }
}
