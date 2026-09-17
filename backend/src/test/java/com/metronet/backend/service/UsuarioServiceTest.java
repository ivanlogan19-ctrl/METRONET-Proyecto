package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {
    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthService authService;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void eliminaDatosPropiosSinBorrarUnEscenarioCompartido() {
        Usuario usuario = crearUsuario(7, Rol.JUGADOR, null);
        when(usuarioRepository.findById(7)).thenReturn(Optional.of(usuario));
        when(jdbcTemplate.query(
            contains("COALESCE(e.progresivo, FALSE) = FALSE"),
            ArgumentMatchers.<RowMapper<Integer>>any(),
            any(Object[].class)
        )).thenReturn(List.of(31));

        crearServicio().eliminarUsuario(7);

        InOrder orden = inOrder(jdbcTemplate, authService, usuarioRepository);
        orden.verify(jdbcTemplate).update(contains("DELETE FROM actividad_administrativa"), eq(7));
        orden.verify(jdbcTemplate).update(contains("DELETE FROM diseno"), eq(7));
        orden.verify(jdbcTemplate).update(contains("AND NOT EXISTS"), eq(31), eq(31));
        orden.verify(authService).invalidarSesionesDeUsuario(7);
        orden.verify(usuarioRepository).delete(usuario);
    }

    @Test
    void asignaUnIdentificadorUnicoAlPromoverUnJugadorAAdministrador() {
        Usuario usuario = crearUsuario(12, Rol.JUGADOR, null);
        when(usuarioRepository.findById(12)).thenReturn(Optional.of(usuario));
        when(usuarioRepository.findByIdentificadorAdministradorIgnoreCase("administrador-12")).thenReturn(Optional.empty());
        when(usuarioRepository.save(usuario)).thenReturn(usuario);

        UsuarioResponse respuesta = crearServicio().actualizarRol(12, Rol.ADMIN);

        assertEquals(Rol.ADMIN, respuesta.rol());
        assertEquals("administrador-12", respuesta.identificadorAdministrador());
        verify(authService).invalidarSesionesDeUsuario(12);
    }

    @Test
    void limpiaElIdentificadorAlDegradarUnAdministradorAJugador() {
        Usuario usuario = crearUsuario(13, Rol.ADMIN, "admin-anterior");
        when(usuarioRepository.findById(13)).thenReturn(Optional.of(usuario));
        when(usuarioRepository.save(usuario)).thenReturn(usuario);

        UsuarioResponse respuesta = crearServicio().actualizarRol(13, Rol.JUGADOR);

        assertEquals(Rol.JUGADOR, respuesta.rol());
        assertNull(respuesta.identificadorAdministrador());
        verify(authService).invalidarSesionesDeUsuario(13);
    }

    @Test
    void impidePromoverConUnIdentificadorYaAsignadoAOtroAdministrador() {
        Usuario usuario = crearUsuario(14, Rol.ADMIN, "identificador-ocupado");
        Usuario otroAdministrador = crearUsuario(15, Rol.ADMIN, "identificador-ocupado");
        when(usuarioRepository.findById(14)).thenReturn(Optional.of(usuario));
        when(usuarioRepository.findByIdentificadorAdministradorIgnoreCase("identificador-ocupado"))
            .thenReturn(Optional.of(otroAdministrador));

        IllegalArgumentException excepcion = assertThrows(
            IllegalArgumentException.class,
            () -> crearServicio().actualizarRol(14, Rol.ADMIN)
        );

        assertEquals("Ya existe un administrador con ese identificador", excepcion.getMessage());
        verifyNoInteractions(authService);
    }

    private UsuarioService crearServicio() {
        return new UsuarioService(usuarioRepository, passwordEncoder, authService, jdbcTemplate);
    }

    private Usuario crearUsuario(Integer idUsuario, Rol rol, String identificadorAdministrador) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(idUsuario);
        usuario.setNombre("Prueba");
        usuario.setApellido("Usuario");
        usuario.setEmail("prueba" + idUsuario + "@metronet.test");
        usuario.setPassword("hash");
        usuario.setRol(rol);
        usuario.setIdentificadorAdministrador(identificadorAdministrador);
        return usuario;
    }
}
