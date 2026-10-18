package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UsuarioDepuracionRepository {
    private final JdbcTemplate jdbc;

    public UsuarioDepuracionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int eliminarActividad(Integer idUsuario) {
        return jdbc.update("DELETE FROM actividad_administrativa WHERE id_administrador = ?", idUsuario);
    }

    public int eliminarDisenosDeUsuario(Integer idUsuario) {
        return jdbc.update("""
            DELETE FROM diseno
            WHERE id_diseno IN (
                SELECT id_diseno FROM intento WHERE id_usuario = ?
            )
            """, idUsuario);
    }

    public <T> List<T> escenariosNoProgresivos(RowMapper<T> mapeador, Integer idUsuario, Integer idUsuarioIntentos) {
        return jdbc.query("""
            SELECT DISTINCT e.id_escenario
            FROM escenario e
            WHERE COALESCE(e.progresivo, FALSE) = FALSE
              AND (
                  e.id_diseno_base IN (
                      SELECT i.id_diseno FROM intento i WHERE i.id_usuario = ?
                  )
                  OR e.id_escenario IN (
                      SELECT i.id_escenario FROM intento i WHERE i.id_usuario = ?
                  )
              )
            """, mapeador, idUsuario, idUsuarioIntentos);
    }

    public int eliminarEscenarioSinIntentos(Integer idEscenario, Integer idEscenarioIntentos) {
        return jdbc.update("""
                DELETE FROM escenario
                WHERE id_escenario = ?
                  AND COALESCE(progresivo, FALSE) = FALSE
                  AND NOT EXISTS (
                      SELECT 1 FROM intento WHERE id_escenario = ?
                  )
                """, idEscenario, idEscenarioIntentos);
    }
}
