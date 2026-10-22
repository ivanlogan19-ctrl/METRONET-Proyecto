package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.utilidades.GeometriaTerritorial;
import java.util.HashMap;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class ReferenciasRecorridoTest {
    @Test void todasLasEstacionesYConexionesEstanEnTierraConLasCantidadesAprobadas() throws Exception {
        var mapper = new ObjectMapper();
        var geo = new GeografiaService(mapper);
        var territorio = new GeometriaTerritorial(geo.geometriasMapa());
        var servicio = new RecorridoIntegralService(null, null, mapper, geo, null);
        var referencia = RecorridoIntegralService.class.getDeclaredMethod("referencia", JsonNode.class);
        referencia.setAccessible(true);
        try (var entrada = new ClassPathResource("educacion/recorrido-integral.json").getInputStream()) {
            for (var nivel : mapper.readTree(entrada)) {
                var red = (JsonNode) referencia.invoke(servicio, nivel);
                String etiqueta = "Nivel " + nivel.path("numero").asInt();
                var reglas = nivel.path("reglasExito");
                assertEquals(reglas.path("minimoEstaciones").asInt(), red.path("estaciones").size(), etiqueta);
                assertEquals(reglas.path("minimoTramos").asInt(), red.path("tramos").size(), etiqueta);
                var estaciones = new HashMap<String, GeometriaTerritorial.Punto>();
                for (var e : red.path("estaciones")) {
                    var punto = geo.coordenadaGeografica(e.path("x").decimalValue(), e.path("y").decimalValue());
                    estaciones.put(e.path("nombre").asText(), punto);
                    assertTrue(territorio.contiene(punto), etiqueta + " " + e);
                }
                for (var t : red.path("tramos")) assertTrue(territorio.contieneSegmento(
                    estaciones.get(t.path("a").asText()), estaciones.get(t.path("b").asText())), etiqueta + " " + t);
            }
        }
    }
}
