package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class ObjetivosNivel4Test {
    private static final List<String> ESENCIALES = List.of(
        "minimoEstaciones", "minimoTramos", "requiereRedValida",
        "requiereObjetivosMismaLinea", "aprendizajeSimulacion:velocidad", "criterioUvUt"
    );
    private static final List<String> ANTERIORES = List.of(
        "minimoLineas", "minimoMetros", "requiereCoberturaPuntosInteres",
        "areaObjetivo:0", "areaObjetivo:1", "simulacionActual"
    );

    @Test
    void reduceDoceCondicionesDeIntentosAnterioresASeisObjetivosReales() {
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        ESENCIALES.forEach(clave -> condiciones.add(condicion(clave)));
        ANTERIORES.forEach(clave -> condiciones.add(condicion(clave)));

        List<CondicionConsignaResponse> reducidas = ObjetivosNivel4.reducir(4, true, condiciones);

        assertEquals(6, reducidas.size());
        assertEquals(Set.copyOf(ESENCIALES), reducidas.stream().map(CondicionConsignaResponse::clave).collect(Collectors.toSet()));
        assertEquals("Conectar ambos POI por una misma línea continua", reducidas.stream()
            .filter(c -> c.clave().equals("requiereObjetivosMismaLinea")).findFirst().orElseThrow().texto());
        assertEquals(12, condiciones.size(), "El snapshot del intento no se modifica");
    }

    @Test
    void catalogoNuevoNoDuplicaLaObligacionDeSimular() {
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        ESENCIALES.forEach(clave -> condiciones.add(clave.equals("criterioUvUt")
            ? new CondicionConsignaResponse(clave,
                "Completar todos los recorridos en hasta 2 UT con un máximo de 2 UV asignadas", 0, 1, false)
            : condicion(clave)));
        condiciones.add(condicion("simulacionActual"));
        List<CondicionConsignaResponse> reducidas = ObjetivosNivel4.reducir(4, true, condiciones);
        assertEquals(6, reducidas.size());
        assertEquals("Todos los recorridos en hasta 2 UT; máximo 2 UV asignadas", reducidas.stream()
            .filter(c -> c.clave().equals("criterioUvUt")).findFirst().orElseThrow().texto());
    }

    @Test
    void noModificaOtrosNivelesNiConsignasPersonalizadas() {
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        ESENCIALES.forEach(clave -> condiciones.add(condicion(clave)));
        ANTERIORES.forEach(clave -> condiciones.add(condicion(clave)));
        assertSame(condiciones, ObjetivosNivel4.reducir(5, true, condiciones));
        condiciones.add(condicion("configuracionPuntosInteres"));
        assertSame(condiciones, ObjetivosNivel4.reducir(4, true, condiciones));
    }

    private static CondicionConsignaResponse condicion(String clave) {
        return new CondicionConsignaResponse(clave, clave, 0, 1, false);
    }
}
