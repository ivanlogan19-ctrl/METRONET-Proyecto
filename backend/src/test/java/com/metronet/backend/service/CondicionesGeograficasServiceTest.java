package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class CondicionesGeograficasServiceTest {
    private BigDecimal n(int valor) { return BigDecimal.valueOf(valor); }
    private PuntoInteresObjetivoResponse punto(int x, int y) {
        return new PuntoInteresObjetivoResponse(x, "POI", n(x), n(y), n(60));
    }

    @Test
    void coberturaIncluyeElLimiteDelRadioYExcluyeElExterior() {
        assertTrue(CondicionesGeograficasService.cubre(n(136), n(148), punto(100, 100)));
        assertFalse(CondicionesGeograficasService.cubre(n(136), n(149), punto(100, 100)));
        assertFalse(CondicionesGeograficasService.cubre(null, n(0), punto(0, 0)));
    }

    @Test
    void requiereUnRecorridoContinuoNoSoloEstacionesCercanasOLaMismaEtiquetaDeLinea() {
        var estaciones = List.of(new CondicionesGeograficasService.Estacion("A", n(0), n(0)),
            new CondicionesGeograficasService.Estacion("B", n(200), n(0)),
            new CondicionesGeograficasService.Estacion("C", n(400), n(0)),
            new CondicionesGeograficasService.Estacion("D", n(600), n(0)));
        var objetivos = List.of(punto(0, 0), punto(600, 0));
        var separados = List.of(new CondicionesGeograficasService.Tramo("Azul", "A", "B"),
            new CondicionesGeograficasService.Tramo("Azul", "C", "D"));
        assertFalse(CondicionesGeograficasService.conectaObjetivos(estaciones, separados, objetivos));
        var unidos = new java.util.ArrayList<>(separados);
        unidos.add(new CondicionesGeograficasService.Tramo("Azul", "B", "C"));
        assertTrue(CondicionesGeograficasService.conectaObjetivos(estaciones, unidos, objetivos));
        assertFalse(CondicionesGeograficasService.conectaObjetivos(estaciones, List.of(), objetivos));
        assertFalse(CondicionesGeograficasService.conectaObjetivos(estaciones, unidos, List.of()));
        assertTrue(CondicionesGeograficasService.conectaObjetivos(estaciones, separados, List.of(punto(0, 0))));
    }
}
