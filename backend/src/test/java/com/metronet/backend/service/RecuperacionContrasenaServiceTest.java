package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.CambiarContrasenaRecuperacionRequest;
import com.metronet.backend.dto.SolicitudCodigoRecuperacionResponse;
import com.metronet.backend.dto.VerificacionCodigoRecuperacionResponse;
import com.metronet.backend.dto.VerificarCodigoRecuperacionRequest;
import com.metronet.backend.entity.RecuperacionContrasena;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.EstadoRecuperacionContrasena;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.RecuperacionContrasenaRepository;
import com.metronet.backend.repository.UsuarioRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class RecuperacionContrasenaServiceTest {
    private static final Clock RELOJ = Clock.fixed(Instant.parse("2026-09-17T12:00:00Z"), ZoneOffset.UTC);
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Mock
    private RecuperacionContrasenaRepository recuperacionContrasenaRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private ServicioCorreo servicioCorreo;

    @Mock
    private AuthService authService;

    private RecuperacionContrasenaService servicio;

    @BeforeEach
    void prepararServicio() {
        servicio = new RecuperacionContrasenaService(
            recuperacionContrasenaRepository,
            usuarioRepository,
            passwordEncoder,
            servicioCorreo,
            authService,
            RELOJ
        );
    }

    @Test
    void respondeDeFormaNeutralParaCorreoInexistente() {
        prepararCorreoDisponible();
        when(usuarioRepository.findByEmailParaActualizacion("nadie@metronet.uy")).thenReturn(Optional.empty());

        SolicitudCodigoRecuperacionResponse respuesta = servicio.solicitarRecuperacion("Nadie@METRONET.UY");

        assertEquals(60, respuesta.segundosEspera());
        verify(servicioCorreo, never()).enviarCodigoRecuperacion(anyString(), anyString());
        verify(recuperacionContrasenaRepository, never()).save(any());
    }

    @Test
    void generaCodigoSeguroDeSeisDigitosYGuardaSoloSuHash() {
        prepararCorreoDisponible();
        Usuario usuario = crearUsuario();
        when(usuarioRepository.findByEmailParaActualizacion(usuario.getEmail())).thenReturn(Optional.of(usuario));
        when(recuperacionContrasenaRepository.findByUsuarioIdParaActualizacion(usuario.getIdUsuario())).thenReturn(List.of());
        ArgumentCaptor<RecuperacionContrasena> recuperacionCaptor = ArgumentCaptor.forClass(RecuperacionContrasena.class);
        ArgumentCaptor<String> codigoCaptor = ArgumentCaptor.forClass(String.class);

        SolicitudCodigoRecuperacionResponse respuesta = servicio.solicitarRecuperacion(usuario.getEmail());

        verify(recuperacionContrasenaRepository).save(recuperacionCaptor.capture());
        verify(servicioCorreo).enviarCodigoRecuperacion(eq(usuario.getEmail()), codigoCaptor.capture());
        RecuperacionContrasena recuperacion = recuperacionCaptor.getValue();
        String codigo = codigoCaptor.getValue();
        assertEquals(60, respuesta.segundosEspera());
        assertTrue(codigo.matches("\\d{6}"));
        assertNotEquals(codigo, recuperacion.getCodigoHash());
        assertTrue(passwordEncoder.matches(codigo, recuperacion.getCodigoHash()));
        assertEquals(EstadoRecuperacionContrasena.PENDIENTE, recuperacion.getEstado());
        assertEquals(LocalDateTime.now(RELOJ).plusMinutes(10), recuperacion.getFechaExpiracion());
    }

    @Test
    void reenvioAntesDeSesentaSegundosNoGeneraOtroCodigo() {
        prepararCorreoDisponible();
        Usuario usuario = crearUsuario();
        when(usuarioRepository.findByEmailParaActualizacion(usuario.getEmail())).thenReturn(Optional.of(usuario));
        when(recuperacionContrasenaRepository.findByUsuarioIdParaActualizacion(usuario.getIdUsuario())).thenReturn(List.of());

        servicio.solicitarRecuperacion(usuario.getEmail());
        SolicitudCodigoRecuperacionResponse respuesta = servicio.reenviarCodigo(usuario.getEmail());

        assertTrue(respuesta.segundosEspera() > 0);
        verify(servicioCorreo, times(1)).enviarCodigoRecuperacion(eq(usuario.getEmail()), anyString());
        verify(recuperacionContrasenaRepository, times(1)).save(any(RecuperacionContrasena.class));
    }

    @Test
    void invalidaLaRecuperacionActivaAnteriorCuandoGeneraUnCodigoNuevo() {
        prepararCorreoDisponible();
        Usuario usuario = crearUsuario();
        RecuperacionContrasena anterior = crearRecuperacionPendiente(usuario, "482731", LocalDateTime.now(RELOJ).minusSeconds(61));
        when(usuarioRepository.findByEmailParaActualizacion(usuario.getEmail())).thenReturn(Optional.of(usuario));
        when(recuperacionContrasenaRepository.findByUsuarioIdParaActualizacion(usuario.getIdUsuario())).thenReturn(List.of(anterior));

        servicio.solicitarRecuperacion(usuario.getEmail());

        assertEquals(EstadoRecuperacionContrasena.INVALIDADA, anterior.getEstado());
        assertNull(anterior.getCodigoHash());
        verify(recuperacionContrasenaRepository).saveAll(List.of(anterior));
    }

    @Test
    void noExponeUnErrorDistintoCuandoFallaElEnvioDeUnCorreoExistente() {
        prepararCorreoDisponible();
        Usuario usuario = crearUsuario();
        when(usuarioRepository.findByEmailParaActualizacion(usuario.getEmail())).thenReturn(Optional.of(usuario));
        when(recuperacionContrasenaRepository.findByUsuarioIdParaActualizacion(usuario.getIdUsuario())).thenReturn(List.of());
        doThrow(new ErrorEnvioCorreoException("fallo de prueba"))
            .when(servicioCorreo).enviarCodigoRecuperacion(eq(usuario.getEmail()), anyString());
        ArgumentCaptor<RecuperacionContrasena> recuperacionCaptor = ArgumentCaptor.forClass(RecuperacionContrasena.class);

        SolicitudCodigoRecuperacionResponse respuesta = servicio.solicitarRecuperacion(usuario.getEmail());

        verify(recuperacionContrasenaRepository, times(2)).save(recuperacionCaptor.capture());
        RecuperacionContrasena recuperacion = recuperacionCaptor.getAllValues().getLast();
        assertEquals(60, respuesta.segundosEspera());
        assertEquals(EstadoRecuperacionContrasena.INVALIDADA, recuperacion.getEstado());
        assertNull(recuperacion.getCodigoHash());
    }

    @Test
    void rechazaSolicitudCuandoElCorreoNoEstaConfiguradoParaTodosLosCorreosValidos() {
        when(servicioCorreo.estaDisponible()).thenReturn(false);

        ErrorEnvioCorreoException excepcion = assertThrows(
            ErrorEnvioCorreoException.class,
            () -> servicio.solicitarRecuperacion("nadie@metronet.uy")
        );

        assertEquals("La recuperación de contraseña no está disponible en este momento. Intentá más tarde.", excepcion.getMessage());
        verify(usuarioRepository, never()).findByEmailParaActualizacion(anyString());
    }

    @Test
    void verificaCodigoCorrectoYEntregaSoloTokenTemporal() {
        Usuario usuario = crearUsuario();
        RecuperacionContrasena recuperacion = crearRecuperacionPendiente(usuario, "482731", LocalDateTime.now(RELOJ));
        recuperacion.setIdSolicitud(12);
        prepararVerificacion(usuario, recuperacion);

        VerificacionCodigoRecuperacionResponse respuesta = servicio.verificarCodigo(
            new VerificarCodigoRecuperacionRequest(usuario.getEmail(), null, "482731")
        );

        assertEquals(12, respuesta.idSolicitud());
        assertFalse(respuesta.tokenRecuperacion().isBlank());
        assertNull(recuperacion.getCodigoHash());
        assertTrue(passwordEncoder.matches(respuesta.tokenRecuperacion(), recuperacion.getTokenRecuperacionHash()));
        assertEquals(EstadoRecuperacionContrasena.VERIFICADA, recuperacion.getEstado());
    }

    @Test
    void bloqueaElCodigoDespuesDeCincoIntentosIncorrectos() {
        Usuario usuario = crearUsuario();
        RecuperacionContrasena recuperacion = crearRecuperacionPendiente(usuario, "482731", LocalDateTime.now(RELOJ));
        prepararVerificacion(usuario, recuperacion);

        for (int intento = 1; intento < 5; intento++) {
            ResponseStatusException excepcion = assertThrows(
                ResponseStatusException.class,
                () -> servicio.verificarCodigo(new VerificarCodigoRecuperacionRequest(usuario.getEmail(), null, "111111"))
            );
            assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
        }
        ResponseStatusException bloqueo = assertThrows(
            ResponseStatusException.class,
            () -> servicio.verificarCodigo(new VerificarCodigoRecuperacionRequest(usuario.getEmail(), null, "111111"))
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, bloqueo.getStatusCode());
        assertEquals(5, recuperacion.getIntentosFallidos());
        assertEquals(EstadoRecuperacionContrasena.BLOQUEADA, recuperacion.getEstado());
        assertNull(recuperacion.getCodigoHash());
    }

    @Test
    void rechazaCodigoExpiradoYRegistraSuVencimiento() {
        Usuario usuario = crearUsuario();
        RecuperacionContrasena recuperacion = crearRecuperacionPendiente(usuario, "482731", LocalDateTime.now(RELOJ).minusMinutes(11));
        prepararVerificacion(usuario, recuperacion);

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> servicio.verificarCodigo(new VerificarCodigoRecuperacionRequest(usuario.getEmail(), null, "482731"))
        );

        assertEquals(HttpStatus.GONE, excepcion.getStatusCode());
        assertEquals(EstadoRecuperacionContrasena.VENCIDA, recuperacion.getEstado());
        assertNull(recuperacion.getCodigoHash());
    }

    @Test
    void cambiaLaContrasenaSoloConAutorizacionTemporalValidaYLaInutiliza() {
        Usuario usuario = crearUsuario();
        RecuperacionContrasena recuperacion = new RecuperacionContrasena();
        recuperacion.setIdSolicitud(25);
        recuperacion.setUsuario(usuario);
        recuperacion.setTokenRecuperacionHash(passwordEncoder.encode("token-valido"));
        recuperacion.setFechaExpiracionAutorizacion(LocalDateTime.now(RELOJ).plusMinutes(10));
        recuperacion.setEstado(EstadoRecuperacionContrasena.VERIFICADA);
        when(recuperacionContrasenaRepository.findByIdParaActualizacion(25)).thenReturn(Optional.of(recuperacion));

        servicio.cambiarContrasena(new CambiarContrasenaRecuperacionRequest(25, "token-valido", "Nueva1!", "Nueva1!"));

        verify(authService).cambiarContrasenaPorRecuperacion(usuario, "Nueva1!");
        assertTrue(recuperacion.isUtilizado());
        assertEquals(EstadoRecuperacionContrasena.UTILIZADA, recuperacion.getEstado());
        assertNull(recuperacion.getTokenRecuperacionHash());
        ResponseStatusException reutilizacion = assertThrows(
            ResponseStatusException.class,
            () -> servicio.cambiarContrasena(new CambiarContrasenaRecuperacionRequest(25, "token-valido", "Nueva1!", "Nueva1!"))
        );
        assertEquals(HttpStatus.UNAUTHORIZED, reutilizacion.getStatusCode());
        verify(authService, times(1)).cambiarContrasenaPorRecuperacion(usuario, "Nueva1!");
    }

    @Test
    void rechazaCambioDirectoSinVerificarElCodigo() {
        Usuario usuario = crearUsuario();
        RecuperacionContrasena recuperacion = crearRecuperacionPendiente(usuario, "482731", LocalDateTime.now(RELOJ));
        recuperacion.setIdSolicitud(29);
        when(recuperacionContrasenaRepository.findByIdParaActualizacion(29)).thenReturn(Optional.of(recuperacion));

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> servicio.cambiarContrasena(new CambiarContrasenaRecuperacionRequest(29, "token-inventado", "Nueva1!", "Nueva1!"))
        );

        assertEquals(HttpStatus.UNAUTHORIZED, excepcion.getStatusCode());
        verify(authService, never()).cambiarContrasenaPorRecuperacion(any(), anyString());
    }

    private void prepararVerificacion(Usuario usuario, RecuperacionContrasena recuperacion) {
        when(usuarioRepository.findByEmailParaActualizacion(usuario.getEmail())).thenReturn(Optional.of(usuario));
        when(recuperacionContrasenaRepository.findByUsuarioIdParaActualizacion(usuario.getIdUsuario())).thenReturn(List.of(recuperacion));
    }

    private void prepararCorreoDisponible() {
        when(servicioCorreo.estaDisponible()).thenReturn(true);
    }

    private Usuario crearUsuario() {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(7);
        usuario.setNombre("Ana");
        usuario.setApellido("Pérez");
        usuario.setEmail("ana@metronet.uy");
        usuario.setPassword(passwordEncoder.encode("Clave1!"));
        usuario.setRol(Rol.JUGADOR);
        return usuario;
    }

    private RecuperacionContrasena crearRecuperacionPendiente(Usuario usuario, String codigo, LocalDateTime fechaSolicitud) {
        RecuperacionContrasena recuperacion = new RecuperacionContrasena();
        recuperacion.setUsuario(usuario);
        recuperacion.setCodigoHash(passwordEncoder.encode(codigo));
        recuperacion.setFechaSolicitud(fechaSolicitud);
        recuperacion.setFechaUltimoEnvio(fechaSolicitud);
        recuperacion.setFechaExpiracion(fechaSolicitud.plusMinutes(10));
        recuperacion.setEstado(EstadoRecuperacionContrasena.PENDIENTE);
        return recuperacion;
    }
}
