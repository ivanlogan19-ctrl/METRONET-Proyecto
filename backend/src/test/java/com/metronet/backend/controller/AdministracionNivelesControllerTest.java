package com.metronet.backend.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.service.AdministracionNivelesService;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ContenidoPublicadoNivelService;
import com.metronet.backend.service.JuegoEducativoService;
import com.metronet.backend.service.PublicacionNivelService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

class AdministracionNivelesControllerTest {
    @Test
    void contenidoVigenteDeniegaNivelBloqueadoSinEntregarTarjetas() throws Exception {
        var auth=mock(AuthService.class);
        var contenido=mock(ContenidoPublicadoNivelService.class);
        var juego=mock(JuegoEducativoService.class);
        var jugador=mock(Usuario.class);
        when(jugador.getIdUsuario()).thenReturn(17);
        when(auth.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(jugador);
        var http=MockMvcBuilders.standaloneSetup(new ContenidoPublicadoNivelController(auth,contenido,juego))
            .setControllerAdvice(new ManejadorExcepcionesApi()).build();
        http.perform(get("/api/juego/niveles/10/contenido").header("Authorization","Bearer jugador"))
            .andExpect(status().isForbidden());
        verify(juego).puedeConsultarContenidoActual(17,10);
        verifyNoInteractions(contenido);
    }
    @Test
    void contenidoVigenteConservaAccesoAlNivelJugable() throws Exception {
        var auth=mock(AuthService.class);
        var contenido=mock(ContenidoPublicadoNivelService.class);
        var juego=mock(JuegoEducativoService.class);
        var jugador=mock(Usuario.class);
        when(jugador.getIdUsuario()).thenReturn(17);
        when(auth.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(jugador);
        when(juego.puedeConsultarContenidoActual(17,2)).thenReturn(true);
        var http=MockMvcBuilders.standaloneSetup(new ContenidoPublicadoNivelController(auth,contenido,juego))
            .setControllerAdvice(new ManejadorExcepcionesApi()).build();
        http.perform(get("/api/juego/niveles/2/contenido").header("Authorization","Bearer jugador"))
            .andExpect(status().isOk());
        verify(contenido).actual(2);
    }
    @Test
    void contenidoVigenteSinSesionNoConsultaLogrosNiTarjetas() throws Exception {
        var auth=mock(AuthService.class);
        var contenido=mock(ContenidoPublicadoNivelService.class);
        var juego=mock(JuegoEducativoService.class);
        when(auth.obtenerUsuarioConSesion(null)).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var http=MockMvcBuilders.standaloneSetup(new ContenidoPublicadoNivelController(auth,contenido,juego))
            .setControllerAdvice(new ManejadorExcepcionesApi()).build();
        http.perform(get("/api/juego/niveles/2/contenido")).andExpect(status().isUnauthorized());
        verifyNoInteractions(juego,contenido);
    }
    @Test
    void todasLasRutasPrivadasRechazanJugadorAntesDeLeerDatos() throws Exception {
        var auth=mock(AuthService.class);
        var niveles=mock(AdministracionNivelesService.class);
        var publicacion=mock(PublicacionNivelService.class);
        when(auth.obtenerAdministradorAutorizado("Bearer jugador"))
            .thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var http=MockMvcBuilders.standaloneSetup(new AdministracionNivelesController(auth,niveles,publicacion))
            .setControllerAdvice(new ManejadorExcepcionesApi()).build();
        for (String ruta : new String[]{"/api/admin/niveles","/api/admin/niveles/1/borrador",
            "/api/admin/niveles/1/versiones"})
            http.perform(get(ruta).header("Authorization","Bearer jugador")).andExpect(status().isUnauthorized());
        http.perform(put("/api/admin/niveles/1/borrador").header("Authorization","Bearer jugador")
            .contentType(MediaType.APPLICATION_JSON).content("{}")) .andExpect(status().isUnauthorized());
        for (String ruta : new String[]{"/api/admin/niveles/1/previsualizar",
            "/api/admin/niveles/1/publicar","/api/admin/niveles/1/versiones/1/preparar-reversion"})
            http.perform(post(ruta).header("Authorization","Bearer jugador")
                .contentType(MediaType.APPLICATION_JSON).content("{}")) .andExpect(status().isUnauthorized());
        verifyNoInteractions(niveles,publicacion);
    }

    @Test
    void contenidoDeIntentoUsaSoloIdentidadAutenticada() throws Exception {
        var auth=mock(AuthService.class);
        var contenido=mock(ContenidoPublicadoNivelService.class);
        var jugador=mock(Usuario.class);
        when(jugador.getIdUsuario()).thenReturn(17);
        when(auth.obtenerUsuarioConSesion("Bearer jugador" )).thenReturn(jugador);
        when(contenido.deIntento(81,17)).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));
        var http=MockMvcBuilders.standaloneSetup(new ContenidoPublicadoNivelController(auth,contenido,mock(JuegoEducativoService.class)))
            .setControllerAdvice(new ManejadorExcepcionesApi()).build();
        http.perform(get("/api/juego/intentos/81/contenido").header("Authorization","Bearer jugador"))
            .andExpect(status().isNotFound());
        verify(contenido).deIntento(81,17);
    }
}
