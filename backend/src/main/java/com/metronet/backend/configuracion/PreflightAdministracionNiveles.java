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
            Integer publicaciones = jdbc.queryForObject("SELECT COUNT(*) FROM nivel_publicacion WHERE numero_version=1", Integer.class);
            Integer tarjetas = jdbc.queryForObject("SELECT COUNT(*) FROM nivel_publicacion_tarjeta t JOIN nivel_publicacion p USING(id_nivel_publicacion) WHERE p.numero_version=1", Integer.class);
            if (publicaciones == null || publicaciones != 10 || tarjetas == null || tarjetas != 60) {
                throw new IllegalStateException("La migración 018 no contiene diez niveles y 60 tarjetas iniciales");
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
