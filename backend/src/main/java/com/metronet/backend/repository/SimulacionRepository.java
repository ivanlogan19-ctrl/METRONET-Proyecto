package com.metronet.backend.repository;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class SimulacionRepository {
    private final JdbcTemplate jdbc;

    public SimulacionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> listarSimulaciones(RowMapper<T> mapeador, Integer idUsuario) {
        return jdbc.query("""
            SELECT i.id_diseno, i.id_escenario, e.nombre, i.estado, e.modo,
                   COALESCE(e.dificultad, 'Inicial') AS dificultad,
                   CASE WHEN v.id_intento IS NOT NULL THEN v.objetivo WHEN h.id_intento IS NOT NULL THEN h.objetivo ELSE e.objetivo END AS objetivo,
                   CASE WHEN v.id_intento IS NOT NULL THEN v.instrucciones WHEN h.id_intento IS NOT NULL THEN h.instrucciones ELSE e.instrucciones END AS instrucciones,
                   e.id_diseno_base, COALESCE(v.reglas_exito,h.reglas_exito,e.reglas_exito)::text AS reglas_exito
            FROM intento i
            JOIN escenario e ON e.id_escenario = i.id_escenario
            LEFT JOIN intento_uv_ut v ON v.id_intento=i.id_intento
            LEFT JOIN intento_catalogo_v1 h ON h.id_intento=i.id_intento
            WHERE i.id_usuario = ? AND i.id_diseno IS NOT NULL
            ORDER BY i.id_diseno DESC
            """, mapeador, idUsuario);
    }

    public Integer crearDisenoLibre() {
        return jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
    }

    public Integer crearEscenarioLibre(String nombre) {
        return jdbc.queryForObject("""
            INSERT INTO escenario (nombre, modo, objetivo, dificultad, instrucciones)
            VALUES (?, 'EDICION_LIBRE', 'Diseño de red creado por el jugador', 'Inicial', 'Creá estaciones y unilas en líneas. Guardar y Simular comprueban la red automáticamente.')
            RETURNING id_escenario
            """, Integer.class, nombre);
    }

    public int crearIntentoLibre(Integer idUsuario, Integer idEscenario, Integer idDiseno) {
        return jdbc.update("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, estado, puntaje)
            VALUES (?, ?, ?, 'EN_DISENO', NULL)
            """, idUsuario, idEscenario, idDiseno);
    }

    public Integer siguienteNumeroEscenario() {
        return jdbc.queryForObject("SELECT COALESCE(MAX(numero), 0) + 1 FROM escenario WHERE modo = 'NIVEL'", Integer.class);
    }

    public Integer crearEscenario(
        String nombre,
        Integer idDisenoBase,
        String objetivo,
        Integer numero,
        String modo,
        String dificultad,
        String instrucciones
    ) {
        return jdbc.queryForObject("""
            INSERT INTO escenario (nombre, id_diseno_base, objetivo, numero, modo, dificultad, instrucciones)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id_escenario
            """, Integer.class, nombre, idDisenoBase, objetivo, numero, modo, dificultad, instrucciones);
    }

    public Integer crearDisenoNivel() {
        return jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
    }

    public int copiarEstaciones(Integer idDisenoNuevo, Integer idDisenoBase) {
        return jdbc.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            SELECT ?, nombre, posicion_x, posicion_y, transbordo, modificable FROM estacion WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
    }

    public int copiarLineas(Integer idDisenoNuevo, Integer idDisenoBase) {
        return jdbc.update("""
            INSERT INTO linea (id_diseno, nombre, modificable)
            SELECT ?, nombre, modificable FROM linea WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
    }

    public int copiarConexiones(Integer idDisenoNuevo, Integer idDisenoBase) {
        return jdbc.update("""
            INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion)
            SELECT ?, nombre_linea, nombre_estacion FROM pasa WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
    }

    public int copiarTramos(Integer idDisenoNuevo, Integer idDisenoBase) {
        return jdbc.update("""
            INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
            SELECT ?, nombre_linea, nombre_estacion_a, nombre_estacion_b FROM tramo WHERE id_diseno = ?
            """, idDisenoNuevo, idDisenoBase);
    }

    public int copiarMetros(Integer idDisenoNuevo, Integer idDisenoBase) {
        return jdbc.update("""
            INSERT INTO metro (id_diseno, nombre_linea, capacidad, velocidad_promedio, duracion_ut, referencia_uv_ut)
            SELECT ?, nombre_linea, capacidad, velocidad_promedio, duracion_ut, referencia_uv_ut
            FROM metro WHERE id_diseno=? ORDER BY id_tren
            """, idDisenoNuevo, idDisenoBase);
    }

    public int crearIntento(Integer idUsuario, Integer idEscenario, Integer idDisenoNuevo) {
        return jdbc.update("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, estado, puntaje)
            VALUES (?, ?, ?, 'EN_DESARROLLO', NULL)
            """, idUsuario, idEscenario, idDisenoNuevo);
    }

    public <T> List<T> estaciones(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT nombre, posicion_x, posicion_y, transbordo
            FROM estacion WHERE id_diseno = ? ORDER BY nombre
            """, mapeador, idDiseno);
    }

    public <T> List<T> lineas(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("SELECT nombre FROM linea WHERE id_diseno = ? ORDER BY nombre", mapeador, idDiseno);
    }

    public int crearEstacion(Integer idDiseno, String nombre, BigDecimal posicionX, BigDecimal posicionY) {
        return jdbc.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            VALUES (?, ?, ?, ?, FALSE, TRUE)
            """, idDiseno, nombre, posicionX, posicionY);
    }

    public int crearLinea(Integer idDiseno, String nombre) {
        return jdbc.update("INSERT INTO linea (id_diseno, nombre, modificable) VALUES (?, ?, TRUE)", idDiseno, nombre);
    }

    public int crearConexion(Integer idDiseno, String nombre, String estacion) {
        return jdbc.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombre, estacion);
    }

    public int crearTramo(Integer idDiseno, String nombre, String estacionA, String estacionB) {
        return jdbc.update("""
                INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
                VALUES (?, ?, ?, ?)
                """, idDiseno, nombre, estacionA, estacionB);
    }

    public Integer bloquearUsuarioParaGuardar(Integer idUsuario) {
        return jdbc.queryForObject("SELECT id_usuario FROM usuario WHERE id_usuario=? FOR UPDATE", Integer.class, idUsuario);
    }

    public int guardarDiseno(Integer idUsuario, Integer idDiseno) {
        return jdbc.update("""
            UPDATE intento SET estado = 'GUARDADO'
            WHERE id_usuario = ? AND id_diseno = ?
              AND estado NOT IN ('VALIDADO', 'COMPLETADA', 'COMPLETADO')
            """, idUsuario, idDiseno);
    }

    public Integer crearUnidad(Integer idDiseno, String nombreLinea, Integer capacidad, BigDecimal velocidad) {
        return jdbc.queryForObject("""
            INSERT INTO metro (id_diseno, nombre_linea, capacidad, velocidad_promedio)
            VALUES (?, ?, ?, ?) RETURNING id_tren
            """, Integer.class, idDiseno, nombreLinea, capacidad, velocidad);
    }

    public int eliminarUnidad(Integer idDiseno, Integer idTren) {
        return jdbc.update("DELETE FROM metro WHERE id_diseno = ? AND id_tren = ?", idDiseno, idTren);
    }

    public <T> List<T> lineaDeUnidad(RowMapper<T> mapeador, Integer idDiseno, Integer idTren) {
        return jdbc.query("SELECT nombre_linea FROM metro WHERE id_diseno=? AND id_tren=?", mapeador, idDiseno, idTren);
    }

    public <T> List<T> velocidadDeUnidad(RowMapper<T> mapeador, Integer idDiseno, Integer idTren) {
        return jdbc.query("SELECT velocidad_promedio,referencia_uv_ut FROM metro WHERE id_diseno=? AND id_tren=?", mapeador, idDiseno, idTren);
    }

    public int actualizarUnidad(String nombreLinea, Integer capacidad, BigDecimal velocidad, Double duracionUt, Integer idDiseno, Integer idTren) {
        return jdbc.update("""
            UPDATE metro SET nombre_linea = ?, capacidad = ?, velocidad_promedio = ?, duracion_ut = COALESCE(?, duracion_ut)
            WHERE id_diseno = ? AND id_tren = ?
            """, nombreLinea, capacidad, velocidad, duracionUt, idDiseno, idTren);
    }

    public int actualizarEscenario(String nombre, String dificultad, String objetivo, String instrucciones, Integer idEscenario) {
        return jdbc.update("""
            UPDATE escenario SET nombre = ?, dificultad = ?, objetivo = ?, instrucciones = ?
            WHERE id_escenario = ?
            """, nombre, dificultad, objetivo, instrucciones, idEscenario);
    }

    public int eliminarDiseno(Integer idDiseno) {
        return jdbc.update("DELETE FROM diseno WHERE id_diseno = ?", idDiseno);
    }

    public Integer bloquearUsuarioParaSimular(Integer idUsuario) {
        return jdbc.queryForObject("SELECT id_usuario FROM usuario WHERE id_usuario=? FOR UPDATE", Integer.class, idUsuario);
    }

    public Integer idIntento(Integer idUsuario, Integer idDiseno) {
        return jdbc.queryForObject("SELECT id_intento FROM intento WHERE id_usuario = ? AND id_diseno = ?", Integer.class, idUsuario, idDiseno);
    }

    public Integer contarLineasParaSimular(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarEstacionesParaSimular(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarEstacionesCompartidas(Integer idDiseno) {
        return jdbc.queryForObject("""
            SELECT COUNT(*) FROM estacion e WHERE e.id_diseno = ?
              AND (SELECT COUNT(DISTINCT t.nombre_linea) FROM tramo t
                   WHERE t.id_diseno = e.id_diseno
                     AND (t.nombre_estacion_a = e.nombre OR t.nombre_estacion_b = e.nombre)) >= 2
            """, Integer.class, idDiseno);
    }

    public Integer registrarSimulacion(Integer idIntento, BigDecimal velocidad, double duracion, String comentarios, int puntaje) {
        return jdbc.queryForObject("""
            INSERT INTO simulacion (id_intento, velocidad, duracion, comentarios, estado, puntaje)
            VALUES (?, ?, ?, ?, 'COMPLETADA', ?) RETURNING id_simulacion
            """, Integer.class, idIntento, velocidad, duracion, comentarios, puntaje);
    }

    public int actualizarPuntajeSimulacion(int puntaje, Integer idSimulacion) {
        return jdbc.update("UPDATE simulacion SET puntaje = ? WHERE id_simulacion = ?", puntaje, idSimulacion);
    }

    public int actualizarEstadoIntento(String estadoIntento, int puntaje, int puntajeEnCurso, Integer idUsuario, Integer idDiseno) {
        return jdbc.update("""
            UPDATE intento SET estado = ?,
                puntaje = CASE WHEN estado = 'COMPLETADO' THEN GREATEST(COALESCE(puntaje, 0), ?) ELSE ? END
            WHERE id_usuario = ? AND id_diseno = ?
            """, estadoIntento, puntaje, puntajeEnCurso, idUsuario, idDiseno);
    }

    public <T> List<T> listarResultados(RowMapper<T> mapeador, Integer idUsuario, Integer idDiseno) {
        return jdbc.query("""
            SELECT s.id_simulacion, s.velocidad, s.duracion, s.estado, s.puntaje, s.comentarios, s.fecha_ejecucion
            FROM simulacion s JOIN intento i ON i.id_intento = s.id_intento
            WHERE i.id_usuario = ? AND i.id_diseno = ? ORDER BY s.id_simulacion DESC
            """, mapeador, idUsuario, idDiseno);
    }

    public int actualizarPosicionEstacion(BigDecimal posicionX, BigDecimal posicionY, boolean transbordo, Integer idDiseno, String nombreActual) {
        return jdbc.update("""
                UPDATE estacion SET posicion_x = ?, posicion_y = ?, transbordo = ?
                WHERE id_diseno = ? AND nombre = ?
                """, posicionX, posicionY, transbordo, idDiseno, nombreActual);
    }

    public int copiarEstacion(
        String nuevoNombre,
        BigDecimal posicionX,
        BigDecimal posicionY,
        boolean transbordo,
        Integer idDiseno,
        String nombreActual
    ) {
        return jdbc.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            SELECT id_diseno, ?, ?, ?, ?, modificable FROM estacion WHERE id_diseno = ? AND nombre = ?
            """, nuevoNombre, posicionX, posicionY, transbordo, idDiseno, nombreActual);
    }

    public int renombrarEstacionEnConexiones(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("UPDATE pasa SET nombre_estacion = ? WHERE id_diseno = ? AND nombre_estacion = ?", nuevoNombre, idDiseno, nombreActual);
    }

    public int renombrarEstacionOrigen(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("UPDATE tramo SET nombre_estacion_a = ? WHERE id_diseno = ? AND nombre_estacion_a = ?", nuevoNombre, idDiseno, nombreActual);
    }

    public int renombrarEstacionDestino(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("UPDATE tramo SET nombre_estacion_b = ? WHERE id_diseno = ? AND nombre_estacion_b = ?", nuevoNombre, idDiseno, nombreActual);
    }

    public int eliminarEstacionAnterior(Integer idDiseno, String nombreActual) {
        return jdbc.update("DELETE FROM estacion WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreActual);
    }

    public int eliminarEstacion(Integer idDiseno, String nombreEstacion) {
        return jdbc.update("DELETE FROM estacion WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreEstacion);
    }

    public int copiarLinea(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("""
                INSERT INTO linea (id_diseno, nombre, modificable)
                SELECT id_diseno, ?, modificable FROM linea WHERE id_diseno = ? AND nombre = ?
                """, nuevoNombre, idDiseno, nombreActual);
    }

    public int renombrarLineaEnConexiones(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("UPDATE pasa SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
    }

    public int renombrarLineaEnTramos(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("UPDATE tramo SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
    }

    public int renombrarLineaEnMetros(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("UPDATE metro SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
    }

    public int eliminarLineaAnterior(Integer idDiseno, String nombreActual) {
        return jdbc.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreActual);
    }

    public int eliminarTramosLinea(Integer idDiseno, String nuevoNombre) {
        return jdbc.update("DELETE FROM tramo WHERE id_diseno = ? AND nombre_linea = ?", idDiseno, nuevoNombre);
    }

    public int eliminarConexionesLinea(Integer idDiseno, String nuevoNombre) {
        return jdbc.update("""
            DELETE FROM pasa p WHERE id_diseno=? AND nombre_linea=? AND NOT EXISTS
              (SELECT 1 FROM tramo t WHERE t.id_diseno=p.id_diseno AND t.nombre_linea=p.nombre_linea
                AND (t.nombre_estacion_a=p.nombre_estacion OR t.nombre_estacion_b=p.nombre_estacion))
            """, idDiseno, nuevoNombre);
    }

    public int registrarConexionLinea(Integer idDiseno, String nuevoNombre, String estacion) {
        return jdbc.update("INSERT INTO pasa (id_diseno,nombre_linea,nombre_estacion) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM pasa WHERE id_diseno=? AND nombre_linea=? AND nombre_estacion=?)", idDiseno,nuevoNombre,estacion,idDiseno,nuevoNombre,estacion);
    }

    public int registrarTramoLinea(Integer idDiseno, String nuevoNombre, String estacionA, String estacionB) {
        return jdbc.update("""
                INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
                VALUES (?, ?, ?, ?)
                """, idDiseno, nuevoNombre, estacionA, estacionB);
    }

    public int eliminarLinea(Integer idDiseno, String nombreLinea) {
        return jdbc.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreLinea);
    }

    public int registrarValidacion(String estado, Integer idUsuario, Integer idDiseno) {
        return jdbc.update("UPDATE intento SET estado = ? WHERE id_usuario = ? AND id_diseno = ?", estado, idUsuario, idDiseno);
    }

    public Integer contarEstaciones(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarLineas(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public Integer contarTramos(Integer idDiseno) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM tramo WHERE id_diseno = ?", Integer.class, idDiseno);
    }

    public <T> List<T> lineasIncompletas(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT l.nombre FROM linea l
            LEFT JOIN pasa p ON p.id_diseno = l.id_diseno AND p.nombre_linea = l.nombre
            WHERE l.id_diseno = ? GROUP BY l.nombre HAVING COUNT(p.nombre_estacion) < 2
            """, mapeador, idDiseno);
    }

    public <T> List<T> estacionesAisladas(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT e.nombre FROM estacion e
            LEFT JOIN pasa p ON p.id_diseno = e.id_diseno AND p.nombre_estacion = e.nombre
            WHERE e.id_diseno = ? GROUP BY e.nombre HAVING COUNT(p.nombre_linea) = 0
            """, mapeador, idDiseno);
    }

    public <T> List<T> tramosDuplicados(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT nombre_linea, LEAST(nombre_estacion_a, nombre_estacion_b) AS estacion_a,
                   GREATEST(nombre_estacion_a, nombre_estacion_b) AS estacion_b
            FROM tramo WHERE id_diseno = ?
            GROUP BY nombre_linea, LEAST(nombre_estacion_a, nombre_estacion_b), GREATEST(nombre_estacion_a, nombre_estacion_b)
            HAVING COUNT(*) > 1
            """, mapeador, idDiseno);
    }

    public <T> List<T> lineasParaConectividad(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("SELECT nombre FROM linea WHERE id_diseno = ? ORDER BY nombre", mapeador, idDiseno);
    }

    public <T> List<T> estacionesPorLinea(RowMapper<T> mapeador, Integer idDiseno, String linea) {
        return jdbc.query("""
                SELECT nombre_estacion FROM pasa
                WHERE id_diseno = ? AND nombre_linea = ? ORDER BY nombre_estacion
                """, mapeador, idDiseno, linea);
    }

    public <T> List<T> tramosPorLinea(RowMapper<T> mapeador, Integer idDiseno, String linea) {
        return jdbc.query("""
                SELECT nombre_estacion_a, nombre_estacion_b FROM tramo
                WHERE id_diseno = ? AND nombre_linea = ?
                """, mapeador, idDiseno, linea);
    }

    public <T> List<T> estacionesConRamificaciones(RowMapper<T> mapeador, Integer idDiseno, Integer idDisenoRelacionado) {
        return jdbc.query("""
            SELECT nombre_linea, nombre_estacion FROM (
                SELECT nombre_linea, nombre_estacion_a AS nombre_estacion FROM tramo WHERE id_diseno = ?
                UNION ALL
                SELECT nombre_linea, nombre_estacion_b AS nombre_estacion FROM tramo WHERE id_diseno = ?
            ) AS extremos
            GROUP BY nombre_linea, nombre_estacion
            HAVING COUNT(*) > 2
            ORDER BY nombre_linea, nombre_estacion
            """, mapeador, idDiseno, idDisenoRelacionado);
    }

    public <T> List<T> resumen(RowMapper<T> mapeador, Integer idUsuario, Integer idDiseno) {
        return jdbc.query("""
            SELECT i.id_diseno, i.id_escenario, e.nombre, i.estado, e.modo,
                   COALESCE(e.dificultad, 'Inicial') AS dificultad,
                   CASE WHEN v.id_intento IS NOT NULL THEN v.objetivo WHEN h.id_intento IS NOT NULL THEN h.objetivo ELSE e.objetivo END AS objetivo,
                   CASE WHEN v.id_intento IS NOT NULL THEN v.instrucciones WHEN h.id_intento IS NOT NULL THEN h.instrucciones ELSE e.instrucciones END AS instrucciones,
                   e.id_diseno_base, COALESCE(v.reglas_exito,h.reglas_exito,e.reglas_exito)::text AS reglas_exito
            FROM intento i
            JOIN escenario e ON e.id_escenario = i.id_escenario
            LEFT JOIN intento_uv_ut v ON v.id_intento=i.id_intento
            LEFT JOIN intento_catalogo_v1 h ON h.id_intento=i.id_intento
            WHERE i.id_usuario = ? AND i.id_diseno = ?
            """, mapeador, idUsuario, idDiseno);
    }

    public Boolean existeEstacion(Integer idDiseno, String nombre) {
        return jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM estacion WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombre);
    }

    public Boolean esEscenarioProgresivo(Integer idEscenario) {
        return jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM escenario WHERE id_escenario = ? AND progresivo = TRUE)", Boolean.class, idEscenario);
    }

    public <T> List<T> escenariosNoProgresivos(RowMapper<T> mapeador, Integer idDiseno, Integer idDisenoRelacionado) {
        return jdbc.query("""
            SELECT DISTINCT e.id_escenario
            FROM escenario e
            WHERE COALESCE(e.progresivo, FALSE) = FALSE
              AND (
                  e.id_diseno_base = ?
                  OR e.id_escenario IN (
                      SELECT i.id_escenario FROM intento i WHERE i.id_diseno = ?
                  )
              )
            """, mapeador, idDiseno, idDisenoRelacionado);
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

    public int retirarLineasVacias(Integer idDiseno) {
        return jdbc.update("""
            DELETE FROM linea l WHERE l.id_diseno = ?
              AND NOT EXISTS (SELECT 1 FROM pasa p WHERE p.id_diseno=l.id_diseno AND p.nombre_linea=l.nombre)
              AND NOT EXISTS (SELECT 1 FROM tramo t WHERE t.id_diseno=l.id_diseno AND t.nombre_linea=l.nombre)
              AND NOT EXISTS (SELECT 1 FROM metro m WHERE m.id_diseno=l.id_diseno AND m.nombre_linea=l.nombre)
              AND NOT EXISTS (SELECT 1 FROM conexion_lineas c WHERE c.id_diseno=l.id_diseno AND (c.linea_a=l.nombre OR c.linea_b=l.nombre))
            """, idDiseno);
    }

    public Boolean tieneRutaOperable(Integer idDiseno, String nombreLinea) {
        return jdbc.queryForObject("""
            SELECT EXISTS (
                SELECT 1 FROM tramo tramo
                WHERE tramo.id_diseno = ? AND tramo.nombre_linea = ?
                  AND tramo.nombre_estacion_a <> tramo.nombre_estacion_b
                  AND EXISTS (
                      SELECT 1 FROM pasa origen
                      WHERE origen.id_diseno = tramo.id_diseno AND origen.nombre_linea = tramo.nombre_linea
                        AND origen.nombre_estacion = tramo.nombre_estacion_a
                  )
                  AND EXISTS (
                      SELECT 1 FROM pasa destino
                      WHERE destino.id_diseno = tramo.id_diseno AND destino.nombre_linea = tramo.nombre_linea
                        AND destino.nombre_estacion = tramo.nombre_estacion_b
                  )
            )
            """, Boolean.class, idDiseno, nombreLinea);
    }

    public <T> List<T> listarUnidades(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT id_tren, nombre_linea AS nombre_linea, capacidad, velocidad_promedio, duracion_ut
            FROM metro WHERE id_diseno = ? ORDER BY id_tren
            """, mapeador, idDiseno);
    }

    public <T> T obtenerResultado(RowMapper<T> mapeador, Integer idSimulacion) {
        return jdbc.queryForObject("""
            SELECT id_simulacion, velocidad, duracion, estado, puntaje, comentarios, fecha_ejecucion
            FROM simulacion WHERE id_simulacion = ?
            """, mapeador, idSimulacion);
    }

    public Boolean existeLinea(Integer idDiseno, String nombre) {
        return jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM linea WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombre);
    }

    public int marcarEnDiseno(Integer idUsuario, Integer idDiseno) {
        return jdbc.update("UPDATE intento SET estado = 'EN_DISENO' WHERE id_usuario = ? AND id_diseno = ?", idUsuario, idDiseno);
    }
}
