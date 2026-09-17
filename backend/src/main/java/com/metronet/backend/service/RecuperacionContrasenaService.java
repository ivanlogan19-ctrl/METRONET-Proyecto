package com.metronet.backend.service;

import com.metronet.backend.dto.CambiarContrasenaRecuperacionRequest;
import com.metronet.backend.dto.SolicitudCodigoRecuperacionResponse;
import com.metronet.backend.dto.VerificacionCodigoRecuperacionResponse;
import com.metronet.backend.dto.VerificarCodigoRecuperacionRequest;
import com.metronet.backend.entity.RecuperacionContrasena;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.EstadoRecuperacionContrasena;
import com.metronet.backend.repository.RecuperacionContrasenaRepository;
import com.metronet.backend.repository.UsuarioRepository;
import com.metronet.backend.utilidades.ValidadorDatos;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecuperacionContrasenaService {
    private static final Duration DURACION_CODIGO = Duration.ofMinutes(10);
    private static final Duration DURACION_AUTORIZACION = Duration.ofMinutes(10);
    private static final Duration INTERVALO_REENVIO = Duration.ofSeconds(60);
    private static final int MAXIMO_INTENTOS = 5;
    private static final SecureRandom GENERADOR_ALEATORIO = new SecureRandom();
    private final RecuperacionContrasenaRepository recuperacionContrasenaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final ServicioCorreo servicioCorreo;
    private final AuthService authService;
    private final Clock reloj;
    private final Map<String, LocalDateTime> solicitudesRecientes = new ConcurrentHashMap<>();

    public RecuperacionContrasenaService(
        RecuperacionContrasenaRepository recuperacionContrasenaRepository,
        UsuarioRepository usuarioRepository,
        PasswordEncoder passwordEncoder,
        ServicioCorreo servicioCorreo,
        AuthService authService,
        Clock reloj
    ) {
        this.recuperacionContrasenaRepository = recuperacionContrasenaRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.servicioCorreo = servicioCorreo;
        this.authService = authService;
        this.reloj = reloj;
    }

    @Transactional
    public SolicitudCodigoRecuperacionResponse solicitarRecuperacion(String email) {
        String correo = normalizarCorreo(email);
        validarServicioCorreo();
        LocalDateTime ahora = obtenerAhora();
        limpiarSolicitudesRecientes(ahora);
        int segundosMemoria = obtenerSegundosRestantes(solicitudesRecientes.get(correo), ahora);
        Optional<Usuario> usuario = usuarioRepository.findByEmailParaActualizacion(correo);

        if (usuario.isEmpty()) {
            if (segundosMemoria == 0) solicitudesRecientes.put(correo, ahora);
            return new SolicitudCodigoRecuperacionResponse(segundosMemoria == 0 ? 60 : segundosMemoria);
        }

        List<RecuperacionContrasena> recuperaciones = recuperacionContrasenaRepository.findByUsuarioIdParaActualizacion(usuario.get().getIdUsuario());
        int segundosBaseDatos = recuperaciones.stream()
            .map(RecuperacionContrasena::getFechaUltimoEnvio)
            .mapToInt(fecha -> obtenerSegundosRestantes(fecha, ahora))
            .max()
            .orElse(0);
        int segundosRestantes = Math.max(segundosMemoria, segundosBaseDatos);

        if (segundosRestantes > 0) {
            solicitudesRecientes.put(correo, obtenerUltimaFechaEnvio(recuperaciones, ahora));
            return new SolicitudCodigoRecuperacionResponse(segundosRestantes);
        }

        invalidarRecuperacionesActivas(recuperaciones);
        String codigo = generarCodigo();
        RecuperacionContrasena recuperacion = new RecuperacionContrasena();
        recuperacion.setUsuario(usuario.get());
        recuperacion.setCodigoHash(passwordEncoder.encode(codigo));
        recuperacion.setFechaSolicitud(ahora);
        recuperacion.setFechaExpiracion(ahora.plus(DURACION_CODIGO));
        recuperacion.setFechaUltimoEnvio(ahora);
        recuperacion.setIntentosFallidos(0);
        recuperacion.setUtilizado(false);
        recuperacion.setEstado(EstadoRecuperacionContrasena.PENDIENTE);
        recuperacionContrasenaRepository.save(recuperacion);
        try {
            servicioCorreo.enviarCodigoRecuperacion(correo, codigo);
        } catch (ErrorEnvioCorreoException excepcion) {
            recuperarSolicitudNoEnviada(recuperacion);
        }
        solicitudesRecientes.put(correo, ahora);
        return new SolicitudCodigoRecuperacionResponse(60);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public VerificacionCodigoRecuperacionResponse verificarCodigo(VerificarCodigoRecuperacionRequest solicitud) {
        if (solicitud == null) throw codigoIncorrecto();
        String correo = normalizarCorreo(solicitud.email());
        LocalDateTime ahora = obtenerAhora();
        Usuario usuario = usuarioRepository.findByEmailParaActualizacion(correo).orElseThrow(this::codigoIncorrecto);
        RecuperacionContrasena recuperacion = obtenerUltimaRecuperacion(usuario.getIdUsuario());

        if (recuperacion == null) throw codigoIncorrecto();
        actualizarVencimiento(recuperacion, ahora);

        if (recuperacion.getEstado() == EstadoRecuperacionContrasena.VENCIDA) {
            recuperacionContrasenaRepository.save(recuperacion);
            throw new ResponseStatusException(HttpStatus.GONE, "El código ha expirado. Solicitá uno nuevo.");
        }
        if (recuperacion.getEstado() == EstadoRecuperacionContrasena.BLOQUEADA) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Se alcanzó el máximo de intentos. Solicitá un código nuevo.");
        }
        if (recuperacion.getEstado() == EstadoRecuperacionContrasena.UTILIZADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El código ya fue utilizado. Solicitá uno nuevo.");
        }
        if (recuperacion.getEstado() != EstadoRecuperacionContrasena.PENDIENTE) throw codigoIncorrecto();

        if (!coincideCodigo(solicitud.codigo(), recuperacion.getCodigoHash())) {
            registrarIntentoFallido(recuperacion);
            recuperacionContrasenaRepository.save(recuperacion);
            if (recuperacion.getEstado() == EstadoRecuperacionContrasena.BLOQUEADA) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Se alcanzó el máximo de intentos. Solicitá un código nuevo.");
            }
            throw codigoIncorrecto();
        }

        String tokenRecuperacion = generarTokenRecuperacion();
        recuperacion.setCodigoHash(null);
        recuperacion.setTokenRecuperacionHash(passwordEncoder.encode(tokenRecuperacion));
        recuperacion.setFechaVerificacion(ahora);
        recuperacion.setFechaExpiracionAutorizacion(ahora.plus(DURACION_AUTORIZACION));
        recuperacion.setEstado(EstadoRecuperacionContrasena.VERIFICADA);
        recuperacionContrasenaRepository.save(recuperacion);
        return new VerificacionCodigoRecuperacionResponse(recuperacion.getIdSolicitud(), tokenRecuperacion);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void cambiarContrasena(CambiarContrasenaRecuperacionRequest solicitud) {
        if (solicitud == null || solicitud.idSolicitud() == null || solicitud.idSolicitud() <= 0 || esVacio(solicitud.tokenRecuperacion())) {
            throw autorizacionInvalida();
        }
        if (esVacio(solicitud.nuevaContrasena()) || esVacio(solicitud.confirmarNuevaContrasena())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá la nueva contraseña y su confirmación.");
        }
        if (!solicitud.nuevaContrasena().equals(solicitud.confirmarNuevaContrasena())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La confirmación de la contraseña no coincide.");
        }

        RecuperacionContrasena recuperacion = recuperacionContrasenaRepository.findByIdParaActualizacion(solicitud.idSolicitud())
            .orElseThrow(this::autorizacionInvalida);
        LocalDateTime ahora = obtenerAhora();
        actualizarVencimiento(recuperacion, ahora);

        if (recuperacion.getEstado() == EstadoRecuperacionContrasena.VENCIDA) {
            recuperacionContrasenaRepository.save(recuperacion);
            throw new ResponseStatusException(HttpStatus.GONE, "La autorización para cambiar la contraseña expiró. Solicitá un código nuevo.");
        }
        if (recuperacion.getEstado() != EstadoRecuperacionContrasena.VERIFICADA || recuperacion.isUtilizado()) {
            throw autorizacionInvalida();
        }
        if (!coincideToken(solicitud.tokenRecuperacion(), recuperacion.getTokenRecuperacionHash())) {
            throw autorizacionInvalida();
        }

        authService.cambiarContrasenaPorRecuperacion(recuperacion.getUsuario(), solicitud.nuevaContrasena());
        recuperacion.setTokenRecuperacionHash(null);
        recuperacion.setUtilizado(true);
        recuperacion.setEstado(EstadoRecuperacionContrasena.UTILIZADA);
        recuperacionContrasenaRepository.save(recuperacion);
    }

    public SolicitudCodigoRecuperacionResponse reenviarCodigo(String email) {
        return solicitarRecuperacion(email);
    }

    private String normalizarCorreo(String email) {
        if (email == null || email.isBlank() || !ValidadorDatos.esCorreoElectronicoValido(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo electrónico válido.");
        }
        return email.trim().toLowerCase();
    }

    private void validarServicioCorreo() {
        if (!servicioCorreo.estaDisponible()) {
            throw new ErrorEnvioCorreoException("La recuperación de contraseña no está disponible en este momento. Intentá más tarde.");
        }
    }

    private RecuperacionContrasena obtenerUltimaRecuperacion(Integer idUsuario) {
        return recuperacionContrasenaRepository.findByUsuarioIdParaActualizacion(idUsuario).stream().findFirst().orElse(null);
    }

    private void invalidarRecuperacionesActivas(List<RecuperacionContrasena> recuperaciones) {
        recuperaciones.stream()
            .filter(recuperacion -> recuperacion.getEstado() == EstadoRecuperacionContrasena.PENDIENTE || recuperacion.getEstado() == EstadoRecuperacionContrasena.VERIFICADA)
            .forEach(recuperacion -> {
                recuperacion.setCodigoHash(null);
                recuperacion.setTokenRecuperacionHash(null);
                recuperacion.setEstado(EstadoRecuperacionContrasena.INVALIDADA);
            });
        if (!recuperaciones.isEmpty()) recuperacionContrasenaRepository.saveAll(recuperaciones);
    }

    private void recuperarSolicitudNoEnviada(RecuperacionContrasena recuperacion) {
        recuperacion.setCodigoHash(null);
        recuperacion.setEstado(EstadoRecuperacionContrasena.INVALIDADA);
        recuperacionContrasenaRepository.save(recuperacion);
    }

    private LocalDateTime obtenerUltimaFechaEnvio(List<RecuperacionContrasena> recuperaciones, LocalDateTime fechaPredeterminada) {
        return recuperaciones.stream()
            .map(RecuperacionContrasena::getFechaUltimoEnvio)
            .filter(fecha -> fecha != null)
            .max(LocalDateTime::compareTo)
            .orElse(fechaPredeterminada);
    }

    private int obtenerSegundosRestantes(LocalDateTime fechaUltimoEnvio, LocalDateTime ahora) {
        if (fechaUltimoEnvio == null) return 0;
        long segundos = Duration.between(ahora, fechaUltimoEnvio.plus(INTERVALO_REENVIO)).toSeconds();
        return segundos <= 0 ? 0 : (int) Math.min(INTERVALO_REENVIO.toSeconds(), segundos + 1);
    }

    private void limpiarSolicitudesRecientes(LocalDateTime ahora) {
        solicitudesRecientes.entrySet().removeIf(entrada -> obtenerSegundosRestantes(entrada.getValue(), ahora) == 0);
    }

    private void actualizarVencimiento(RecuperacionContrasena recuperacion, LocalDateTime ahora) {
        if (recuperacion.getEstado() == EstadoRecuperacionContrasena.PENDIENTE && !estaVigente(recuperacion.getFechaExpiracion(), ahora)) {
            recuperacion.setCodigoHash(null);
            recuperacion.setEstado(EstadoRecuperacionContrasena.VENCIDA);
        }
        if (recuperacion.getEstado() == EstadoRecuperacionContrasena.VERIFICADA && !estaVigente(recuperacion.getFechaExpiracionAutorizacion(), ahora)) {
            recuperacion.setTokenRecuperacionHash(null);
            recuperacion.setEstado(EstadoRecuperacionContrasena.VENCIDA);
        }
    }

    private boolean estaVigente(LocalDateTime fechaExpiracion, LocalDateTime ahora) {
        return fechaExpiracion != null && fechaExpiracion.isAfter(ahora);
    }

    private void registrarIntentoFallido(RecuperacionContrasena recuperacion) {
        recuperacion.setIntentosFallidos(recuperacion.getIntentosFallidos() + 1);
        if (recuperacion.getIntentosFallidos() >= MAXIMO_INTENTOS) {
            recuperacion.setCodigoHash(null);
            recuperacion.setEstado(EstadoRecuperacionContrasena.BLOQUEADA);
        }
    }

    private boolean coincideCodigo(String codigo, String codigoHash) {
        if (codigo == null || !codigo.matches("\\d{6}") || codigoHash == null) return false;
        try {
            return passwordEncoder.matches(codigo, codigoHash);
        } catch (IllegalArgumentException excepcion) {
            return false;
        }
    }

    private boolean coincideToken(String token, String tokenHash) {
        if (token == null || token.isBlank() || tokenHash == null) return false;
        try {
            return passwordEncoder.matches(token, tokenHash);
        } catch (IllegalArgumentException excepcion) {
            return false;
        }
    }

    private String generarCodigo() {
        return String.valueOf(100000 + GENERADOR_ALEATORIO.nextInt(900000));
    }

    private String generarTokenRecuperacion() {
        byte[] bytes = new byte[32];
        GENERADOR_ALEATORIO.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private LocalDateTime obtenerAhora() {
        return LocalDateTime.now(reloj);
    }

    private boolean esVacio(String valor) {
        return valor == null || valor.isBlank();
    }

    private ResponseStatusException codigoIncorrecto() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código incorrecto.");
    }

    private ResponseStatusException autorizacionInvalida() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La autorización para cambiar la contraseña no es válida.");
    }
}
