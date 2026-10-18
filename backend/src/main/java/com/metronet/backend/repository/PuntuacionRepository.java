package com.metronet.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class PuntuacionRepository {
    private final JdbcTemplate jdbc;

    public PuntuacionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> ejecucionesIntento(RowMapper<T> mapeador, int idIntento) {
        return jdbc.query("SELECT duracion, comentarios FROM simulacion WHERE id_intento=? ORDER BY id_simulacion", mapeador, idIntento);
    }

    public <T> List<T> registros(RowMapper<T> mapeador, int idDiseno) {
        return jdbc.query("""
            SELECT s.id_simulacion,s.comentarios FROM simulacion s JOIN intento i USING(id_intento)
            WHERE i.id_diseno=? ORDER BY s.id_simulacion
            """, mapeador, idDiseno);
    }

    public int registrarPuntaje(String comentarios, int puntaje, int idSimulacion) {
        return jdbc.update("UPDATE simulacion SET comentarios=?,puntaje=? WHERE id_simulacion=?", comentarios, puntaje, idSimulacion);
    }

    public <T> List<T> medicionesUnidades(RowMapper<T> mapeador, int idDiseno) {
        return jdbc.query("""
            SELECT m.id_tren, m.nombre_linea, m.velocidad_promedio, m.duracion_ut,
                (SELECT COUNT(*) FROM tramo t WHERE t.id_diseno=m.id_diseno AND t.nombre_linea=m.nombre_linea) tramos
            FROM metro m WHERE m.id_diseno=? ORDER BY m.id_tren
            """, mapeador, idDiseno);
    }

    public void referenciasLineas(RowCallbackHandler lector, int idDiseno) {
        jdbc.query("SELECT DISTINCT nombre_linea,referencia_uv_ut FROM metro WHERE id_diseno=?", lector, idDiseno);
    }

    public Boolean tieneDuracion(int idDiseno) {
        return jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM metro WHERE id_diseno=? AND duracion_ut IS NOT NULL)", Boolean.class, idDiseno);
    }

    public List<Map<String,Object>> estacionesOrdenadas(int idDiseno) {
        return jdbc.queryForList("SELECT nombre,posicion_x,posicion_y,transbordo FROM estacion WHERE id_diseno=? ORDER BY nombre", idDiseno);
    }

    public List<Map<String,Object>> lineasOrdenadas(int idDiseno) {
        return jdbc.queryForList("SELECT nombre FROM linea WHERE id_diseno=? ORDER BY nombre", idDiseno);
    }

    public List<Map<String,Object>> conexionesOrdenadas(int idDiseno) {
        return jdbc.queryForList("SELECT nombre_linea,nombre_estacion FROM pasa WHERE id_diseno=? ORDER BY nombre_linea,nombre_estacion", idDiseno);
    }

    public List<Map<String,Object>> tramosOrdenados(int idDiseno) {
        return jdbc.queryForList("SELECT nombre_linea,nombre_estacion_a,nombre_estacion_b FROM tramo WHERE id_diseno=? ORDER BY nombre_linea,nombre_estacion_a,nombre_estacion_b", idDiseno);
    }

    public List<Map<String,Object>> unidadesOrdenadas(
        boolean incluirVelocidad,
        boolean incluirDuracion,
        boolean incluirCapacidad,
        int idDiseno
    ) {
        return jdbc.queryForList("SELECT id_tren,nombre_linea" + (incluirVelocidad ? ",velocidad_promedio" : "") + (incluirDuracion ? ",duracion_ut" : "")
                    + (incluirCapacidad ? ",capacidad" : "") + " FROM metro WHERE id_diseno=? ORDER BY id_tren", idDiseno);
    }

    public <T> List<T> huellaUltimaEjecucion(RowMapper<T> mapeador, int idIntento) {
        return jdbc.query("""
            SELECT r.huella_ejecucion FROM resultado_uv_ut r
            JOIN simulacion s ON s.id_simulacion=r.id_simulacion
            WHERE s.id_intento=? ORDER BY s.id_simulacion DESC LIMIT 1
            """, mapeador, idIntento);
    }

    public <T> List<T> ranking(RowMapper<T> mapeador) {
        return jdbc.query("""
            WITH mejores AS (
                SELECT i.id_usuario, i.id_escenario, MAX(i.puntaje) puntos
                FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
                WHERE i.estado='COMPLETADO' AND i.puntaje IS NOT NULL AND e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero IS NOT NULL
                GROUP BY i.id_usuario,i.id_escenario
            )
            SELECT u.id_usuario, u.nombre, u.apellido, COALESCE(SUM(m.puntos),0) total, COUNT(m.id_escenario) completados
            FROM usuario u LEFT JOIN mejores m ON m.id_usuario=u.id_usuario WHERE u.rol='JUGADOR'
            GROUP BY u.id_usuario, u.nombre, u.apellido ORDER BY total DESC, completados DESC, u.id_usuario ASC
            """, mapeador);
    }

    public <T> List<T> reglasNiveles(RowMapper<T> mapeador) {
        return jdbc.query("SELECT reglas_exito::text AS reglas_exito FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero IS NOT NULL", mapeador);
    }
}
