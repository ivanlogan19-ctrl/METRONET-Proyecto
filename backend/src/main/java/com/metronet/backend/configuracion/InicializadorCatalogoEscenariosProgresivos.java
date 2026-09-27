package com.metronet.backend.configuracion;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("!test")
public class InicializadorCatalogoEscenariosProgresivos {
    private static final String REGLAS_NIVEL_4_ANTERIORES = """
        {"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereRedValida":true,"requiereSimulacion":true,"requiereCoberturaPuntosInteres":true,"puntosInteresObjetivo":[{"idPunto":1,"nombrePunto":"Palacio Legislativo","posicionX":596,"posicionY":493,"radioCobertura":60},{"idPunto":26,"nombrePunto":"Rambla de Carrasco","posicionX":864,"posicionY":503,"radioCobertura":60}]}
        """;

    @Bean
    CommandLineRunner inicializarCatalogoEscenariosProgresivos(JdbcTemplate jdbcTemplate) {
        return argumentos -> {
            JsonNode niveles;
            try (var entrada = new ClassPathResource("educacion/niveles.json").getInputStream()) {
                niveles = new ObjectMapper().readTree(entrada);
            }
            JsonNode anterioresUV;
            try (var entrada = new ClassPathResource("educacion/niveles-pre-uv.json").getInputStream()) {
                anterioresUV = new ObjectMapper().readTree(entrada);
            }
            for (JsonNode nivel : niveles) {
                for (JsonNode anterior : anterioresUV) {
                    if (anterior.path("numero").asInt() != nivel.path("numero").asInt()) continue;
                    // Solo el seed exacto anterior: conserva escenarios personalizados e históricos.
                    jdbcTemplate.update("""
                        UPDATE escenario SET objetivo=?, instrucciones=?, reglas_exito=CAST(? AS jsonb)
                        WHERE progresivo=TRUE AND numero=? AND objetivo=? AND (instrucciones=? OR instrucciones=?)
                          AND reglas_exito=CAST(? AS jsonb) AND herramientas_habilitadas=CAST(? AS jsonb)
                        """, nivel.path("objetivo").asText(), nivel.path("instrucciones").asText(), nivel.path("reglasExito").toString(),
                        nivel.path("numero").asInt(), anterior.path("objetivo").asText(), anterior.path("instrucciones").asText(), anterior.path("instruccionesLegadas").asText(anterior.path("instrucciones").asText()),
                        anterior.path("reglasExito").toString(), anterior.path("herramientasHabilitadas").toString());
                }
                insertarNivel(jdbcTemplate, nivel.path("numero").asInt(), nivel.path("nombre").asText(),
                    nivel.path("objetivo").asText(), nivel.path("dificultad").asText(),
                    nivel.path("instrucciones").asText(), nivel.path("reglasExito").toString(),
                    nivel.path("herramientasHabilitadas").toString());
                if (nivel.path("numero").asInt() == 4) actualizarReglasNivel4(jdbcTemplate, nivel);
                // Completar exclusivamente el seed conocido, sin sustituir consignas personalizadas.
                var anteriores = nivel.path("reglasExito").deepCopy();
                ((com.fasterxml.jackson.databind.node.ObjectNode) anteriores).remove("puntuacion");
                jdbcTemplate.update("UPDATE escenario SET reglas_exito=CAST(? AS jsonb) WHERE progresivo=TRUE AND numero=? AND reglas_exito=CAST(? AS jsonb)",
                    nivel.path("reglasExito").toString(), nivel.path("numero").asInt(), anteriores.toString());
                actualizarInstruccionGuardado(jdbcTemplate, nivel);
            }
            insertarModoLibre(jdbcTemplate);
        };
    }

    private void actualizarInstruccionGuardado(JdbcTemplate jdbcTemplate, JsonNode nivel) {
        int numero = nivel.path("numero").asInt();
        if (numero != 8 && numero != 10) return;
        String actual = nivel.path("instrucciones").asText();
        String anterior = actual.replace("Guardá tu diseño y simulá", "Validá y simulá");
        // Corregir solo el texto original conocido. No sobrescribir escenarios
        // personalizados ni sus reglas, herramientas o resultados históricos.
        jdbcTemplate.update("""
            UPDATE escenario SET instrucciones=?
            WHERE progresivo=TRUE AND numero=? AND instrucciones=?
              AND reglas_exito=CAST(? AS jsonb) AND herramientas_habilitadas=CAST(? AS jsonb)
            """, actual, numero, anterior, nivel.path("reglasExito").toString(), nivel.path("herramientasHabilitadas").toString());
    }

    private void insertarNivel(JdbcTemplate jdbcTemplate, int numero, String nombre, String objetivo, String dificultad,
                               String instrucciones, String reglasExito, String herramientasHabilitadas) {
        jdbcTemplate.update("""
            INSERT INTO escenario (nombre, objetivo, numero, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
            SELECT ?, ?, ?, 'NIVEL', ?, ?, TRUE, CAST(? AS jsonb), CAST(? AS jsonb)
            WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND numero = ?)
            """, nombre, objetivo, numero, dificultad, instrucciones, reglasExito, herramientasHabilitadas, numero);
    }

    private void insertarModoLibre(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.update("""
            INSERT INTO escenario (nombre, objetivo, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
            SELECT 'Modo Libre', 'Diseñá, editá y simulá una red de metro sin consignas obligatorias.', 'EDICION_LIBRE', 'Libre',
                   'Todas las herramientas están disponibles.', TRUE, CAST('{}' AS jsonb),
                   CAST('{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":true}' AS jsonb)
            WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND modo = 'EDICION_LIBRE')
            """);
    }

    private void actualizarReglasNivel4(JdbcTemplate jdbcTemplate, JsonNode nivel) {
        jdbcTemplate.update("""
            UPDATE escenario
            SET objetivo = ?,
                instrucciones = ?,
                reglas_exito = COALESCE(reglas_exito, '{}'::jsonb) || CAST(? AS jsonb)
            WHERE progresivo = TRUE AND numero = 4
              AND (reglas_exito = CAST(? AS jsonb) OR reglas_exito = CAST(? AS jsonb))
            """, nivel.path("objetivo").asText(), nivel.path("instrucciones").asText(), nivel.path("reglasExito").toString(), REGLAS_NIVEL_4_ANTERIORES,
            "{\"minimoEstaciones\":3,\"minimoLineas\":1,\"minimoTramos\":2,\"minimoMetros\":1,\"requiereRedValida\":true,\"requiereSimulacion\":true}");
    }
}
