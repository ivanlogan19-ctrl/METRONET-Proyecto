package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarConexionRequest;
import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarLineaRequest;
import com.metronet.backend.dto.ActualizarTramoRequest;
import com.metronet.backend.dto.ActualizarUnidadMetroRequest;
import com.metronet.backend.dto.ConexionResponse;
import com.metronet.backend.dto.CrearConexionRequest;
import com.metronet.backend.dto.CrearEstacionAdministracionRequest;
import com.metronet.backend.dto.CrearLineaAdministracionRequest;
import com.metronet.backend.dto.DisenoDetalleResponse;
import com.metronet.backend.dto.DisenoResumenResponse;
import com.metronet.backend.dto.EstacionResponse;
import com.metronet.backend.dto.LineaMetroResponse;
import com.metronet.backend.dto.TramoResponse;
import com.metronet.backend.dto.UnidadMetroResponse;
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
        List<TramoResponse> tramos = jdbcTemplate.query("""
            SELECT nombre_linea, nombre_estacion_a, nombre_estacion_b
            FROM tramo WHERE id_diseno = ? ORDER BY id_tramo
            """, (resultado, fila) -> new TramoResponse(
                resultado.getString("nombre_linea"),
                resultado.getString("nombre_estacion_a"),
                resultado.getString("nombre_estacion_b")
            ), idDiseno);
        List<UnidadMetroResponse> unidadesMetro = jdbcTemplate.query("""
            SELECT id_tren, nombre_linea, capacidad, velocidad_promedio
            FROM metro WHERE id_diseno = ? ORDER BY id_tren
            """, (resultado, fila) -> new UnidadMetroResponse(
                resultado.getInt("id_tren"),
                resultado.getString("nombre_linea"),
                resultado.getInt("capacidad"),
                resultado.getBigDecimal("velocidad_promedio")
            ), idDiseno);

        return new DisenoDetalleResponse(diseno, lineas, estaciones, conexiones, tramos, unidadesMetro);
    }

    @Transactional
    public void eliminarDiseno(Integer idDiseno) {
        Integer idEscenario = jdbcTemplate.query("SELECT id_escenario FROM intento WHERE id_diseno = ?", (resultado, fila) -> resultado.getInt("id_escenario"), idDiseno)
            .stream().findFirst().orElseThrow(() -> noEncontrado("No existe el diseño solicitado"));
        jdbcTemplate.update("DELETE FROM escenario WHERE id_escenario = ?", idEscenario);
        jdbcTemplate.update("DELETE FROM diseno WHERE id_diseno = ?", idDiseno);
    }

    public void crearLinea(Integer idDiseno, CrearLineaAdministracionRequest solicitud) {
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre de línea válido");

        if (existeLinea(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
        }

        jdbcTemplate.update("INSERT INTO linea (id_diseno, nombre, modificable) VALUES (?, ?, TRUE)", idDiseno, nombre);
    }

    public void crearEstacion(Integer idDiseno, CrearEstacionAdministracionRequest solicitud) {
        if (solicitud == null || solicitud.posicionX() == null || solicitud.posicionY() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una posición válida para la estación");
        }

        String nombre = nombreValido(solicitud.nombre(), "Ingresá un nombre de estación válido");

        if (existeEstacion(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una estación con ese nombre");
        }

        jdbcTemplate.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            VALUES (?, ?, ?, ?, ?, TRUE)
            """, idDiseno, nombre, solicitud.posicionX(), solicitud.posicionY(), Boolean.TRUE.equals(solicitud.transbordo()));
    }

    public void crearConexion(Integer idDiseno, CrearConexionRequest solicitud) {
        if (solicitud == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una conexión válida");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        String nombreEstacion = nombreValido(solicitud.nombreEstacion(), "Seleccioná una estación válida");
        verificarLinea(idDiseno, nombreLinea);
        verificarEstacion(idDiseno, nombreEstacion);

        if (Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM pasa WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?)
            """, Boolean.class, idDiseno, nombreLinea, nombreEstacion))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La conexión ya existe");
        }

        jdbcTemplate.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombreLinea, nombreEstacion);
    }

    @Transactional
    public void crearTramo(Integer idDiseno, ActualizarTramoRequest solicitud) {
        DatosTramo tramo = validarTramo(idDiseno, solicitud);
        if (existeTramo(idDiseno, tramo.nombreLinea(), tramo.estacionA(), tramo.estacionB())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La conexión entre esas estaciones ya existe en la línea");
        }
        jdbcTemplate.update("""
            INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
            VALUES (?, ?, ?, ?)
            """, idDiseno, tramo.nombreLinea(), tramo.estacionA(), tramo.estacionB());
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionA());
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionB());
    }

    @Transactional
    public void actualizarTramo(
        Integer idDiseno,
        String nombreLineaActual,
        String estacionAActual,
        String estacionBActual,
        ActualizarTramoRequest solicitud
    ) {
        DatosTramo tramo = validarTramo(idDiseno, solicitud);
        if (!representaMismoTramo(
            nombreLineaActual,
            estacionAActual,
            estacionBActual,
            tramo.nombreLinea(),
            tramo.estacionA(),
            tramo.estacionB()
        ) && existeTramo(idDiseno, tramo.nombreLinea(), tramo.estacionA(), tramo.estacionB())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La conexión entre esas estaciones ya existe en la línea");
        }
        if (jdbcTemplate.update("""
            UPDATE tramo SET nombre_linea = ?, nombre_estacion_a = ?, nombre_estacion_b = ?
            WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion_a = ? AND nombre_estacion_b = ?
            """, tramo.nombreLinea(), tramo.estacionA(), tramo.estacionB(), idDiseno, nombreLineaActual, estacionAActual, estacionBActual) == 0) {
            throw noEncontrado("No existe el tramo solicitado");
        }
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionA());
        asegurarConexion(idDiseno, tramo.nombreLinea(), tramo.estacionB());
    }

    public void eliminarTramo(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        if (jdbcTemplate.update("""
            DELETE FROM tramo WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion_a = ? AND nombre_estacion_b = ?
            """, idDiseno, nombreLinea, estacionA, estacionB) == 0) {
            throw noEncontrado("No existe el tramo solicitado");
        }
    }

    public UnidadMetroResponse crearUnidadMetro(Integer idDiseno, ActualizarUnidadMetroRequest solicitud) {
        DatosUnidadMetro unidad = validarUnidadMetro(idDiseno, solicitud);
        Integer idTren = jdbcTemplate.queryForObject("""
            INSERT INTO metro (id_diseno, nombre_linea, capacidad, velocidad_promedio)
            VALUES (?, ?, ?, ?) RETURNING id_tren
            """, Integer.class, idDiseno, unidad.nombreLinea(), unidad.capacidad(), unidad.velocidadPromedio());
        return new UnidadMetroResponse(idTren, unidad.nombreLinea(), unidad.capacidad(), unidad.velocidadPromedio());
    }

    public void actualizarUnidadMetro(Integer idDiseno, Integer idTren, ActualizarUnidadMetroRequest solicitud) {
        DatosUnidadMetro unidad = validarUnidadMetro(idDiseno, solicitud);
        if (jdbcTemplate.update("""
            UPDATE metro SET nombre_linea = ?, capacidad = ?, velocidad_promedio = ?
            WHERE id_diseno = ? AND id_tren = ?
            """, unidad.nombreLinea(), unidad.capacidad(), unidad.velocidadPromedio(), idDiseno, idTren) == 0) {
            throw noEncontrado("No existe la unidad de metro solicitada");
        }
    }

    public void eliminarUnidadMetro(Integer idDiseno, Integer idTren) {
        if (jdbcTemplate.update("DELETE FROM metro WHERE id_diseno = ? AND id_tren = ?", idDiseno, idTren) == 0) {
            throw noEncontrado("No existe la unidad de metro solicitada");
        }
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
        jdbcTemplate.update("UPDATE tramo SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
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
        jdbcTemplate.update("UPDATE tramo SET nombre_estacion_a = ? WHERE id_diseno = ? AND nombre_estacion_a = ?", nuevoNombre, idDiseno, nombreActual);
        jdbcTemplate.update("UPDATE tramo SET nombre_estacion_b = ? WHERE id_diseno = ? AND nombre_estacion_b = ?", nuevoNombre, idDiseno, nombreActual);
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

    private DatosTramo validarTramo(Integer idDiseno, ActualizarTramoRequest solicitud) {
        if (solicitud == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un tramo válido");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        String estacionA = nombreValido(solicitud.estacionA(), "Seleccioná la estación de origen");
        String estacionB = nombreValido(solicitud.estacionB(), "Seleccioná la estación de destino");

        if (estacionA.equals(estacionB)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Las estaciones del tramo deben ser diferentes");
        }

        verificarLinea(idDiseno, nombreLinea);
        verificarEstacion(idDiseno, estacionA);
        verificarEstacion(idDiseno, estacionB);
        return new DatosTramo(nombreLinea, estacionA, estacionB);
    }

    private DatosUnidadMetro validarUnidadMetro(Integer idDiseno, ActualizarUnidadMetroRequest solicitud) {
        if (solicitud == null || solicitud.capacidad() == null || solicitud.velocidadPromedio() == null
            || solicitud.capacidad() <= 0 || solicitud.velocidadPromedio().signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá capacidad y velocidad válidas para la unidad");
        }

        String nombreLinea = nombreValido(solicitud.nombreLinea(), "Seleccioná una línea válida");
        verificarLinea(idDiseno, nombreLinea);
        return new DatosUnidadMetro(nombreLinea, solicitud.capacidad(), solicitud.velocidadPromedio());
    }

    private void asegurarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        if (!Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM pasa WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?)
            """, Boolean.class, idDiseno, nombreLinea, nombreEstacion))) {
            jdbcTemplate.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombreLinea, nombreEstacion);
        }
    }

    private boolean existeTramo(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
            SELECT EXISTS (
                SELECT 1 FROM tramo
                WHERE id_diseno = ? AND nombre_linea = ?
                  AND ((nombre_estacion_a = ? AND nombre_estacion_b = ?)
                    OR (nombre_estacion_a = ? AND nombre_estacion_b = ?))
            )
            """, Boolean.class, idDiseno, nombreLinea, estacionA, estacionB, estacionB, estacionA));
    }

    private boolean representaMismoTramo(
        String lineaActual,
        String estacionAActual,
        String estacionBActual,
        String nuevaLinea,
        String nuevaEstacionA,
        String nuevaEstacionB
    ) {
        return lineaActual.equals(nuevaLinea) && (
            estacionAActual.equals(nuevaEstacionA) && estacionBActual.equals(nuevaEstacionB)
                || estacionAActual.equals(nuevaEstacionB) && estacionBActual.equals(nuevaEstacionA)
        );
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

    private record DatosTramo(String nombreLinea, String estacionA, String estacionB) {}

    private record DatosUnidadMetro(String nombreLinea, Integer capacidad, java.math.BigDecimal velocidadPromedio) {}
}
