package com.metronet.backend.service;

import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.List;
import java.util.Map;
import java.util.function.BiPredicate;

/** Ajusta solo el texto: cada condición que se evalúa también se muestra. */
final class ObjetivosAvanzados {
    private ObjetivosAvanzados() {}

    static List<CondicionConsignaResponse> reducir(int numero, boolean escalaUt, Map<String, Object> reglas,
                                                    List<CondicionConsignaResponse> condiciones) {
        return reducir(numero, escalaUt, reglas, condiciones, (zona, barrio) -> false);
    }

    static List<CondicionConsignaResponse> reducir(int numero, boolean escalaUt, Map<String, Object> reglas,
                                                    List<CondicionConsignaResponse> condiciones,
                                                    BiPredicate<String, String> zonaIncluyeBarrio) {
        if (numero < 5 || numero > 10 || !escalaUt) return condiciones;
        // El catálogo reducido conserva el requisito de simular para registrar el puntaje,
        // pero UV/UT ya verifica esa misma ejecución. Los intentos anteriores mantienen
        // sus condiciones originales y su distribución histórica de puntos.
        boolean catalogoReducido = Boolean.TRUE.equals(reglas.get("requiereSimulacion"))
            && !reglas.containsKey("minimoTramos") && !reglas.containsKey("requiereCoberturaPuntosInteres");
        boolean criterioUvUt = condiciones.stream().anyMatch(c -> c.clave().equals("criterioUvUt"));
        return condiciones.stream()
            .filter(c -> !(catalogoReducido && criterioUvUt && c.clave().equals("simulacionActual")))
            .map(ObjetivosAvanzados::textoCompacto).toList();
    }

    private static CondicionConsignaResponse textoCompacto(CondicionConsignaResponse condicion) {
        String texto = condicion.texto();
        if (condicion.clave().equals("minimoEstaciones") && texto.matches("Ubicar al menos \\d+ estaciones"))
            texto = texto.replace("Ubicar al menos ", "");
        else if (condicion.clave().equals("minimoLineas") && texto.matches("Crear al menos \\d+ líneas"))
            texto = texto.replace("Crear al menos ", "");
        else if (condicion.clave().equals("minimoMetros") && texto.matches("Asignar al menos \\d+ unidades de metro"))
            texto = texto.replace("Asignar al menos ", "").replace(" unidades de metro", " metros");
        else if (condicion.clave().equals("requiereGeografiaValida")
            && texto.equals("Mantener estaciones y conexiones dentro del territorio permitido"))
            texto = "Red dentro del territorio permitido";
        else if (condicion.clave().equals("minimoTransbordos") && texto.matches("Conectar al menos \\d+ estaciones compartidas por dos líneas"))
            texto = texto.replace("Conectar al menos ", "").replace(" estaciones compartidas por dos líneas", " transbordos entre líneas");
        else if (condicion.clave().equals("minimoTransbordos")
            && texto.equals("Conectar al menos una estación compartida por dos líneas"))
            texto = "1 transbordo entre líneas";
        else if (condicion.clave().startsWith("areaObjetivo:") && texto.startsWith("Ubicar al menos 1 estaciones en "))
            texto = "Estación en " + texto.substring("Ubicar al menos 1 estaciones en ".length());
        else if (condicion.clave().equals("requiereObjetivosMismaLinea"))
            texto = "POI en una misma línea continua";
        else if (condicion.clave().equals("aprendizajeSimulacion:individual")
            && texto.equals("Cambiar solo un metro, mantener UT y volver a ejecutar"))
            texto = "Cambiar UV de un metro; repetir con igual UT";
        else if (condicion.clave().equals("aprendizajeSimulacion:global")
            && texto.equals("Cambiar todos los metros a una misma UV, mantener UT y volver a ejecutar"))
            texto = "Metros: igualar UV; repetir con UT fija";
        else if (condicion.clave().equals("criterioUvUt"))
            texto = texto.replace("Completar todos los recorridos en hasta ", "Recorridos: hasta ")
                .replace(" con un máximo de ", "; máximo ")
                .replace(" UV asignadas", " UV");
        return texto.equals(condicion.texto()) ? condicion : new CondicionConsignaResponse(condicion.clave(), texto,
            condicion.actual(), condicion.requerido(), condicion.completado());
    }
}
