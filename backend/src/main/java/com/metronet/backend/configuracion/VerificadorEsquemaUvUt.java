package com.metronet.backend.configuracion;

import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;

/** Detiene el arranque antes de los inicializadores que modifican datos. */
@Configuration
@Profile("!test")
public class VerificadorEsquemaUvUt {
    private static final List<String> TABLAS = List.of(
        "criterio_uv_ut", "intento_uv_ut", "resultado_uv_ut", "intento_catalogo_v1");

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    CommandLineRunner verificarEsquemaUvUt(JdbcTemplate jdbc) {
        return argumentos -> {
            for (String tabla : TABLAS) {
                String encontrada = jdbc.queryForObject("SELECT to_regclass(?)::text", String.class, tabla);
                if (encontrada == null) throw migracionPendiente();
            }
            Boolean disparador = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid=to_regclass('intento') AND tgname='congelar_catalogo_intento_v1'
                    AND NOT tgisinternal)
                """, Boolean.class);
            if (!Boolean.TRUE.equals(disparador)) throw migracionPendiente();
        };
    }

    private IllegalStateException migracionPendiente() {
        return new IllegalStateException("Falta aplicar la migración 017_criterio_uv_ut_v2.sql antes de iniciar esta versión de METRONET. El arranque se detuvo antes de actualizar el catálogo o las contraseñas.");
    }
}
