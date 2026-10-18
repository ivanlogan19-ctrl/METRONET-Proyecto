package com.metronet.backend.configuracion;

import com.metronet.backend.service.CatalogoEscenariosService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!test")
public class InicializadorCatalogoEscenariosProgresivos {
    @Bean
    CommandLineRunner inicializarCatalogoEscenariosProgresivos(CatalogoEscenariosService catalogo) {
        return argumentos -> catalogo.inicializar();
    }
}
