package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ObjetivosPuntosInteresServiceTest {
    private final ObjetivosPuntosInteresService servicio = new ObjetivosPuntosInteresService(new ObjectMapper());

    @Test
    void obtieneObjetivosConCoordenadasNormalizadasDesdeLasReglas() {
        String reglasExito = """
            {"puntosInteresObjetivo":[{"idPunto":1,"nombrePunto":"Palacio Legislativo","posicionX":596,"posicionY":493,"radioCobertura":60}]}
            """;

        List<PuntoInteresObjetivoResponse> objetivos = servicio.obtenerObjetivos(reglasExito);

        assertEquals(1, objetivos.size());
        PuntoInteresObjetivoResponse objetivo = objetivos.getFirst();
        assertEquals(1, objetivo.idPunto());
        assertEquals("Palacio Legislativo", objetivo.nombrePunto());
        assertEquals(new BigDecimal("596"), objetivo.posicionX());
        assertEquals(new BigDecimal("493"), objetivo.posicionY());
        assertEquals(new BigDecimal("60"), objetivo.radioCobertura());
    }

    @Test
    void conservaCompatibilidadConEscenariosSinObjetivos() {
        assertTrue(servicio.obtenerObjetivos("{\"minimoEstaciones\":2}").isEmpty());
    }
}
