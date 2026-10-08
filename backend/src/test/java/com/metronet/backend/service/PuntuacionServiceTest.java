package com.metronet.backend.service;

import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PuntuacionServiceTest {
    @Test void politicaAprobadaSeparaPuntosInicialesDeObjetivosPendientes() {
        var servicio = new PuntuacionService(org.mockito.Mockito.mock(org.springframework.jdbc.core.JdbcTemplate.class),
            new com.fasterxml.jackson.databind.ObjectMapper());
        var resultado = servicio.calcular(1, """
            {"puntuacion":{"version":"puntuacion-progreso-v1","puntosBase":100,
              "descuentoPorEjecucionSinAvance":10,"descuentoMaximo":40,
              "puntajeMinimoAprobacion":60,"practicasGratuitas":1}}
            """, criterios(4, 2));
        assertEquals(100, resultado.puntaje(), "Un intento nuevo empieza en 100; el progreso sigue incompleto");
        assertFalse(resultado.redResuelta());
        assertEquals(50, PuntuacionService.normalizar(criterios(4, 2)));
    }

    @Test void explicacionMencionaSoloElTutorialVigenteSinAlterarPuntos() {
        var servicio = new PuntuacionService(null, new com.fasterxml.jackson.databind.ObjectMapper());
        var resultado = servicio.calcular(1, "{}", criterios(4, 4));
        assertEquals(100, resultado.puntaje());
        assertTrue(resultado.explicacion().contains("tutorial"));
        assertFalse(resultado.explicacion().toLowerCase(java.util.Locale.ROOT).contains("pistas"));
    }

    private List<CondicionConsignaResponse> criterios(int total, int satisfechos) {
        return IntStream.range(0, total).mapToObj(i -> new CondicionConsignaResponse(
            "criterio" + i, "Condición obligatoria", i < satisfechos ? 1 : 0, 1, i < satisfechos)).toList();
    }

    @Test void cuatroCriteriosConPesoEquivalente() {
        for (int satisfechos = 0; satisfechos <= 4; satisfechos++) {
            assertEquals(satisfechos * 25, PuntuacionService.normalizar(criterios(4, satisfechos)));
        }
    }

    @Test void sinCriteriosNoHayPuntosYElRedondeoEsUnico() {
        assertEquals(0, PuntuacionService.normalizar(List.of()));
        assertEquals(33, PuntuacionService.normalizar(criterios(3, 1)));
        assertEquals(67, PuntuacionService.normalizar(criterios(3, 2)));
        assertEquals(17, PuntuacionService.normalizar(criterios(6, 1)));
        assertEquals(100, PuntuacionService.normalizar(criterios(3, 3)));
    }

    @Test void soloImportaElCumplimientoNoElNumeroDeElementosNiLaDescripcion() {
        assertEquals(50, PuntuacionService.normalizar(List.of(
            new CondicionConsignaResponse("minimoEstaciones", "100 estaciones", 100, 100, true),
            new CondicionConsignaResponse("minimoLineas", "2 líneas", 1, 2, false))));
        for (int repeticion = 0; repeticion < 20; repeticion++) {
            assertEquals(75, PuntuacionService.normalizar(criterios(4, 3)));
        }
    }
}
