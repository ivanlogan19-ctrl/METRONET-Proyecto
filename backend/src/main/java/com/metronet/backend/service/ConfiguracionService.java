package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarConfiguracionRequest;
import com.metronet.backend.dto.ConfiguracionResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ConfiguracionService {
    private final JdbcTemplate jdbcTemplate;

    public ConfiguracionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ConfiguracionResponse> listarConfiguraciones() {
        return jdbcTemplate.query("""
            SELECT clave, valor, descripcion FROM configuracion ORDER BY clave
            """, (resultado, fila) -> new ConfiguracionResponse(
                resultado.getString("clave"), resultado.getString("valor"), resultado.getString("descripcion")
            ));
    }

    public ConfiguracionResponse actualizarConfiguracion(String clave, ActualizarConfiguracionRequest solicitud) {
        if (solicitud == null || solicitud.valor() == null || solicitud.valor().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un valor válido para la configuración");
        }

        String valor = solicitud.valor().trim();
        if (jdbcTemplate.update("UPDATE configuracion SET valor = ? WHERE clave = ?", valor, clave) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la configuración solicitada");
        }

        return jdbcTemplate.queryForObject("""
            SELECT clave, valor, descripcion FROM configuracion WHERE clave = ?
            """, (resultado, fila) -> new ConfiguracionResponse(
                resultado.getString("clave"), resultado.getString("valor"), resultado.getString("descripcion")
            ), clave);
    }
}
