package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarCorreoPerfilRequest;
import com.metronet.backend.dto.ActualizarDatosPersonalesRequest;
import com.metronet.backend.dto.CambioContrasenaRequest;
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
import com.metronet.backend.utilidades.ValidadorDatos;
import com.metronet.backend.utilidades.LimiteSolicitudes;
import com.metronet.backend.utilidades.PoliticaContrasena;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Clock;
import java.util.Locale;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(AuthService.class);
    private static final Duration DURACION_SESION = Duration.ofHours(8);
    private static final SecureRandom GENERADOR_TOKENS = new SecureRandom();
    private static final String HASH_INEXISTENTE = new BCryptPasswordEncoder().encode("Cuenta no disponible " + GENERADOR_TOKENS.nextLong());
    private final Clock reloj;
    private final LimiteSolicitudes intentos;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final Map<String, SesionActiva> sesionesUsuario = new ConcurrentHashMap<>();
    private final Map<String, SesionActiva> sesionesAdministrador = new ConcurrentHashMap<>();

    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this(usuarioRepository, passwordEncoder, Clock.systemUTC());
    }

    @Autowired
    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder, Clock reloj) {
        this.reloj = reloj;
        this.intentos = new LimiteSolicitudes(reloj, 6, Duration.ofMinutes(15));
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public SesionUsuarioResponse iniciarSesion(LoginRequest solicitud) {
        Usuario usuario = obtenerUsuarioPorEmailYContrasena(solicitud);

        if (usuario.getRol() == Rol.ADMIN) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Los administradores deben ingresar desde el acceso de administración"
            );
        }

        return crearSesionUsuario(usuario);
    }

    public UsuarioResponse registrar(RegistroRequest solicitud) {
        if (solicitud == null || esVacio(solicitud.nombre()) || esVacio(solicitud.apellido()) || esVacio(solicitud.email()) || esVacio(solicitud.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá todos los campos");
        }

        if (!solicitud.aceptaDatos()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Debés aceptar el uso de datos para crear la cuenta"
            );
        }

        String email = solicitud.email().trim().toLowerCase(Locale.ROOT);

        if (!ValidadorDatos.esCorreoElectronicoValido(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo electrónico válido");
        }

        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un usuario con ese email");
        }

        Usuario usuario = new Usuario();
        validarNombre(solicitud.nombre(), solicitud.apellido());
        usuario.setNombre(solicitud.nombre().trim());
        usuario.setApellido(solicitud.apellido().trim());
        usuario.setEmail(email);
        validarContrasena(solicitud.password());
        usuario.setPassword(passwordEncoder.encode(solicitud.password()));
        usuario.setRol(Rol.JUGADOR);
        usuario.setAceptaDatos(true);
        usuario.setFechaConsentimiento(LocalDateTime.now());

        return convertirARespuesta(usuarioRepository.save(usuario));
    }

    public SesionAdministradorResponse iniciarSesionAdministrador(LoginAdministradorRequest solicitud) {
        Usuario usuario = obtenerAdministradorPorUsuarioYContrasena(solicitud);

        if (usuario.getRol() != Rol.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Esta cuenta no tiene permisos de administrador");
        }

        String token = crearSesion(sesionesAdministrador, usuario);

        return new SesionAdministradorResponse(convertirARespuesta(usuario), token);
    }

    public Usuario obtenerAdministradorAutorizado(String autorizacion) {
        return obtenerSesion(sesionesAdministrador, autorizacion);
    }

    public void cerrarSesionAdministrador(String autorizacion) {
        if (autorizacion != null && autorizacion.startsWith("Bearer ")) {
            sesionesAdministrador.remove(autorizacion.substring(7).trim());
        }
    }

    public PerfilUsuarioResponse obtenerPerfil(String autorizacion) {
        return convertirAPerfil(obtenerUsuarioConSesion(autorizacion));
    }

    public PerfilUsuarioResponse actualizarDatosPersonales(
        String autorizacion,
        ActualizarDatosPersonalesRequest solicitud
    ) {
        if (solicitud == null || esVacio(solicitud.nombre()) || esVacio(solicitud.apellido())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá nombre y apellido");
        }

        Usuario usuario = obtenerUsuarioConSesion(autorizacion);
        validarNombre(solicitud.nombre(), solicitud.apellido());
        usuario.setNombre(solicitud.nombre().trim());
        usuario.setApellido(solicitud.apellido().trim());
        return convertirAPerfil(usuarioRepository.save(usuario));
    }

    public PerfilUsuarioResponse actualizarCorreoPerfil(
        String autorizacion,
        ActualizarCorreoPerfilRequest solicitud
    ) {
        if (solicitud == null || esVacio(solicitud.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo electrónico");
        }

        Usuario usuario = obtenerUsuarioConSesion(autorizacion);
        String email = solicitud.email().trim().toLowerCase(Locale.ROOT);

        if (!ValidadorDatos.esCorreoElectronicoValido(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo electrónico válido");
        }

        usuarioRepository.findByEmailIgnoreCase(email).ifPresent(candidato -> {
            if (!candidato.getIdUsuario().equals(usuario.getIdUsuario())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una cuenta con ese correo");
            }
        });

        usuario.setEmail(email);
        return convertirAPerfil(usuarioRepository.save(usuario));
    }

    public void cambiarContrasena(String autorizacion, CambioContrasenaRequest solicitud) {
        if (
            solicitud == null
            || esVacio(solicitud.contrasenaActual())
            || esVacio(solicitud.nuevaContrasena())
            || esVacio(solicitud.confirmarNuevaContrasena())
        ) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá todos los campos de contraseña");
        }

        if (!solicitud.nuevaContrasena().equals(solicitud.confirmarNuevaContrasena())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La confirmación de la contraseña no coincide");
        }

        Usuario usuario = obtenerUsuarioConSesion(autorizacion);

        if (!coincideContrasena(usuario, solicitud.contrasenaActual())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La contraseña actual no es correcta");
        }

        validarContrasena(solicitud.nuevaContrasena());
        usuario.setPassword(passwordEncoder.encode(solicitud.nuevaContrasena()));
        usuarioRepository.save(usuario);
        invalidarSesionesDeUsuario(usuario.getIdUsuario());
    }

    public void cambiarContrasenaPorRecuperacion(Usuario usuario, String nuevaContrasena) {
        if (usuario == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La autorización para cambiar la contraseña no es válida.");
        }
        validarContrasena(nuevaContrasena);
        usuario.setPassword(passwordEncoder.encode(nuevaContrasena));
        usuarioRepository.save(usuario);
        invalidarSesionesDeUsuario(usuario.getIdUsuario());
    }

    public void cerrarSesionUsuario(String autorizacion) {
        if (autorizacion != null && autorizacion.startsWith("Bearer ")) {
            sesionesUsuario.remove(autorizacion.substring(7).trim());
        }
    }

    private void validarCredenciales(LoginRequest solicitud) {
        if (solicitud == null || esVacio(solicitud.email()) || esVacio(solicitud.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá email y contraseña");
        }

        if (!ValidadorDatos.esCorreoElectronicoValido(solicitud.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo electrónico válido");
        }
    }

    private Usuario obtenerUsuarioPorEmailYContrasena(LoginRequest solicitud) {
        validarCredenciales(solicitud);

        return autenticar("jugador:" + solicitud.email().trim().toLowerCase(Locale.ROOT),
            solicitud.password(), () -> usuarioRepository.findByEmailIgnoreCase(solicitud.email().trim()),
            "Email o contraseña incorrectos");
    }

    private Usuario obtenerAdministradorPorUsuarioYContrasena(LoginAdministradorRequest solicitud) {
        if (solicitud == null || esVacio(solicitud.usuario()) || esVacio(solicitud.password()) || solicitud.usuario().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá usuario y contraseña válidos");
        }
        return autenticar("admin:" + solicitud.usuario().trim().toLowerCase(Locale.ROOT),
            solicitud.password(), () -> usuarioRepository.findByIdentificadorAdministradorIgnoreCase(solicitud.usuario().trim()),
            "Usuario o contraseña incorrectos");
    }

    private Usuario autenticar(String clave, String password, java.util.function.Supplier<java.util.Optional<Usuario>> buscar, String mensaje) {
        intentos.registrar(clave);
        Usuario usuario = buscar.get().orElse(null);
        if (usuario == null) {
            if (PoliticaContrasena.admiteBCrypt(password)) passwordEncoder.matches(password, HASH_INEXISTENTE);
        } else if (coincideContrasena(usuario, password)) {
            intentos.limpiar(clave);
            return usuario;
        }
        LOG.warn("seguridad: acceso rechazado ({})", clave.startsWith("admin:") ? "ADMIN" : "JUGADOR");
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, mensaje);
    }

    private SesionUsuarioResponse crearSesionUsuario(Usuario usuario) {
        String token = crearSesion(sesionesUsuario, usuario);

        return new SesionUsuarioResponse(convertirARespuesta(usuario), token);
    }

    public Usuario obtenerUsuarioAutorizado(String autorizacion) {
        return obtenerSesion(sesionesUsuario, autorizacion);
    }

    public Usuario obtenerUsuarioConSesion(String autorizacion) {
        String token = extraerToken(autorizacion);
        return obtenerSesion(sesionesAdministrador.containsKey(token) ? sesionesAdministrador : sesionesUsuario, autorizacion);
    }

    private String extraerToken(String autorizacion) {
        if (autorizacion == null || !autorizacion.startsWith("Bearer ")) throw sesionInvalida();
        String token = autorizacion.substring(7).trim();
        if (!token.matches("[A-Za-z0-9_-]{43}")) throw sesionInvalida();
        return token;
    }

    private Usuario obtenerSesion(Map<String, SesionActiva> sesiones, String autorizacion) {
        String token = extraerToken(autorizacion);
        SesionActiva sesion = sesiones.get(token);
        if (sesion == null) throw sesionInvalida();
        if (!sesion.fechaVencimiento().isAfter(LocalDateTime.now(reloj))) {
            sesiones.remove(token);
            throw sesionInvalida();
        }
        Usuario usuario = usuarioRepository.findById(sesion.idUsuario()).orElse(null);
        if (usuario == null || usuario.getRol() != sesion.rol()) {
            sesiones.remove(token);
            throw sesionInvalida();
        }
        return usuario;
    }

    private ResponseStatusException sesionInvalida() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión venció o no es válida");
    }

    public void invalidarSesionesDeUsuario(Integer idUsuario) {
        sesionesUsuario.entrySet().removeIf(entrada -> entrada.getValue().idUsuario().equals(idUsuario));
        sesionesAdministrador.entrySet().removeIf(entrada -> entrada.getValue().idUsuario().equals(idUsuario));
    }

    private String crearSesion(Map<String, SesionActiva> sesiones, Usuario usuario) {
        LocalDateTime ahora = LocalDateTime.now(reloj);
        sesionesUsuario.values().removeIf(sesion -> !sesion.fechaVencimiento().isAfter(ahora));
        sesionesAdministrador.values().removeIf(sesion -> !sesion.fechaVencimiento().isAfter(ahora));
        String token = generarToken();
        sesiones.put(token, new SesionActiva(usuario.getIdUsuario(), usuario.getRol(), ahora.plus(DURACION_SESION)));
        return token;
    }

    private String generarToken() {
        byte[] bytes = new byte[32];
        GENERADOR_TOKENS.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void validarNombre(String nombre, String apellido) {
        if (nombre.length() > 100 || apellido.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre y apellido admiten hasta 100 caracteres cada uno");
        }
    }

    private boolean esVacio(String valor) {
        return valor == null || valor.isBlank();
    }

    private boolean coincideContrasena(Usuario usuario, String contrasena) {
        if (!PoliticaContrasena.admiteBCrypt(contrasena)) return false;
        try {
            return passwordEncoder.matches(contrasena, usuario.getPassword());
        } catch (IllegalArgumentException excepcion) { return false; }
    }

    private void validarContrasena(String contrasena) {
        if (!PoliticaContrasena.esValida(contrasena)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, PoliticaContrasena.MENSAJE);
        }
    }

    private UsuarioResponse convertirARespuesta(Usuario usuario) {
        return new UsuarioResponse(
            usuario.getIdUsuario(),
            usuario.getNombre(),
            usuario.getApellido(),
            usuario.getEmail(),
            usuario.getRol(),
            usuario.getIdentificadorAdministrador()
        );
    }

    private PerfilUsuarioResponse convertirAPerfil(Usuario usuario) {
        return new PerfilUsuarioResponse(
            usuario.getNombre(),
            usuario.getApellido(),
            usuario.getEmail(),
            usuario.getRol(),
            usuario.getFechaCreacion()
        );
    }

    private record SesionActiva(Integer idUsuario, Rol rol, LocalDateTime fechaVencimiento) {}
}
