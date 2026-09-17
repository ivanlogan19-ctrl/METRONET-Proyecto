package com.metronet.backend.configuracion;

import com.metronet.backend.service.DatosDemostrativosService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;

@Configuration
@ConditionalOnProperty(
    prefix = "metronet.datos-demostrativos",
    name = "habilitados",
    havingValue = "true"
)
public class InicializadorDatosDemostrativos {
    private final DatosDemostrativosService datosDemostrativosService;
    private final String contrasenaJugador;
    private final String contrasenaAdministrador;

    public InicializadorDatosDemostrativos(
        DatosDemostrativosService datosDemostrativosService,
        @Value("${metronet.datos-demostrativos.contrasena-jugador:}") String contrasenaJugador,
        @Value("${metronet.datos-demostrativos.contrasena-administrador:}") String contrasenaAdministrador
    ) {
        this.datosDemostrativosService = datosDemostrativosService;
        this.contrasenaJugador = contrasenaJugador;
        this.contrasenaAdministrador = contrasenaAdministrador;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void inicializarDatosDemostrativos() {
        datosDemostrativosService.crearOActualizarDatosDemostrativos(
            contrasenaJugador,
            contrasenaAdministrador
        );
    }
}
