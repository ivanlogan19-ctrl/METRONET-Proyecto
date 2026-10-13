package com.metronet.backend.service;

import com.metronet.backend.dto.TramoSimulacionResponse;
import com.metronet.backend.utilidades.GeometriaTerritorial.Punto;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Longitud geográfica del trazado dibujado. No estima rutas por calles ni tiempos de parada. */
@Service
public class DistanciasRedService {
    private final JdbcTemplate jdbc;
    private final GeografiaService geografia;

    public DistanciasRedService(JdbcTemplate jdbc, GeografiaService geografia) {
        this.jdbc = jdbc;
        this.geografia = geografia;
    }

    public List<TramoSimulacionResponse> tramos(int idDiseno) {
        return jdbc.query("""
            SELECT t.nombre_linea,t.nombre_estacion_a,t.nombre_estacion_b,
                a.posicion_x ax,a.posicion_y ay,b.posicion_x bx,b.posicion_y lat_b
            FROM tramo t JOIN estacion a ON a.id_diseno=t.id_diseno AND a.nombre=t.nombre_estacion_a
            JOIN estacion b ON b.id_diseno=t.id_diseno AND b.nombre=t.nombre_estacion_b
            WHERE t.id_diseno=? ORDER BY t.nombre_linea,t.nombre_estacion_a,t.nombre_estacion_b
            """, (r, fila) -> new TramoSimulacionResponse(r.getString(1), r.getString(2), r.getString(3),
                kilometros(geografia.coordenadaGeografica(r.getBigDecimal("ax"), r.getBigDecimal("ay")),
                    geografia.coordenadaGeografica(r.getBigDecimal("bx"), r.getBigDecimal("lat_b")))), idDiseno);
    }

    public Map<String, Double> porLinea(int idDiseno) {
        Map<String, Double> resultado = new LinkedHashMap<>();
        tramos(idDiseno).forEach(t -> resultado.merge(t.nombreLinea(), t.distanciaKm(), Double::sum));
        return resultado;
    }

    public static double kilometros(Punto a, Punto b) {
        if (a == null || b == null) throw new IllegalArgumentException("El tramo necesita coordenadas geográficas");
        double lat1 = Math.toRadians(a.y()), lat2 = Math.toRadians(b.y());
        double dlat = lat2 - lat1, dlon = Math.toRadians(b.x() - a.x());
        double h = Math.pow(Math.sin(dlat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon / 2), 2);
        return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
    }
}
