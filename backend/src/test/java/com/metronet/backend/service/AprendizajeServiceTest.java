package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class AprendizajeServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ContenidoPublicadoNivelService contenido = mock(ContenidoPublicadoNivelService.class);
    private final AprendizajeService servicio = new AprendizajeService(jdbc, contenido);

    private Usuario usuario(Rol rol) {
        var usuario = new Usuario(); usuario.setIdUsuario(42); usuario.setRol(rol); return usuario;
    }

    @Test void sinProgresoNoEntregaContenidoYDeniegaAccesoDirecto() {
        when(jdbc.query(anyString(), any(RowMapper.class), eq(42))).thenReturn(List.of());
        var niveles = servicio.niveles(usuario(Rol.JUGADOR));
        assertEquals(10, niveles.size());
        assertTrue(niveles.stream().noneMatch(AprendizajeService.Nivel::desbloqueado));
        verifyNoInteractions(contenido);
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(42), eq(1))).thenReturn(false);
        assertEquals(403, assertThrows(ResponseStatusException.class,
            () -> servicio.contenido(1, usuario(Rol.JUGADOR))).getStatusCode().value());
    }

    @Test void progresoHistoricoDesbloqueaSoloSusNivelesYAdminVeTodos() {
        when(jdbc.query(anyString(), any(RowMapper.class), eq(42))).thenReturn(List.of(1, 4));
        var niveles = servicio.niveles(usuario(Rol.JUGADOR));
        assertEquals(List.of(1, 4), niveles.stream().filter(AprendizajeService.Nivel::desbloqueado)
            .map(AprendizajeService.Nivel::numero).toList());
        verify(contenido).actual(1); verify(contenido).actual(4);
        assertEquals(10, servicio.niveles(usuario(Rol.ADMIN)).stream()
            .filter(AprendizajeService.Nivel::desbloqueado).count());
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(42), eq(4))).thenReturn(true);
        servicio.contenido(4, usuario(Rol.JUGADOR));
        verify(contenido, times(3)).actual(4);
    }
}
