package com.metronet.backend.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AprendizajeService;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ContenidoPublicadoNivelService;
import com.metronet.backend.service.TrofeosService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

class AprendizajeTrofeosHttpTest {
    private Usuario usuario(int id, Rol rol) {
        var usuario = new Usuario(); usuario.setIdUsuario(id); usuario.setRol(rol); return usuario;
    }

    @Test void sinSesionAmbosEndpointsResponden401AntesDeConsultarServicios() throws Exception {
        var auth = mock(AuthService.class);
        var aprendizaje = mock(AprendizajeService.class);
        var trofeos = mock(TrofeosService.class);
        when(auth.obtenerUsuarioConSesion(null)).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var http = MockMvcBuilders.standaloneSetup(new AprendizajeController(auth, aprendizaje),
            new TrofeosController(auth, trofeos)).setControllerAdvice(new ManejadorExcepcionesApi()).build();
        http.perform(get("/api/juego/aprendizaje")).andExpect(status().isUnauthorized());
        http.perform(get("/api/juego/aprendizaje/niveles/1")).andExpect(status().isUnauthorized());
        http.perform(get("/api/juego/trofeos")).andExpect(status().isUnauthorized());
        verifyNoInteractions(aprendizaje, trofeos);
    }

    @Test void identidadDelTokenDecideBibliotecaYAccesoDirecto() throws Exception {
        var auth = mock(AuthService.class);
        var aprendizaje = mock(AprendizajeService.class);
        var jugadorA = usuario(17, Rol.JUGADOR);
        var jugadorB = usuario(18, Rol.JUGADOR);
        var administrador = usuario(1, Rol.ADMIN);
        when(auth.obtenerUsuarioConSesion("Bearer a")).thenReturn(jugadorA);
        when(auth.obtenerUsuarioConSesion("Bearer b")).thenReturn(jugadorB);
        when(auth.obtenerUsuarioConSesion("Bearer admin")).thenReturn(administrador);
        var contenido = new ContenidoPublicadoNivelService.Contenido(5L, 1, 2,
            new ObjectMapper().createObjectNode(), new ObjectMapper().createObjectNode(), new ObjectMapper().createArrayNode());
        when(aprendizaje.niveles(jugadorA)).thenReturn(List.of(new AprendizajeService.Nivel(1, false, null)));
        when(aprendizaje.niveles(jugadorB)).thenReturn(List.of(new AprendizajeService.Nivel(1, true, contenido)));
        when(aprendizaje.niveles(administrador)).thenReturn(List.of(new AprendizajeService.Nivel(1, true, contenido)));
        when(aprendizaje.contenido(1, jugadorA)).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN));
        when(aprendizaje.contenido(1, jugadorB)).thenReturn(contenido);
        when(aprendizaje.contenido(1, administrador)).thenReturn(contenido);
        var http = MockMvcBuilders.standaloneSetup(new AprendizajeController(auth, aprendizaje))
            .setControllerAdvice(new ManejadorExcepcionesApi()).build();
        http.perform(get("/api/juego/aprendizaje").header("Authorization", "Bearer a"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].desbloqueado").value(false));
        http.perform(get("/api/juego/aprendizaje").header("Authorization", "Bearer b"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].desbloqueado").value(true));
        http.perform(get("/api/juego/aprendizaje").header("Authorization", "Bearer admin"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].desbloqueado").value(true));
        http.perform(get("/api/juego/aprendizaje/niveles/1").header("Authorization", "Bearer a"))
            .andExpect(status().isForbidden());
        http.perform(get("/api/juego/aprendizaje/niveles/1").header("Authorization", "Bearer b"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.idNivelPublicacion").value(5));
        http.perform(get("/api/juego/aprendizaje/niveles/1").header("Authorization", "Bearer admin"))
            .andExpect(status().isOk());
        verify(aprendizaje).contenido(1, jugadorA);
        verify(aprendizaje).contenido(1, jugadorB);
        verify(aprendizaje).contenido(1, administrador);
    }

    @Test void trofeosUsanIdentidadDelTokenYAdminNoRecibePremioGanado() throws Exception {
        var auth = mock(AuthService.class);
        var trofeos = mock(TrofeosService.class);
        var jugador = usuario(17, Rol.JUGADOR);
        var administrador = usuario(1, Rol.ADMIN);
        when(auth.obtenerUsuarioConSesion("Bearer jugador")).thenReturn(jugador);
        when(auth.obtenerUsuarioConSesion("Bearer admin")).thenReturn(administrador);
        when(trofeos.consultar(jugador)).thenReturn(List.of(new TrofeosService.Trofeo(
            "estacion", "Primera estación", "Completar Nivel 1", "Completaste Nivel 1", true)));
        when(trofeos.consultar(administrador)).thenReturn(List.of(new TrofeosService.Trofeo(
            "estacion", "Primera estación", "Completar Nivel 1", "Completaste Nivel 1", false)));
        var http = MockMvcBuilders.standaloneSetup(new TrofeosController(auth, trofeos))
            .setControllerAdvice(new ManejadorExcepcionesApi()).build();
        http.perform(get("/api/juego/trofeos").header("Authorization", "Bearer jugador"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].obtenido").value(true));
        http.perform(get("/api/juego/trofeos").header("Authorization", "Bearer admin"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].obtenido").value(false));
        verify(trofeos).consultar(jugador);
        verify(trofeos).consultar(administrador);
    }
}
