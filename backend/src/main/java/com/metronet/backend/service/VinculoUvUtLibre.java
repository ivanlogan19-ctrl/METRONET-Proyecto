package com.metronet.backend.service;

import com.metronet.backend.dto.UnidadMetroSimulacionResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Regla de Modo Libre. Reutiliza las mismas distancias que la regla y el motor. */
public class VinculoUvUtLibre {
    private final JdbcTemplate jdbc;
    private final DistanciasRedService distancias;
    public VinculoUvUtLibre(JdbcTemplate jdbc, DistanciasRedService distancias) {
        this.jdbc = jdbc; this.distancias = distancias;
    }
    public boolean aplica(int diseno) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
             WHERE i.id_diseno=? AND e.modo IN ('LIBRE','EDICION_LIBRE') AND NOT COALESCE(e.progresivo,FALSE))
            """, Boolean.class, diseno));
    }
    public record Valores(BigDecimal uv, Double ut) {}
    public static Valores calcular(double km, BigDecimal uv, Double ut, String referencia) {
        if (!Double.isFinite(km) || km <= 0) return new Valores(uv, null);
        var distancia = BigDecimal.valueOf(km);
        if ("UT".equals(referencia)) {
            if (!tiempoValido(ut)) throw invalido();
            var velocidad = distancia.divide(BigDecimal.valueOf(ut), 8, RoundingMode.CEILING);
            if (!velocidadValida(velocidad)) throw invalido();
            return new Valores(velocidad, ut);
        }
        if (!velocidadValida(uv)) throw invalido();
        double tiempo = distancia.divide(uv, 8, RoundingMode.CEILING).doubleValue();
        if (!tiempoValido(tiempo)) throw invalido();
        return new Valores(uv, tiempo);
    }
    public static boolean tiempoValido(Double ut) {
        return ut != null && Double.isFinite(ut) && ut > 0 && ut < 10_000_000_000d
            && BigDecimal.valueOf(ut).stripTrailingZeros().scale() <= 8;
    }
    public static boolean velocidadValida(BigDecimal uv) {
        return uv != null && uv.signum() > 0 && uv.compareTo(new BigDecimal("9999.99")) <= 0
            && uv.stripTrailingZeros().scale() <= 8;
    }
    private static ResponseStatusException invalido() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "La velocidad o duración no permite calcular este recorrido. Usá valores positivos representables.");
    }
    /** Un recorrido conectado y sin bifurcaciones; el motor también admite circuitos. */
    private Map<String, Double> longitudesValidas(int diseno) {
        var tramos = distancias.tramos(diseno);
        Map<String, Map<String, Set<String>>> grafos = new HashMap<>();
        Map<String, Double> km = new HashMap<>();
        for (var t : tramos) {
            var grafo = grafos.computeIfAbsent(t.nombreLinea(), k -> new HashMap<>());
            grafo.computeIfAbsent(t.estacionA(), k -> new HashSet<>()).add(t.estacionB());
            grafo.computeIfAbsent(t.estacionB(), k -> new HashSet<>()).add(t.estacionA());
            km.merge(t.nombreLinea(), t.distanciaKm(), Double::sum);
        }
        km.keySet().removeIf(linea -> {
            var g = grafos.get(linea);
            long extremos = g.values().stream().filter(v -> v.size() == 1).count();
            if (g.values().stream().anyMatch(v -> v.size() > 2) || (extremos != 0 && extremos != 2)) return true;
            Set<String> visitadas = new HashSet<>(); var pendientes = new ArrayDeque<String>(); pendientes.add(g.keySet().iterator().next());
            while (!pendientes.isEmpty()) { var n = pendientes.remove(); if (visitadas.add(n)) pendientes.addAll(g.get(n)); }
            return visitadas.size() != g.size();
        });
        return km;
    }
    public List<UnidadMetroSimulacionResponse> resolver(int diseno, List<UnidadMetroSimulacionResponse> unidades) {
        if (!aplica(diseno)) return unidades;
        var km = longitudesValidas(diseno);
        Map<Integer, String> referencias = new HashMap<>();
        jdbc.query("SELECT id_tren,referencia_uv_ut FROM metro WHERE id_diseno=?", r -> {
            referencias.put(r.getInt(1), r.getString(2));
        }, diseno);
        return unidades.stream().map(u -> {
            var v = calcular(km.getOrDefault(u.nombreLinea(), 0d), u.velocidadPromedio(), u.duracionUt(), referencias.get(u.idTren()));
            return new UnidadMetroSimulacionResponse(u.idTren(), u.nombreLinea(), u.capacidad(), v.uv(), v.ut());
        }).toList();
    }
    public void recalcular(int diseno) {
        if (!aplica(diseno)) return;
        var km = longitudesValidas(diseno);
        var cambios = jdbc.query("SELECT id_tren,nombre_linea,velocidad_promedio,duracion_ut,referencia_uv_ut FROM metro WHERE id_diseno=? ORDER BY id_tren FOR UPDATE",
            (r, n) -> new Object[]{r.getInt(1), r.getString(2), r.getBigDecimal(3), (r.getBigDecimal(4) == null ? null : r.getBigDecimal(4).doubleValue()), r.getString(5)}, diseno);
        for (var u : cambios) {
            // Si se está editando una línea incompleta, conservar la referencia; no inventar una duración.
            if (!km.containsKey((String) u[1])) continue;
            var v = calcular(km.get((String) u[1]), (BigDecimal) u[2], (Double) u[3], (String) u[4]);
            jdbc.update("UPDATE metro SET velocidad_promedio=?,duracion_ut=? WHERE id_diseno=? AND id_tren=?", v.uv(), v.ut(), diseno, u[0]);
        }
    }
}
