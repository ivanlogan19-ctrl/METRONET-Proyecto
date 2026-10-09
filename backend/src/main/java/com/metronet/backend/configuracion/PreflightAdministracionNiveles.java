package com.metronet.backend.configuracion;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

/** Verifica 018 y el catálogo empaquetado antes de cualquier inicializador. */
@Configuration
@Profile("!test")
public class PreflightAdministracionNiveles {
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE + 1)
    CommandLineRunner verificarAdministracionNiveles(JdbcTemplate jdbc, ObjectMapper mapper) {
        return argumentos -> {
            for (String tabla : new String[] {"nivel_publicacion", "nivel_publicacion_tarjeta", "nivel_borrador"}) {
                if (jdbc.queryForObject("SELECT to_regclass(?)::text", String.class, tabla) == null) {
                    throw new IllegalStateException("Falta aplicar 018_administracion_niveles.sql antes de iniciar METRONET");
                }
            }
            // La limpieza autorizada puede retirar V1 si ninguna partida la utiliza.
            // El arranque verifica las diez publicaciones vigentes y sus borradores.
            Integer publicaciones = jdbc.queryForObject("""
                SELECT COUNT(DISTINCT e.numero) FROM escenario e
                JOIN nivel_borrador b ON b.id_escenario=e.id_escenario
                WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 1 AND 10
                  AND EXISTS (SELECT 1 FROM nivel_publicacion p WHERE p.id_escenario=e.id_escenario)
                """, Integer.class);
            if (publicaciones == null || publicaciones != 10) {
                throw new IllegalStateException("Deben existir diez niveles publicados con sus borradores");
            }
            Integer nivelesActualesIncompletos = jdbc.queryForObject("""
                SELECT COUNT(*) FROM (
                  SELECT e.id_escenario,COUNT(t.id_tarjeta) AS cantidad
                  FROM escenario e
                  JOIN LATERAL (SELECT id_nivel_publicacion FROM nivel_publicacion
                    WHERE id_escenario=e.id_escenario ORDER BY numero_version DESC LIMIT 1) p ON TRUE
                  LEFT JOIN nivel_publicacion_tarjeta t ON t.id_nivel_publicacion=p.id_nivel_publicacion
                  WHERE e.progresivo=TRUE AND e.modo='NIVEL'
                  GROUP BY e.id_escenario
                ) niveles WHERE cantidad<>7
                """, Integer.class);
            if (nivelesActualesIncompletos == null || nivelesActualesIncompletos != 0) {
                throw new IllegalStateException("Falta aplicar 019_siete_tarjetas_niveles.sql antes de iniciar METRONET");
            }
            try (InputStream entrada = new ClassPathResource("educacion/catalogo-svgs-niveles.json").getInputStream()) {
                JsonNode catalogo = mapper.readTree(entrada);
                if (!catalogo.isArray() || catalogo.size() != 10) throw new IllegalStateException("Catálogo SVG incompleto");
                for (int numero = 1; numero <= 10; numero++) {
                    JsonNode nivel = catalogo.get(numero - 1);
                    if (nivel.path("numero").asInt() != numero || nivel.path("tarjetas").size() != 7)
                        throw new IllegalStateException("Catálogo SVG incompleto en nivel " + numero);
                }
            }
        };
    }
}
