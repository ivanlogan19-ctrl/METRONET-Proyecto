package com.metronet.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.CrearSimulacionRequest;
import com.metronet.backend.dto.ValidacionDisenoResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.SimulacionService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SimulacionControllerTest {
    @Mock
    private AuthService authService;

    @Mock
    private SimulacionService simulacionService;

    @Test
    void consultaLaValidacionSinSolicitarUnaActualizacionDeEstado() {
        Usuario jugador = jugador(7);
        ValidacionDisenoResponse validacion = new ValidacionDisenoResponse(true, List.of(), false, List.of("Falta una unidad"));
        when(authService.obtenerUsuarioConSesion("Bearer token-jugador")).thenReturn(jugador);
        when(simulacionService.consultarValidacionDiseno(7, 21)).thenReturn(validacion);

        ValidacionDisenoResponse respuesta = crearController().consultarValidacionDiseno(21, "Bearer token-jugador");

        assertEquals(validacion, respuesta);
        verify(simulacionService).consultarValidacionDiseno(7, 21);
        verify(simulacionService, never()).validarDiseno(7, 21);
    }

    @Test
    void confirmaLaValidacionMedianteLaAccionPost() {
        Usuario jugador = jugador(7);
        ValidacionDisenoResponse validacion = new ValidacionDisenoResponse(true, List.of(), true, List.of());
        when(authService.obtenerUsuarioConSesion("Bearer token-jugador")).thenReturn(jugador);
        when(simulacionService.validarDiseno(7, 21)).thenReturn(validacion);

        ValidacionDisenoResponse respuesta = crearController().validarDiseno(21, "Bearer token-jugador");

        assertEquals(validacion, respuesta);
        verify(simulacionService).validarDiseno(7, 21);
        verify(simulacionService, never()).consultarValidacionDiseno(7, 21);
    }

    @Test
    void conservaElRolDelUsuarioAlCrearUnaSimulacion() {
        Usuario administrador = jugador(7);
        administrador.setRol(Rol.ADMIN);
        when(authService.obtenerUsuarioConSesion("Bearer token-administrador")).thenReturn(administrador);

        CrearSimulacionRequest solicitud = new CrearSimulacionRequest("Red administrativa");
        crearController().crear(solicitud, "Bearer token-administrador");

        verify(simulacionService).crearSimulacion(7, Rol.ADMIN, solicitud);
    }

    private SimulacionController crearController() {
        return new SimulacionController(authService, simulacionService);
    }

    private Usuario jugador(Integer idUsuario) {
        Usuario jugador = new Usuario();
        jugador.setIdUsuario(idUsuario);
        return jugador;
    }
}
