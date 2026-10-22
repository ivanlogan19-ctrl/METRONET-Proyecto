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
        var actuales = estaciones.values().stream().map(Set::size).sorted().toList();
        boolean distribucion = estaciones.size() == lineas && actuales.equals(esperadas);
        boolean unida = !Boolean.TRUE.equals(configuracion.get("redConectada")) || conectada(vecinos);
        return metas.stream().map(meta -> {
            boolean cumple = switch (meta.clave()) {
                case "minimoLineas" -> distribucion;
                case "minimoTramos" -> unida;
                case "minimoMetros" -> !Boolean.TRUE.equals(configuracion.get("metroPorLinea")) || lineas > 0 && atendidas == lineas;
                default -> true;
            };
            return new CondicionConsignaResponse(meta.clave(), meta.texto(), meta.actual(), meta.requerido(), meta.completado() && cumple);
        }).toList();
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
