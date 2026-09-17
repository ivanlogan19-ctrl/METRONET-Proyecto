package com.metronet.backend.configuracion;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ConfiguracionMantenimientoWeb implements WebMvcConfigurer {
    private final ControlMantenimientoInterceptor controlMantenimientoInterceptor;

    public ConfiguracionMantenimientoWeb(ControlMantenimientoInterceptor controlMantenimientoInterceptor) {
        this.controlMantenimientoInterceptor = controlMantenimientoInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registro) {
        registro.addInterceptor(controlMantenimientoInterceptor)
            .addPathPatterns(
                "/api/simulaciones/**",
                "/api/juego/escenarios/*/iniciar",
                "/api/juego/escenarios/*/volver-a-jugar",
                "/api/juego/recorrido/reiniciar",
                "/api/juego/disenos/*/evaluar"
            );
    }
}
