package com.metronet.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RecorridoIntegralRepository {
    private final JdbcTemplate jdbc;

    public RecorridoIntegralRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Boolean esAdministrador(int idAdmin) {
        return jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM usuario WHERE id_usuario=? AND rol='ADMIN')", Boolean.class, idAdmin);
    }

    public List<Map<String,Object>> intentosEnCurso(String recorrido) {
        return jdbc.queryForList("""
            SELECT i.id_intento, nueva.id_nivel_publicacion
            FROM intento i JOIN nivel_publicacion anterior ON anterior.id_nivel_publicacion=i.id_nivel_publicacion
            JOIN nivel_publicacion nueva ON nueva.id_escenario=i.id_escenario
            WHERE anterior.contenido->'desafio'->>'recorrido'='integral-2026-10-objetivos-reales-km-v3'
              AND nueva.contenido->'desafio'->>'recorrido'=?
              AND nueva.numero_version=(SELECT MAX(p.numero_version) FROM nivel_publicacion p WHERE p.id_escenario=i.id_escenario)
              AND i.estado<>'COMPLETADO' AND i.fecha_finalizacion IS NULL
              AND i.numero_campana=(SELECT MAX(j.numero_campana) FROM intento j WHERE j.id_usuario=i.id_usuario)
              AND NOT EXISTS (SELECT 1 FROM intento_uv_ut v WHERE v.id_intento=i.id_intento)
            FOR UPDATE OF i
            """, recorrido);
    }

    public int vincularPublicacion(Object idPublicacion, Object idIntento) {
        return jdbc.update("UPDATE intento SET id_nivel_publicacion=? WHERE id_intento=?", idPublicacion, idIntento);
    }

    public int actualizarCatalogoIntento(Object idIntento, Object idPublicacion) {
        return jdbc.update("""
                UPDATE intento_catalogo_v1 h SET reglas_exito=p.contenido->'reglasExito',
                  herramientas_habilitadas=p.contenido->'herramientasHabilitadas',
                  objetivo=p.contenido->'desafio'->>'objetivo', instrucciones=p.contenido->'desafio'->>'instrucciones'
                FROM nivel_publicacion p WHERE h.id_intento=? AND p.id_nivel_publicacion=?
                """, idIntento, idPublicacion);
    }
}
