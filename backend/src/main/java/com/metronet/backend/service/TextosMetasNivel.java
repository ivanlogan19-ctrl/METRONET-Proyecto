package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Etiquetas editoriales: conserva intactos clave, contador y resultado del evaluador. */
final class TextosMetasNivel {
    private static final Set<String> CANTIDADES = Set.of("minimoEstaciones", "minimoLineas", "minimoTramos",
        "minimoMetros", "minimoTransbordos", "maximoEstaciones");
    private static final Set<String> ACCIONES = Set.of("simulacionActual", "requiereMetroPorLinea",
        "requiereObjetivosMismaLinea", "requiereCoberturaPuntosInteres", "requiereGeografiaValida",
        "aprendizajeSimulacion:velocidad", "aprendizajeSimulacion:duracion",
        "aprendizajeSimulacion:individual", "aprendizajeSimulacion:combinacion");

    private TextosMetasNivel() {}

    static void validar(JsonNode reglas) {
        JsonNode textos = reglas.path("textosMetas");
        if (textos.isMissingNode()) return; // Publicaciones anteriores conservan su contrato.
        if (!textos.isObject()) throw invalido("Los textos de metas deben ser un objeto");
        textos.fields().forEachRemaining(par -> {
            String clave = par.getKey(); JsonNode texto = par.getValue();
            boolean lugarConocido = false;
            for (JsonNode lugar : reglas.path("puntosInteresObjetivo"))
                if (clave.equals("poi:" + lugar.path("idPunto").asInt())) lugarConocido = true;
            if (!CANTIDADES.contains(clave) && !ACCIONES.contains(clave) && !lugarConocido)
                throw invalido("Meta no admitida: " + clave);
            if (!texto.isTextual() || texto.asText().isBlank() || texto.asText().length() > 180
                || texto.asText().contains("<") || texto.asText().contains(">")) throw invalido("Texto de meta inválido: " + clave);
            if (CANTIDADES.contains(clave) && !texto.asText().contains("{cantidad}"))
                throw invalido("El texto de " + clave + " debe incluir {cantidad} para coincidir con la cantidad exigida");
        });
        long cantidad = CANTIDADES.stream().filter(reglas::has).count();
        cantidad += ACCIONES.stream().filter(clave -> activa(reglas, clave)).count();
        cantidad += reglas.path("areasObjetivo").size();
        if (cantidad > 5) throw invalido("El nivel admite hasta cinco metas; quitá una antes de agregar otra");
        JsonNode lugares = reglas.path("puntosInteresObjetivo");
        if (lugares.size() > 3) throw invalido("El nivel admite hasta tres lugares objetivo");
        Set<Integer> ids = new java.util.HashSet<>();
        for (JsonNode lugar : lugares) if (!ids.add(lugar.path("idPunto").asInt()))
            throw invalido("No repitas un lugar objetivo");
        if (reglas.path("requierePoiIndividuales").asBoolean() && lugares.isEmpty())
            throw invalido("Agregá al menos un lugar objetivo");
    }

    private static boolean activa(JsonNode reglas, String clave) {
        if (clave.startsWith("aprendizajeSimulacion:")) return reglas.path("aprendizajeSimulacion").path(clave.split(":")[1]).asBoolean();
        return reglas.path(clave.equals("simulacionActual") ? "requiereSimulacion" : clave).asBoolean();
    }

    static List<CondicionConsignaResponse> aplicar(Map<String, Object> reglas, List<CondicionConsignaResponse> condiciones) {
        if (!(reglas.get("textosMetas") instanceof Map<?, ?> textos)) return condiciones;
        return condiciones.stream().map(c -> {
            if (!(textos.get(c.clave()) instanceof String texto) || texto.isBlank()) return c;
            return new CondicionConsignaResponse(c.clave(), texto.replace("{cantidad}", String.valueOf(c.requerido())),
                c.actual(), c.requerido(), c.completado(), true);
        }).toList();
    }

    private static ResponseStatusException invalido(String mensaje) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
