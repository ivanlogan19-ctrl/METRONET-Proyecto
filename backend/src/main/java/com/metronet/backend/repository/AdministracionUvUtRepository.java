package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class AdministracionUvUtRepository {
    private final JdbcTemplate jdbc;

    public AdministracionUvUtRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> listarCriterios(RowMapper<T> mapeador) {
        return jdbc.query("""
            SELECT e.numero,COALESCE(c.version,0),c.limite_ut,c.presupuesto_uv,e.reglas_exito::text,e.herramientas_habilitadas::text
            FROM escenario e LEFT JOIN criterio_uv_ut c ON c.id_escenario=e.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 4 AND 10 ORDER BY e.numero
            """, mapeador);
    }

    public <T> List<T> reglasYHerramientas(RowMapper<T> mapeador, int numero) {
        return jdbc.query("""
            SELECT e.reglas_exito::text,e.herramientas_habilitadas::text FROM escenario e
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            """, mapeador, numero);
    }

    public Boolean tieneBorradoresPublicos() {
        return jdbc.queryForObject("SELECT to_regclass('nivel_borrador') IS NOT NULL AND to_regclass('escenario')=to_regclass('public.escenario')", Boolean.class);
    }

    public <T> List<T> referenciaBorrador(RowMapper<T> mapeador, int numero) {
        return jdbc.query("""
            SELECT b.red_referencia::text FROM nivel_borrador b JOIN escenario e ON e.id_escenario=b.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            """, mapeador, numero);
    }
}
