package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Detalles de las cinco metas del recorrido; no agrega condiciones ocultas ni reinterpreta históricos. */
final class MetasRecorrido {
    private static final Set<String> PRACTICAS = Set.of("inicial", "aumentarUV", "aumentarUT", "reducirUT", "reducirUV", "cambiar");
    record Enlace(String linea, String origen, String destino) {}

    private MetasRecorrido() {}

    static void validar(JsonNode reglas) {
        JsonNode c = reglas.path("configuracionRecorrido");
        if (c.isMissingNode()) return;
        JsonNode estaciones = c.path("estacionesPorLinea");
        if (!c.isObject() || !estaciones.isArray() || estaciones.size() != reglas.path("minimoLineas").asInt()
            || !c.path("redConectada").isBoolean() || !c.path("metroPorLinea").isBoolean()
            || (c.has("practica") && !PRACTICAS.contains(c.path("practica").asText())))
            throw invalida();
        for (JsonNode cantidad : estaciones) if (!cantidad.isIntegralNumber() || cantidad.asInt() < 2) throw invalida();
        c.fieldNames().forEachRemaining(clave -> {
            if (!Set.of("estacionesPorLinea", "redConectada", "metroPorLinea", "practica").contains(clave)) throw invalida();
        });
        if (!reglas.path("requiereSimulacion").asBoolean() || reglas.has("aprendizajeSimulacion")
            || reglas.has("requiereMetroPorLinea")) throw invalida();
    }

    private static ResponseStatusException invalida() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Configuración de las metas del recorrido inválida");
    }

    static List<CondicionConsignaResponse> evaluar(Map<?, ?> configuracion, List<CondicionConsignaResponse> metas,
                                                   List<Enlace> enlaces, int lineas, int atendidas) {
        Map<String, Set<String>> estaciones = new HashMap<>();
        Map<String, Set<String>> vecinos = new HashMap<>();
        for (var enlace : enlaces) {
            estaciones.computeIfAbsent(enlace.linea(), k -> new HashSet<>()).addAll(List.of(enlace.origen(), enlace.destino()));
            vecinos.computeIfAbsent(enlace.origen(), k -> new HashSet<>()).add(enlace.destino());
            vecinos.computeIfAbsent(enlace.destino(), k -> new HashSet<>()).add(enlace.origen());
        }
        var esperadas = ((List<?>) configuracion.get("estacionesPorLinea")).stream().map(n -> ((Number) n).intValue()).sorted().toList();
        boolean distribucion = contieneDistribucion(estaciones, esperadas);
        boolean unida = !Boolean.TRUE.equals(configuracion.get("redConectada")) || conectada(vecinos);
        return metas.stream().map(meta -> {
            boolean cumple = switch (meta.clave()) {
                case "minimoLineas" -> distribucion;
                case "minimoTramos" -> unida;
                case "minimoMetros" -> !Boolean.TRUE.equals(configuracion.get("metroPorLinea")) || !esperadas.isEmpty() && atendidas >= esperadas.size();
                default -> true;
            };
            return new CondicionConsignaResponse(meta.clave(), meta.texto(), meta.actual(), meta.requerido(), meta.completado() && cumple);
        }).toList();
    }

    private static boolean contieneDistribucion(Map<String, Set<String>> estaciones, List<Integer> esperadas) {
        var actuales = new java.util.ArrayList<>(estaciones.values().stream().map(Set::size).sorted().toList());
        // Cada requisito consume una línea distinta; las adicionales no borran lo cumplido.
        for (Integer cantidad : esperadas) {
            var suficiente = actuales.stream().filter(actual -> actual >= cantidad).findFirst();
            if (suficiente.isEmpty()) return false;
            actuales.remove(suficiente.get());
        }
        return true;
    }

    /** Los extras descuentan al ejecutar; no alteran las estrellas de las cinco metas. */
    static List<String> excesos(Map<String, Object> reglas, List<CondicionConsignaResponse> condiciones) {
        if (!Boolean.TRUE.equals(reglas.get("penalizarElementosAdicionales"))) return List.of();
        var nombres = Map.of("minimoEstaciones", "estaciones", "minimoLineas", "líneas",
            "minimoTramos", "tramos", "minimoMetros", "metros", "minimoConexionesLineas", "conexiones");
        var excesos = new java.util.ArrayList<String>();
        for (var condicion : condiciones) {
            if (!nombres.containsKey(condicion.clave())) continue;
            int limite = condicion.requerido();
            // Cada conexión exigida requiere su metro adicional a los metros de las líneas.
            if (condicion.clave().equals("minimoMetros"))
                limite += ((Number) reglas.getOrDefault("minimoConexionesLineas", 0)).intValue();
            if (condicion.actual() > limite)
                excesos.add(condicion.actual() + " " + nombres.get(condicion.clave()) + "; consigna " + limite);
        }
        return List.copyOf(excesos);
    }

    static boolean lineasConectadas(List<List<String>> conexiones, int cantidadLineas) {
        Map<String, Set<String>> vecinas = new HashMap<>();
        for (var conexion : conexiones) {
            vecinas.computeIfAbsent(conexion.get(0), k -> new HashSet<>()).add(conexion.get(1));
            vecinas.computeIfAbsent(conexion.get(1), k -> new HashSet<>()).add(conexion.get(0));
        }
        // Una componente suficiente conserva lo cumplido aunque haya líneas adicionales.
        var pendientes = new HashSet<>(vecinas.keySet());
        while (!pendientes.isEmpty()) {
            var cola = new ArrayDeque<String>();
            var visitadas = new HashSet<String>();
            cola.add(pendientes.iterator().next());
            while (!cola.isEmpty()) {
                String linea = cola.remove();
                if (visitadas.add(linea)) cola.addAll(vecinas.get(linea));
            }
            if (visitadas.size() >= cantidadLineas) return true;
            pendientes.removeAll(visitadas);
        }
        return false;
    }

    private static boolean conectada(Map<String, Set<String>> vecinos) {
        if (vecinos.isEmpty()) return false;
        var pendientes = new ArrayDeque<String>();
        var visitadas = new HashSet<String>();
        pendientes.add(vecinos.keySet().iterator().next());
        while (!pendientes.isEmpty()) {
            var estacion = pendientes.remove();
            if (visitadas.add(estacion)) pendientes.addAll(vecinos.get(estacion));
        }
        return visitadas.size() == vecinos.size();
    }

    /** El punto de partida del juego es 1 UV; la UT inicial resulta de la distancia de cada línea. */
    static boolean practica(String practica, RegistroSimulacionDidactica registro) {
        if (practica.isEmpty()) return true;
        if (registro == null || !registro.esVinculada() || registro.unidades().isEmpty()) return false;
        if (practica.equals("inicial")) return registro.unidades().stream().allMatch(u -> Math.abs(u.velocidad() - 1) < 1e-7);
        if (registro.referencias() == null) return false;
        return registro.unidades().stream().anyMatch(u -> {
            String referencia = registro.referencias().get(u.linea());
            double diferencia = u.velocidad() - 1;
            return switch (practica) {
                case "aumentarUV" -> "UV".equals(referencia) && diferencia > 1e-7;
                case "reducirUV" -> "UV".equals(referencia) && diferencia < -1e-7;
                case "aumentarUT" -> "UT".equals(referencia) && diferencia < -1e-7;
                case "reducirUT" -> "UT".equals(referencia) && diferencia > 1e-7;
                case "cambiar" -> Set.of("UV", "UT").contains(referencia == null ? "" : referencia) && Math.abs(diferencia) > 1e-7;
                default -> false;
            };
        });
    }
}
