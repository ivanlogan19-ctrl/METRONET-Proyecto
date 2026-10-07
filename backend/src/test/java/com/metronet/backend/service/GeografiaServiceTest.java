package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class GeografiaServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final GeografiaService geografia = new GeografiaService(mapper);

    @Test
    void utilizaCoordenadasYPoligonosDelMapaIncluyendoLaDiscrepanciaDelCatalogo() {
        var palacio = geografia.resolverPunto(1, null);
        assertTrue(geografia.pertenece("barrio", "Aguada", geografia.posicionX(palacio), geografia.posicionY(palacio)));
        assertTrue(geografia.pertenece("zona", "ZONA OESTE", geografia.posicionX(palacio), geografia.posicionY(palacio)));
        assertTrue(geografia.zonaIncluyeBarrio("ZONA OESTE", "Aguada"));
        assertTrue(geografia.zonaIncluyeBarrio("ZONA ESTE", "Punta Gorda"));
        assertFalse(geografia.zonaIncluyeBarrio("ZONA ESTE", "Aguada"));
        assertFalse(geografia.pertenece("zona", "ZONA ESTE", geografia.posicionX(palacio), geografia.posicionY(palacio)));
        var rambla = geografia.resolverPunto(26, null);
        assertTrue(geografia.pertenece("barrio", "Punta Gorda", geografia.posicionX(rambla), geografia.posicionY(rambla)));
        assertFalse(geografia.pertenece("barrio", "Carrasco", geografia.posicionX(rambla), geografia.posicionY(rambla)));
        assertTrue(geografia.pertenece("zona", "ZONA ESTE", geografia.posicionX(rambla), geografia.posicionY(rambla)));
        for (String zona : new String[]{"CENTRO", "ESTE", "NORTE", "OESTE", "OESTE-COSTA", "NOROESTE"}) {
            assertTrue(geografia.tieneGeometria("zona", "ZONA " + zona), zona);
        }
    }

    @Test
    void rechazaAreasDesconocidasSinUsarNombresComoPruebaDePertenencia() {
        assertFalse(geografia.tieneGeometria("barrio", "Inventado"));
        assertFalse(geografia.tieneGeometria("zona", "Inventada"));
        assertFalse(geografia.pertenece("barrio", "Aguada", BigDecimal.ZERO, BigDecimal.ZERO));
        assertNull(geografia.resolverPunto(null, "Estadio Jardines del Hipódromo"));
        assertNull(geografia.resolverPunto(99999, "Palacio Legislativo"));
    }

    @Test
    void respetaPoligonosHuecosBordesYMultipoligonos() throws Exception {
        var poligono = mapper.readTree("""
            {"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]]}
            """);
        assertTrue(GeografiaService.contiene(poligono, 1, 1));
        assertTrue(GeografiaService.contiene(poligono, 0, 5));
        assertFalse(GeografiaService.contiene(poligono, 5, 5));
        assertFalse(GeografiaService.contiene(poligono, 11, 5));
        var multiple = mapper.readTree("""
            {"type":"MultiPolygon","coordinates":[[[[0,0],[2,0],[2,2],[0,2],[0,0]]],[[[5,5],[8,5],[8,8],[5,8],[5,5]]]]}
            """);
        assertTrue(GeografiaService.contiene(multiple, 6, 6));
        assertFalse(GeografiaService.contiene(multiple, 4, 4));
        assertFalse(GeografiaService.contiene(mapper.readTree("{\"type\":\"Polygon\",\"coordinates\":[]}"), 0, 0));
    }

    @Test
    void zonaConBarrioSinGeometriaNoPuedeValidarse() throws Exception {
        var incompleta = new GeografiaService(mapper.readTree("{}"), mapper.readTree("""
            {"features":[{"properties":{"BARRIO":"A"},"geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}},
                         {"properties":{"BARRIO":"B"},"geometry":null}]}
            """), mapper.readTree("{\"ZONA PRUEBA\":[\"A\",\"B\"]}"));
        assertFalse(incompleta.tieneGeometria("zona", "ZONA PRUEBA"));
        assertFalse(incompleta.zonaIncluyeBarrio("ZONA PRUEBA", "A"));
        assertFalse(incompleta.tieneGeometria("barrio", "B"));
    }
}
