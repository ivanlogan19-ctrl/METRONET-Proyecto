package com.metronet.backend.service;

import com.metronet.backend.dto.CondicionConsignaResponse;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PoliticaPuntuacionTest {
    private final PoliticaPuntuacion politica = PoliticaPuntuacion.leer(PoliticaPuntuacion.configuracionNivel(1));
    private List<CondicionConsignaResponse> condiciones(boolean red, boolean lugar) {
        return List.of(new CondicionConsignaResponse("red", "Conectar la red", red ? 1 : 0, 1, red),
            new CondicionConsignaResponse("poi", "Cubrir el lugar solicitado", lugar ? 1 : 0, 1, lugar));
    }
    @Test void descuentosDiezHastaCuarentaConMotivosYUnSoloCobroPorEjecucion() {
        var historia = new ArrayList<PoliticaPuntuacion.Registro>();
        int[] esperados = {0, 10, 20, 30, 40, 40};
        for (int i = 0; i < esperados.length; i++) {
            var registro = politica.evaluar(condiciones(false, false), historia, i + 1);
            assertEquals(esperados[i], registro.totalDescontado());
            assertEquals(i == 0 || i == 5 ? 0 : 10, registro.descuento());
            assertEquals(List.of("Conectar la red", "Cubrir el lugar solicitado"), registro.condicionesPendientes());
            historia.add(registro);
        }
        var completa = politica.evaluar(condiciones(true, true), historia, 7);
        assertEquals(0, completa.descuento());
        assertEquals(60, politica.puntosBase() - completa.totalDescontado());
    }
    @Test void avanzarEsGratisPeroPerderYRecuperarLoMismoNoBorraElHistorial() {
        var uno = politica.evaluar(condiciones(false, false), List.of(), 1);
        var avance = politica.evaluar(condiciones(true, false), List.of(uno), 2);
        assertEquals(0, avance.descuento());
        var retroceso = politica.evaluar(condiciones(false, false), List.of(uno, avance), 3);
        var recuperacion = politica.evaluar(condiciones(true, false), List.of(uno, avance, retroceso), 4);
        assertEquals(10, recuperacion.descuento());
        assertEquals(20, recuperacion.totalDescontado());
        var completa = politica.evaluar(condiciones(true, true), List.of(uno, avance, retroceso, recuperacion), 5);
        assertEquals(0, completa.descuento());
    }
    @Test void cadaNivelTieneSuCantidadDePracticasAntesDeDescontar() {
        int[] gratuitas = {1,2,2,3,1,1,1,2,2,4};
        for (int nivel = 1; nivel <= 10; nivel++) {
            var regla = PoliticaPuntuacion.leer(PoliticaPuntuacion.configuracionNivel(nivel));
            assertEquals(0, regla.evaluar(condiciones(false,false), List.of(), gratuitas[nivel-1]).descuento());
            assertEquals(10, regla.evaluar(condiciones(false,false), List.of(), gratuitas[nivel-1]+1).descuento());
        }
    }
    @Test void noAceptaConfiguracionesArbitrariasNiReinterpretaElFormatoHistorico() throws Exception {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        assertNull(PoliticaPuntuacion.leer(mapper.readTree("{\"maximo\":100}")));
        var alterada = PoliticaPuntuacion.configuracionNivel(1).put("puntosBase",200);
        assertThrows(IllegalArgumentException.class, () -> PoliticaPuntuacion.leer(alterada));
        assertThrows(IllegalArgumentException.class, () -> PoliticaPuntuacion.leer(alterada.put("version","desconocida")));
    }
    @Test void registroNuevoYAntiguoSeRecuperanSinExponerMetadatos() {
        var antigua = new RegistroSimulacionDidactica("huella", List.of());
        assertNull(RegistroSimulacionDidactica.leer(antigua.codificar()).puntuacion());
        var puntuacion = politica.evaluar(condiciones(false,false), List.of(), 2);
        var nueva = new RegistroSimulacionDidactica("huella",List.of(),puntuacion);
        String comentario = "Ejecución aceptada." + nueva.codificar() + " [METRONET-RED-v1:huella]";
        assertEquals(nueva, RegistroSimulacionDidactica.leer(comentario));
        assertEquals("Ejecución aceptada.", PuntuacionService.comentarioVisible(comentario));
        assertNull(RegistroSimulacionDidactica.leer(" [METRONET-UV-H-v2:roto]"));
    }
}
