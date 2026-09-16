package com.metronet.backend.service;

import com.metronet.backend.dto.LoginRequest;
import com.metronet.backend.dto.LoginAdministradorRequest;
import com.metronet.backend.dto.CambioContrasenaRequest;
import com.metronet.backend.dto.PerfilRequest;
import com.metronet.backend.dto.RegistroRequest;
import com.metronet.backend.dto.SesionAdministradorResponse;
import com.metronet.backend.dto.SesionUsuarioResponse;
import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import com.metronet.backend.utilidades.ValidadorDatos;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final Map<String, Integer> sesionesUsuario = new ConcurrentHashMap<>();
    private final Map<String, Integer> sesionesAdministrador = new ConcurrentHashMap<>();

    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
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

        String email = solicitud.email().trim().toLowerCase();

        if (!ValidadorDatos.esCorreoElectronicoValido(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo electrónico válido");
        }

        if (usuarioRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un usuario con ese email");
        }

        Usuario usuario = new Usuario();
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

        String token = UUID.randomUUID().toString();
        sesionesAdministrador.put(token, usuario.getIdUsuario());

        return new SesionAdministradorResponse(convertirARespuesta(usuario), token);
    }

    public Usuario obtenerAdministradorAutorizado(String autorizacion) {
        if (autorizacion == null || !autorizacion.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión de administrador no es válida");
        }

        String token = autorizacion.substring(7).trim();
        Integer idUsuario = sesionesAdministrador.get(token);

        if (idUsuario == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión de administrador venció o no es válida");
        }

        Usuario administrador = usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión de administrador no es válida")
        );

        if (administrador.getRol() != Rol.ADMIN) {
            sesionesAdministrador.remove(token);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Esta cuenta ya no tiene permisos de administrador");
        }

        return administrador;
    }

    public void cerrarSesionAdministrador(String autorizacion) {
        if (autorizacion != null && autorizacion.startsWith("Bearer ")) {
            sesionesAdministrador.remove(autorizacion.substring(7).trim());
        }
    }

    public UsuarioResponse obtenerPerfil(String autorizacion) {
        return convertirARespuesta(obtenerUsuarioAutorizado(autorizacion));
    }

    public UsuarioResponse actualizarPerfil(String autorizacion, PerfilRequest solicitud) {
        if (solicitud == null || esVacio(solicitud.nombre()) || esVacio(solicitud.apellido()) || esVacio(solicitud.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá nombre, apellido y correo electrónico");
        }

        Usuario usuario = obtenerUsuarioAutorizado(autorizacion);
        String email = solicitud.email().trim().toLowerCase();

        if (!ValidadorDatos.esCorreoElectronicoValido(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un correo electrónico válido");
        }

        usuarioRepository.findByEmail(email).ifPresent(candidato -> {
            if (!candidato.getIdUsuario().equals(usuario.getIdUsuario())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una cuenta con ese correo");
            }
        });

        usuario.setNombre(solicitud.nombre().trim());
        usuario.setApellido(solicitud.apellido().trim());
        usuario.setEmail(email);

        return convertirARespuesta(usuarioRepository.save(usuario));
    }

    public void cambiarContrasena(String autorizacion, CambioContrasenaRequest solicitud) {
        if (solicitud == null || esVacio(solicitud.contrasenaActual()) || esVacio(solicitud.nuevaContrasena())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá la contraseña actual y la nueva");
        }

        Usuario usuario = obtenerUsuarioAutorizado(autorizacion);

        if (!coincideContrasena(usuario, solicitud.contrasenaActual())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La contraseña actual no es correcta");
        }

        validarContrasena(solicitud.nuevaContrasena());
        usuario.setPassword(passwordEncoder.encode(solicitud.nuevaContrasena()));
        usuarioRepository.save(usuario);
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
    }

    private Usuario obtenerUsuarioPorEmailYContrasena(LoginRequest solicitud) {
        validarCredenciales(solicitud);

        return usuarioRepository
            .findByEmailIgnoreCase(solicitud.email().trim())
            .filter(candidato -> coincideContrasena(candidato, solicitud.password()))
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Email o contraseña incorrectos"
            ));
    }

    private Usuario obtenerAdministradorPorUsuarioYContrasena(LoginAdministradorRequest solicitud) {
        if (solicitud == null || esVacio(solicitud.usuario()) || esVacio(solicitud.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completá usuario y contraseña");
        }

        return usuarioRepository
            .findByIdentificadorAdministradorIgnoreCase(solicitud.usuario().trim())
            .or(() -> usuarioRepository.findByNombreIgnoreCase(solicitud.usuario().trim()))
            .filter(candidato -> coincideContrasena(candidato, solicitud.password()))
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Usuario o contraseña incorrectos"
            ));
    }

    private SesionUsuarioResponse crearSesionUsuario(Usuario usuario) {
        String token = UUID.randomUUID().toString();
        sesionesUsuario.put(token, usuario.getIdUsuario());

        return new SesionUsuarioResponse(convertirARespuesta(usuario), token);
    }

    public Usuario obtenerUsuarioAutorizado(String autorizacion) {
        if (autorizacion == null || !autorizacion.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión no es válida");
        }

        Integer idUsuario = sesionesUsuario.get(autorizacion.substring(7).trim());

        if (idUsuario == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión venció o no es válida");
        }

        return usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión no es válida")
        );
    }

    public Usuario obtenerUsuarioConSesion(String autorizacion) {
        if (autorizacion == null || !autorizacion.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión no es válida");
        }

        String token = autorizacion.substring(7).trim();
        Integer idUsuario = sesionesUsuario.get(token);

        if (idUsuario == null) {
            idUsuario = sesionesAdministrador.get(token);
        }

        if (idUsuario == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión venció o no es válida");
        }

        Integer identificadorUsuario = idUsuario;
        return usuarioRepository.findById(identificadorUsuario).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión no es válida")
        );
    }

    private boolean esVacio(String valor) {
        return valor == null || valor.isBlank();
    }

    private boolean coincideContrasena(Usuario usuario, String contrasena) {
        String contrasenaAlmacenada = usuario.getPassword();

        if (esHashBCrypt(contrasenaAlmacenada)) {
            try {
                return passwordEncoder.matches(contrasena, contrasenaAlmacenada);
            } catch (IllegalArgumentException excepcion) {
                return false;
            }
        }

        if (!contrasenaAlmacenada.equals(contrasena)) {
            return false;
        }

        usuario.setPassword(passwordEncoder.encode(contrasena));
        usuarioRepository.save(usuario);
        return true;
    }

    private boolean esHashBCrypt(String valor) {
        return valor != null && valor.matches("^\\$2[aby]\\$\\d{2}\\$.*");
    }

    private void validarContrasena(String contrasena) {
        boolean esValida = contrasena != null
            && contrasena.length() >= 6
            && contrasena.matches(".*[A-Z].*")
            && contrasena.matches(".*[^A-Za-z0-9].*");

        if (!esValida) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "La contraseña debe tener al menos 6 caracteres, una mayúscula y un carácter especial"
            );
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
}
