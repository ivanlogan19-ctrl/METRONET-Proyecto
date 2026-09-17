package com.metronet.backend.configuracion;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ConfiguracionTiempo {
    @Bean
    public Clock relojSistema() {
        return Clock.systemUTC();
    }
}
