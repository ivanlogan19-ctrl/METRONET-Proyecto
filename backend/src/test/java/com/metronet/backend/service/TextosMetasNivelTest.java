package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class TextosMetasNivelTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void textoNoModificaLaEvaluacionYLaCantidadSeActualiza() {
        var original = new CondicionConsignaResponse("minimoEstaciones", "Original", 2, 3, false);
        var editada = TextosMetasNivel.aplicar(Map.of("textosMetas", Map.of("minimoEstaciones", "Construí {cantidad} estaciones")), List.of(original)).getFirst();
        assertEquals("Construí 3 estaciones", editada.texto());
        assertEquals(original.actual(), editada.actual()); assertEquals(original.requerido(), editada.requerido());
        assertEquals(original.clave(), editada.clave()); assertFalse(editada.completado()); assertTrue(editada.textoPersonalizado());
    }
    @Test void rechazaTextoConNumeroDesvinculadoYClavesInventadas() throws Exception {
        for (String texto : List.of("{\"minimoEstaciones\":\"Construir 9 estaciones\"}", "{\"inventada\":\"Ganar\"}")) {
            var reglas = mapper.createObjectNode().put("minimoEstaciones", 2);
            reglas.set("textosMetas", mapper.readTree(texto));
            assertThrows(ResponseStatusException.class, () -> TextosMetasNivel.validar(reglas));
        }
    }
    @Test void admitePoiEnNivelInicialSinContarloComoSextaMeta() throws Exception {
        var reglas = mapper.readTree("""
            {"minimoEstaciones":2,"minimoLineas":1,"minimoTramos":1,"minimoMetros":1,"requiereSimulacion":true,
             "textosMetas":{},"requierePoiIndividuales":true,"puntosInteresObjetivo":[{"idPunto":1,"radioCobertura":40}]}
            """);
        assertDoesNotThrow(() -> TextosMetasNivel.validar(reglas));
        ((com.fasterxml.jackson.databind.node.ObjectNode)reglas).put("minimoTransbordos", 1);
        assertThrows(ResponseStatusException.class, () -> TextosMetasNivel.validar(reglas));
    }
    @Test void rechazaLugaresDuplicadosOMasDeTres() throws Exception {
        for (String ids : List.of("1,1", "1,2,3,4")) {
            var reglas = mapper.createObjectNode(); reglas.putObject("textosMetas");
            var lugares = reglas.putArray("puntosInteresObjetivo");
            for (String id : ids.split(",")) lugares.addObject().put("idPunto", Integer.parseInt(id));
            assertThrows(ResponseStatusException.class, () -> TextosMetasNivel.validar(reglas));
        }
    }
    @Test void textoDeLugarExigePoiExistenteYConservaSuEvaluacion() throws Exception {
        var reglas = mapper.readTree("""
            {"puntosInteresObjetivo":[{"idPunto":3}],"textosMetas":{"poi:3":"Conectar el destino"}}
            """);
        assertDoesNotThrow(() -> TextosMetasNivel.validar(reglas));
        var original = new CondicionConsignaResponse("poi:3", "Original", 0, 1, false);
        var editada = TextosMetasNivel.aplicar(Map.of("textosMetas", Map.of("poi:3", "Conectar el destino")), List.of(original)).getFirst();
        assertEquals("Conectar el destino", editada.texto());
        assertEquals(original.actual(), editada.actual());
        assertEquals(original.requerido(), editada.requerido());
        assertFalse(editada.completado());
        ((com.fasterxml.jackson.databind.node.ObjectNode)reglas).remove("puntosInteresObjetivo");
        assertThrows(ResponseStatusException.class, () -> TextosMetasNivel.validar(reglas));
    }
}
