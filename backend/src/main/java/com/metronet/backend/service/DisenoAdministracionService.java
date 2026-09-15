package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarConexionRequest;
import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarLineaRequest;
import com.metronet.backend.dto.ConexionResponse;
import com.metronet.backend.dto.DisenoDetalleResponse;
import com.metronet.backend.dto.DisenoResumenResponse;
import com.metronet.backend.dto.EstacionResponse;
import com.metronet.backend.dto.LineaMetroResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DisenoAdministracionService {
    private final JdbcTemplate jdbcTemplate;

    public DisenoAdministracionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<DisenoResumenResponse> listarDisenos() {
        return jdbcTemplate.query("""
            SELECT d.id_diseno, COALESCE(NULLIF(CONCAT_WS(' ', u.nombre, u.apellido), ''), 'Sin usuario asignado') AS propietario,
                   u.email, e.id_escenario, e.modo, i.estado
            FROM diseno d
            LEFT JOIN intento i ON i.id_diseno = d.id_diseno
            LEFT JOIN usuario u ON u.id_usuario = i.id_usuario
            LEFT JOIN escenario e ON e.id_escenario = i.id_escenario
            ORDER BY d.id_diseno
            """, (resultado, fila) -> new DisenoResumenResponse(
                resultado.getInt("id_diseno"),
                resultado.getString("propietario"),
                resultado.getString("email"),
                (Integer) resultado.getObject("id_escenario"),
                resultado.getString("modo"),
                resultado.getString("estado")
            ));
    }

    public DisenoDetalleResponse obtenerDiseno(Integer idDiseno) {
        DisenoResumenResponse diseno = listarDisenos().stream()
            .filter(candidato -> candidato.idDiseno().equals(idDiseno))
            .findFirst()
            .orElseThrow(() -> noEncontrado("No existe el diseño solicitado"));

        List<LineaMetroResponse> lineas = jdbcTemplate.query(
            "SELECT nombre, modificable FROM linea WHERE id_diseno = ? ORDER BY nombre",
            (resultado, fila) -> new LineaMetroResponse(resultado.getString("nombre"), resultado.getBoolean("modificable")),
            idDiseno
        );
        List<EstacionResponse> estaciones = jdbcTemplate.query("""
            SELECT nombre, posicion_x, posicion_y, transbordo, modificable
            FROM estacion WHERE id_diseno = ? ORDER BY nombre
            """, (resultado, fila) -> new EstacionResponse(
                resultado.getString("nombre"),
                resultado.getBigDecimal("posicion_x"),
                resultado.getBigDecimal("posicion_y"),
                resultado.getBoolean("transbordo"),
                resultado.getBoolean("modificable")
            ), idDiseno);
        List<ConexionResponse> conexiones = jdbcTemplate.query("""
            SELECT nombre_linea, nombre_estacion FROM pasa
            WHERE id_diseno = ? ORDER BY nombre_linea, nombre_estacion
            """, (resultado, fila) -> new ConexionResponse(
                resultado.getString("nombre_linea"), resultado.getString("nombre_estacion")
            ), idDiseno);

        return new DisenoDetalleResponse(diseno, lineas, estaciones, conexiones);
    }

    @Transactional
    public void actualizarLinea(Integer idDiseno, String nombreActual, ActualizarLineaRequest solicitud) {
        String nuevoNombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre de línea válido");
        verificarLinea(idDiseno, nombreActual);

        if (nombreActual.equals(nuevoNombre)) {
            return;
        }

        if (existeLinea(idDiseno, nuevoNombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
        }

        jdbcTemplate.update("""
            INSERT INTO linea (id_diseno, nombre, modificable)
            SELECT id_diseno, ?, modificable FROM linea WHERE id_diseno = ? AND nombre = ?
            """, nuevoNombre, idDiseno, nombreActual);
        jdbcTemplate.update("UPDATE pasa SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
        jdbcTemplate.update("UPDATE metro SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
        jdbcTemplate.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreActual);
    }

    public void eliminarLinea(Integer idDiseno, String nombreLinea) {
        if (jdbcTemplate.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreLinea) == 0) {
            throw noEncontrado("No existe la línea solicitada");
        }
    }

    @Transactional
    public void actualizarEstacion(Integer idDiseno, String nombreActual, ActualizarEstacionRequest solicitud) {
        if (solicitud == null || solicitud.posicionX() == null || solicitud.posicionY() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una posición válida para la estación");
        }

        String nuevoNombre = nombreValido(solicitud.nombre(), "Ingresá un nombre de estación válido");
        verificarEstacion(idDiseno, nombreActual);

        if (nombreActual.equals(nuevoNombre)) {
            jdbcTemplate.update("""
                UPDATE estacion SET posicion_x = ?, posicion_y = ?, transbordo = ?
                WHERE id_diseno = ? AND nombre = ?
                """, solicitud.posicionX(), solicitud.posicionY(), solicitud.transbordo(), idDiseno, nombreActual);
            return;
        }

        if (existeEstacion(idDiseno, nuevoNombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una estación con ese nombre");
        }

        jdbcTemplate.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            SELECT id_diseno, ?, ?, ?, ?, modificable FROM estacion WHERE id_diseno = ? AND nombre = ?
            """, nuevoNombre, solicitud.posicionX(), solicitud.posicionY(), solicitud.transbordo(), idDiseno, nombreActual);
        jdbcTemplate.update("UPDATE pasa SET nombre_estacion = ? WHERE id_diseno = ? AND nombre_estacion = ?", nuevoNombre, idDiseno, nombreActual);
        jdbcTemplate.update("DELETE FROM estacion WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreActual);
    }

    public void eliminarEstacion(Integer idDiseno, String nombreEstacion) {
        if (jdbcTemplate.update("DELETE FROM estacion WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreEstacion) == 0) {
            throw noEncontrado("No existe la estación solicitada");
        }
    }

    public void actualizarConexion(Integer idDiseno, String nombreLineaActual, String nombreEstacionActual, ActualizarConexionRequest solicitud) {
        if (solicitud == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una conexión válida");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        String nombreEstacion = nombreValido(solicitud.nombreEstacion(), "Seleccioná una estación válida");
        verificarLinea(idDiseno, nombreLinea);
        verificarEstacion(idDiseno, nombreEstacion);

        if (jdbcTemplate.update("""
            UPDATE pasa SET nombre_linea = ?, nombre_estacion = ?
            WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?
            """, nombreLinea, nombreEstacion, idDiseno, nombreLineaActual, nombreEstacionActual) == 0) {
            throw noEncontrado("No existe la conexión solicitada");
        }
    }

    public void eliminarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        if (jdbcTemplate.update("DELETE FROM pasa WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?", idDiseno, nombreLinea, nombreEstacion) == 0) {
            throw noEncontrado("No existe la conexión solicitada");
        }
    }

    private void verificarLinea(Integer idDiseno, String nombreLinea) {
        if (!existeLinea(idDiseno, nombreLinea)) {
            throw noEncontrado("No existe la línea solicitada");
        }
    }

    private void verificarEstacion(Integer idDiseno, String nombreEstacion) {
        if (!existeEstacion(idDiseno, nombreEstacion)) {
            throw noEncontrado("No existe la estación solicitada");
        }
    }

    private boolean existeLinea(Integer idDiseno, String nombreLinea) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM linea WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombreLinea
        ));
    }

    private boolean existeEstacion(Integer idDiseno, String nombreEstacion) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM estacion WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombreEstacion
        ));
    }

    private String nombreValido(String nombre, String mensaje) {
        if (nombre == null || nombre.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
        }

        return nombre.trim();
    }

    private ResponseStatusException noEncontrado(String mensaje) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, mensaje);
    }
}
