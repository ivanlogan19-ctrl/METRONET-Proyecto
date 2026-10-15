package com.metronet.backend.service;

import com.metronet.backend.dto.UnidadMetroSimulacionResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Vínculo por línea para Modo Libre y niveles 1–10. Conserva el nombre por compatibilidad. */
public class VinculoUvUtLibre {
    private final JdbcTemplate jdbc;
    private final DistanciasRedService distancias;
    public VinculoUvUtLibre(JdbcTemplate jdbc, DistanciasRedService distancias) {
        this.jdbc = jdbc; this.distancias = distancias;
    }
    public boolean aplica(int diseno) {
        // La extensión aprobada incluye los diez niveles, sin alterar escenarios externos.
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
             WHERE i.id_diseno=? AND (e.modo IN ('LIBRE','EDICION_LIBRE') OR (e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10)))
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
    private record Configuracion(String linea, BigDecimal uv, Double ut, String referencia) {}

    /** Serializa las modificaciones de una red libre antes de actualizar sus unidades. */
    public void bloquear(int diseno) {
        if (aplica(diseno)) jdbc.queryForObject("SELECT id_diseno FROM diseno WHERE id_diseno=? FOR UPDATE", Integer.class, diseno);
    }

    private Map<String, Configuracion> configuraciones(int diseno) {
        Map<String, Configuracion> resultado = new LinkedHashMap<>();
        // Compatibilidad con diseños anteriores: el primer metro es la referencia de su línea.
        jdbc.query("SELECT nombre_linea,velocidad_promedio,duracion_ut,referencia_uv_ut FROM metro WHERE id_diseno=? ORDER BY id_tren", r -> {
            var ut = r.getBigDecimal(3);
            var c = new Configuracion(r.getString(1), r.getBigDecimal(2), ut == null ? null : ut.doubleValue(), r.getString(4));
            resultado.putIfAbsent(c.linea(), c);
        }, diseno);
        return resultado;
    }

    /** Tras editar un metro, el parámetro elegido gobierna todos los de su línea. */
    public void compartir(int diseno, int tren, String referencia, boolean cambioDeLinea) {
        var filas = jdbc.query("SELECT nombre_linea,velocidad_promedio,duracion_ut FROM metro WHERE id_diseno=? AND id_tren=?",
            (r,n) -> new Configuracion(r.getString(1), r.getBigDecimal(2), r.getBigDecimal(3) == null ? null : r.getBigDecimal(3).doubleValue(), referencia), diseno, tren);
        var elegida = filas.getFirst();
        if (cambioDeLinea) {
            // Al reasignar, hereda la línea de destino sin alterar los metros que ya estaban allí.
            var destino = jdbc.query("SELECT nombre_linea,velocidad_promedio,duracion_ut,referencia_uv_ut FROM metro WHERE id_diseno=? AND nombre_linea=? AND id_tren<>? ORDER BY id_tren LIMIT 1",
                (r,n) -> new Configuracion(r.getString(1), r.getBigDecimal(2), r.getBigDecimal(3) == null ? null : r.getBigDecimal(3).doubleValue(), r.getString(4)), diseno, elegida.linea(), tren);
            if (!destino.isEmpty()) elegida = destino.getFirst();
        }
        guardarLinea(diseno, elegida);
    }

    private void guardarLinea(int diseno, Configuracion c) {
        jdbc.update("UPDATE metro SET velocidad_promedio=?,duracion_ut=?,referencia_uv_ut=? WHERE id_diseno=? AND nombre_linea=?",
            c.uv(), c.ut(), c.referencia(), diseno, c.linea());
    }

    public List<UnidadMetroSimulacionResponse> resolver(int diseno, List<UnidadMetroSimulacionResponse> unidades) {
        if (!aplica(diseno)) return unidades;
        var km = longitudesValidas(diseno);
        var porLinea = configuraciones(diseno);
        return unidades.stream().map(u -> {
            var c = porLinea.get(u.nombreLinea());
            var v = calcular(km.getOrDefault(u.nombreLinea(), 0d), c.uv(), c.ut(), c.referencia());
            return new UnidadMetroSimulacionResponse(u.idTren(), u.nombreLinea(), u.capacidad(), v.uv(), v.ut());
        }).toList();
    }
    public void recalcular(int diseno) {
        if (!aplica(diseno)) return;
        bloquear(diseno);
        var km = longitudesValidas(diseno);
        for (var c : configuraciones(diseno).values()) {
            // Conservar la referencia mientras se construye una línea incompleta.
            var v = km.containsKey(c.linea()) ? calcular(km.get(c.linea()), c.uv(), c.ut(), c.referencia()) : new Valores(c.uv(), c.ut());
            guardarLinea(diseno, new Configuracion(c.linea(), v.uv(), v.ut(), c.referencia()));
        }
    }
}
