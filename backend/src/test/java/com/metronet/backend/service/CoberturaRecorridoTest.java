package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CoberturaRecorridoTest {
    @Test void palacioYTorresCompartenCentroRadioYBordeInclusivo() {
        var geo=new GeografiaService(new ObjectMapper());
        for (int id:new int[]{1,3}) {
            var catalogo=geo.resolverPunto(id,null);
            var x=geo.posicionX(catalogo);var y=geo.posicionY(catalogo);
            var radio=new BigDecimal("25");
            var punto=new PuntoInteresObjetivoResponse(id,catalogo.nombre(),x,y,radio);
            assertTrue(CondicionesGeograficasService.cubre(x,y,punto));
            assertTrue(CondicionesGeograficasService.cubre(x.add(new BigDecimal("24.99")),y,punto));
            assertTrue(CondicionesGeograficasService.cubre(x.add(radio),y,punto),"El borde se incluye");
            assertFalse(CondicionesGeograficasService.cubre(x.add(new BigDecimal("25.01")),y,punto));
            assertTrue(CondicionesGeograficasService.cubre(x,y.add(radio),punto));
            assertFalse(CondicionesGeograficasService.cubre(x,y.add(new BigDecimal("25.01")),punto));
        }
    }
}
