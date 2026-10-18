package com.metronet.backend.repository;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class DatosDemostrativosRepository {
    private final JdbcTemplate jdbc;

    public DatosDemostrativosRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> escenarioLibre(RowMapper<T> mapeador, String nombre) {
        return jdbc.query("""
            SELECT id_escenario FROM escenario
            WHERE nombre = ? AND modo = 'EDICION_LIBRE' AND progresivo = FALSE
            ORDER BY id_escenario
            """, mapeador, nombre);
    }

    public Integer crearEscenarioLibre(String nombre, String objetivo, String instrucciones) {
        return jdbc.queryForObject("""
                INSERT INTO escenario (
                    nombre, objetivo, dificultad, instrucciones, modo, progresivo, reglas_exito, herramientas_habilitadas
                )
                VALUES (?, ?, 'Inicial', ?, 'EDICION_LIBRE', FALSE, '{}'::jsonb,
                    '{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":true}'::jsonb)
                RETURNING id_escenario
                """, Integer.class, nombre, objetivo, instrucciones);
    }

    public int actualizarEscenarioLibre(String objetivo, String instrucciones, Integer idEscenario) {
        return jdbc.update("""
            UPDATE escenario
            SET objetivo = ?, dificultad = 'Inicial', instrucciones = ?, id_diseno_base = NULL,
                progresivo = FALSE, reglas_exito = '{}'::jsonb,
                herramientas_habilitadas = '{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":true}'::jsonb
            WHERE id_escenario = ?
            """, objetivo, instrucciones, idEscenario);
    }

    public <T> List<T> intentoLibre(RowMapper<T> mapeador, Integer idJugador, Integer idEscenario) {
        return jdbc.query("""
            SELECT id_intento, id_diseno FROM intento
            WHERE id_usuario = ? AND id_escenario = ?
            ORDER BY id_intento
            """, mapeador, idJugador, idEscenario);
    }

    public Integer crearDisenoLibre() {
        return jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
    }

    public Integer crearIntentoLibre(Integer idJugador, Integer idEscenario, Integer idDiseno) {
        return jdbc.queryForObject("""
                INSERT INTO intento (id_usuario, id_escenario, id_diseno, estado, progreso, puntaje, fecha_finalizacion)
                VALUES (?, ?, ?, 'EN_DISENO', 0, NULL, NULL) RETURNING id_intento
                """, Integer.class, idJugador, idEscenario, idDiseno);
    }

    public int eliminarDisenoLibre(Integer idDiseno) {
        return jdbc.update("DELETE FROM diseno WHERE id_diseno = ?", idDiseno);
    }

    public int reiniciarIntentoLibre(Integer idIntento) {
        return jdbc.update("""
            UPDATE intento
            SET estado = 'EN_DISENO', progreso = 0, puntaje = NULL, fecha_finalizacion = NULL
            WHERE id_intento = ?
            """, idIntento);
    }

    public int eliminarSimulacionesLibres(Integer idIntento) {
        return jdbc.update("DELETE FROM simulacion WHERE id_intento = ?", idIntento);
    }

    public int eliminarMetrosLibres(Integer idDiseno) {
        return jdbc.update("DELETE FROM metro WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarTramosLibres(Integer idDiseno) {
        return jdbc.update("DELETE FROM tramo WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarConexionesLibres(Integer idDiseno) {
        return jdbc.update("DELETE FROM pasa WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarLineasLibres(Integer idDiseno) {
        return jdbc.update("DELETE FROM linea WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarEstacionesLibres(Integer idDiseno) {
        return jdbc.update("DELETE FROM estacion WHERE id_diseno = ?", idDiseno);
    }

    public int crearLineaLibre(Integer idDiseno, String nombreLinea) {
        return jdbc.update("INSERT INTO linea (id_diseno, nombre, modificable) VALUES (?, ?, TRUE)", idDiseno, nombreLinea);
    }

    public int crearMetroLibre(Integer idDiseno, String nombreLinea) {
        return jdbc.update("""
            INSERT INTO metro (id_diseno, nombre_linea, capacidad, velocidad_promedio)
            VALUES (?, ?, 300, 4.00)
            """, idDiseno, nombreLinea);
    }

    public <T> List<T> escenarioNivelUno(RowMapper<T> mapeador) {
        return jdbc.query("""
            SELECT id_escenario FROM escenario
            WHERE progresivo = TRUE AND numero = 1 AND modo = 'NIVEL'
            ORDER BY id_escenario
            """, mapeador);
    }

    public <T> List<T> intentoNivelUno(RowMapper<T> mapeador, Integer idJugador, Integer idEscenario) {
        return jdbc.query("""
            SELECT id_intento, id_diseno FROM intento
            WHERE id_usuario = ? AND id_escenario = ?
            ORDER BY id_intento
            """, mapeador, idJugador, idEscenario);
    }

    public Integer crearDisenoNivelUno() {
        return jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
    }

    public Integer crearIntentoNivelUno(Integer idJugador, Integer idEscenario, Integer idDiseno) {
        return jdbc.queryForObject("""
                INSERT INTO intento (id_usuario, id_escenario, id_diseno, estado, progreso, puntaje, fecha_finalizacion)
                VALUES (?, ?, ?, 'EN_DESARROLLO', 0, NULL, NULL) RETURNING id_intento
                """, Integer.class, idJugador, idEscenario, idDiseno);
    }

    public int eliminarDisenoNivelUno(Integer idDiseno) {
        return jdbc.update("DELETE FROM diseno WHERE id_diseno = ?", idDiseno);
    }

    public int reiniciarIntentoNivelUno(Integer idIntento) {
        return jdbc.update("""
            UPDATE intento
            SET estado = 'EN_DESARROLLO', progreso = 0, puntaje = NULL, fecha_finalizacion = NULL
            WHERE id_intento = ?
            """, idIntento);
    }

    public int eliminarSimulacionesNivelUno(Integer idIntento) {
        return jdbc.update("DELETE FROM simulacion WHERE id_intento = ?", idIntento);
    }

    public int eliminarMetrosNivelUno(Integer idDiseno) {
        return jdbc.update("DELETE FROM metro WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarTramosNivelUno(Integer idDiseno) {
        return jdbc.update("DELETE FROM tramo WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarConexionesNivelUno(Integer idDiseno) {
        return jdbc.update("DELETE FROM pasa WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarLineasNivelUno(Integer idDiseno) {
        return jdbc.update("DELETE FROM linea WHERE id_diseno = ?", idDiseno);
    }

    public int eliminarEstacionesNivelUno(Integer idDiseno) {
        return jdbc.update("DELETE FROM estacion WHERE id_diseno = ?", idDiseno);
    }

    public int crearLineaNivelUno(Integer idDiseno, String nombreLinea) {
        return jdbc.update("INSERT INTO linea (id_diseno, nombre, modificable) VALUES (?, ?, TRUE)", idDiseno, nombreLinea);
    }

    public int crearConexionOrigen(Integer idDiseno, String nombreLinea, String estacionOrigen) {
        return jdbc.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombreLinea, estacionOrigen);
    }

    public int crearConexionDestino(Integer idDiseno, String nombreLinea, String estacionDestino) {
        return jdbc.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombreLinea, estacionDestino);
    }

    public int crearTramoNivelUno(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        return jdbc.update("""
            INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
            VALUES (?, ?, ?, ?)
            """, idDiseno, nombreLinea, estacionA, estacionB);
    }

    public int insertarEstacion(Integer idDiseno, String nombre, BigDecimal posicionX, BigDecimal posicionY, boolean transbordo) {
        return jdbc.update("""
            INSERT INTO estacion (id_diseno, nombre, posicion_x, posicion_y, transbordo, modificable)
            VALUES (?, ?, ?, ?, ?, TRUE)
            """, idDiseno, nombre, posicionX, posicionY, transbordo);
    }

    public int insertarConexion(Integer idDiseno, String nombreLinea, String nombreEstacion) {
        return jdbc.update("INSERT INTO pasa (id_diseno, nombre_linea, nombre_estacion) VALUES (?, ?, ?)", idDiseno, nombreLinea, nombreEstacion);
    }

    public int insertarTramo(Integer idDiseno, String nombreLinea, String estacionA, String estacionB) {
        return jdbc.update("""
            INSERT INTO tramo (id_diseno, nombre_linea, nombre_estacion_a, nombre_estacion_b)
            VALUES (?, ?, ?, ?)
            """, idDiseno, nombreLinea, estacionA, estacionB);
    }
}
