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
    @Test void excesoDescuentaDesdeLaPrimeraEjecucionAunqueHayaAvancesEnLosDiezNiveles() {
        var exceso = new ArrayList<>(condiciones(true, false));
        exceso.add(new CondicionConsignaResponse("maximoEstaciones", "Máximo 3 estaciones", 4, 3, false));
        for (int nivel = 1; nivel <= 10; nivel++) {
            var regla = PoliticaPuntuacion.leer(PoliticaPuntuacion.configuracionNivel(nivel));
            var primera = regla.evaluar(exceso, List.of(), 1);
            assertEquals(10, primera.descuento(), "Nivel " + nivel);
            assertEquals(10, primera.totalDescontado());
            assertEquals(List.of("4 estaciones; máximo 3"), primera.excesos());
        }
    }
    @Test void excesosYSinAvanceCompartenTopeYCorregirNoBorraLosDescuentos() {
        var exceso = List.of(new CondicionConsignaResponse("maximoEstaciones", "Máximo 3 estaciones", 4, 3, false));
        var historia = new ArrayList<PoliticaPuntuacion.Registro>();
        for (int i = 1; i <= 6; i++) {
            var registro = politica.evaluar(exceso, historia, i, List.of("8 UV asignadas; máximo 6", "4 UT; máximo 3"));
            assertEquals(i <= 4 ? 10 : 0, registro.descuento());
            assertEquals(Math.min(40, i * 10), registro.totalDescontado());
            assertEquals(3, registro.excesos().size());
            historia.add(registro);
        }
        var corregida = politica.evaluar(List.of(new CondicionConsignaResponse("maximoEstaciones", "Máximo 3", 3, 3, true)), historia, 7);
        assertEquals(0, corregida.descuento());
        assertEquals(40, corregida.totalDescontado());
        assertTrue(corregida.excesos().isEmpty());
    }
    @Test void superarMinimosOIgualarMaximosNoDescuenta() {
        var condiciones = List.of(new CondicionConsignaResponse("minimoEstaciones", "Al menos 2", 5, 2, true),
            new CondicionConsignaResponse("maximoEstaciones", "Máximo 5", 5, 5, true));
        var registro = politica.evaluar(condiciones, List.of(), 8);
        assertEquals(0, registro.descuento());
        assertTrue(registro.excesos().isEmpty());
    }
    @Test void versionAnteriorConservaPracticasYRegistroSinExcesos() throws Exception {
        var json = PoliticaPuntuacion.configuracionNivel(1).put("version", "puntuacion-progreso-v1");
        json.remove("descuentoPorExceso");
        json.put("practicasGratuitas", 1);
        var anterior = PoliticaPuntuacion.leer(json);
        assertEquals(0, anterior.descuentoPorExceso());
        var registro = anterior.evaluar(List.of(new CondicionConsignaResponse("maximoEstaciones", "Máximo 3", 4, 3, false)), List.of(), 1);
        assertEquals(0, registro.descuento());
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var viejo = mapper.valueToTree(registro);
        ((com.fasterxml.jackson.databind.node.ObjectNode) viejo).remove("excesos");
        assertEquals(registro, mapper.treeToValue(viejo, PoliticaPuntuacion.Registro.class));
    }
    @Test void limitesUvUtSeComparanConLaEjecucionGuardadaSinInventarEquivalencias() {
        var resultado = new CriterioUvUtService.Resultado(1, "red", "ejecucion", 3,
            new java.math.BigDecimal("6"), 4, new java.math.BigDecimal("8.50"), false, List.of(), null);
        assertEquals(List.of("4 UT; máximo 3", "8.5 UV asignadas; máximo 6"), CriterioUvUtService.excesos(resultado));
        var justo = new CriterioUvUtService.Resultado(1, "red", "ejecucion", 3,
            new java.math.BigDecimal("6"), 3, new java.math.BigDecimal("6"), true, List.of(), null);
        assertTrue(CriterioUvUtService.excesos(justo).isEmpty());
        assertTrue(CriterioUvUtService.excesos(null).isEmpty());
    }
    @Test void descuentosDiezHastaCuarentaConMotivosYUnSoloCobroPorEjecucion() {
        var historia = new ArrayList<PoliticaPuntuacion.Registro>();
        int[] esperados = {10, 20, 30, 40, 40, 40};
        for (int i = 0; i < esperados.length; i++) {
            var registro = politica.evaluar(condiciones(false, false), historia, i + 1);
            assertEquals(esperados[i], registro.totalDescontado());
            assertEquals(i < 4 ? 10 : 0, registro.descuento());
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
        assertEquals(30, recuperacion.totalDescontado());
        var completa = politica.evaluar(condiciones(true, true), List.of(uno, avance, retroceso, recuperacion), 5);
        assertEquals(0, completa.descuento());
    }
    @Test void ningunNivelEximeUnaPrimeraEjecucionSinAvances() {
        for (int nivel = 1; nivel <= 10; nivel++) {
            var regla = PoliticaPuntuacion.leer(PoliticaPuntuacion.configuracionNivel(nivel));
            assertEquals(0, regla.practicasGratuitas());
            assertEquals(10, regla.evaluar(condiciones(false,false), List.of(), 1).descuento());
            assertEquals(0, regla.evaluar(condiciones(true,false), List.of(), 1).descuento(),
                "Un avance real sin exceso sigue sin descontar");
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
