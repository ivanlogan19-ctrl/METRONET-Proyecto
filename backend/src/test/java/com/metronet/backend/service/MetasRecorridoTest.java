package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class MetasRecorridoTest {
    private final List<CondicionConsignaResponse> metas = List.of(
        new CondicionConsignaResponse("minimoLineas", "Dos líneas de tres estaciones", 2, 2, true),
        new CondicionConsignaResponse("minimoTramos", "Unir las líneas", 4, 4, true),
        new CondicionConsignaResponse("minimoMetros", "Uno por línea", 2, 2, true));
    private final Map<String, Object> configuracion = Map.of("estacionesPorLinea", List.of(3, 3), "redConectada", true, "metroPorLinea", true);

    @Test void conexionesExigenTodasLasLineasEnUnaMismaRed() {
        assertTrue(MetasRecorrido.lineasConectadas(List.of(List.of("Azul", "Verde"), List.of("Verde", "Roja")), 3));
        assertFalse(MetasRecorrido.lineasConectadas(List.of(List.of("Azul", "Verde"), List.of("Azul", "Verde")), 3));
        assertFalse(MetasRecorrido.lineasConectadas(List.of(List.of("Azul", "Verde"), List.of("Roja", "Amarilla")), 4));
    }

    @Test void noAlcanzaConLasCantidadesTotales() {
        var enlaces = List.of(enlace("Azul", "A", "B"), enlace("Azul", "B", "C"),
            enlace("Azul", "C", "D"), enlace("Verde", "D", "E"));
        var resultado = MetasRecorrido.evaluar(configuracion, metas, enlaces, 2, 1);
        assertFalse(resultado.get(0).completado(), "Cuatro y dos no cumple tres y tres");
        assertTrue(resultado.get(1).completado());
        assertFalse(resultado.get(2).completado(), "Dos metros en una línea no atienden ambas");
    }

    @Test void unaLineaAdicionalNoQuitaLaMetaCumplidaEnNingunoDeLosDiezNiveles() throws Exception {
        var mapper = new ObjectMapper();
        try (var entrada = new ClassPathResource("educacion/recorrido-integral.json").getInputStream()) {
            for (var nivel : mapper.readTree(entrada)) {
                var reglas = nivel.path("reglasExito");
                Map<?, ?> configuracionNivel = mapper.convertValue(reglas.path("configuracionRecorrido"), Map.class);
                var enlaces = new ArrayList<MetasRecorrido.Enlace>();
                int indice = 0;
                for (var cantidad : reglas.path("configuracionRecorrido").path("estacionesPorLinea")) {
                    for (int estacion = 1; estacion < cantidad.asInt(); estacion++)
                        enlaces.add(enlace("L" + indice, indice + ":" + (estacion - 1), indice + ":" + estacion));
                    indice++;
                }
                enlaces.add(enlace("Extra", "X", "Y"));
                enlaces.add(enlace("Extra", "Y", "Z"));
                var meta = new CondicionConsignaResponse("minimoLineas", "Líneas solicitadas", indice + 1, indice, true);
                assertTrue(MetasRecorrido.evaluar(configuracionNivel, List.of(meta), enlaces, indice + 1, indice + 1).getFirst().completado(),
                    "Nivel " + nivel.path("numero").asInt() + ": la línea adicional no invalida las requeridas");
                var metaMetro = new CondicionConsignaResponse("minimoMetros", "Metros solicitados", indice, indice, true);
                assertTrue(MetasRecorrido.evaluar(configuracionNivel, List.of(metaMetro), enlaces, indice + 1, indice).getFirst().completado(),
                    "N" + nivel.path("numero").asInt() + ": una línea extra sin metro no borra la meta cumplida");
                assertFalse(MetasRecorrido.evaluar(configuracionNivel, List.of(metaMetro), enlaces, indice + 1, indice - 1).getFirst().completado(),
                    "Eliminar un metro requerido sí quita su cumplimiento");
                enlaces.removeIf(e -> e.linea().equals("L0"));
                enlaces.removeIf(e -> e.linea().equals("Extra"));
                assertFalse(MetasRecorrido.evaluar(configuracionNivel, List.of(meta), enlaces, indice, indice).getFirst().completado(),
                    "No reutilizar una misma línea para cumplir dos líneas solicitadas");
            }
        }
    }

    @Test void exigeUnaRedUnidaSinAgregarOtraMeta() {
        var separadas = List.of(enlace("Azul", "A", "B"), enlace("Azul", "B", "C"),
            enlace("Verde", "D", "E"), enlace("Verde", "E", "F"));
        assertFalse(MetasRecorrido.evaluar(configuracion, metas, separadas, 2, 2).get(1).completado());
        var unidas = List.of(enlace("Azul", "A", "B"), enlace("Azul", "B", "C"),
            enlace("Verde", "C", "D"), enlace("Verde", "D", "E"));
        var resultado = MetasRecorrido.evaluar(configuracion, metas, unidas, 2, 2);
        assertEquals(metas.size(), resultado.size());
        assertTrue(resultado.stream().allMatch(CondicionConsignaResponse::completado));
    }

    @Test void aceptaUnaSolaSimulacionConElControlYLaDireccionSolicitados() {
        assertTrue(MetasRecorrido.practica("inicial", registro(1, "UV")));
        assertFalse(MetasRecorrido.practica("aumentarUV", registro(1, "UV")));
        assertTrue(MetasRecorrido.practica("aumentarUV", registro(2, "UV")));
        assertFalse(MetasRecorrido.practica("aumentarUV", registro(2, "UT")));
        assertTrue(MetasRecorrido.practica("aumentarUT", registro(0.5, "UT")));
        assertFalse(MetasRecorrido.practica("aumentarUT", registro(2, "UT")));
        assertTrue(MetasRecorrido.practica("reducirUT", registro(2, "UT")));
        assertTrue(MetasRecorrido.practica("reducirUV", registro(0.5, "UV")));
        assertTrue(MetasRecorrido.practica("cambiar", registro(2, "UV")));
        assertTrue(MetasRecorrido.practica("cambiar", registro(0.5, "UT")));
        assertFalse(MetasRecorrido.practica("cambiar", registro(1, "UT")));
        assertFalse(MetasRecorrido.practica("cambiar", null));
        assertTrue(MetasRecorrido.practica("", null), "Los históricos conservan sus reglas");
    }

    @Test void rechazaConfiguracionesAmbiguasAntesDePublicar() throws Exception {
        var reglas = new ObjectMapper().readTree("""
            {"minimoLineas":2,"requiereSimulacion":true,"configuracionRecorrido":
              {"estacionesPorLinea":[3,3],"redConectada":true,"metroPorLinea":true,"practica":"aumentarUV"}}
            """);
        assertDoesNotThrow(() -> MetasRecorrido.validar(reglas));
        ((com.fasterxml.jackson.databind.node.ObjectNode) reglas.path("configuracionRecorrido")).put("practica", "comparar");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> MetasRecorrido.validar(reglas));
    }

    @Test void extrasDescuentanSinBorrarMetasEnLosDiezNiveles() throws Exception {
        var mapper = new ObjectMapper();
        try (var entrada = new ClassPathResource("educacion/recorrido-integral.json").getInputStream()) {
            for (var nivel : mapper.readTree(entrada)) {
                var reglas = mapper.convertValue(nivel.path("reglasExito"), Map.class);
                int numero = nivel.path("numero").asInt();
                int exigidas = nivel.path("reglasExito").path("minimoEstaciones").asInt();
                var meta = new CondicionConsignaResponse("minimoEstaciones", "Estaciones", exigidas + 1, exigidas, true);
                var exceso = MetasRecorrido.excesos(reglas, List.of(meta));
                var registro = PoliticaPuntuacion.leer(PoliticaPuntuacion.configuracionNivel(numero))
                    .evaluar(List.of(meta), List.of(), 1, exceso);
                assertEquals(10, registro.descuento(), "Nivel " + numero);
                assertTrue(registro.condicionesPendientes().isEmpty());
                assertEquals(List.of("minimoEstaciones"), registro.condicionesCumplidas());
                int metros = nivel.path("reglasExito").path("minimoMetros").asInt();
                int conexiones = nivel.path("reglasExito").path("minimoConexionesLineas").asInt();
                assertTrue(MetasRecorrido.excesos(reglas, List.of(new CondicionConsignaResponse(
                    "minimoMetros", "Metros", metros + conexiones, metros, true))).isEmpty(), "El metro obligatorio de conexión no es un extra");
            }
        }
        assertTrue(MetasRecorrido.excesos(Map.of(), metas).isEmpty(), "Sin nueva regla no cambia el histórico");
    }

    @Test void extenderUnaLineaCumplidaConservaSuEstrella() {
        var configuracion = Map.of("estacionesPorLinea", List.of(2), "redConectada", false, "metroPorLinea", true);
        var meta = new CondicionConsignaResponse("minimoLineas", "Una línea de dos estaciones", 1, 1, true);
        assertTrue(MetasRecorrido.evaluar(configuracion, List.of(meta),
            List.of(enlace("Azul", "A", "B"), enlace("Azul", "B", "C")), 1, 1).getFirst().completado());
    }

    private MetasRecorrido.Enlace enlace(String linea, String a, String b) { return new MetasRecorrido.Enlace(linea, a, b); }
    private RegistroSimulacionDidactica registro(double uv, String referencia) {
        return new RegistroSimulacionDidactica("red", List.of(new MedicionUnidad(1, "Azul", uv, 2, 10 / uv)),
            null, RegistroSimulacionDidactica.ESCALA_VINCULADA, Map.of("Azul", referencia));
    }
}
