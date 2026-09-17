package com.metronet.backend.configuracion;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.metronet.backend.controller.JuegoEducativoController;
import com.metronet.backend.dto.EvaluacionEscenarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ConfiguracionService;
import com.metronet.backend.service.JuegoEducativoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = JuegoEducativoController.class)
@Import({ConfiguracionMantenimientoWeb.class, ControlMantenimientoInterceptor.class})
class ConfiguracionMantenimientoWebTest {
    @Autowired
    private MockMvc clienteHttp;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private ConfiguracionService configuracionService;

    @MockitoBean
    private JuegoEducativoService juegoEducativoService;

    @Test
    void bloqueaLaEvaluacionDeUnJugadorDuranteElMantenimiento() throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(usuario(Rol.JUGADOR));

        clienteHttp.perform(post("/api/juego/disenos/21/evaluar").header("Authorization", "Bearer jugador"))
            .andExpect(status().isServiceUnavailable());

        verify(juegoEducativoService, never()).evaluarEscenario(7, 21);
    }

    @Test
    void permiteLaEvaluacionDeUnAdministradorDuranteElMantenimiento() throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer administrador")).thenReturn(usuario(Rol.ADMIN));
        when(juegoEducativoService.evaluarEscenario(7, 21)).thenReturn(
            new EvaluacionEscenarioResponse(true, 100, 100, "Evaluación completada", null, true)
        );

        clienteHttp.perform(post("/api/juego/disenos/21/evaluar").header("Authorization", "Bearer administrador"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.completado").value(true));

        verify(juegoEducativoService).evaluarEscenario(7, 21);
    }

    @Test
    void bloqueaElReinicioYLaRepeticionDeUnJugadorDuranteElMantenimiento() throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(usuario(Rol.JUGADOR));

        clienteHttp.perform(post("/api/juego/escenarios/2/volver-a-jugar").header("Authorization", "Bearer jugador"))
            .andExpect(status().isServiceUnavailable());
        clienteHttp.perform(post("/api/juego/recorrido/reiniciar").header("Authorization", "Bearer jugador"))
            .andExpect(status().isServiceUnavailable());

        verify(juegoEducativoService, never()).volverAJugar(7, 2);
        verify(juegoEducativoService, never()).reiniciarRecorrido(7, null);
    }

    private Usuario usuario(Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(7);
        usuario.setRol(rol);
        return usuario;
    }
}
