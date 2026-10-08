package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ObjetivosAvanzadosTest {
    @Test
    void catalogosReducenCondicionesRealesYConservanGeografiaTransbordosYPoi() throws Exception {
        var mapper = new ObjectMapper();
        List<Map<String, Object>> niveles = mapper.readValue(getClass().getResourceAsStream("/educacion/niveles.json"),
            new TypeReference<>() {});
        Map<Integer, Integer> generales = Map.of(5, 8, 6, 9, 7, 10, 8, 10, 9, 11, 10, 12);
        Map<Integer, Integer> poi = Map.of(5, 2, 6, 3, 7, 3, 8, 3, 9, 4, 10, 4);
        for (var nivel : niveles) {
            int numero = (Integer) nivel.get("numero");
            if (numero < 5 || numero > 10) continue;
            @SuppressWarnings("unchecked")
            Map<String, Object> reglas = (Map<String, Object>) nivel.get("reglasExito");
            List<CondicionConsignaResponse> condiciones = new ArrayList<>();
            for (String clave : List.of("minimoEstaciones", "minimoLineas", "minimoTramos", "minimoMetros",
                    "maximoEstaciones", "requiereCoberturaPuntosInteres",
                    "requiereGeografiaValida", "minimoTransbordos", "requiereObjetivosMismaLinea"))
                if (reglas.containsKey(clave)) condiciones.add(condicion(clave));
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> areas = (List<Map<String, Object>>) reglas.get("areasObjetivo");
            for (int i = 0; i < areas.size(); i++) condiciones.add(condicion("areaObjetivo:" + i));
            @SuppressWarnings("unchecked")
            Map<String, Object> aprendizaje = (Map<String, Object>) reglas.get("aprendizajeSimulacion");
            aprendizaje.keySet().forEach(clave -> condiciones.add(condicion("aprendizajeSimulacion:" + clave)));
            if (Boolean.TRUE.equals(reglas.get("requiereSimulacion"))) condiciones.add(condicion("simulacionActual"));
            condiciones.add(condicion("criterioUvUt"));

            var mostradas = ObjetivosAvanzados.reducir(numero, true, reglas, condiciones);
            assertEquals(generales.get(numero) + 1, condiciones.size(), "Nivel " + numero);
            assertEquals(generales.get(numero), mostradas.size(), "Simulación y UV/UT no puntúan dos veces");
            assertEquals(condiciones.stream().map(CondicionConsignaResponse::clave)
                .filter(clave -> !clave.equals("simulacionActual")).toList(),
                mostradas.stream().map(CondicionConsignaResponse::clave).toList(), "Solo se elimina el criterio duplicado");
            assertEquals(poi.get(numero), ((List<?>) reglas.get("puntosInteresObjetivo")).size());
            assertTrue(mostradas.size() > poi.get(numero));
            assertTrue(mostradas.stream().anyMatch(c -> c.clave().equals("requiereGeografiaValida")));
            assertTrue(mostradas.stream().noneMatch(c -> c.clave().equals("requiereRedValida")));
            assertTrue(mostradas.stream().anyMatch(c -> c.clave().equals("requiereObjetivosMismaLinea")));
            if (numero >= 7) assertTrue(mostradas.stream().anyMatch(c -> c.clave().equals("minimoTransbordos")));
            if (numero >= 9) assertTrue(mostradas.stream().anyMatch(c -> c.clave().equals("maximoEstaciones")));
            if (numero <= 8) assertTrue(mostradas.stream().anyMatch(c -> c.clave().equals("maximoEstaciones")));
            if (numero >= 9) assertTrue(mostradas.stream().anyMatch(c -> c.clave().equals("minimoTramos")));
        }
    }

    @Test
    void intentosAnterioresNoPierdenCondicionesEvaluadas() {
        List<CondicionConsignaResponse> anteriores = new ArrayList<>();
        for (String clave : List.of("minimoEstaciones", "minimoLineas", "minimoTramos", "minimoMetros",
                "requiereCoberturaPuntosInteres", "requiereGeografiaValida",
                "areaObjetivo:0", "areaObjetivo:1", "simulacionActual", "criterioUvUt"))
            anteriores.add(condicion(clave));
        var mostradas = ObjetivosAvanzados.reducir(7, true, Map.of(), anteriores);
        assertEquals(anteriores.stream().map(CondicionConsignaResponse::clave).toList(),
            mostradas.stream().map(CondicionConsignaResponse::clave).toList());
        assertSame(anteriores, ObjetivosAvanzados.reducir(7, false, Map.of(), anteriores));
    }

    @Test
    void criterioUvUtMantieneAmbosLimitesEnTextoBreve() {
        var original = new CondicionConsignaResponse("criterioUvUt",
            "Completar todos los recorridos en hasta 12 UT con un máximo de 60 UV asignadas", 0, 1, false);
        var resultado = ObjetivosAvanzados.reducir(10, true, Map.of(), List.of(original));
        assertEquals("Recorridos: hasta 12 UT; máximo 60 UV", resultado.getFirst().texto());
        var global = new CondicionConsignaResponse("aprendizajeSimulacion:global",
            "Cambiar todos los metros a una misma UV, mantener UT y volver a ejecutar", 0, 1, false);
        assertEquals("Metros: igualar UV; repetir con UT fija",
            ObjetivosAvanzados.reducir(10, true, Map.of(), List.of(global)).getFirst().texto());
    }

    private static CondicionConsignaResponse condicion(String clave) {
        return new CondicionConsignaResponse(clave, clave, 0, 1, false);
    }
}
