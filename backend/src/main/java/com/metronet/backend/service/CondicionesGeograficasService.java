package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Condiciones optativas del escenario; no sustituye las reglas de conectividad de la red. */
@Service
public class CondicionesGeograficasService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final GeografiaService geografia;
    private final RestriccionesGeograficasService restricciones;

    public CondicionesGeograficasService(JdbcTemplate jdbc, ObjectMapper mapper, GeografiaService geografia, RestriccionesGeograficasService restricciones) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.geografia = geografia;
        this.restricciones = restricciones;
    }

    public boolean zonaIncluyeBarrio(String zona, String barrio) {
        return geografia.zonaIncluyeBarrio(zona, barrio);
    }

    public List<CondicionConsignaResponse> evaluar(Integer idDiseno, Map<String, Object> reglas,
                                                  List<PuntoInteresObjetivoResponse> objetivos) {
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        JsonNode configuracion = mapper.valueToTree(reglas);
        if (Boolean.TRUE.equals(reglas.get("requiereGeografiaValida")) || reglas.containsKey("restriccionesGeograficas")) {
            List<String> problemas = restricciones.observarDiseno(idDiseno, restricciones.leerConfiguracion(configuracion.toString()));
            Integer estaciones = jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", Integer.class, idDiseno);
            // Sin una red construida no hay geografía que acreditar como logro educativo.
            boolean cumplida = estaciones != null && estaciones > 0 && problemas.isEmpty();
            condiciones.add(new CondicionConsignaResponse("requiereGeografiaValida", problemas.isEmpty()
                ? "Mantener estaciones y conexiones dentro del territorio permitido"
                : "Revisar la geografía de la red: " + String.join(" ", problemas), cumplida ? 1 : 0, 1, cumplida));
        }
        if (reglas.containsKey("minimoTransbordos")) {
            JsonNode minimo = configuracion.path("minimoTransbordos");
            boolean valido = minimo.isIntegralNumber() && minimo.canConvertToInt() && minimo.intValue() > 0;
            // Los intentos previos conservan el criterio explícito guardado en su snapshot.
            boolean porConexion = Boolean.TRUE.equals(reglas.get("transbordosPorConexion"));
            Integer actual = valido ? jdbc.queryForObject("""
                SELECT COUNT(*) FROM estacion e WHERE e.id_diseno = ?
                  AND (? OR e.transbordo = TRUE)
                  AND (SELECT COUNT(DISTINCT t.nombre_linea) FROM tramo t
                       WHERE t.id_diseno = e.id_diseno
                         AND (t.nombre_estacion_a = e.nombre OR t.nombre_estacion_b = e.nombre)) >= 2
                """, Integer.class, idDiseno, porConexion) : 0;
            condiciones.add(new CondicionConsignaResponse("minimoTransbordos",
                valido ? (porConexion
                    ? "Conectar al menos " + (minimo.intValue() == 1 ? "una estación compartida" : minimo.intValue() + " estaciones compartidas") + " por dos líneas"
                    : "Usar al menos " + minimo.intValue() + " transbordos entre líneas")
                    : "Cantidad de transbordos inválida en la consigna",
                actual == null ? 0 : actual, valido ? minimo.intValue() : 1, valido && actual != null && actual >= minimo.intValue()));
        }
        boolean areas = reglas.containsKey("areasObjetivo");
        boolean mismaLinea = Boolean.TRUE.equals(reglas.get("requiereObjetivosMismaLinea"));
        if (!areas && !mismaLinea) return condiciones;
        List<Estacion> estaciones = jdbc.query("SELECT nombre, posicion_x, posicion_y FROM estacion WHERE id_diseno = ?",
            (r, fila) -> new Estacion(r.getString("nombre"), r.getBigDecimal("posicion_x"), r.getBigDecimal("posicion_y")), idDiseno);
        if (areas) {
            JsonNode lista = configuracion.path("areasObjetivo");
            if (!lista.isArray() || lista.isEmpty()) {
                condiciones.add(new CondicionConsignaResponse("areasObjetivo", "No hay áreas geográficas válidas en la consigna", 0, 1, false));
            } else {
                int indice = 0;
                for (JsonNode area : lista) {
                    String tipo = area.path("tipo").asText();
                    String nombre = area.path("nombre").asText();
                    JsonNode minimo = area.path("minimoEstaciones");
                    int requerido = minimo.isMissingNode() ? 1 : minimo.asInt();
                    boolean valido = (minimo.isMissingNode() || (minimo.isIntegralNumber() && minimo.canConvertToInt()))
                        && requerido > 0 && geografia.tieneGeometria(tipo, nombre);
                    int actual = valido ? (int) estaciones.stream().filter(e -> geografia.pertenece(tipo, nombre, e.x(), e.y())).count() : 0;
                    condiciones.add(new CondicionConsignaResponse("areaObjetivo:" + indice++, valido
                        ? "Ubicar al menos " + requerido + " estaciones en " + nombre
                        : "Área sin geometría o configuración válida: " + nombre,
                        actual, valido ? requerido : 1, valido && actual >= requerido));
                }
            }
        }
        if (mismaLinea) {
            List<Tramo> tramos = jdbc.query("SELECT nombre_linea, nombre_estacion_a, nombre_estacion_b FROM tramo WHERE id_diseno = ?",
                (r, fila) -> new Tramo(r.getString("nombre_linea"), r.getString("nombre_estacion_a"), r.getString("nombre_estacion_b")), idDiseno);
            boolean conectado = conectaObjetivos(estaciones, tramos, objetivos);
            condiciones.add(new CondicionConsignaResponse("requiereObjetivosMismaLinea",
                "Conectar los POI objetivo mediante un recorrido continuo de una misma línea", conectado ? 1 : 0, 1, conectado));
        }
        return condiciones;
    }

    static boolean conectaObjetivos(List<Estacion> estaciones, List<Tramo> tramos, List<PuntoInteresObjetivoResponse> objetivos) {
        if (objetivos.isEmpty()) return false;
        Map<String, Map<String, Set<String>>> lineas = new HashMap<>();
        for (Tramo tramo : tramos) {
            Map<String, Set<String>> adyacencias = lineas.computeIfAbsent(tramo.linea(), clave -> new HashMap<>());
            adyacencias.computeIfAbsent(tramo.a(), clave -> new HashSet<>()).add(tramo.b());
            adyacencias.computeIfAbsent(tramo.b(), clave -> new HashSet<>()).add(tramo.a());
        }
        for (Map<String, Set<String>> adyacencias : lineas.values()) {
            Set<String> visitadas = new HashSet<>();
            for (String inicio : adyacencias.keySet()) {
                if (visitadas.contains(inicio)) continue;
                Set<String> componente = new HashSet<>();
                List<String> pendientes = new ArrayList<>(List.of(inicio));
                while (!pendientes.isEmpty()) {
                    String actual = pendientes.removeLast();
                    if (!componente.add(actual)) continue;
                    pendientes.addAll(adyacencias.getOrDefault(actual, Set.of()));
                }
                visitadas.addAll(componente);
                if (objetivos.stream().allMatch(punto -> estaciones.stream()
                    .anyMatch(e -> componente.contains(e.nombre()) && cubre(e.x(), e.y(), punto)))) return true;
            }
        }
        return false;
    }

    static boolean cubre(BigDecimal x, BigDecimal y, PuntoInteresObjetivoResponse punto) {
        if (x == null || y == null || punto.posicionX() == null || punto.posicionY() == null || punto.radioCobertura() == null) return false;
        return Math.hypot(x.subtract(punto.posicionX()).doubleValue(), y.subtract(punto.posicionY()).doubleValue()) <= punto.radioCobertura().doubleValue();
    }

    record Estacion(String nombre, BigDecimal x, BigDecimal y) {}
    record Tramo(String linea, String a, String b) {}
}
