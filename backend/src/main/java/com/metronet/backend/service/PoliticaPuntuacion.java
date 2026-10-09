package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.HashSet;
import java.util.List;
import org.springframework.core.io.ClassPathResource;

/** Política aprobada, congelada en la publicación del nivel; no convierte históricos. */
public record PoliticaPuntuacion(String version, int puntosBase, int descuentoPorEjecucionSinAvance,
        int descuentoPorExceso, int descuentoMaximo, int puntajeMinimoAprobacion, int practicasGratuitas) {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final JsonNode CATALOGO = cargar();
    // Valores congelados de las publicaciones históricas, independientes del catálogo vigente.
    private static final int[] PRACTICAS_V1 = {1, 2, 2, 3, 1, 1, 1, 2, 2, 4};
    public static final String VERSION = CATALOGO.path("version").asText();

    private static JsonNode cargar() {
        try (var entrada = new ClassPathResource("educacion/puntuacion-progreso.json").getInputStream()) {
            return MAPPER.readTree(entrada);
        } catch (Exception e) { throw new IllegalStateException("No se pudo cargar la política de puntuación", e); }
    }

    public static ObjectNode configuracionNivel(int numero) {
        if (numero < 1 || numero > 10) throw new IllegalArgumentException("Nivel fuera del recorrido");
        ObjectNode politica = CATALOGO.deepCopy();
        politica.remove("practicasGratuitasPorNivel");
        politica.put("practicasGratuitas", CATALOGO.path("practicasGratuitasPorNivel").get(numero - 1).asInt());
        return politica;
    }

    public static PoliticaPuntuacion leer(JsonNode configuracion) {
        if (!configuracion.has("version")) return null;
        boolean anterior = "puntuacion-progreso-v1".equals(configuracion.path("version").asText());
        if (!anterior && !VERSION.equals(configuracion.path("version").asText()))
            throw new IllegalArgumentException("Versión de puntuación no soportada");
        boolean aprobada = false;
        for (int nivel = 1; nivel <= 10; nivel++) {
            var esperada = configuracionNivel(nivel);
            if (anterior) {
                esperada.put("version", "puntuacion-progreso-v1");
                esperada.remove("descuentoPorExceso");
                esperada.put("practicasGratuitas", PRACTICAS_V1[nivel - 1]);
            }
            aprobada |= esperada.equals(configuracion);
        }
        if (!aprobada) throw new IllegalArgumentException("La puntuación debe respetar la política aprobada");
        return MAPPER.convertValue(configuracion, PoliticaPuntuacion.class);
    }

    public Registro evaluar(List<CondicionConsignaResponse> condiciones, List<Registro> anteriores, int numeroEjecucion) {
        return evaluar(condiciones, anteriores, numeroEjecucion, List.of());
    }

    public Registro evaluar(List<CondicionConsignaResponse> condiciones, List<Registro> anteriores,
            int numeroEjecucion, List<String> excesosOperacion) {
        var alcanzadas = new HashSet<String>();
        anteriores.forEach(r -> alcanzadas.addAll(r.condicionesCumplidas()));
        var cumplidas = condiciones.stream().filter(CondicionConsignaResponse::completado)
            .map(CondicionConsignaResponse::clave).distinct().toList();
        var pendientes = condiciones.stream().filter(c -> !c.completado()).map(CondicionConsignaResponse::texto).toList();
        boolean avance = cumplidas.stream().anyMatch(clave -> !alcanzadas.contains(clave));
        int descontado = Math.min(descuentoMaximo, anteriores.stream().mapToInt(Registro::descuento).sum());
        var excesos = new java.util.ArrayList<String>();
        if (descuentoPorExceso > 0) {
            // Solo límites explícitos; superar un mínimo no es un exceso.
            condiciones.stream().filter(c -> c.clave().equals("maximoEstaciones")
                && c.requerido() > 0 && c.actual() > c.requerido()).forEach(c ->
                    excesos.add(c.actual() + " estaciones; máximo " + c.requerido()));
            excesos.addAll(excesosOperacion);
        }
        boolean sinAvance = numeroEjecucion > practicasGratuitas && !pendientes.isEmpty() && !avance;
        // Una ejecución cobra una sola vez, aun con varios excesos o sin avances.
        int descuento = Math.min(descuentoMaximo - descontado,
            excesos.isEmpty() ? (sinAvance ? descuentoPorEjecucionSinAvance : 0) : descuentoPorExceso);
        return new Registro(version, numeroEjecucion, practicasGratuitas, cumplidas, pendientes,
            descuento, descontado + descuento, List.copyOf(excesos));
    }

    public record Registro(String version, int numeroEjecucion, int practicasGratuitas,
        List<String> condicionesCumplidas, List<String> condicionesPendientes, int descuento, int totalDescontado,
        List<String> excesos) {
        public Registro { excesos = excesos == null ? List.of() : List.copyOf(excesos); }
    }
}
