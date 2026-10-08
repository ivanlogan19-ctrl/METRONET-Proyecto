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
        int descuentoMaximo, int puntajeMinimoAprobacion, int practicasGratuitas) {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final JsonNode CATALOGO = cargar();
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
        if (!VERSION.equals(configuracion.path("version").asText()))
            throw new IllegalArgumentException("Versión de puntuación no soportada");
        boolean aprobada = false;
        for (int nivel = 1; nivel <= 10; nivel++) aprobada |= configuracionNivel(nivel).equals(configuracion);
        if (!aprobada) throw new IllegalArgumentException("La puntuación debe respetar la política aprobada");
        return MAPPER.convertValue(configuracion, PoliticaPuntuacion.class);
    }

    public Registro evaluar(List<CondicionConsignaResponse> condiciones, List<Registro> anteriores, int numeroEjecucion) {
        var alcanzadas = new HashSet<String>();
        anteriores.forEach(r -> alcanzadas.addAll(r.condicionesCumplidas()));
        var cumplidas = condiciones.stream().filter(CondicionConsignaResponse::completado)
            .map(CondicionConsignaResponse::clave).distinct().toList();
        var pendientes = condiciones.stream().filter(c -> !c.completado()).map(CondicionConsignaResponse::texto).toList();
        boolean avance = cumplidas.stream().anyMatch(clave -> !alcanzadas.contains(clave));
        int descontado = Math.min(descuentoMaximo, anteriores.stream().mapToInt(Registro::descuento).sum());
        int descuento = numeroEjecucion > practicasGratuitas && !pendientes.isEmpty() && !avance
            ? Math.min(descuentoPorEjecucionSinAvance, descuentoMaximo - descontado) : 0;
        return new Registro(version, numeroEjecucion, practicasGratuitas, cumplidas, pendientes,
            descuento, descontado + descuento);
    }

    public record Registro(String version, int numeroEjecucion, int practicasGratuitas,
        List<String> condicionesCumplidas, List<String> condicionesPendientes, int descuento, int totalDescontado) {}
}
