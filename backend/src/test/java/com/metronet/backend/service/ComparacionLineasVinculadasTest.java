package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import java.util.*;
import org.junit.jupiter.api.Test;

class ComparacionLineasVinculadasTest {
    private RegistroSimulacionDidactica registro(double uvA, double uvB, String refA, String refB) {
        return new RegistroSimulacionDidactica("misma-red", List.of(
            new MedicionUnidad(1,"A",uvA,2,12/uvA), new MedicionUnidad(2,"A",uvA,2,12/uvA),
            new MedicionUnidad(3,"B",uvB,1,6/uvB)), null, RegistroSimulacionDidactica.ESCALA_VINCULADA,
            Map.of("A",refA,"B",refB));
    }
    @Test void unaLineaConVariosMetrosCuentaUnaDecisionYNoUnaDuracionElegida() {
        var cambios=ComparacionLineasVinculadas.evaluar(registro(4,4,"UV","UV"),registro(8,4,"UV","UV"));
        assertEquals(Set.of("velocidad","individual","combinacion"),cambios);
    }
    @Test void elegirTiempoNoSeConfundeConElegirLaVelocidadDerivada() {
        var cambios=ComparacionLineasVinculadas.evaluar(registro(4,4,"UV","UV"),registro(8,4,"UT","UV"));
        assertEquals(Set.of("duracion","combinacion"),cambios);
    }
    @Test void mismaVelocidadEnTodasLasLineasAdmiteTiemposDistintos() {
        assertEquals(Set.of("velocidad","global","combinacion"),ComparacionLineasVinculadas.evaluar(
            registro(4,4,"UV","UV"),registro(8,8,"UV","UV")));
    }
    @Test void guardarSinCambiosNoAcreditaAprendizajeNiReinterpretaHistoricos() {
        var actual=registro(4,4,"UV","UV");
        assertTrue(ComparacionLineasVinculadas.evaluar(actual,registro(4,4,"UT","UT")).isEmpty());
        var antigua=new RegistroSimulacionDidactica(actual.estructura(),actual.unidades(),null,RegistroSimulacionDidactica.ESCALA_FISICA);
        assertTrue(ComparacionLineasVinculadas.evaluar(antigua,registro(8,8,"UV","UV")).isEmpty());
    }
    @Test void referenciasSobrevivenLaPersistenciaDeLaInstantanea() {
        var original=registro(4,6,"UV","UT");
        assertEquals(original,RegistroSimulacionDidactica.leer(original.codificar()));
    }
}
