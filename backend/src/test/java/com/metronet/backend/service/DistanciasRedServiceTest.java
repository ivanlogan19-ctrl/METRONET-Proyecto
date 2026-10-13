package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.utilidades.GeometriaTerritorial.Punto;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import java.util.List;
import org.junit.jupiter.api.Test;

class DistanciasRedServiceTest {
    @Test void distanciaGeodesicaSimetricaConUnidadesKm() {
        assertEquals(111.19508, DistanciasRedService.kilometros(new Punto(0,0),new Punto(0,1)), .0001);
        var a = new Punto(-56.2,-34.9); var b = new Punto(-56.1,-34.8);
        assertEquals(0,DistanciasRedService.kilometros(a,a));
        assertEquals(DistanciasRedService.kilometros(a,b),DistanciasRedService.kilometros(b,a),1e-9);
    }

    @Test void preservaHistorialLogicoYDistingueInstantaneaFisica() {
        var antigua = new RegistroSimulacionDidactica("red",List.of(new MedicionUnidad(1,"L",4,2)));
        var historica = RegistroSimulacionDidactica.leer("Texto" + antigua.codificar());
        assertNotNull(historica);
        assertFalse(historica.esFisica());
        assertNull(historica.unidades().getFirst().distanciaKm());
        var nueva = new RegistroSimulacionDidactica("red",List.of(new MedicionUnidad(1,"L",4,2,2,12d,8d,3d)),null,
            RegistroSimulacionDidactica.ESCALA_FISICA);
        assertEquals(nueva,RegistroSimulacionDidactica.leer("Texto"+nueva.codificar()));
        assertEquals("Texto",PuntuacionService.comentarioVisible("Texto"+nueva.codificar()));
        assertEquals(antigua.codificar(),historica.codificar(),"Leer no reescribe ni convierte históricos");
    }
}
