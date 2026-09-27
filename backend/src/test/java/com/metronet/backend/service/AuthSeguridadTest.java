package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.metronet.backend.dto.*;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import com.metronet.backend.utilidades.PoliticaContrasena;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class AuthSeguridadTest {
    private final UsuarioRepository repo = mock(UsuarioRepository.class);
    private final Clock reloj = mock(Clock.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final Instant inicio = Instant.parse("2026-09-26T12:00:00Z");
    private AuthService servicio() {
        when(reloj.instant()).thenReturn(inicio);
        when(reloj.getZone()).thenReturn(ZoneOffset.UTC);
        return new AuthService(repo, encoder, reloj);
    }
    private Usuario usuario() {
        Usuario u = new Usuario(); u.setIdUsuario(1); u.setEmail("prueba@example.test");
        u.setRol(Rol.JUGADOR); u.setPassword(encoder.encode("Clave1!"));
        when(repo.findByEmailIgnoreCase(anyString())).thenReturn(Optional.of(u));
        when(repo.findById(1)).thenReturn(Optional.of(u));
        return u;
    }
    private LoginRequest login(String clave) { return new LoginRequest("prueba@example.test", clave); }
    private void estado(int esperado, Runnable accion) {
        assertEquals(esperado, assertThrows(ResponseStatusException.class, accion::run).getStatusCode().value());
    }
    @Test void limitaIntentosPorCuentaNormalizadaYRecuperaTrasLaVentana() {
        var auth = servicio(); usuario();
        for (int i=0;i<6;i++) estado(401, () -> auth.iniciarSesion(login("Incorrecta!")));
        estado(429, () -> auth.iniciarSesion(new LoginRequest("PRUEBA@example.test", "Clave1!")));
        when(reloj.instant()).thenReturn(inicio.plusSeconds(901));
        assertNotNull(auth.iniciarSesion(login("Clave1!")).token());
    }
    @Test void tokenAleatorioNoEsReutilizableTrasLogoutNiTrasOchoHoras() {
        var auth = servicio(); usuario();
        String a = auth.iniciarSesion(login("Clave1!")).token();
        String b = auth.iniciarSesion(login("Clave1!")).token();
        assertNotEquals(a,b); assertEquals(43,a.length());
        auth.cerrarSesionUsuario("Bearer " + a);
        estado(401, () -> auth.obtenerPerfil("Bearer " + a));
        assertNotNull(auth.obtenerPerfil("Bearer " + b));
        when(reloj.instant()).thenReturn(inicio.plusSeconds(8*3600));
        estado(401, () -> auth.obtenerPerfil("Bearer " + b));
    }
    @Test void cambioDeRolOEliminacionInvalidanAccesoInclusoFueraDelController() {
        var auth = servicio(); var u = usuario();
        String token = auth.iniciarSesion(login("Clave1!")).token();
        u.setRol(Rol.ADMIN);
        final String anterior = token;
        estado(401, () -> auth.obtenerUsuarioConSesion("Bearer " + anterior));
        u.setRol(Rol.JUGADOR);
        token = auth.iniciarSesion(login("Clave1!")).token();
        when(repo.findById(1)).thenReturn(Optional.empty());
        final String eliminado = token;
        estado(401, () -> auth.obtenerUsuarioConSesion("Bearer " + eliminado));
    }
    @Test void noAceptaContrasenasPlanasNiTruncamientoBCrypt() {
        var auth = servicio(); var u = usuario();
        u.setPassword("Clave1!");
        estado(401, () -> auth.iniciarSesion(login("Clave1!")));
        assertFalse(PoliticaContrasena.esValida("Á".repeat(37)+"A!"));
        assertTrue(PoliticaContrasena.esValida("A!"+"a".repeat(70)));
        estado(400, () -> auth.registrar(new RegistroRequest("Ana","Prueba","nueva@example.test","A!"+"a".repeat(71),true)));
    }
}
