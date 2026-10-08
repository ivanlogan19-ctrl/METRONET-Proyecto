package com.metronet.backend.service;

import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Ajusta solo los objetivos de la versión UV/UT del Nivel 4, sin alterar intentos personalizados. */
final class ObjetivosNivel4 {
    private static final Set<String> ESENCIALES = Set.of(
        "minimoEstaciones", "minimoTramos",
        "requiereObjetivosMismaLinea", "aprendizajeSimulacion:velocidad", "criterioUvUt"
    );
    private static final String LIMITE_ESTACIONES = "maximoEstaciones";
    private static final Set<String> REDUNDANTES_ANTERIORES = Set.of(
        "minimoLineas", "minimoMetros", "requiereCoberturaPuntosInteres",
        "areaObjetivo:0", "areaObjetivo:1", "simulacionActual"
    );

    private ObjetivosNivel4() {}

    static List<CondicionConsignaResponse> reducir(int numero, boolean escalaUt,
                                                    List<CondicionConsignaResponse> condiciones) {
        if (numero != 4 || !escalaUt) return condiciones;
        List<CondicionConsignaResponse> vigentes = condiciones.stream().anyMatch(condicion -> condicion.clave().equals("requiereRedValida"))
            ? condiciones.stream().filter(condicion -> !condicion.clave().equals("requiereRedValida")).toList()
            : condiciones;
        Set<String> claves = vigentes.stream().map(CondicionConsignaResponse::clave).collect(Collectors.toSet());
        boolean anterior = vigentes.size() == ESENCIALES.size() + REDUNDANTES_ANTERIORES.size()
            && claves.size() == vigentes.size()
            && claves.containsAll(ESENCIALES) && claves.containsAll(REDUNDANTES_ANTERIORES);
        boolean anteriorReducida = vigentes.size() == ESENCIALES.size() + 1
            && claves.size() == vigentes.size()
            && claves.containsAll(ESENCIALES) && claves.contains("simulacionActual");
        boolean nueva = vigentes.size() == ESENCIALES.size() + 2
            && claves.size() == vigentes.size()
            && claves.containsAll(ESENCIALES) && claves.contains("simulacionActual")
            && claves.contains(LIMITE_ESTACIONES);
        if (!anterior && !anteriorReducida && !nueva) return vigentes;
        return vigentes.stream().filter(condicion -> ESENCIALES.contains(condicion.clave())
                || (nueva && condicion.clave().equals(LIMITE_ESTACIONES)))
            .map(ObjetivosNivel4::textoCompacto).toList();
    }

    private static CondicionConsignaResponse textoCompacto(CondicionConsignaResponse condicion) {
        String texto = switch (condicion.clave()) {
            case "requiereObjetivosMismaLinea" -> "Conectar ambos POI por una misma línea continua";
            case "aprendizajeSimulacion:velocidad" -> "UV nueva, UT igual: repetir";
            case "criterioUvUt" -> condicion.texto()
                .replace("Completar todos los recorridos en", "Todos los recorridos en")
                .replace(" con un máximo de ", "; máximo ");
            default -> condicion.texto();
        };
        return new CondicionConsignaResponse(condicion.clave(), texto,
            condicion.actual(), condicion.requerido(), condicion.completado());
    }
}
