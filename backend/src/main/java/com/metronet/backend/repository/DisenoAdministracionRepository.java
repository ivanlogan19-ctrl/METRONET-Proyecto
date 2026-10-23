package com.metronet.backend.repository;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class DisenoAdministracionRepository {
    private final JdbcTemplate jdbc;

    public DisenoAdministracionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> listarDisenos(RowMapper<T> mapeador) {
        return jdbc.query("""
            SELECT d.id_diseno, COALESCE(NULLIF(CONCAT_WS(' ', u.nombre, u.apellido), ''), 'Sin usuario asignado') AS propietario,
                   u.email, e.id_escenario, e.modo, i.estado, e.nombre, i.id_usuario
            FROM diseno d
            LEFT JOIN intento i ON i.id_diseno = d.id_diseno
            LEFT JOIN usuario u ON u.id_usuario = i.id_usuario
            LEFT JOIN escenario e ON e.id_escenario = i.id_escenario
            ORDER BY d.id_diseno
            """, mapeador);
    }

    public <T> List<T> lineas(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("SELECT nombre, modificable FROM linea WHERE id_diseno = ? ORDER BY nombre", mapeador, idDiseno);
    }

    public <T> List<T> estaciones(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT nombre, posicion_x, posicion_y, transbordo, modificable
            FROM estacion WHERE id_diseno = ? ORDER BY nombre
            """, mapeador, idDiseno);
    }

    public <T> List<T> conexiones(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT nombre_linea, nombre_estacion FROM pasa
            WHERE id_diseno = ? ORDER BY nombre_linea, nombre_estacion
            """, mapeador, idDiseno);
    }

    public <T> List<T> tramos(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT nombre_linea, nombre_estacion_a, nombre_estacion_b
            FROM tramo WHERE id_diseno = ? ORDER BY id_tramo
            """, mapeador, idDiseno);
    }

    public <T> List<T> unidades(RowMapper<T> mapeador, Integer idDiseno) {
        return jdbc.query("""
            SELECT id_tren, COALESCE(nombre_linea, '@conexion:' || id_conexion) AS nombre_linea, capacidad, velocidad_promedio
            FROM metro WHERE id_diseno = ? ORDER BY id_tren
            """, mapeador, idDiseno);
    }

    public Boolean existeDiseno(Integer idDiseno) {
        return jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM diseno WHERE id_diseno = ?)", Boolean.class, idDiseno);
    }

    public void bloquearIntentosDelDiseno(Integer idDiseno) {
        jdbc.queryForList("SELECT id_intento FROM intento WHERE id_diseno = ? FOR UPDATE", Integer.class, idDiseno);
    }

    public int conservarIntentosCompletados(Integer idDiseno) {
        return jdbc.update("""
            UPDATE intento i SET id_diseno = NULL
            FROM escenario e
            WHERE i.id_diseno = ? AND i.id_escenario = e.id_escenario
              AND i.estado = 'COMPLETADO' AND e.progresivo = TRUE AND e.modo = 'NIVEL'
            """, idDiseno);
    }

    public int eliminarDiseno(Integer idDiseno) {
        return jdbc.update("DELETE FROM diseno WHERE id_diseno = ?", idDiseno);
    }

    public Boolean tieneIntentoCompleto(Integer idDiseno) {
        return jdbc.queryForObject("""
            SELECT EXISTS (
                SELECT 1
                FROM intento intento
                JOIN escenario escenarioJuego ON escenarioJuego.id_escenario = intento.id_escenario
                WHERE intento.id_diseno = ?
                  AND escenarioJuego.progresivo = TRUE
                  AND intento.estado = 'COMPLETADO'
            )
            """, Boolean.class, idDiseno);
    }

    public <T> List<T> escenariosNoProgresivos(RowMapper<T> mapeador, Integer idDiseno, Integer idDisenoIntentos) {
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
            """, mapeador, idDiseno, idDisenoIntentos);
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

    public int crearLinea(Integer idDiseno, String nombre) {
        return jdbc.update("INSERT INTO linea (id_diseno, nombre, modificable) VALUES (?, ?, TRUE)", idDiseno, nombre);
    }

    public int crearEstacion(Integer idDiseno, String nombre, BigDecimal posicionX, BigDecimal posicionY, boolean transbordo) {
        return jdbc.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            VALUES (?, ?, ?, ?, ?, TRUE)
            """, idDiseno, nombre, posicionX, posicionY, transbordo);
    }

    public Boolean existeConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        return jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM pasa WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?)
            """, Boolean.class, idDiseno, nombreLinea, nombreEstacion);
    }

    public int crearConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        return jdbc.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombreLinea, nombreEstacion);
    }

    public int crearTramo(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        return jdbc.update("""
            INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
            VALUES (?, ?, ?, ?)
            """, idDiseno, nombreLinea, estacionA, estacionB);
    }

    public int actualizarTramo(
        String nombreLinea,
        String estacionA,
        String estacionB,
        Integer idDiseno,
        String nombreLineaActual,
        String estacionAActual,
        String estacionBActual
    ) {
        return jdbc.update("""
            UPDATE tramo SET nombre_linea = ?, nombre_estacion_a = ?, nombre_estacion_b = ?
            WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion_a = ? AND nombre_estacion_b = ?
            """, nombreLinea, estacionA, estacionB, idDiseno, nombreLineaActual, estacionAActual, estacionBActual);
    }

    public int eliminarTramo(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        return jdbc.update("""
            DELETE FROM tramo WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion_a = ? AND nombre_estacion_b = ?
            """, idDiseno, nombreLinea, estacionA, estacionB);
    }

    public Integer crearUnidad(Integer idDiseno, String nombreLinea, Integer capacidad, BigDecimal velocidad) {
        return jdbc.queryForObject("""
            INSERT INTO metro (id_diseno, nombre_linea, capacidad, velocidad_promedio)
            VALUES (?, ?, ?, ?) RETURNING id_tren
            """, Integer.class, idDiseno, nombreLinea, capacidad, velocidad);
    }

    public int actualizarUnidad(String nombreLinea, Integer capacidad, BigDecimal velocidad, Integer idDiseno, Integer idTren) {
        return jdbc.update("""
            UPDATE metro SET nombre_linea = ?, capacidad = ?, velocidad_promedio = ?
            WHERE id_diseno = ? AND id_tren = ?
            """, nombreLinea, capacidad, velocidad, idDiseno, idTren);
    }

    public int eliminarUnidad(Integer idDiseno, Integer idTren) {
        return jdbc.update("DELETE FROM metro WHERE id_diseno = ? AND id_tren = ?", idDiseno, idTren);
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

    public int renombrarLineaEnUnidades(String nuevoNombre, Integer idDiseno, String nombreActual) {
        return jdbc.update("UPDATE metro SET nombre_linea = ? WHERE id_diseno = ? AND nombre_linea = ?", nuevoNombre, idDiseno, nombreActual);
    }

    public int eliminarLineaAnterior(Integer idDiseno, String nombreActual) {
        return jdbc.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreActual);
    }

    public int eliminarLinea(Integer idDiseno, String nombreLinea) {
        return jdbc.update("DELETE FROM linea WHERE id_diseno = ? AND nombre = ?", idDiseno, nombreLinea);
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

    public int actualizarConexion(
        String nombreLinea,
        String nombreEstacion,
        Integer idDiseno,
        String nombreLineaActual,
        String nombreEstacionActual
    ) {
        return jdbc.update("""
            UPDATE pasa SET nombre_linea = ?, nombre_estacion = ?
            WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?
            """, nombreLinea, nombreEstacion, idDiseno, nombreLineaActual, nombreEstacionActual);
    }

    public int eliminarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        return jdbc.update("DELETE FROM pasa WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?", idDiseno, nombreLinea, nombreEstacion);
    }

    public Boolean comprobarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        return jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM pasa WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?)
            """, Boolean.class, idDiseno, nombreLinea, nombreEstacion);
    }

    public int registrarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        return jdbc.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombreLinea, nombreEstacion);
    }

    public int quitarConexionSinTramos(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        return jdbc.update("""
            DELETE FROM pasa WHERE id_diseno = ? AND nombre_linea = ? AND nombre_estacion = ?
              AND NOT EXISTS (
                SELECT 1 FROM tramo t WHERE t.id_diseno = pasa.id_diseno
                  AND t.nombre_linea = pasa.nombre_linea
                  AND (t.nombre_estacion_a = pasa.nombre_estacion OR t.nombre_estacion_b = pasa.nombre_estacion)
              )
            """, idDiseno, nombreLinea, nombreEstacion);
    }

    public Boolean existeTramo(
        Integer idDiseno,
        String nombreLinea,
        String estacionA,
        String estacionB,
        String origenInverso,
        String destinoInverso
    ) {
        return jdbc.queryForObject("""
            SELECT EXISTS (
                SELECT 1 FROM tramo
                WHERE id_diseno = ? AND nombre_linea = ?
                  AND ((nombre_estacion_a = ? AND nombre_estacion_b = ?)
                    OR (nombre_estacion_a = ? AND nombre_estacion_b = ?))
            )
            """, Boolean.class, idDiseno, nombreLinea, estacionA, estacionB, origenInverso, destinoInverso);
    }

    public Boolean existeLinea(Integer idDiseno, String nombreLinea) {
        return jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM linea WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombreLinea);
    }

    public Boolean existeEstacion(Integer idDiseno, String nombreEstacion) {
        return jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM estacion WHERE id_diseno = ? AND nombre = ?)", Boolean.class, idDiseno, nombreEstacion);
    }
}
