package com.metronet.backend.repository;

import com.metronet.backend.dto.ConexionLineasRequest;
import com.metronet.backend.dto.ConexionLineasResponse;
import com.metronet.backend.dto.TramoSimulacionResponse;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ConexionesLineasRepository {
    private final JdbcTemplate jdbc;
    public ConexionesLineasRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void bloquear(int diseno) {
        jdbc.queryForList("SELECT id_diseno FROM diseno WHERE id_diseno=? FOR UPDATE", diseno);
    }

    public List<TramoSimulacionResponse> tramos(int diseno) {
        return jdbc.query("SELECT nombre_linea,nombre_estacion_a,nombre_estacion_b FROM tramo WHERE id_diseno=?",
            (r, n) -> new TramoSimulacionResponse(r.getString(1), r.getString(2), r.getString(3)), diseno);
    }

    public List<ConexionLineasResponse> listar(int diseno) {
        return jdbc.query("SELECT id_conexion,linea_a,estacion_a,linea_b,estacion_b FROM conexion_lineas WHERE id_diseno=? ORDER BY id_conexion",
            (r, n) -> new ConexionLineasResponse(r.getLong(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5)), diseno);
    }

    public boolean existeLinea(int diseno, String linea) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM linea WHERE id_diseno=? AND nombre=?)", Boolean.class, diseno, linea));
    }

    public void crearLinea(int diseno, String linea, String origen, String destino) {
        jdbc.update("INSERT INTO linea(id_diseno,nombre) VALUES (?,?)", diseno, linea);
        jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,?,?),(?,?,?)", diseno, linea, origen, diseno, linea, destino);
        jdbc.update("INSERT INTO tramo(id_diseno,nombre_linea,nombre_estacion_a,nombre_estacion_b) VALUES (?,?,?,?)", diseno, linea, origen, destino);
    }

    public ConexionLineasResponse crear(int diseno, ConexionLineasRequest c) {
        long id = jdbc.queryForObject("INSERT INTO conexion_lineas(id_diseno,linea_a,estacion_a,linea_b,estacion_b) VALUES (?,?,?,?,?) RETURNING id_conexion",
            Long.class, diseno, c.lineaA(), c.estacionA(), c.lineaB(), c.estacionB());
        return new ConexionLineasResponse(id, c.lineaA(), c.estacionA(), c.lineaB(), c.estacionB());
    }

    public void fusionar(int diseno, String linea, String origen, String destino) {
        jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,?,?) ON CONFLICT DO NOTHING", diseno, linea, destino);
        jdbc.update("UPDATE tramo SET nombre_estacion_a=? WHERE id_diseno=? AND nombre_linea=? AND nombre_estacion_a=?", destino, diseno, linea, origen);
        jdbc.update("UPDATE tramo SET nombre_estacion_b=? WHERE id_diseno=? AND nombre_linea=? AND nombre_estacion_b=?", destino, diseno, linea, origen);
        jdbc.update("DELETE FROM pasa WHERE id_diseno=? AND nombre_linea=? AND nombre_estacion=?", diseno, linea, origen);
        jdbc.update("DELETE FROM estacion WHERE id_diseno=? AND nombre=?", diseno, origen);
    }

    public int eliminar(int diseno, long conexion) {
        return jdbc.update("DELETE FROM conexion_lineas WHERE id_diseno=? AND id_conexion=?", diseno, conexion);
    }

    public void limpiarSinRecorrido(int diseno) {
        jdbc.update("""
            DELETE FROM conexion_lineas c WHERE c.id_diseno=? AND (
              NOT EXISTS (SELECT 1 FROM tramo t WHERE t.id_diseno=c.id_diseno AND t.nombre_linea=c.linea_a
                AND (t.nombre_estacion_a=c.estacion_a OR t.nombre_estacion_b=c.estacion_a))
              OR NOT EXISTS (SELECT 1 FROM tramo t WHERE t.id_diseno=c.id_diseno AND t.nombre_linea=c.linea_b
                AND (t.nombre_estacion_a=c.estacion_b OR t.nombre_estacion_b=c.estacion_b)))
            """, diseno);
    }

    public void copiar(int origen, int destino) {
        jdbc.update("INSERT INTO conexion_lineas(id_diseno,linea_a,estacion_a,linea_b,estacion_b) SELECT ?,linea_a,estacion_a,linea_b,estacion_b FROM conexion_lineas WHERE id_diseno=?", destino, origen);
    }
}
