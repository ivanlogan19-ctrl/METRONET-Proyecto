package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MetasRecorridoTest {
    private final List<CondicionConsignaResponse> metas = List.of(
        new CondicionConsignaResponse("minimoLineas", "Dos líneas de tres estaciones", 2, 2, true),
        new CondicionConsignaResponse("minimoTramos", "Unir las líneas", 4, 4, true),
        new CondicionConsignaResponse("minimoMetros", "Uno por línea", 2, 2, true));
    private final Map<String, Object> configuracion = Map.of("estacionesPorLinea", List.of(3, 3), "redConectada", true, "metroPorLinea", true);

    @Test void noAlcanzaConLasCantidadesTotales() {
        var enlaces = List.of(enlace("Azul", "A", "B"), enlace("Azul", "B", "C"),
            enlace("Azul", "C", "D"), enlace("Verde", "D", "E"));
        var resultado = MetasRecorrido.evaluar(configuracion, metas, enlaces, 2, 1);
        assertFalse(resultado.get(0).completado(), "Cuatro y dos no cumple tres y tres");
        assertTrue(resultado.get(1).completado());
        assertFalse(resultado.get(2).completado(), "Dos metros en una línea no atienden ambas");
    }

    @Test void exigeUnaRedUnidaSinAgregarOtraMeta() {
        var separadas = List.of(enlace("Azul", "A", "B"), enlace("Azul", "B", "C"),
            enlace("Verde", "D", "E"), enlace("Verde", "E", "F"));
        assertFalse(MetasRecorrido.evaluar(configuracion, metas, separadas, 2, 2).get(1).completado());
        var unidas = List.of(enlace("Azul", "A", "B"), enlace("Azul", "B", "C"),
            enlace("Verde", "C", "D"), enlace("Verde", "D", "E"));
        var resultado = MetasRecorrido.evaluar(configuracion, metas, unidas, 2, 2);
        assertEquals(metas.size(), resultado.size());
        assertTrue(resultado.stream().allMatch(CondicionConsignaResponse::completado));
    }

    @Test void aceptaUnaSolaSimulacionConElControlYLaDireccionSolicitados() {
        assertTrue(MetasRecorrido.practica("inicial", registro(1, "UV")));
        assertFalse(MetasRecorrido.practica("aumentarUV", registro(1, "UV")));
        assertTrue(MetasRecorrido.practica("aumentarUV", registro(2, "UV")));
        assertFalse(MetasRecorrido.practica("aumentarUV", registro(2, "UT")));
        assertTrue(MetasRecorrido.practica("aumentarUT", registro(0.5, "UT")));
        assertFalse(MetasRecorrido.practica("aumentarUT", registro(2, "UT")));
        assertTrue(MetasRecorrido.practica("reducirUT", registro(2, "UT")));
        assertTrue(MetasRecorrido.practica("reducirUV", registro(0.5, "UV")));
        assertTrue(MetasRecorrido.practica("cambiar", registro(2, "UV")));
        assertTrue(MetasRecorrido.practica("cambiar", registro(0.5, "UT")));
        assertFalse(MetasRecorrido.practica("cambiar", registro(1, "UT")));
        assertFalse(MetasRecorrido.practica("cambiar", null));
        assertTrue(MetasRecorrido.practica("", null), "Los históricos conservan sus reglas");
    }

    @Test void rechazaConfiguracionesAmbiguasAntesDePublicar() throws Exception {
        var reglas = new ObjectMapper().readTree("""
            {"minimoLineas":2,"requiereSimulacion":true,"configuracionRecorrido":
              {"estacionesPorLinea":[3,3],"redConectada":true,"metroPorLinea":true,"practica":"aumentarUV"}}
            """);
        assertDoesNotThrow(() -> MetasRecorrido.validar(reglas));
        ((com.fasterxml.jackson.databind.node.ObjectNode) reglas.path("configuracionRecorrido")).put("practica", "comparar");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> MetasRecorrido.validar(reglas));
    }

    private MetasRecorrido.Enlace enlace(String linea, String a, String b) { return new MetasRecorrido.Enlace(linea, a, b); }
    private RegistroSimulacionDidactica registro(double uv, String referencia) {
        return new RegistroSimulacionDidactica("red", List.of(new MedicionUnidad(1, "Azul", uv, 2, 10 / uv)),
            null, RegistroSimulacionDidactica.ESCALA_VINCULADA, Map.of("Azul", referencia));
    }
}
