package com.metronet.backend.configuracion;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("!test")
public class InicializadorCatalogoEscenariosProgresivos {
    private static final String OBJETIVO_NIVEL_4 = "Conectá estaciones cercanas a Palacio Legislativo y Rambla de Carrasco, validá la red y ejecutá una simulación.";
    private static final String INSTRUCCIONES_NIVEL_4 = "Ubicá una estación dentro del radio de cada punto de interés objetivo, completá una red válida, asigná un metro y simulá su recorrido.";
    private static final String REGLAS_NIVEL_4 = """
        {"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereRedValida":true,"requiereSimulacion":true,"requiereCoberturaPuntosInteres":true,"puntosInteresObjetivo":[{"idPunto":1,"nombrePunto":"Palacio Legislativo","posicionX":596,"posicionY":493,"radioCobertura":60},{"idPunto":26,"nombrePunto":"Rambla de Carrasco","posicionX":864,"posicionY":503,"radioCobertura":60}]}
        """;

    @Bean
    CommandLineRunner inicializarCatalogoEscenariosProgresivos(JdbcTemplate jdbcTemplate) {
        return argumentos -> {
            insertarNivel(jdbcTemplate, 1, "Nivel 1 · Red inicial", "Creá una línea con al menos dos estaciones sobre el mapa.", "Inicial",
                "Ubicá dos estaciones y unilas mediante una línea de metro.",
                "{\"minimoEstaciones\":2,\"minimoLineas\":1}",
                "{\"estaciones\":true,\"lineas\":true,\"conexiones\":false,\"metros\":false,\"simulacion\":false}");
            insertarNivel(jdbcTemplate, 2, "Nivel 2 · Conexiones", "Construí un recorrido con tres estaciones y dos conexiones.", "Inicial",
                "Agregá estaciones y conexiones para completar el recorrido de una línea.",
                "{\"minimoEstaciones\":3,\"minimoLineas\":1,\"minimoTramos\":2}",
                "{\"estaciones\":true,\"lineas\":true,\"conexiones\":true,\"metros\":false,\"simulacion\":false}");
            insertarNivel(jdbcTemplate, 3, "Nivel 3 · Unidades de metro", "Asigná una unidad de metro a una red con recorrido válido.", "Intermedio",
                "Construí una red conectada y agregá una unidad de metro a una de sus líneas.",
                "{\"minimoEstaciones\":3,\"minimoLineas\":1,\"minimoTramos\":2,\"minimoMetros\":1}",
                "{\"estaciones\":true,\"lineas\":true,\"conexiones\":true,\"metros\":true,\"simulacion\":false}");
            insertarNivel(jdbcTemplate, 4, "Nivel 4 · Simulación completa", OBJETIVO_NIVEL_4, "Avanzado",
                INSTRUCCIONES_NIVEL_4,
                REGLAS_NIVEL_4,
                "{\"estaciones\":true,\"lineas\":true,\"conexiones\":true,\"metros\":true,\"simulacion\":true}");
            actualizarReglasNivel4(jdbcTemplate);
            insertarModoLibre(jdbcTemplate);
        };
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

    private void actualizarReglasNivel4(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.update("""
            UPDATE escenario
            SET objetivo = ?,
                instrucciones = ?,
                reglas_exito = COALESCE(reglas_exito, '{}'::jsonb) || CAST(? AS jsonb)
            WHERE progresivo = TRUE AND numero = 4
            """, OBJETIVO_NIVEL_4, INSTRUCCIONES_NIVEL_4, REGLAS_NIVEL_4);
    }
}
