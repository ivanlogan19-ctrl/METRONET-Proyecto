package com.metronet.backend.service;

import com.metronet.backend.dto.CrearEstacionSimulacionRequest;
import com.metronet.backend.dto.CrearEscenarioRequest;
import com.metronet.backend.dto.CrearLineaSimulacionRequest;
import com.metronet.backend.dto.CrearUnidadMetroSimulacionRequest;
import com.metronet.backend.dto.CrearSimulacionRequest;
import com.metronet.backend.dto.EjecutarSimulacionRequest;
import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarEscenarioRequest;
import com.metronet.backend.dto.ActualizarLineaSimulacionRequest;
import com.metronet.backend.dto.ActualizarTramoRequest;
import com.metronet.backend.dto.ActualizarUnidadMetroRequest;
import com.metronet.backend.dto.EstacionSimulacionResponse;
import com.metronet.backend.dto.LineaSimulacionResponse;
import com.metronet.backend.dto.SimulacionDetalleResponse;
import com.metronet.backend.dto.SimulacionResumenResponse;
import com.metronet.backend.dto.TramoSimulacionResponse;
import com.metronet.backend.dto.ResultadoSimulacionResponse;
import com.metronet.backend.dto.UnidadMetroSimulacionResponse;
import com.metronet.backend.dto.ValidacionDisenoResponse;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SimulacionService {
    private final JdbcTemplate jdbcTemplate;
    private final DisenoAdministracionService disenoAdministracionService;

    public SimulacionService(JdbcTemplate jdbcTemplate, DisenoAdministracionService disenoAdministracionService) {
        this.jdbcTemplate = jdbcTemplate;
        this.disenoAdministracionService = disenoAdministracionService;
    }

    public List<SimulacionResumenResponse> listarSimulaciones(Integer idUsuario) {
        return jdbcTemplate.query("""
            SELECT i.id_diseno, i.id_escenario, e.nombre, i.estado, e.modo,
                   COALESCE(e.dificultad, 'Inicial') AS dificultad, e.objetivo, e.instrucciones, e.id_diseno_base
            FROM intento i
            JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_usuario = ?
            ORDER BY i.id_diseno DESC
            """, (resultado, fila) -> new SimulacionResumenResponse(
                resultado.getInt("id_diseno"),
                resultado.getInt("id_escenario"),
                resultado.getString("nombre"),
                resultado.getString("estado"),
                resultado.getString("modo"),
                resultado.getString("dificultad"),
                resultado.getString("objetivo"),
                resultado.getString("instrucciones"),
                resultado.getObject("id_diseno_base", Integer.class)
            ), idUsuario);
    }

    @Transactional
    public SimulacionResumenResponse crearSimulacion(Integer idUsuario, CrearSimulacionRequest solicitud) {
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la simulación");
        Integer idDiseno = jdbcTemplate.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
        Integer idEscenario = jdbcTemplate.queryForObject("""
            INSERT INTO escenario (nombre, modo, objetivo, dificultad, instrucciones)
            VALUES (?, 'EDICION_LIBRE', 'Diseño de red creado por el jugador', 'Inicial', 'Creá estaciones, unilas en líneas y validá la red antes de usarla.')
            RETURNING id_escenario
            """, Integer.class, nombre);

        jdbcTemplate.update("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, estado, puntaje)
            VALUES (?, ?, ?, 'EN_DISENO', NULL)
            """, idUsuario, idEscenario, idDiseno);

        return obtenerResumen(idUsuario, idDiseno);
    }

    @Transactional
    public SimulacionResumenResponse crearEscenario(Integer idUsuario, Integer idDisenoBase, CrearEscenarioRequest solicitud) {
        SimulacionResumenResponse base = obtenerResumen(idUsuario, idDisenoBase);
        if (!"VALIDADO".equals(base.estado())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Validá el diseño antes de crear un escenario de aprendizaje");
        }

        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para el escenario");
        String modo = modoValido(solicitud == null ? null : solicitud.modo());
        String dificultad = dificultadValida(solicitud == null ? null : solicitud.dificultad());
        String objetivo = textoOpcional(solicitud == null ? null : solicitud.objetivo(), "Aplicar los conceptos de diseño de una red de metro.");
        String instrucciones = textoOpcional(solicitud == null ? null : solicitud.instrucciones(), instruccionesPredeterminadas(modo, dificultad));
        Integer numero = "NIVEL".equals(modo)
            ? jdbcTemplate.queryForObject("SELECT COALESCE(MAX(numero), 0) + 1 FROM escenario WHERE modo = 'NIVEL'", Integer.class)
            : null;
        Integer idEscenario = jdbcTemplate.queryForObject("""
            INSERT INTO escenario (nombre, id_diseno_base, objetivo, numero, modo, dificultad, instrucciones)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id_escenario
            """, Integer.class, nombre, idDisenoBase, objetivo, numero, modo, dificultad, instrucciones);
        Integer idDisenoNuevo = jdbcTemplate.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);

        jdbcTemplate.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            SELECT ?, nombre, posicion_x, posicion_y, transbordo, modificable FROM estacion WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
        jdbcTemplate.update("""
            INSERT INTO linea (id_diseno, nombre, modificable)
            SELECT ?, nombre, modificable FROM linea WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
        jdbcTemplate.update("""
            INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion)
            SELECT ?, nombre_linea, nombre_estacion FROM pasa WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
        jdbcTemplate.update("""
            INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
            SELECT ?, nombre_linea, nombre_estacion_a, nombre_estacion_b FROM tramo WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
        jdbcTemplate.update("""
            INSERT INTO metro (id_diseno, nombre_linea, capacidad, velocidad_promedio)
            SELECT ?, nombre_linea, capacidad, velocidad_promedio FROM metro WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
        jdbcTemplate.update("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, estado, puntaje)
            VALUES (?, ?, ?, 'EN_DESARROLLO', NULL)
            """, idUsuario, idEscenario, idDisenoNuevo);
        return obtenerResumen(idUsuario, idDisenoNuevo);
    }

    public SimulacionDetalleResponse obtenerSimulacion(Integer idUsuario, Integer idDiseno) {
        SimulacionResumenResponse simulacion = obtenerResumen(idUsuario, idDiseno);
        List<EstacionSimulacionResponse> estaciones = jdbcTemplate.query("""
            SELECT nombre, posicion_x, posicion_y, transbordo
            FROM estacion WHERE id_diseno = ? ORDER BY nombre
            """, (resultado, fila) -> new EstacionSimulacionResponse(
                resultado.getString("nombre"), resultado.getBigDecimal("posicion_x"), resultado.getBigDecimal("posicion_y"), resultado.getBoolean("transbordo")
            ), idDiseno);
        List<LineaSimulacionResponse> lineas = jdbcTemplate.query(
            "SELECT nombre FROM linea WHERE id_diseno = ? ORDER BY nombre",
            (resultado, fila) -> new LineaSimulacionResponse(resultado.getString("nombre")), idDiseno
        );
        List<TramoSimulacionResponse> tramos = jdbcTemplate.query("""
            SELECT nombre_linea, nombre_estacion_a, nombre_estacion_b
            FROM tramo WHERE id_diseno = ? ORDER BY id_tramo
            """, (resultado, fila) -> new TramoSimulacionResponse(
                resultado.getString("nombre_linea"),
                resultado.getString("nombre_estacion_a"),
                resultado.getString("nombre_estacion_b")
            ), idDiseno);
        List<UnidadMetroSimulacionResponse> unidadesMetro = listarUnidades(idDiseno);
        List<ResultadoSimulacionResponse> resultados = listarResultados(idUsuario, idDiseno);
        PreparacionSimulacion preparacion = evaluarPreparacionSimulacion(
            estadoPermiteSimular(simulacion.estado()), unidadesMetro.size()
        );

        return new SimulacionDetalleResponse(
            simulacion, estaciones, lineas, tramos, unidadesMetro, resultados,
            preparacion.preparado(), preparacion.observaciones()
        );
    }

    @Transactional
    public EstacionSimulacionResponse crearEstacion(
        Integer idUsuario,
        Integer idDiseno,
        CrearEstacionSimulacionRequest solicitud
    ) {
        obtenerResumen(idUsuario, idDiseno);
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la estación");
        BigDecimal posicionX = solicitud == null ? null : solicitud.posicionX();
        BigDecimal posicionY = solicitud == null ? null : solicitud.posicionY();

        if (posicionX == null || posicionY == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí una posición válida para la estación");
        }

        if (existeEstacion(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una estación con ese nombre");
        }

        jdbcTemplate.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            VALUES (?, ?, ?, ?, FALSE, TRUE)
            """, idDiseno, nombre, posicionX, posicionY);
        marcarEnDiseno(idUsuario, idDiseno);
        return new EstacionSimulacionResponse(nombre, posicionX, posicionY, false);
    }

    @Transactional
    public LineaSimulacionResponse crearLinea(
        Integer idUsuario,
        Integer idDiseno,
        CrearLineaSimulacionRequest solicitud
    ) {
        obtenerResumen(idUsuario, idDiseno);
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para la línea");
        List<String> estaciones = solicitud == null || solicitud.estaciones() == null
            ? List.of()
            : solicitud.estaciones().stream().map(valor -> valor == null ? "" : valor.trim()).toList();

        if (estaciones.size() < 2 || new LinkedHashSet<>(estaciones).size() != estaciones.size() || estaciones.stream().anyMatch(String::isBlank)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seleccioná al menos dos estaciones diferentes");
        }

        if (existeLinea(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
        }

        for (String estacion : estaciones) {
            if (!existeEstacion(idDiseno, estacion)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Una de las estaciones seleccionadas no existe");
            }
        }

        jdbcTemplate.update("INSERT INTO linea (id_diseno, nombre, modificable) VALUES (?, ?, TRUE)", idDiseno, nombre);
        for (String estacion : estaciones) {
            jdbcTemplate.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombre, estacion);
        }
        for (int indice = 1; indice < estaciones.size(); indice++) {
            jdbcTemplate.update("""
                INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
                VALUES (?, ?, ?, ?)
                """, idDiseno, nombre, estaciones.get(indice - 1), estaciones.get(indice));
        }

        marcarEnDiseno(idUsuario, idDiseno);
        return new LineaSimulacionResponse(nombre);
    }

    public SimulacionResumenResponse guardarDiseno(Integer idUsuario, Integer idDiseno) {
        obtenerResumen(idUsuario, idDiseno);
        jdbcTemplate.update("""
            UPDATE intento SET estado = 'GUARDADO'
            WHERE id_usuario = ? AND id_diseno = ?
              AND estado NOT IN ('VALIDADO', 'COMPLETADA', 'COMPLETADO')
            """, idUsuario, idDiseno);
        return obtenerResumen(idUsuario, idDiseno);
    }

    public UnidadMetroSimulacionResponse crearUnidadMetro(
        Integer idUsuario,
        Integer idDiseno,
        CrearUnidadMetroSimulacionRequest solicitud
    ) {
        obtenerResumen(idUsuario, idDiseno);
        String nombreLinea = nombreValido(solicitud == null ? null : solicitud.nombreLinea(), "Elegí la línea de la unidad");
        if (!existeLinea(idDiseno, nombreLinea)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La línea seleccionada no existe");
        if (solicitud.capacidad() == null || solicitud.capacidad() < 1 || solicitud.velocidadPromedio() == null || solicitud.velocidadPromedio().signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una capacidad y velocidad válidas");
        }
        Integer idTren = jdbcTemplate.queryForObject("""
            INSERT INTO metro (id_diseno, nombre_linea, capacidad, velocidad_promedio)
            VALUES (?, ?, ?, ?) RETURNING id_tren
            """, Integer.class, idDiseno, nombreLinea, solicitud.capacidad(), solicitud.velocidadPromedio());
        marcarEnDiseno(idUsuario, idDiseno);
        return new UnidadMetroSimulacionResponse(idTren, nombreLinea, solicitud.capacidad(), solicitud.velocidadPromedio());
    }

    public void eliminarUnidadMetro(Integer idUsuario, Integer idDiseno, Integer idTren) {
        obtenerResumen(idUsuario, idDiseno);
        if (jdbcTemplate.update("DELETE FROM metro WHERE id_diseno = ? AND id_tren = ?", idDiseno, idTren) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la unidad de metro solicitada");
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public void actualizarUnidadMetro(Integer idUsuario, Integer idDiseno, Integer idTren, ActualizarUnidadMetroRequest solicitud) {
        obtenerResumen(idUsuario, idDiseno);
        String nombreLinea = nombreValido(solicitud == null ? null : solicitud.nombreLinea(), "Elegí la línea de la unidad");
        if (!existeLinea(idDiseno, nombreLinea)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La línea seleccionada no existe");
        if (solicitud.capacidad() == null || solicitud.capacidad() < 1 || solicitud.velocidadPromedio() == null || solicitud.velocidadPromedio().signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una capacidad y velocidad válidas");
        }
        if (jdbcTemplate.update("""
            UPDATE metro SET nombre_linea = ?, capacidad = ?, velocidad_promedio = ?
            WHERE id_diseno = ? AND id_tren = ?
            """, nombreLinea, solicitud.capacidad(), solicitud.velocidadPromedio(), idDiseno, idTren) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la unidad de metro solicitada");
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public SimulacionResumenResponse actualizarEscenario(Integer idUsuario, Integer idDiseno, ActualizarEscenarioRequest solicitud) {
        SimulacionResumenResponse resumen = obtenerResumen(idUsuario, idDiseno);
        if (esEscenarioProgresivo(resumen.idEscenario())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No podés editar un escenario progresivo.");
        }
        String nombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre para el escenario");
        String dificultad = dificultadValida(solicitud == null ? null : solicitud.dificultad());
        String objetivo = textoOpcional(solicitud == null ? null : solicitud.objetivo(), "Aplicar los conceptos de diseño de una red de metro.");
        String instrucciones = textoOpcional(solicitud == null ? null : solicitud.instrucciones(), instruccionesPredeterminadas(resumen.modo(), dificultad));
        jdbcTemplate.update("""
            UPDATE escenario SET nombre = ?, dificultad = ?, objetivo = ?, instrucciones = ?
            WHERE id_escenario = ?
            """, nombre, dificultad, objetivo, instrucciones, resumen.idEscenario());
        return obtenerResumen(idUsuario, idDiseno);
    }

    @Transactional
    public void eliminarDiseno(Integer idUsuario, Integer idDiseno) {
        SimulacionResumenResponse resumen = obtenerResumen(idUsuario, idDiseno);
        if (!esEscenarioProgresivo(resumen.idEscenario())) {
            jdbcTemplate.update("DELETE FROM escenario WHERE id_escenario = ?", resumen.idEscenario());
        }
        if (jdbcTemplate.update("DELETE FROM diseno WHERE id_diseno = ?", idDiseno) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el diseño solicitado");
        }
    }

    @Transactional
    public ResultadoSimulacionResponse ejecutarSimulacion(Integer idUsuario, Integer idDiseno, EjecutarSimulacionRequest solicitud) {
        SimulacionResumenResponse resumen = obtenerResumen(idUsuario, idDiseno);
        if (solicitud == null || solicitud.velocidad() == null || solicitud.velocidad().signum() <= 0 || solicitud.duracion() == null || solicitud.duracion() < 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indicá una velocidad positiva y una duración de al menos 10 segundos");
        }
        int unidades = listarUnidades(idDiseno).size();
        PreparacionSimulacion preparacion = evaluarPreparacionSimulacion(estadoPermiteSimular(resumen.estado()), unidades);
        if (!preparacion.preparado()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.join(" ", preparacion.observaciones()));
        }
        int lineas = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", Integer.class, idDiseno);
        int estaciones = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", Integer.class, idDiseno);
        int transbordos = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ? AND transbordo = TRUE", Integer.class, idDiseno);
        int puntaje = Math.min(100, 35 + Math.min(25, estaciones * 3) + Math.min(20, lineas * 8) + Math.min(15, unidades * 5) + Math.min(5, transbordos * 3));
        String comentarios = "Se operaron " + unidades + " unidad(es) en " + lineas + " línea(s) durante " + solicitud.duracion()
            + " segundos. La red mantiene " + estaciones + " estaciones y " + transbordos + " punto(s) de transbordo.";
        Integer idIntento = jdbcTemplate.queryForObject("SELECT id_intento FROM intento WHERE id_usuario = ? AND id_diseno = ?", Integer.class, idUsuario, idDiseno);
        Integer idSimulacion = jdbcTemplate.queryForObject("""
            INSERT INTO simulacion (id_intento, velocidad, duracion, comentarios, estado, puntaje)
            VALUES (?, ?, ?, ?, 'COMPLETADA', ?) RETURNING id_simulacion
            """, Integer.class, idIntento, solicitud.velocidad(), solicitud.duracion(), comentarios, puntaje);
        String estadoIntento = "COMPLETADO".equals(resumen.estado()) ? "COMPLETADO" : "COMPLETADA";
        jdbcTemplate.update("UPDATE intento SET estado = ?, puntaje = ? WHERE id_usuario = ? AND id_diseno = ?", estadoIntento, puntaje, idUsuario, idDiseno);
        return obtenerResultado(idSimulacion);
    }

    public List<ResultadoSimulacionResponse> listarResultados(Integer idUsuario, Integer idDiseno) {
        obtenerResumen(idUsuario, idDiseno);
        return jdbcTemplate.query("""
            SELECT s.id_simulacion, s.velocidad, s.duracion, s.estado, s.puntaje, s.comentarios, s.fecha_ejecucion
            FROM simulacion s JOIN intento i ON i.id_intento = s.id_intento
            WHERE i.id_usuario = ? AND i.id_diseno = ? ORDER BY s.id_simulacion DESC
            """, (resultado, fila) -> mapearResultado(resultado), idUsuario, idDiseno);
    }

    @Transactional
    public void actualizarEstacion(Integer idUsuario, Integer idDiseno, String nombreActual, ActualizarEstacionRequest solicitud) {
        obtenerResumen(idUsuario, idDiseno);
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
            marcarEnDiseno(idUsuario, idDiseno);
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
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public void eliminarEstacion(Integer idUsuario, Integer idDiseno, String nombreEstacion) {
        obtenerResumen(idUsuario, idDiseno);
        if (jdbcTemplate.update("DELETE FROM estacion WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreEstacion) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la estación solicitada");
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    @Transactional
    public void actualizarLinea(Integer idUsuario, Integer idDiseno, String nombreActual, ActualizarLineaSimulacionRequest solicitud) {
        obtenerResumen(idUsuario, idDiseno);
        String nuevoNombre = nombreValido(solicitud == null ? null : solicitud.nombre(), "Ingresá un nombre de línea válido");
        verificarLinea(idDiseno, nombreActual);
        List<String> estaciones = estacionesValidas(solicitud == null ? null : solicitud.estaciones());
        for (String estacion : estaciones) verificarEstacion(idDiseno, estacion);

        if (existeLinea(idDiseno, nuevoNombre)) {
            if (!nombreActual.equals(nuevoNombre)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una línea con ese nombre");
            }
        } else {
            jdbcTemplate.update("""
                INSERT INTO linea (id_diseno, nombre, modificable)
                SELECT id_diseno, ?, modificable FROM linea WHERE id_diseno = ? AND nombre = ?
                """, nuevoNombre, idDiseno, nombreActual);
            jdbcTemplate.update("UPDATE pasa SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
            jdbcTemplate.update("UPDATE tramo SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
            jdbcTemplate.update("UPDATE metro SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
            jdbcTemplate.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreActual);
        }

        jdbcTemplate.update("DELETE FROM tramo WHERE id_diseno = ? AND nombre_linea = ?", idDiseno, nuevoNombre);
        jdbcTemplate.update("DELETE FROM pasa WHERE id_diseno = ? AND nombre_linea = ?", idDiseno, nuevoNombre);
        for (String estacion : estaciones) {
            jdbcTemplate.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nuevoNombre, estacion);
        }
        for (int indice = 1; indice < estaciones.size(); indice++) {
            jdbcTemplate.update("""
                INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
                VALUES (?, ?, ?, ?)
                """, idDiseno, nuevoNombre, estaciones.get(indice - 1), estaciones.get(indice));
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public void eliminarLinea(Integer idUsuario, Integer idDiseno, String nombreLinea) {
        obtenerResumen(idUsuario, idDiseno);
        if (jdbcTemplate.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreLinea) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la línea solicitada");
        }
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public void crearTramo(Integer idUsuario, Integer idDiseno, ActualizarTramoRequest solicitud) {
        obtenerResumen(idUsuario, idDiseno);
        disenoAdministracionService.crearTramo(idDiseno, solicitud);
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public void actualizarTramo(
        Integer idUsuario,
        Integer idDiseno,
        String nombreLineaActual,
        String estacionAActual,
        String estacionBActual,
        ActualizarTramoRequest solicitud
    ) {
        obtenerResumen(idUsuario, idDiseno);
        disenoAdministracionService.actualizarTramo(
            idDiseno, nombreLineaActual, estacionAActual, estacionBActual, solicitud
        );
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public void eliminarTramo(
        Integer idUsuario,
        Integer idDiseno,
        String nombreLinea,
        String estacionA,
        String estacionB
    ) {
        obtenerResumen(idUsuario, idDiseno);
        disenoAdministracionService.eliminarTramo(idDiseno, nombreLinea, estacionA, estacionB);
        marcarEnDiseno(idUsuario, idDiseno);
    }

    public ValidacionDisenoResponse validarDiseno(Integer idUsuario, Integer idDiseno) {
        SimulacionResumenResponse resumen = obtenerResumen(idUsuario, idDiseno);
        List<String> observaciones = new ArrayList<>();
        Integer cantidadEstaciones = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", Integer.class, idDiseno);
        Integer cantidadLineas = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", Integer.class, idDiseno);
        Integer cantidadTramos = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tramo WHERE id_diseno = ?", Integer.class, idDiseno);

        if (cantidadEstaciones == null || cantidadEstaciones < 2) observaciones.add("El diseño debe tener al menos dos estaciones.");
        if (cantidadLineas == null || cantidadLineas < 1) observaciones.add("El diseño debe tener al menos una línea de metro.");
        if (cantidadTramos == null || cantidadTramos < 1) observaciones.add("El diseño debe tener al menos un tramo entre estaciones.");

        List<String> lineasIncompletas = jdbcTemplate.query("""
            SELECT l.nombre FROM linea l
            LEFT JOIN pasa p ON p.id_diseno = l.id_diseno AND p.nombre_linea = l.nombre
            WHERE l.id_diseno = ? GROUP BY l.nombre HAVING COUNT(p.nombre_estacion) < 2
            """, (resultado, fila) -> resultado.getString("nombre"), idDiseno);
        if (!lineasIncompletas.isEmpty()) observaciones.add("Cada línea debe tener al menos dos estaciones: " + String.join(", ", lineasIncompletas) + ".");

        List<String> estacionesAisladas = jdbcTemplate.query("""
            SELECT e.nombre FROM estacion e
            LEFT JOIN pasa p ON p.id_diseno = e.id_diseno AND p.nombre_estacion = e.nombre
            WHERE e.id_diseno = ? GROUP BY e.nombre HAVING COUNT(p.nombre_linea) = 0
            """, (resultado, fila) -> resultado.getString("nombre"), idDiseno);
        if (!estacionesAisladas.isEmpty()) observaciones.add("Hay estaciones sin línea asociada: " + String.join(", ", estacionesAisladas) + ".");

        List<String> estacionesFueraDelMapa = jdbcTemplate.query("""
            SELECT nombre FROM estacion
            WHERE id_diseno = ? AND (posicion_x < 0 OR posicion_x > 1000 OR posicion_y < 0 OR posicion_y > 620)
            ORDER BY nombre
            """, (resultado, fila) -> resultado.getString("nombre"), idDiseno);
        if (!estacionesFueraDelMapa.isEmpty()) observaciones.add("Hay estaciones fuera de los límites del mapa: " + String.join(", ", estacionesFueraDelMapa) + ".");

        List<String> conexionesDuplicadas = jdbcTemplate.query("""
            SELECT nombre_linea, LEAST(nombre_estacion_a, nombre_estacion_b) AS estacion_a,
                   GREATEST(nombre_estacion_a, nombre_estacion_b) AS estacion_b
            FROM tramo WHERE id_diseno = ?
            GROUP BY nombre_linea, LEAST(nombre_estacion_a, nombre_estacion_b), GREATEST(nombre_estacion_a, nombre_estacion_b)
            HAVING COUNT(*) > 1
            """, (resultado, fila) -> resultado.getString("nombre_linea") + " ("
                + resultado.getString("estacion_a") + " y " + resultado.getString("estacion_b") + ")", idDiseno);
        if (!conexionesDuplicadas.isEmpty()) observaciones.add("Hay conexiones duplicadas: " + String.join(", ", conexionesDuplicadas) + ".");

        validarConectividadLineas(idDiseno, observaciones);

        boolean valido = observaciones.isEmpty();
        PreparacionSimulacion preparacion = evaluarPreparacionSimulacion(
            valido, listarUnidades(idDiseno).size()
        );
        jdbcTemplate.update(
            "UPDATE intento SET estado = ? WHERE id_usuario = ? AND id_diseno = ?",
            estadoLuegoDeValidacion(valido, resumen.estado()), idUsuario, idDiseno
        );
        return new ValidacionDisenoResponse(valido, observaciones, preparacion.preparado(), preparacion.observaciones());
    }

    private void validarConectividadLineas(Integer idDiseno, List<String> observaciones) {
        List<String> lineas = jdbcTemplate.query(
            "SELECT nombre FROM linea WHERE id_diseno = ? ORDER BY nombre",
            (resultado, fila) -> resultado.getString("nombre"),
            idDiseno
        );
        for (String linea : lineas) {
            List<String> estaciones = jdbcTemplate.query("""
                SELECT nombre_estacion FROM pasa
                WHERE id_diseno = ? AND nombre_linea = ? ORDER BY nombre_estacion
                """, (resultado, fila) -> resultado.getString("nombre_estacion"), idDiseno, linea);
            if (estaciones.size() < 2) continue;
            Map<String, Set<String>> conexiones = new HashMap<>();
            estaciones.forEach((estacion) -> conexiones.put(estacion, new HashSet<>()));
            jdbcTemplate.query("""
                SELECT nombre_estacion_a, nombre_estacion_b FROM tramo
                WHERE id_diseno = ? AND nombre_linea = ?
                """, (resultado, fila) -> {
                    String estacionA = resultado.getString("nombre_estacion_a");
                    String estacionB = resultado.getString("nombre_estacion_b");
                    conexiones.computeIfAbsent(estacionA, clave -> new HashSet<>()).add(estacionB);
                    conexiones.computeIfAbsent(estacionB, clave -> new HashSet<>()).add(estacionA);
                    return null;
                }, idDiseno, linea);
            Set<String> visitadas = new HashSet<>();
            ArrayDeque<String> pendientes = new ArrayDeque<>();
            pendientes.add(estaciones.getFirst());
            while (!pendientes.isEmpty()) {
                String estacion = pendientes.removeFirst();
                if (!visitadas.add(estacion)) continue;
                conexiones.getOrDefault(estacion, Set.of()).forEach(pendientes::addLast);
            }
            if (visitadas.size() != estaciones.size()) observaciones.add("La línea " + linea + " tiene estaciones o conexiones desconectadas.");
        }
    }

    private SimulacionResumenResponse obtenerResumen(Integer idUsuario, Integer idDiseno) {
        List<SimulacionResumenResponse> resultados = jdbcTemplate.query("""
            SELECT i.id_diseno, i.id_escenario, e.nombre, i.estado, e.modo,
                   COALESCE(e.dificultad, 'Inicial') AS dificultad, e.objetivo, e.instrucciones, e.id_diseno_base
            FROM intento i
            JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_usuario = ? AND i.id_diseno = ?
            """, (resultado, fila) -> new SimulacionResumenResponse(
                resultado.getInt("id_diseno"),
                resultado.getInt("id_escenario"),
                resultado.getString("nombre"),
                resultado.getString("estado"),
                resultado.getString("modo"),
                resultado.getString("dificultad"),
                resultado.getString("objetivo"),
                resultado.getString("instrucciones"),
                resultado.getObject("id_diseno_base", Integer.class)
            ), idUsuario, idDiseno);

        if (resultados.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la simulación solicitada");
        }

        return resultados.getFirst();
    }

    private boolean existeEstacion(Integer idDiseno, String nombre) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM estacion WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombre
        ));
    }

    private boolean esEscenarioProgresivo(Integer idEscenario) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM escenario WHERE id_escenario = ? AND progresivo = TRUE)", Boolean.class, idEscenario
        ));
    }

    private PreparacionSimulacion evaluarPreparacionSimulacion(boolean redValidada, int cantidadUnidades) {
        List<String> observaciones = new ArrayList<>();
        if (!redValidada) observaciones.add("Validá la red antes de iniciar una simulación.");
        if (cantidadUnidades < 1) observaciones.add("Incorporá al menos una unidad de metro antes de iniciar una simulación.");
        return new PreparacionSimulacion(observaciones.isEmpty(), List.copyOf(observaciones));
    }

    private boolean estadoPermiteSimular(String estado) {
        return "VALIDADO".equals(estado) || "COMPLETADA".equals(estado) || "COMPLETADO".equals(estado);
    }

    private String estadoLuegoDeValidacion(boolean valido, String estadoActual) {
        if (!valido) return "EN_DISENO";
        if ("COMPLETADO".equals(estadoActual) || "COMPLETADA".equals(estadoActual)) return estadoActual;
        return "VALIDADO";
    }

    private List<UnidadMetroSimulacionResponse> listarUnidades(Integer idDiseno) {
        return jdbcTemplate.query("""
            SELECT id_tren, nombre_linea, capacidad, velocidad_promedio
            FROM metro WHERE id_diseno = ? ORDER BY id_tren
            """, (resultado, fila) -> new UnidadMetroSimulacionResponse(
                resultado.getInt("id_tren"), resultado.getString("nombre_linea"), resultado.getInt("capacidad"), resultado.getBigDecimal("velocidad_promedio")
            ), idDiseno);
    }

    private record PreparacionSimulacion(boolean preparado, List<String> observaciones) {}

    private ResultadoSimulacionResponse obtenerResultado(Integer idSimulacion) {
        return jdbcTemplate.queryForObject("""
            SELECT id_simulacion, velocidad, duracion, estado, puntaje, comentarios, fecha_ejecucion
            FROM simulacion WHERE id_simulacion = ?
            """, (resultado, fila) -> mapearResultado(resultado), idSimulacion);
    }

    private ResultadoSimulacionResponse mapearResultado(ResultSet resultado) throws SQLException {
        return new ResultadoSimulacionResponse(
            resultado.getInt("id_simulacion"),
            resultado.getBigDecimal("velocidad"),
            resultado.getInt("duracion"),
            resultado.getString("estado"),
            resultado.getInt("puntaje"),
            resultado.getString("comentarios"),
            resultado.getTimestamp("fecha_ejecucion").toLocalDateTime()
        );
    }

    private void verificarEstacion(Integer idDiseno, String nombre) {
        if (!existeEstacion(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la estación solicitada");
        }
    }

    private boolean existeLinea(Integer idDiseno, String nombre) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM linea WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombre
        ));
    }

    private void verificarLinea(Integer idDiseno, String nombre) {
        if (!existeLinea(idDiseno, nombre)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la línea solicitada");
        }
    }

    private void marcarEnDiseno(Integer idUsuario, Integer idDiseno) {
        jdbcTemplate.update("UPDATE intento SET estado = 'EN_DISENO' WHERE id_usuario = ? AND id_diseno = ?", idUsuario, idDiseno);
    }

    private List<String> estacionesValidas(List<String> estaciones) {
        List<String> resultado = estaciones == null ? List.of() : estaciones.stream().map(valor -> valor == null ? "" : valor.trim()).toList();
        if (resultado.size() < 2 || new LinkedHashSet<>(resultado).size() != resultado.size() || resultado.stream().anyMatch(String::isBlank)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indicá al menos dos estaciones diferentes para la línea");
        }
        return resultado;
    }

    private String nombreValido(String nombre, String mensaje) {
        if (nombre == null || nombre.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
        }

        return nombre.trim();
    }

    private String modoValido(String modo) {
        if (!"NIVEL".equals(modo) && !"EDICION_LIBRE".equals(modo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí el tipo de escenario");
        }
        return modo;
    }

    private String dificultadValida(String dificultad) {
        if ("Inicial".equals(dificultad) || "Intermedio".equals(dificultad) || "Avanzado".equals(dificultad)) return dificultad;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí un nivel de dificultad válido");
    }

    private String textoOpcional(String texto, String predeterminado) {
        return texto == null || texto.isBlank() ? predeterminado : texto.trim();
    }

    private String instruccionesPredeterminadas(String modo, String dificultad) {
        if ("NIVEL".equals(modo)) {
            return "Nivel " + dificultad + ": revisá el objetivo, explorá la red y realizá ajustes hasta obtener una red consistente.";
        }
        return "Edición libre: experimentá con estaciones, líneas y transbordos. Podés corregir cada decisión sin afectar el diseño original.";
    }
}
