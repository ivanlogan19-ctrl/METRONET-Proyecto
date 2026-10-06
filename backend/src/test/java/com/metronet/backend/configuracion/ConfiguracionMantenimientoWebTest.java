package com.metronet.backend.configuracion;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import com.metronet.backend.controller.SimulacionController;
import com.metronet.backend.controller.AuthController;
import com.metronet.backend.controller.EstadoSistemaController;
import com.metronet.backend.service.SimulacionService;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

@WebMvcTest(controllers = {JuegoEducativoController.class, SimulacionController.class, AuthController.class, EstadoSistemaController.class})
@Import({ConfiguracionMantenimientoWeb.class, ControlMantenimientoInterceptor.class})
class ConfiguracionMantenimientoWebTest {
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.metronet.backend.service.PuntuacionService puntuacionService;
    @MockitoBean
    private SimulacionService simulacionService;

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

    @ParameterizedTest
    @CsvSource({
        "POST,/api/simulaciones", "DELETE,/api/simulaciones/21",
        "POST,/api/simulaciones/21/estaciones", "PATCH,/api/simulaciones/21/estaciones/Centro", "DELETE,/api/simulaciones/21/estaciones/Centro",
        "POST,/api/simulaciones/21/lineas", "PATCH,/api/simulaciones/21/lineas/Azul", "DELETE,/api/simulaciones/21/lineas/Azul",
        "POST,/api/simulaciones/21/tramos", "PATCH,/api/simulaciones/21/tramos", "DELETE,/api/simulaciones/21/tramos",
        "POST,/api/simulaciones/21/unidades", "PATCH,/api/simulaciones/21/unidades/1", "DELETE,/api/simulaciones/21/unidades/1",
        "POST,/api/simulaciones/21/escenarios", "PATCH,/api/simulaciones/21/escenario",
        "POST,/api/simulaciones/21/guardar", "POST,/api/simulaciones/21/validacion", "POST,/api/simulaciones/21/ejecutar",
        "POST,/api/juego/escenarios/2/iniciar"
    })
    void rechazaLlamadasDirectasAntesDeModificarDatos(String metodo, String ruta) throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(usuario(Rol.JUGADOR));
        clienteHttp.perform(request(HttpMethod.valueOf(metodo), ruta)
                .header("Authorization", "Bearer jugador").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isServiceUnavailable());
        verifyNoInteractions(simulacionService, juegoEducativoService);
    }

    @ParameterizedTest
    @CsvSource({"JUGADOR,false", "ADMIN,false", "ADMIN,true"})
    void permiteModificarYSimularSegunRolYEstado(Rol rol, boolean mantenimiento) throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(mantenimiento);
        when(authService.obtenerUsuarioConSesion("Bearer sesion")).thenReturn(usuario(rol));
        clienteHttp.perform(post("/api/simulaciones/21/guardar").header("Authorization", "Bearer sesion"))
            .andExpect(status().isOk());
        clienteHttp.perform(post("/api/simulaciones/21/ejecutar").header("Authorization", "Bearer sesion")
                .contentType(MediaType.APPLICATION_JSON).content("{\"velocidad\":1,\"duracion\":10}"))
            .andExpect(status().isOk());
        verify(simulacionService).guardarDiseno(7, 21);
        verify(simulacionService).ejecutarSimulacion(eq(7), eq(21), any());
    }

    @Test
    void mantenimientoImpideLeerEIniciarSesionPeroPermiteCerrarSesion() throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true);
        when(authService.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(usuario(Rol.JUGADOR));
        clienteHttp.perform(get("/api/simulaciones/21").header("Authorization", "Bearer jugador"))
            .andExpect(status().isServiceUnavailable());
        clienteHttp.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"jugador@example.test\",\"password\":\"prueba\"}"))
            .andExpect(status().isServiceUnavailable());
        clienteHttp.perform(post("/auth/logout").header("Authorization", "Bearer jugador"))
            .andExpect(status().isNoContent());
        verify(authService, never()).iniciarSesion(any());
        verify(authService).cerrarSesionUsuario("Bearer jugador");
        verify(simulacionService, never()).obtenerSimulacion(7, 21);
    }

    @Test
    void estadoPublicoPermiteConocerCuandoSeLevantaElMantenimiento() throws Exception {
        when(configuracionService.estaModoMantenimientoActivo()).thenReturn(true, false);
        clienteHttp.perform(get("/api/estado"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mantenimiento").value(true));
        clienteHttp.perform(get("/api/estado"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mantenimiento").value(false));
    }

    private Usuario usuario(Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(7);
        usuario.setRol(rol);
        return usuario;
    }
}
