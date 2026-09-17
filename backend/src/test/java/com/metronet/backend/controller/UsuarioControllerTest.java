package com.metronet.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.ActividadAdministrativaService;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.UsuarioService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class UsuarioControllerTest {
    @Mock
    private UsuarioService usuarioService;

    @Mock
    private AuthService authService;

    @Mock
    private ActividadAdministrativaService actividadAdministrativaService;

    @Test
    void rechazaEndpointAdministrativoSinSesion() {
        UsuarioController controller = crearController();
        when(authService.obtenerAdministradorAutorizado(null)).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión no es válida"));

        ResponseStatusException excepcion = assertThrows(ResponseStatusException.class, () -> controller.obtenerUsuarios(null));

        assertEquals(HttpStatus.UNAUTHORIZED, excepcion.getStatusCode());
        verifyNoInteractions(usuarioService);
    }

    @Test
    void rechazaEndpointAdministrativoConSesionDeJugador() {
        UsuarioController controller = crearController();
        when(authService.obtenerAdministradorAutorizado("Bearer token-jugador")).thenThrow(
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión de administrador no es válida")
        );

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> controller.obtenerUsuarios("Bearer token-jugador")
        );

        assertEquals(HttpStatus.UNAUTHORIZED, excepcion.getStatusCode());
        verifyNoInteractions(usuarioService);
    }

    @Test
    void permiteEndpointAdministrativoAAdministradorAutorizado() {
        UsuarioController controller = crearController();
        Usuario administrador = new Usuario();
        administrador.setIdUsuario(1);
        administrador.setRol(Rol.ADMIN);
        List<UsuarioResponse> usuarios = List.of(new UsuarioResponse(2, "Ana", "Pérez", "ana@metronet.uy", Rol.JUGADOR, null));
        when(authService.obtenerAdministradorAutorizado("Bearer token-admin")).thenReturn(administrador);
        when(usuarioService.listarUsuarios()).thenReturn(usuarios);

        List<UsuarioResponse> respuesta = controller.obtenerUsuarios("Bearer token-admin");

        assertEquals(usuarios, respuesta);
        verify(usuarioService).listarUsuarios();
    }

    private UsuarioController crearController() {
        return new UsuarioController(usuarioService, authService, actividadAdministrativaService);
    }
}
