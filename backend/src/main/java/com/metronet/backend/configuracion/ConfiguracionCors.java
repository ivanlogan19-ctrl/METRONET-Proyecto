package com.metronet.backend.configuracion;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.core.Ordered;
import java.util.List;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ConfiguracionCors implements WebMvcConfigurer {
    private final String[] origenes;
    public ConfiguracionCors(@Value("${METRONET_CORS_ORIGENES:http://127.0.0.1:5173,http://localhost:5173}") String valor) {
        origenes = Arrays.stream(valor.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
        if (Arrays.stream(origenes).anyMatch(s -> s.contains("*") || !s.matches("https?://[^/]+"))) {
            throw new IllegalArgumentException("METRONET_CORS_ORIGENES requiere orígenes HTTP(S) explícitos");
        }
    }
    @Override
    public void addCorsMappings(CorsRegistry registro) {
        for (String ruta : new String[]{"/auth/**", "/api/**"}) {
            registro.addMapping(ruta).allowedOrigins(origenes)
                .allowedMethods("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type").allowCredentials(false).maxAge(600);
        }
    }

    // CORS debe preceder al límite HTTP para que el frontend pueda leer también 413/429.
    @Bean
    public FilterRegistrationBean<CorsFilter> filtroCors() {
        CorsConfiguration configuracion = new CorsConfiguration();
        configuracion.setAllowedOrigins(List.of(origenes));
        configuracion.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        configuracion.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuracion.setAllowCredentials(false);
        configuracion.setMaxAge(600L);
        UrlBasedCorsConfigurationSource fuente = new UrlBasedCorsConfigurationSource();
        fuente.registerCorsConfiguration("/auth/**", configuracion);
        fuente.registerCorsConfiguration("/api/**", configuracion);
        FilterRegistrationBean<CorsFilter> filtro = new FilterRegistrationBean<>(new CorsFilter(fuente));
        filtro.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return filtro;
    }
}
