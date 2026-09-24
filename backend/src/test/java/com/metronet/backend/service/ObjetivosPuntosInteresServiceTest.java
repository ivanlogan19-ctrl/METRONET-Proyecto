package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ObjetivosPuntosInteresServiceTest {
    private final ObjetivosPuntosInteresService servicio = new ObjetivosPuntosInteresService(new ObjectMapper(), new GeografiaService(new ObjectMapper()));

    @Test
    void resuelveElPoiDelCatalogoSinDesplazarloPorCoordenadasAntiguasEnLasReglas() {
        String reglasExito = """
            {"puntosInteresObjetivo":[{"idPunto":1,"nombrePunto":"Palacio Legislativo","posicionX":596,"posicionY":493,"radioCobertura":60}]}
            """;

        List<PuntoInteresObjetivoResponse> objetivos = servicio.obtenerObjetivos(reglasExito);

        assertEquals(1, objetivos.size());
        PuntoInteresObjetivoResponse objetivo = objetivos.getFirst();
        assertEquals(1, objetivo.idPunto());
        assertEquals("Palacio Legislativo", objetivo.nombrePunto());
        GeografiaService geografia = new GeografiaService(new ObjectMapper());
        assertEquals(geografia.posicionX(geografia.resolverPunto(1, null)), objetivo.posicionX());
        assertEquals(geografia.posicionY(geografia.resolverPunto(1, null)), objetivo.posicionY());
        assertEquals(new BigDecimal("60"), objetivo.radioCobertura());
    }

    @Test
    void conservaCompatibilidadConEscenariosSinObjetivos() {
        assertTrue(servicio.obtenerObjetivos("{\"minimoEstaciones\":2}").isEmpty());
    }

    @Test
    void referenciaInexistenteNoSeSustituyePorElNombreNiPorCoordenadasArbitrarias() {
        String reglas = """
            {"requiereCoberturaPuntosInteres":true,"puntosInteresObjetivo":[
              {"idPunto":9999,"nombrePunto":"Palacio Legislativo","posicionX":10,"posicionY":10,"radioCobertura":60}]}
            """;
        assertTrue(servicio.obtenerObjetivos(reglas).isEmpty());
        assertEquals(1, servicio.obtenerErrores(reglas).size());
    }

    @Test
    void reportaUnObjetivoInvalidoAunqueLosDemasSeanValidos() {
        String reglas = """
            {"requiereCoberturaPuntosInteres":true,"puntosInteresObjetivo":[
              {"idPunto":1,"radioCobertura":60},{"idPunto":26,"radioCobertura":0}]}
            """;
        assertEquals(1, servicio.obtenerObjetivos(reglas).size());
        assertEquals(1, servicio.obtenerErrores(reglas).size());
    }

    @Test
    void exigeRadioExplicitoYRechazaNombresAmbiguos() {
        for (String objetivo : List.of("{\"idPunto\":1}",
            "{\"nombrePunto\":\"Estadio Jardines del Hipódromo\",\"radioCobertura\":60}")) {
            String reglas = "{\"requiereCoberturaPuntosInteres\":true,\"puntosInteresObjetivo\":[" + objetivo + "]}";
            assertTrue(servicio.obtenerObjetivos(reglas).isEmpty());
            assertEquals(1, servicio.obtenerErrores(reglas).size());
        }
        assertEquals(1, servicio.obtenerErrores("{\"requiereCoberturaPuntosInteres\":true}").size());
        assertEquals(1, servicio.obtenerObjetivos("{\"puntosInteresObjetivo\":[{\"nombrePunto\":\"Palacio Legislativo\",\"radioCobertura\":60}]}").size());
    }
}
