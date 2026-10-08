package com.metronet.backend.configuracion;

import com.metronet.backend.service.RecorridoIntegralService;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

/** Operación explícita de publicación. No se activa en un arranque normal. */
@Configuration
@ConditionalOnProperty(name="metronet.recorrido.publicar",havingValue="true")
public class PublicarRecorridoIntegral {
    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    ApplicationRunner ejecutarPublicacionRecorrido(RecorridoIntegralService servicio,
        @Value("${metronet.recorrido.administrador:0}") int administrador) {
        return argumentos -> {
            var publicaciones=servicio.publicar(administrador);
            LoggerFactory.getLogger(PublicarRecorridoIntegral.class).info(
                "Recorrido {}: {} niveles publicados mediante validación e historial existentes",
                RecorridoIntegralService.VERSION,publicaciones.size());
        };
    }
}
