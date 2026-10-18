package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.repository.CatalogoEscenariosRepository;
import org.springframework.core.io.ClassPathResource;

@org.springframework.stereotype.Service
public class CatalogoEscenariosService {
    private final CatalogoEscenariosRepository repositorio;

    public CatalogoEscenariosService(CatalogoEscenariosRepository repositorio) {
        this.repositorio = repositorio;
    }

    private static final String REGLAS_NIVEL_4_ANTERIORES = """
        {"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereRedValida":true,"requiereSimulacion":true,"requiereCoberturaPuntosInteres":true,"puntosInteresObjetivo":[{"idPunto":1,"nombrePunto":"Palacio Legislativo","posicionX":596,"posicionY":493,"radioCobertura":60},{"idPunto":26,"nombrePunto":"Rambla de Carrasco","posicionX":864,"posicionY":503,"radioCobertura":60}]}
        """;
    private static final String REGLAS_NIVEL_4_014 = """
        {"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereRedValida":true,"requiereSimulacion":true}
        """;

    public void inicializar() throws Exception {
        JsonNode niveles;
        try (var entrada = new ClassPathResource("educacion/niveles.json").getInputStream()) {
            niveles = new ObjectMapper().readTree(entrada);
        }
        JsonNode anterioresUV;
        try (var entrada = new ClassPathResource("educacion/niveles-pre-uv.json").getInputStream()) {
            anterioresUV = new ObjectMapper().readTree(entrada);
        }
        JsonNode consignasAnteriores;
        try (var entrada = new ClassPathResource("educacion/niveles-consignas-anteriores.json").getInputStream()) {
            consignasAnteriores = new ObjectMapper().readTree(entrada);
        }
        for (JsonNode nivel : niveles) {
            if (tienePublicacionAdministrada(nivel.path("numero").asInt())) continue;
            if (nivel.path("numero").asInt() == 4) actualizarSeedInicialNivel4(nivel);
            for (JsonNode anterior : anterioresUV) {
                if (anterior.path("numero").asInt() != nivel.path("numero").asInt()) continue;
                // Solo el seed exacto anterior: conserva escenarios personalizados e históricos.
                repositorio.actualizarCatalogoAnterior(
                    nivel.path("objetivo").asText(),
                    nivel.path("instrucciones").asText(),
                    nivel.path("reglasExito").toString(),
                    nivel.path("numero").asInt(),
                    anterior.path("objetivo").asText(),
                    anterior.path("instrucciones").asText(),
                    anterior.path("instruccionesLegadas").asText(anterior.path("instrucciones").asText()),
                    anterior.path("reglasExito").toString(),
                    anterior.path("herramientasHabilitadas").toString()
                );
            }
            insertarNivel(nivel.path("numero").asInt(), nivel.path("nombre").asText(),
                nivel.path("objetivo").asText(), nivel.path("dificultad").asText(),
                nivel.path("instrucciones").asText(), nivel.path("reglasExito").toString(),
                nivel.path("herramientasHabilitadas").toString());
            if (nivel.path("numero").asInt() == 4) actualizarReglasNivel4(nivel, anterioresUV);
            if (nivel.path("numero").asInt() == 3) actualizarReglasNivel3(nivel, consignasAnteriores);
            // Completar exclusivamente el seed conocido, sin sustituir consignas personalizadas.
            var anteriores = nivel.path("reglasExito").deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode) anteriores).remove("puntuacion");
            repositorio.completarPuntuacion(nivel.path("reglasExito").toString(), nivel.path("numero").asInt(), anteriores.toString());
            actualizarInstruccionCatalogo(nivel, consignasAnteriores);
        }
        insertarModoLibre();
        // Activar el criterio nuevo solo en el catálogo canónico y solo para
        // intentos futuros. Una configuración administrativa existente prevalece.
        String[] presupuestos = {null, null, null, null, "2", "2.5", "3", "4", "5.5", "5.5", "6.5"};
        for (JsonNode nivel : niveles) {
            int numero = nivel.path("numero").asInt();
            if (numero < 4 || numero > 10) continue;
            if (tienePublicacionAdministrada(numero)) continue;
            repositorio.crearCriterio(
                presupuestos[numero],
                numero,
                nivel.path("objetivo").asText(),
                nivel.path("instrucciones").asText(),
                nivel.path("reglasExito").toString(),
                nivel.path("herramientasHabilitadas").toString()
            );
        }
    }

    private boolean tienePublicacionAdministrada(int numero) {
        // Las pruebas históricas usan tablas TEMP; su id_escenario puede coincidir
        // con un ID permanente y no debe mezclarse con publicaciones de otra tabla.
        Boolean esquemaReal = repositorio.esEsquemaPublico();
        if (!Boolean.TRUE.equals(esquemaReal)) return false;
        Boolean existeTabla = repositorio.existePublicacion();
        if (!Boolean.TRUE.equals(existeTabla)) return false;
        return Boolean.TRUE.equals(repositorio.tienePublicacionAdministrada(numero));
    }

    private void actualizarSeedInicialNivel4(JsonNode nivel) {
        // 014 contiene la versión anterior a los objetivos geográficos. Los
        // intentos V1 ya quedaron congelados por 017 antes de esta actualización.
        repositorio.actualizarSeedInicialNivel4(
            nivel.path("objetivo").asText(),
            nivel.path("instrucciones").asText(),
            nivel.path("reglasExito").toString(),
            nivel.path("nombre").asText(),
            nivel.path("dificultad").asText(),
            "Validá la red, asigná un metro y ejecutá una simulación.",
            "Completá una red válida y simulá la circulación de la unidad de metro.",
            REGLAS_NIVEL_4_014,
            nivel.path("herramientasHabilitadas").toString()
        );
    }

    private void actualizarInstruccionCatalogo(JsonNode nivel, JsonNode consignasAnteriores) {
        int numero = nivel.path("numero").asInt();
        for (JsonNode anterior : consignasAnteriores) {
            if (anterior.path("numero").asInt() != numero) continue;
            String texto = anterior.path("instrucciones").asText();
            // El texto «Validá y simulá» fue publicado solo para estos dos niveles.
            if (numero == 8 || numero == 10) actualizarInstruccionConocida(nivel,
                anterior.path("objetivo").asText(), texto.replace("Guardá tu diseño y simulá", "Validá y simulá"));
            actualizarInstruccionConocida(nivel, anterior.path("objetivo").asText(), texto);
            break;
        }
    }

    private void actualizarInstruccionConocida(JsonNode nivel, String objetivoAnterior, String instruccionAnterior) {
        // Solo el catálogo conocido: no tocar consignas personalizadas, intentos ni resultados.
        repositorio.actualizarInstruccionConocida(
            nivel.path("objetivo").asText(),
            nivel.path("instrucciones").asText(),
            nivel.path("numero").asInt(),
            objetivoAnterior,
            instruccionAnterior,
            nivel.path("reglasExito").toString(),
            nivel.path("herramientasHabilitadas").toString()
        );
    }

    private void insertarNivel(int numero, String nombre, String objetivo, String dificultad,
                               String instrucciones, String reglasExito, String herramientasHabilitadas) {
        repositorio.insertarNivel(nombre, objetivo, numero, dificultad, instrucciones, reglasExito, herramientasHabilitadas, numero);
    }

    private void insertarModoLibre() {
        repositorio.insertarModoLibre();
    }

    private void actualizarReglasNivel3(JsonNode nivel, JsonNode consignasAnteriores) {
        for (JsonNode anterior : consignasAnteriores) {
            if (anterior.path("numero").asInt() != 3) continue;
            var reglasAnteriores = (com.fasterxml.jackson.databind.node.ObjectNode) nivel.path("reglasExito").deepCopy();
            reglasAnteriores.remove("requiereRedValida");
            actualizarReglasConocidasNivel3(nivel, anterior, reglasAnteriores);
            reglasAnteriores.remove("puntuacion");
            actualizarReglasConocidasNivel3(nivel, anterior, reglasAnteriores);
            break;
        }
    }

    private void actualizarReglasConocidasNivel3(JsonNode nivel, JsonNode anterior, JsonNode reglasAnteriores) {
        // Solo la versión canónica previa. Un objetivo, instrucciones o reglas personalizados quedan intactos.
        repositorio.actualizarReglasConocidasNivel3(
            nivel.path("reglasExito").toString(),
            anterior.path("objetivo").asText(),
            anterior.path("instrucciones").asText(),
            reglasAnteriores.toString(),
            nivel.path("herramientasHabilitadas").toString()
        );
    }

    private void actualizarReglasNivel4(JsonNode nivel, JsonNode anterioresUV) {
        JsonNode anterior = null;
        for (JsonNode candidato : anterioresUV) if (candidato.path("numero").asInt() == 4) anterior = candidato;
        if (anterior == null) return;
        repositorio.actualizarReglasNivel4(
            nivel.path("objetivo").asText(),
            nivel.path("instrucciones").asText(),
            nivel.path("reglasExito").toString(),
            REGLAS_NIVEL_4_ANTERIORES,
            "{\"minimoEstaciones\":3,\"minimoLineas\":1,\"minimoTramos\":2,\"minimoMetros\":1,\"requiereRedValida\":true,\"requiereSimulacion\":true}",
            nivel.path("herramientasHabilitadas").toString(),
            anterior.path("objetivo").asText(),
            anterior.path("instrucciones").asText(),
            anterior.path("instruccionesLegadas").asText(anterior.path("instrucciones").asText()),
            nivel.path("objetivo").asText(),
            nivel.path("instrucciones").asText()
        );
    }
}
