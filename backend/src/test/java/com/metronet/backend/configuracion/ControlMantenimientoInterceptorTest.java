package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ConfiguracionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ControlMantenimientoInterceptorTest {
    @Mock
    private AuthService authService;

    @Mock
    private ConfiguracionService configuracionService;

    @Test
    void bloqueaUnaOperacionDeJugadorCuandoElMantenimientoEstaActivo() {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(crearUsuario(Rol.JUGADOR));

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearInterceptor().preHandle(solicitud("POST", "Bearer jugador"), new MockHttpServletResponse(), new Object())
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, excepcion.getStatusCode());
        assertEquals(
            "METRONET está en mantenimiento. Disculpá las molestias. Volvé cuando finalice.",
            excepcion.getReason()
        );
    }

    @Test
    void permiteLaOperacionDeUnAdministradorDuranteElMantenimiento() {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer administrador")).thenReturn(crearUsuario(Rol.ADMIN));

        assertTrue(crearInterceptor().preHandle(
            solicitud("PATCH", "Bearer administrador"),
            new MockHttpServletResponse(),
            new Object()
        ));
    }

    @Test
    void permiteLaOperacionDeUnJugadorCuandoElMantenimientoEstaDesactivado() throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(false);

        assertTrue(crearInterceptor().preHandle(
            solicitud("POST", "Bearer jugador"),
            new MockHttpServletResponse(),
            new Object()
        ));

        verifyNoInteractions(authService);
    }

    @Test
    void bloqueaTambienLasLecturasDelJugador() {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(crearUsuario(Rol.JUGADOR));
        ResponseStatusException excepcion = assertThrows(ResponseStatusException.class,
            () -> crearInterceptor().preHandle(solicitud("GET", "Bearer jugador"), new MockHttpServletResponse(), new Object()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, excepcion.getStatusCode());
    }

    @Test
    void permiteConsultarElEstadoPublicoDuranteElMantenimiento() throws Exception {
        MockHttpServletRequest solicitud = new MockHttpServletRequest("GET", "/api/estado");
        assertTrue(crearInterceptor().preHandle(solicitud, new MockHttpServletResponse(), new Object()));
        verifyNoInteractions(authService, configuracionService);
    }

    @Test
    void bloqueaElAccesoDesdeElLoginDelJugador() {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        MockHttpServletRequest solicitud = new MockHttpServletRequest("POST", "/auth/login");
        ResponseStatusException excepcion = assertThrows(ResponseStatusException.class,
            () -> crearInterceptor().preHandle(solicitud, new MockHttpServletResponse(), new Object()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, excepcion.getStatusCode());
        verifyNoInteractions(authService);
    }

    private ControlMantenimientoInterceptor crearInterceptor() {
        return new ControlMantenimientoInterceptor(authService, configuracionService);
    }

    private MockHttpServletRequest solicitud(String metodo, String autorizacion) {
        MockHttpServletRequest solicitud = new MockHttpServletRequest(metodo, "/api/simulaciones");
        solicitud.addHeader("Authorization", autorizacion);
        return solicitud;
    }

    private Usuario crearUsuario(Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setRol(rol);
        return usuario;
    }
}
