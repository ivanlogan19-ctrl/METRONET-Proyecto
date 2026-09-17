package com.metronet.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.ConfiguracionResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ConfiguracionService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ConfiguracionConsultaControllerTest {
    @Mock
    private AuthService authService;

    @Mock
    private ConfiguracionService configuracionService;

    @Test
    void permiteConsultarConfiguracionesConUnaSesionDeJugador() {
        Usuario jugador = new Usuario();
        jugador.setRol(Rol.JUGADOR);
        List<ConfiguracionResponse> configuraciones = List.of(
            new ConfiguracionResponse("velocidad_simulacion", "1", "Velocidad predeterminada")
        );
        when(authService.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(jugador);
        when(configuracionService.listarConfiguraciones()).thenReturn(configuraciones);

        List<ConfiguracionResponse> respuesta = crearController().listar("Bearer jugador");

        assertEquals(configuraciones, respuesta);
        verify(authService).obtenerUsuarioConSesion("Bearer jugador");
        verify(configuracionService).listarConfiguraciones();
    }

    @Test
    void rechazaLaConsultaSinUnaSesionValida() {
        when(authService.obtenerUsuarioConSesion(null)).thenThrow(
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión no es válida")
        );

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearController().listar(null)
        );

        assertEquals(HttpStatus.UNAUTHORIZED, excepcion.getStatusCode());
        verifyNoInteractions(configuracionService);
    }

    private ConfiguracionConsultaController crearController() {
        return new ConfiguracionConsultaController(authService, configuracionService);
    }
}
