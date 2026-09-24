package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.utilidades.GeometriaTerritorial;
import java.util.ArrayList;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.core.io.ClassPathResource;

class GeometriaTerritorialTest {
    @TestFactory
    Stream<DynamicTest> verificaLosMismosCasosQueElFrontend() throws Exception {
        JsonNode casos;
        try (var entrada = new ClassPathResource("fixtures/geometria-territorial.json").getInputStream()) {
            casos = new ObjectMapper().readTree(entrada);
        }
        var pruebas = new ArrayList<DynamicTest>();
        for (JsonNode caso : casos) pruebas.add(DynamicTest.dynamicTest(caso.path("nombre").asText(), () -> {
            var formas = new ArrayList<JsonNode>(); caso.path("geometrias").forEach(formas::add);
            var geometria = new GeometriaTerritorial(formas);
            for (JsonNode p : caso.path("puntos")) assertEquals(p.path("dentro").asBoolean(), geometria.contiene(punto(p.path("p"))));
            for (JsonNode s : caso.path("segmentos")) {
                assertEquals(s.path("dentro").asBoolean(), geometria.contieneSegmento(punto(s.path("a")), punto(s.path("b"))), s.toString());
                assertEquals(s.path("intersecta").asBoolean(), geometria.intersectaSegmento(punto(s.path("a")), punto(s.path("b"))), s.toString());
            }
        }));
        return pruebas.stream();
    }

    private GeometriaTerritorial.Punto punto(JsonNode p) { return new GeometriaTerritorial.Punto(p.get(0).doubleValue(), p.get(1).doubleValue()); }
}
