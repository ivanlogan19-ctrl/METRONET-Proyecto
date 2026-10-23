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
            if (jdbc.queryForObject("SELECT to_regclass('conexion_lineas')::text", String.class) == null)
                throw new IllegalStateException("Falta aplicar 025_conexiones_entre_lineas.sql antes de iniciar METRONET");
            if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='metro' AND column_name='id_conexion')", Boolean.class)))
                throw new IllegalStateException("Falta aplicar 026_metros_en_conexiones.sql antes de iniciar METRONET");
            if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='conexion_lineas'::regclass AND conname='chk_conexion_estacion_compartida')", Boolean.class)))
                throw new IllegalStateException("Falta aplicar 027_estaciones_compartidas.sql antes de iniciar METRONET");
            if (jdbc.queryForObject("SELECT to_regclass('aprendizaje_extra_visita')::text", String.class) == null)
                throw new IllegalStateException("Falta aplicar 022_extras_modo_libre.sql antes de iniciar METRONET");
            if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='metro' AND column_name='referencia_uv_ut')", Boolean.class)))
                throw new IllegalStateException("Falta aplicar 023_vinculo_uv_ut_libre.sql antes de iniciar METRONET");
            Boolean columnaUt = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='metro' AND column_name='duracion_ut')", Boolean.class);
            if (!Boolean.TRUE.equals(columnaUt)) throw new IllegalStateException("Falta aplicar 021_duracion_por_metro.sql antes de iniciar METRONET");
            Boolean disparador = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid=to_regclass('intento') AND tgname='congelar_catalogo_intento_v1'
                    AND NOT tgisinternal)
                """, Boolean.class);
            if (!Boolean.TRUE.equals(disparador)) throw migracionPendiente();
            Boolean logrosSinDiseno = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema=current_schema() AND table_name='intento'
                    AND column_name='id_diseno' AND is_nullable='YES')
                  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('intento')
                    AND conname='chk_intento_sin_diseno_completado')
                """, Boolean.class);
            if (!Boolean.TRUE.equals(logrosSinDiseno))
                throw new IllegalStateException("Falta aplicar 024_conservar_logros_sin_diseno.sql antes de iniciar METRONET");
        };
    }

    private IllegalStateException migracionPendiente() {
        return new IllegalStateException("Falta aplicar la migración 017_criterio_uv_ut_v2.sql antes de iniciar esta versión de METRONET. El arranque se detuvo antes de actualizar el catálogo o las contraseñas.");
    }
}
