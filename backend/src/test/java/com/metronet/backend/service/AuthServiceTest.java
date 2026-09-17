package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.CambioContrasenaRequest;
import com.metronet.backend.dto.ActualizarCorreoPerfilRequest;
import com.metronet.backend.dto.ActualizarDatosPersonalesRequest;
import com.metronet.backend.dto.LoginAdministradorRequest;
import com.metronet.backend.dto.LoginRequest;
import com.metronet.backend.dto.PerfilUsuarioResponse;
import com.metronet.backend.dto.RegistroRequest;
import com.metronet.backend.dto.SesionAdministradorResponse;
import com.metronet.backend.dto.SesionUsuarioResponse;
import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock
    private UsuarioRepository usuarioRepository;

    @Captor
    private ArgumentCaptor<Usuario> usuarioCaptor;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Test
    void registraJugadorConContrasenaProtegida() {
        AuthService authService = crearServicio();
        RegistroRequest solicitud = new RegistroRequest("Ana", "Pérez", "ana@metronet.uy", "Clave1!", true);
        when(usuarioRepository.existsByEmailIgnoreCase("ana@metronet.uy")).thenReturn(false);
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));

        UsuarioResponse respuesta = authService.registrar(solicitud);

        verify(usuarioRepository).save(usuarioCaptor.capture());
        Usuario usuario = usuarioCaptor.getValue();
        assertEquals(Rol.JUGADOR, respuesta.rol());
        assertEquals(Rol.JUGADOR, usuario.getRol());
        assertNotEquals(solicitud.password(), usuario.getPassword());
        assertTrue(passwordEncoder.matches(solicitud.password(), usuario.getPassword()));
    }

    @Test
    void rechazaEmailDuplicadoSinCrearOtraCuenta() {
        AuthService authService = crearServicio();
        RegistroRequest solicitud = new RegistroRequest("Ana", "Pérez", "ana@metronet.uy", "Clave1!", true);
        when(usuarioRepository.existsByEmailIgnoreCase("ana@metronet.uy")).thenReturn(true);

        ResponseStatusException excepcion = assertThrows(ResponseStatusException.class, () -> authService.registrar(solicitud));

        assertEquals(HttpStatus.CONFLICT, excepcion.getStatusCode());
    }

    @Test
    void rechazaRegistroConDatosInvalidos() {
        AuthService authService = crearServicio();
        RegistroRequest solicitud = new RegistroRequest("", "Pérez", "correo-invalido", "clave", false);

        ResponseStatusException excepcion = assertThrows(ResponseStatusException.class, () -> authService.registrar(solicitud));

        assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
    }

    @Test
    void rechazaRegistroConContrasenaQueNoCumpleLaRegla() {
        AuthService authService = crearServicio();
        RegistroRequest solicitud = new RegistroRequest("Ana", "Pérez", "ana@metronet.uy", "clave", true);
        when(usuarioRepository.existsByEmailIgnoreCase("ana@metronet.uy")).thenReturn(false);

        ResponseStatusException excepcion = assertThrows(ResponseStatusException.class, () -> authService.registrar(solicitud));

        assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
    }

    @Test
    void jugadorIniciaSesionYNoPuedeAutorizaseComoAdministrador() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));

        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));

        assertEquals(Rol.JUGADOR, sesion.usuario().rol());
        assertFalse(sesion.token().isBlank());
        assertEquals(jugador, authService.obtenerUsuarioConSesion("Bearer " + sesion.token()));
        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> authService.obtenerAdministradorAutorizado("Bearer " + sesion.token())
        );
        assertEquals(HttpStatus.UNAUTHORIZED, excepcion.getStatusCode());
    }

    @Test
    void rechazaCredencialesIncorrectasYVacias() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));

        ResponseStatusException contrasenaIncorrecta = assertThrows(
            ResponseStatusException.class,
            () -> authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "OtraClave1!"))
        );
        ResponseStatusException datosVacios = assertThrows(
            ResponseStatusException.class,
            () -> authService.iniciarSesion(new LoginRequest("", ""))
        );
        ResponseStatusException correoInvalido = assertThrows(
            ResponseStatusException.class,
            () -> authService.iniciarSesion(new LoginRequest("correo-invalido", "Clave1!"))
        );
        ResponseStatusException usuarioInexistente = assertThrows(
            ResponseStatusException.class,
            () -> authService.iniciarSesion(new LoginRequest("nadie@metronet.uy", "Clave1!"))
        );

        assertEquals(HttpStatus.UNAUTHORIZED, contrasenaIncorrecta.getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, datosVacios.getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, correoInvalido.getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, usuarioInexistente.getStatusCode());
    }

    @Test
    void administradorIniciaSesionYPuedeUsarFuncionesDeJugador() {
        AuthService authService = crearServicio();
        Usuario administrador = crearUsuario(2, "admin@metronet.uy", "Clave1!", Rol.ADMIN, "admin-metronet");
        when(usuarioRepository.findByIdentificadorAdministradorIgnoreCase("admin-metronet")).thenReturn(Optional.of(administrador));
        when(usuarioRepository.findById(2)).thenReturn(Optional.of(administrador));

        SesionAdministradorResponse sesion = authService.iniciarSesionAdministrador(
            new LoginAdministradorRequest("admin-metronet", "Clave1!")
        );

        assertEquals(administrador, authService.obtenerAdministradorAutorizado("Bearer " + sesion.token()));
        assertEquals(administrador, authService.obtenerUsuarioConSesion("Bearer " + sesion.token()));
        assertEquals(Rol.ADMIN, authService.obtenerPerfil("Bearer " + sesion.token()).rol());
    }

    @Test
    void impideQueUnAdministradorUseElIngresoDeJugador() {
        AuthService authService = crearServicio();
        Usuario administrador = crearUsuario(2, "admin@metronet.uy", "Clave1!", Rol.ADMIN, "admin-metronet");
        when(usuarioRepository.findByEmailIgnoreCase("admin@metronet.uy")).thenReturn(Optional.of(administrador));

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> authService.iniciarSesion(new LoginRequest("admin@metronet.uy", "Clave1!"))
        );

        assertEquals(HttpStatus.FORBIDDEN, excepcion.getStatusCode());
    }

    @Test
    void cambioDeContrasenaInvalidaLaAnteriorYConservaLaNueva() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));
        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));

        authService.cambiarContrasena("Bearer " + sesion.token(), new CambioContrasenaRequest("Clave1!", "Nueva1!", "Nueva1!"));

        assertFalse(passwordEncoder.matches("Clave1!", jugador.getPassword()));
        assertTrue(passwordEncoder.matches("Nueva1!", jugador.getPassword()));
        assertThrows(ResponseStatusException.class, () -> authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!")));
        assertEquals(Rol.JUGADOR, authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Nueva1!")).usuario().rol());
    }

    @Test
    void recuperacionCambiaLaContrasenaConHashEInvalidaLasSesiones() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));
        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));

        authService.cambiarContrasenaPorRecuperacion(jugador, "Nueva1!");

        assertFalse(passwordEncoder.matches("Clave1!", jugador.getPassword()));
        assertTrue(passwordEncoder.matches("Nueva1!", jugador.getPassword()));
        assertThrows(ResponseStatusException.class, () -> authService.obtenerUsuarioConSesion("Bearer " + sesion.token()));
        assertThrows(ResponseStatusException.class, () -> authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!")));
        assertEquals(Rol.JUGADOR, authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Nueva1!")).usuario().rol());
    }

    @Test
    void rechazaAccesoAdministradorSinSesion() {
        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().obtenerAdministradorAutorizado(null)
        );

        assertEquals(HttpStatus.UNAUTHORIZED, excepcion.getStatusCode());
    }

    @Test
    void usuarioAutenticadoConsultaSuPropioPerfil() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));

        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));
        PerfilUsuarioResponse perfil = authService.obtenerPerfil("Bearer " + sesion.token());

        assertEquals("Usuario", perfil.nombre());
        assertEquals(Rol.JUGADOR, perfil.rol());
        assertEquals(jugador.getFechaCreacion(), perfil.fechaCreacion());
    }

    @Test
    void usuarioActualizaSoloSusDatosPersonales() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        Usuario otroUsuario = crearUsuario(2, "otro@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));

        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));
        PerfilUsuarioResponse perfil = authService.actualizarDatosPersonales(
            "Bearer " + sesion.token(),
            new ActualizarDatosPersonalesRequest("Ana", "Pérez")
        );

        assertEquals("Ana", perfil.nombre());
        assertEquals("Pérez", jugador.getApellido());
        assertEquals("Usuario", otroUsuario.getNombre());
    }

    @Test
    void rechazaCorreoInvalidoODuplicadoEnPerfil() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        Usuario duplicado = crearUsuario(2, "otro@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findByEmailIgnoreCase("otro@metronet.uy")).thenReturn(Optional.of(duplicado));

        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));
        ResponseStatusException correoInvalido = assertThrows(
            ResponseStatusException.class,
            () -> authService.actualizarCorreoPerfil("Bearer " + sesion.token(), new ActualizarCorreoPerfilRequest("correo-invalido"))
        );
        ResponseStatusException correoDuplicado = assertThrows(
            ResponseStatusException.class,
            () -> authService.actualizarCorreoPerfil("Bearer " + sesion.token(), new ActualizarCorreoPerfilRequest("otro@metronet.uy"))
        );

        assertEquals(HttpStatus.BAD_REQUEST, correoInvalido.getStatusCode());
        assertEquals(HttpStatus.CONFLICT, correoDuplicado.getStatusCode());
        assertEquals("jugador@metronet.uy", jugador.getEmail());
    }

    @Test
    void usuarioActualizaCorreoValidoSinPerderSuSesion() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findByEmailIgnoreCase("nuevo@metronet.uy"))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));

        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));
        PerfilUsuarioResponse perfil = authService.actualizarCorreoPerfil(
            "Bearer " + sesion.token(),
            new ActualizarCorreoPerfilRequest("Nuevo@METRONET.UY")
        );

        assertEquals("nuevo@metronet.uy", perfil.email());
        assertEquals(jugador, authService.obtenerUsuarioConSesion("Bearer " + sesion.token()));
        assertEquals(
            Rol.JUGADOR,
            authService.iniciarSesion(new LoginRequest("nuevo@metronet.uy", "Clave1!")).usuario().rol()
        );
    }

    @Test
    void rechazaContrasenaActualIncorrectaYConfirmacionDiferente() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));

        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));
        ResponseStatusException contrasenaIncorrecta = assertThrows(
            ResponseStatusException.class,
            () -> authService.cambiarContrasena("Bearer " + sesion.token(), new CambioContrasenaRequest("OtraClave1!", "Nueva1!", "Nueva1!"))
        );
        ResponseStatusException confirmacionInvalida = assertThrows(
            ResponseStatusException.class,
            () -> authService.cambiarContrasena("Bearer " + sesion.token(), new CambioContrasenaRequest("Clave1!", "Nueva1!", "Distinta1!"))
        );

        assertEquals(HttpStatus.UNAUTHORIZED, contrasenaIncorrecta.getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, confirmacionInvalida.getStatusCode());
        assertTrue(passwordEncoder.matches("Clave1!", jugador.getPassword()));
    }

    @Test
    void perfilNoPermiteModificarRolNiFechaDeCreacion() {
        AuthService authService = crearServicio();
        Usuario jugador = crearUsuario(1, "jugador@metronet.uy", "Clave1!", Rol.JUGADOR, null);
        LocalDateTime fechaCreacion = jugador.getFechaCreacion();
        when(usuarioRepository.findByEmailIgnoreCase("jugador@metronet.uy")).thenReturn(Optional.of(jugador));
        when(usuarioRepository.findById(1)).thenReturn(Optional.of(jugador));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));

        SesionUsuarioResponse sesion = authService.iniciarSesion(new LoginRequest("jugador@metronet.uy", "Clave1!"));
        authService.actualizarDatosPersonales(
            "Bearer " + sesion.token(),
            new ActualizarDatosPersonalesRequest("Nombre nuevo", "Apellido nuevo")
        );

        assertEquals(Rol.JUGADOR, jugador.getRol());
        assertEquals(fechaCreacion, jugador.getFechaCreacion());
    }

    @Test
    void rechazaPerfilSinSesionAutenticada() {
        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().obtenerPerfil(null)
        );

        assertEquals(HttpStatus.UNAUTHORIZED, excepcion.getStatusCode());
    }

    private AuthService crearServicio() {
        return new AuthService(usuarioRepository, passwordEncoder);
    }

    private Usuario crearUsuario(Integer idUsuario, String email, String contrasena, Rol rol, String identificadorAdministrador) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(idUsuario);
        usuario.setNombre("Usuario");
        usuario.setApellido("Prueba");
        usuario.setEmail(email);
        usuario.setPassword(passwordEncoder.encode(contrasena));
        usuario.setRol(rol);
        usuario.setIdentificadorAdministrador(identificadorAdministrador);
        usuario.setFechaCreacion(LocalDateTime.of(2026, 1, 1, 10, 0));
        return usuario;
    }
}
