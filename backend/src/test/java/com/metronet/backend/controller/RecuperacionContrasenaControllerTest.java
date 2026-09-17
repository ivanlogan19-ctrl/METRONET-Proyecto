package com.metronet.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.metronet.backend.dto.SolicitudCodigoRecuperacionResponse;
import com.metronet.backend.dto.VerificacionCodigoRecuperacionResponse;
import com.metronet.backend.service.ErrorEnvioCorreoException;
import com.metronet.backend.service.RecuperacionContrasenaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class RecuperacionContrasenaControllerTest {
    @Mock
    private RecuperacionContrasenaService recuperacionContrasenaService;

    private MockMvc mockMvc;

    @BeforeEach
    void prepararMockMvc() {
        RecuperacionContrasenaController controller = new RecuperacionContrasenaController(recuperacionContrasenaService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new ManejadorExcepcionesApi())
            .build();
    }

    @Test
    void solicitaCodigoConRespuestaNeutralSinIdSolicitud() throws Exception {
        when(recuperacionContrasenaService.solicitarRecuperacion("ana@metronet.uy"))
            .thenReturn(new SolicitudCodigoRecuperacionResponse(60));

        mockMvc.perform(patch("/auth/recuperar-contrasena")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"ana@metronet.uy\"}"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.segundosEspera").value(60))
            .andExpect(jsonPath("$.idSolicitud").doesNotExist());

        verify(recuperacionContrasenaService).solicitarRecuperacion("ana@metronet.uy");
    }

    @Test
    void verificaCodigoYDevuelveTokenTemporal() throws Exception {
        when(recuperacionContrasenaService.verificarCodigo(any()))
            .thenReturn(new VerificacionCodigoRecuperacionResponse(14, "token-temporal"));

        mockMvc.perform(post("/auth/recuperar-contrasena/verificar-codigo")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"ana@metronet.uy\",\"codigo\":\"482731\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.idSolicitud").value(14))
            .andExpect(jsonPath("$.tokenRecuperacion").value("token-temporal"));
    }

    @Test
    void reenviaConEsperaIndependienteDelIdentificadorRecibido() throws Exception {
        when(recuperacionContrasenaService.reenviarCodigo("ana@metronet.uy"))
            .thenReturn(new SolicitudCodigoRecuperacionResponse(43));

        mockMvc.perform(post("/auth/recuperar-contrasena/reenviar-codigo")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"ana@metronet.uy\",\"idSolicitud\":999}"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.segundosEspera").value(43));

        verify(recuperacionContrasenaService).reenviarCodigo("ana@metronet.uy");
    }

    @Test
    void cambiaContrasenaSoloEnLaRutaContratadaPorElFrontend() throws Exception {
        mockMvc.perform(patch("/auth/recuperar-contrasena/cambiar-contrasena")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"idSolicitud":14,"tokenRecuperacion":"token-temporal","nuevaContrasena":"Nueva1!","confirmarNuevaContrasena":"Nueva1!"}
                    """))
            .andExpect(status().isNoContent());

        verify(recuperacionContrasenaService).cambiarContrasena(any());
    }

    @Test
    void ocultaElMotivoTecnicoDeUnErrorDeCorreo() throws Exception {
        when(recuperacionContrasenaService.solicitarRecuperacion("ana@metronet.uy"))
            .thenThrow(new ErrorEnvioCorreoException("credencial SMTP inválida"));

        mockMvc.perform(patch("/auth/recuperar-contrasena")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"ana@metronet.uy\"}"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.detail").value("La recuperación de contraseña no está disponible en este momento. Intentá más tarde."));
    }
}
