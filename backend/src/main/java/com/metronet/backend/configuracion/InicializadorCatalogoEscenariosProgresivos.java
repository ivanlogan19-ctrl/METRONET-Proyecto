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
    private static final String REGLAS_NIVEL_4_014 = """
        {"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereRedValida":true,"requiereSimulacion":true}
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
            JsonNode consignasAnteriores;
            try (var entrada = new ClassPathResource("educacion/niveles-consignas-anteriores.json").getInputStream()) {
                consignasAnteriores = new ObjectMapper().readTree(entrada);
            }
            for (JsonNode nivel : niveles) {
                if (tienePublicacionAdministrada(jdbcTemplate, nivel.path("numero").asInt())) continue;
                if (nivel.path("numero").asInt() == 4) actualizarSeedInicialNivel4(jdbcTemplate, nivel);
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
                if (nivel.path("numero").asInt() == 4) actualizarReglasNivel4(jdbcTemplate, nivel, anterioresUV);
                if (nivel.path("numero").asInt() == 3) actualizarReglasNivel3(jdbcTemplate, nivel, consignasAnteriores);
                // Completar exclusivamente el seed conocido, sin sustituir consignas personalizadas.
                var anteriores = nivel.path("reglasExito").deepCopy();
                ((com.fasterxml.jackson.databind.node.ObjectNode) anteriores).remove("puntuacion");
                jdbcTemplate.update("UPDATE escenario SET reglas_exito=CAST(? AS jsonb) WHERE progresivo=TRUE AND numero=? AND reglas_exito=CAST(? AS jsonb)",
                    nivel.path("reglasExito").toString(), nivel.path("numero").asInt(), anteriores.toString());
                actualizarInstruccionCatalogo(jdbcTemplate, nivel, consignasAnteriores);
            }
            insertarModoLibre(jdbcTemplate);
            // Activar el criterio nuevo solo en el catálogo canónico y solo para
            // intentos futuros. Una configuración administrativa existente prevalece.
            String[] presupuestos = {null, null, null, null, "2", "2.5", "3", "4", "5.5", "5.5", "6.5"};
            for (JsonNode nivel : niveles) {
                int numero = nivel.path("numero").asInt();
                if (numero < 4 || numero > 10) continue;
                if (tienePublicacionAdministrada(jdbcTemplate, numero)) continue;
                jdbcTemplate.update("""
                    INSERT INTO criterio_uv_ut(id_escenario,version,limite_ut,presupuesto_uv)
                    SELECT id_escenario,1,2,CAST(? AS numeric)
                    FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=?
                      AND objetivo=? AND instrucciones=? AND reglas_exito=CAST(? AS jsonb)
                      AND herramientas_habilitadas=CAST(? AS jsonb)
                      AND NOT EXISTS (SELECT 1 FROM criterio_uv_ut c WHERE c.id_escenario=escenario.id_escenario)
                    """, presupuestos[numero], numero, nivel.path("objetivo").asText(), nivel.path("instrucciones").asText(),
                    nivel.path("reglasExito").toString(), nivel.path("herramientasHabilitadas").toString());
            }
        };
    }

    private boolean tienePublicacionAdministrada(JdbcTemplate jdbc, int numero) {
        // Las pruebas históricas usan tablas TEMP; su id_escenario puede coincidir
        // con un ID permanente y no debe mezclarse con publicaciones de otra tabla.
        Boolean esquemaReal = jdbc.queryForObject("SELECT to_regclass('escenario')=to_regclass('public.escenario')", Boolean.class);
        if (!Boolean.TRUE.equals(esquemaReal)) return false;
        Boolean existeTabla = jdbc.queryForObject("SELECT to_regclass('public.nivel_publicacion') IS NOT NULL", Boolean.class);
        if (!Boolean.TRUE.equals(existeTabla)) return false;
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM public.nivel_publicacion p JOIN public.escenario e ON e.id_escenario=p.id_escenario
              WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?)
            """, Boolean.class, numero));
    }

    private void actualizarSeedInicialNivel4(JdbcTemplate jdbcTemplate, JsonNode nivel) {
        // 014 contiene la versión anterior a los objetivos geográficos. Los
        // intentos V1 ya quedaron congelados por 017 antes de esta actualización.
        jdbcTemplate.update("""
            UPDATE escenario SET objetivo=?, instrucciones=?, reglas_exito=CAST(? AS jsonb)
            WHERE progresivo=TRUE AND modo='NIVEL' AND numero=4 AND nombre=? AND dificultad=?
              AND objetivo=? AND instrucciones=? AND reglas_exito=CAST(? AS jsonb)
              AND herramientas_habilitadas=CAST(? AS jsonb)
            """, nivel.path("objetivo").asText(), nivel.path("instrucciones").asText(), nivel.path("reglasExito").toString(),
            nivel.path("nombre").asText(), nivel.path("dificultad").asText(),
            "Validá la red, asigná un metro y ejecutá una simulación.",
            "Completá una red válida y simulá la circulación de la unidad de metro.", REGLAS_NIVEL_4_014,
            nivel.path("herramientasHabilitadas").toString());
    }

    private void actualizarInstruccionCatalogo(JdbcTemplate jdbcTemplate, JsonNode nivel, JsonNode consignasAnteriores) {
        int numero = nivel.path("numero").asInt();
        for (JsonNode anterior : consignasAnteriores) {
            if (anterior.path("numero").asInt() != numero) continue;
            String texto = anterior.path("instrucciones").asText();
            // El texto «Validá y simulá» fue publicado solo para estos dos niveles.
            if (numero == 8 || numero == 10) actualizarInstruccionConocida(jdbcTemplate, nivel,
                anterior.path("objetivo").asText(), texto.replace("Guardá tu diseño y simulá", "Validá y simulá"));
            actualizarInstruccionConocida(jdbcTemplate, nivel, anterior.path("objetivo").asText(), texto);
            break;
        }
    }

    private void actualizarInstruccionConocida(JdbcTemplate jdbcTemplate, JsonNode nivel, String objetivoAnterior, String instruccionAnterior) {
        // Solo el catálogo conocido: no tocar consignas personalizadas, intentos ni resultados.
        jdbcTemplate.update("""
            UPDATE escenario SET objetivo=?, instrucciones=?
            WHERE progresivo=TRUE AND numero=? AND objetivo=? AND instrucciones=?
              AND reglas_exito=CAST(? AS jsonb) AND herramientas_habilitadas=CAST(? AS jsonb)
            """, nivel.path("objetivo").asText(), nivel.path("instrucciones").asText(), nivel.path("numero").asInt(),
            objetivoAnterior, instruccionAnterior, nivel.path("reglasExito").toString(), nivel.path("herramientasHabilitadas").toString());
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

    private void actualizarReglasNivel3(JdbcTemplate jdbcTemplate, JsonNode nivel, JsonNode consignasAnteriores) {
        for (JsonNode anterior : consignasAnteriores) {
            if (anterior.path("numero").asInt() != 3) continue;
            var reglasAnteriores = (com.fasterxml.jackson.databind.node.ObjectNode) nivel.path("reglasExito").deepCopy();
            reglasAnteriores.remove("requiereRedValida");
            actualizarReglasConocidasNivel3(jdbcTemplate, nivel, anterior, reglasAnteriores);
            reglasAnteriores.remove("puntuacion");
            actualizarReglasConocidasNivel3(jdbcTemplate, nivel, anterior, reglasAnteriores);
            break;
        }
    }

    private void actualizarReglasConocidasNivel3(JdbcTemplate jdbcTemplate, JsonNode nivel, JsonNode anterior, JsonNode reglasAnteriores) {
        // Solo la versión canónica previa. Un objetivo, instrucciones o reglas personalizados quedan intactos.
        jdbcTemplate.update("""
            UPDATE escenario SET reglas_exito=CAST(? AS jsonb)
            WHERE progresivo=TRUE AND numero=3 AND objetivo=? AND instrucciones=?
              AND reglas_exito=CAST(? AS jsonb) AND herramientas_habilitadas=CAST(? AS jsonb)
            """, nivel.path("reglasExito").toString(), anterior.path("objetivo").asText(),
            anterior.path("instrucciones").asText(), reglasAnteriores.toString(), nivel.path("herramientasHabilitadas").toString());
    }

    private void actualizarReglasNivel4(JdbcTemplate jdbcTemplate, JsonNode nivel, JsonNode anterioresUV) {
        JsonNode anterior = null;
        for (JsonNode candidato : anterioresUV) if (candidato.path("numero").asInt() == 4) anterior = candidato;
        if (anterior == null) return;
        jdbcTemplate.update("""
            UPDATE escenario
            SET objetivo = ?,
                instrucciones = ?,
                reglas_exito = COALESCE(reglas_exito, '{}'::jsonb) || CAST(? AS jsonb)
            WHERE progresivo = TRUE AND numero = 4
              AND (reglas_exito = CAST(? AS jsonb) OR reglas_exito = CAST(? AS jsonb))
              AND herramientas_habilitadas = CAST(? AS jsonb)
              AND ((objetivo=? AND (instrucciones=? OR instrucciones=?))
                   OR (objetivo=? AND instrucciones=?))
            """, nivel.path("objetivo").asText(), nivel.path("instrucciones").asText(), nivel.path("reglasExito").toString(), REGLAS_NIVEL_4_ANTERIORES,
            "{\"minimoEstaciones\":3,\"minimoLineas\":1,\"minimoTramos\":2,\"minimoMetros\":1,\"requiereRedValida\":true,\"requiereSimulacion\":true}",
            nivel.path("herramientasHabilitadas").toString(), anterior.path("objetivo").asText(), anterior.path("instrucciones").asText(),
            anterior.path("instruccionesLegadas").asText(anterior.path("instrucciones").asText()), nivel.path("objetivo").asText(), nivel.path("instrucciones").asText());
    }
}
