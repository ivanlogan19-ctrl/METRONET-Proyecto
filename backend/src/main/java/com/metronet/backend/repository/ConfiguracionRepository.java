package com.metronet.backend.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ConfiguracionRepository {
    private final JdbcTemplate jdbc;

    public ConfiguracionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> listarConfiguraciones(RowMapper<T> mapeador) {
        return jdbc.query("""
            SELECT clave, valor, descripcion FROM configuracion ORDER BY clave
            """, mapeador);
    }

    public int actualizarValor(String valor, String claveNormalizada) {
        return jdbc.update("UPDATE configuracion SET valor = ? WHERE clave = ?", valor, claveNormalizada);
    }

    public <T> T obtenerConfiguracion(RowMapper<T> mapeador, String claveNormalizada) {
        return jdbc.queryForObject("""
            SELECT clave, valor, descripcion FROM configuracion WHERE clave = ?
            """, mapeador, claveNormalizada);
    }

    public <T> List<T> obtenerValores(RowMapper<T> mapeador, String clave) {
        return jdbc.query("SELECT valor FROM configuracion WHERE clave = ?", mapeador, clave);
    }
}
