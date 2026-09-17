package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarConfiguracionRequest;
import com.metronet.backend.dto.ConfiguracionResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ConfiguracionService {
    public static final String CLAVE_VELOCIDAD_SIMULACION = "velocidad_simulacion";
    public static final String CLAVE_CAPACIDAD_UNIDAD = "capacidad_unidad";
    public static final String CLAVE_MODO_MANTENIMIENTO = "modo_mantenimiento";
    private static final int CAPACIDAD_MAXIMA_UNIDAD = 2_000;
    private static final List<BigDecimal> VELOCIDADES_SIMULACION_PERMITIDAS = List.of(
        new BigDecimal("0.5"),
        BigDecimal.ONE,
        new BigDecimal("2"),
        new BigDecimal("4")
    );
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

        String claveNormalizada = clave == null ? "" : clave.trim().toLowerCase(Locale.ROOT);
        String valor = normalizarValor(claveNormalizada, solicitud.valor());
        if (jdbcTemplate.update("UPDATE configuracion SET valor = ? WHERE clave = ?", valor, claveNormalizada) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la configuración solicitada");
        }

        return jdbcTemplate.queryForObject("""
            SELECT clave, valor, descripcion FROM configuracion WHERE clave = ?
            """, (resultado, fila) -> new ConfiguracionResponse(
                resultado.getString("clave"), resultado.getString("valor"), resultado.getString("descripcion")
            ), claveNormalizada);
    }

    public boolean estaModoMantenimientoActivo() {
        List<String> valores = jdbcTemplate.query(
            "SELECT valor FROM configuracion WHERE clave = ?",
            (resultado, fila) -> resultado.getString("valor"),
            CLAVE_MODO_MANTENIMIENTO
        );
        return !valores.isEmpty() && "activado".equalsIgnoreCase(valores.getFirst().trim());
    }

    private String normalizarValor(String clave, String valorOriginal) {
        String valor = valorOriginal.trim();
        return switch (clave) {
            case CLAVE_VELOCIDAD_SIMULACION -> normalizarVelocidadSimulacion(valor);
            case CLAVE_CAPACIDAD_UNIDAD -> normalizarCapacidadUnidad(valor);
            case CLAVE_MODO_MANTENIMIENTO -> normalizarModoMantenimiento(valor);
            default -> valor;
        };
    }

    private String normalizarVelocidadSimulacion(String valor) {
        try {
            BigDecimal velocidad = new BigDecimal(valor);
            boolean permitida = VELOCIDADES_SIMULACION_PERMITIDAS.stream()
                .anyMatch(valorPermitido -> valorPermitido.compareTo(velocidad) == 0);
            if (permitida) return velocidad.stripTrailingZeros().toPlainString();
        } catch (NumberFormatException excepcion) {
            // El mensaje uniforme se informa debajo.
        }
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "La velocidad de simulación debe ser 0.5, 1, 2 o 4"
        );
    }

    private String normalizarCapacidadUnidad(String valor) {
        try {
            int capacidad = Integer.parseInt(valor);
            if (capacidad > 0 && capacidad <= CAPACIDAD_MAXIMA_UNIDAD) return String.valueOf(capacidad);
        } catch (NumberFormatException excepcion) {
            // El mensaje uniforme se informa debajo.
        }
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "La capacidad de una unidad debe ser un número entero entre 1 y " + CAPACIDAD_MAXIMA_UNIDAD
        );
    }

    private String normalizarModoMantenimiento(String valor) {
        String modo = valor.toLowerCase(Locale.ROOT);
        if ("activado".equals(modo) || "desactivado".equals(modo)) return modo;
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "El modo de mantenimiento debe ser activado o desactivado"
        );
    }
}
