package com.metronet.backend.service;

import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PuntuacionServiceTest {
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
