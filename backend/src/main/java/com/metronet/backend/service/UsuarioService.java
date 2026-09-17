package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarUsuarioRequest;
import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import com.metronet.backend.utilidades.ValidadorDatos;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UsuarioService {
    private static final int LONGITUD_MAXIMA_IDENTIFICADOR_ADMINISTRADOR = 100;

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final JdbcTemplate jdbcTemplate;

    public UsuarioService(
        UsuarioRepository usuarioRepository,
        PasswordEncoder passwordEncoder,
        AuthService authService,
        JdbcTemplate jdbcTemplate
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<UsuarioResponse> listarUsuarios() {
        return usuarioRepository.findAll().stream().map(this::convertirARespuesta).toList();
    }

    @Transactional
    public UsuarioResponse actualizarRol(Integer idUsuario, Rol rol) {
        if (rol == null) {
            throw new IllegalArgumentException("Seleccioná un rol válido");
        }

        Usuario usuario = usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new IllegalArgumentException("No existe el usuario solicitado")
        );

        Rol rolAnterior = usuario.getRol();
        usuario.setRol(rol);
        if (rol == Rol.ADMIN) {
            asignarIdentificadorAdministrador(usuario, usuario.getIdentificadorAdministrador());
        } else {
            usuario.setIdentificadorAdministrador(null);
        }
        UsuarioResponse respuesta = convertirARespuesta(usuarioRepository.save(usuario));

        if (rolAnterior != rol) {
            authService.invalidarSesionesDeUsuario(idUsuario);
        }

        return respuesta;
    }

    public UsuarioResponse actualizarUsuario(Integer idUsuario, ActualizarUsuarioRequest solicitud) {
        if (solicitud == null || esVacio(solicitud.nombre()) || esVacio(solicitud.email())) {
            throw new IllegalArgumentException("Completá nombre y correo electrónico");
        }

        Usuario usuario = usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new IllegalArgumentException("No existe el usuario solicitado")
        );
        String email = solicitud.email().trim().toLowerCase();

        if (!ValidadorDatos.esCorreoElectronicoValido(email)) {
            throw new IllegalArgumentException("Ingresá un correo electrónico válido");
        }

        usuarioRepository.findByEmailIgnoreCase(email).ifPresent(candidato -> {
            if (!candidato.getIdUsuario().equals(idUsuario)) {
                throw new IllegalArgumentException("Ya existe una cuenta con ese correo electrónico");
            }
        });

        usuario.setNombre(solicitud.nombre().trim());
        usuario.setApellido(solicitud.apellido() == null ? null : solicitud.apellido().trim());
        usuario.setEmail(email);

        if (usuario.getRol() == Rol.ADMIN) asignarIdentificadorAdministrador(usuario, solicitud.identificadorAdministrador());
        else usuario.setIdentificadorAdministrador(null);

        boolean cambioContrasena = !esVacio(solicitud.nuevaContrasena());

        if (cambioContrasena) {
            validarContrasena(solicitud.nuevaContrasena());
            usuario.setPassword(passwordEncoder.encode(solicitud.nuevaContrasena()));
        }
        UsuarioResponse respuesta = convertirARespuesta(usuarioRepository.save(usuario));

        if (cambioContrasena) {
            authService.invalidarSesionesDeUsuario(idUsuario);
        }

        return respuesta;
    }

    @Transactional
    public void eliminarUsuario(Integer idUsuario) {
        Usuario usuario = usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new IllegalArgumentException("No existe el usuario solicitado")
        );

        List<Integer> escenariosNoProgresivos = obtenerEscenariosNoProgresivosRelacionados(idUsuario);
        jdbcTemplate.update("DELETE FROM actividad_administrativa WHERE id_administrador = ?", idUsuario);
        jdbcTemplate.update("""
            DELETE FROM diseno
            WHERE id_diseno IN (
                SELECT id_diseno FROM intento WHERE id_usuario = ?
            )
            """, idUsuario);
        eliminarEscenariosSinIntentos(escenariosNoProgresivos);
        authService.invalidarSesionesDeUsuario(idUsuario);
        usuarioRepository.delete(usuario);
    }

    private List<Integer> obtenerEscenariosNoProgresivosRelacionados(Integer idUsuario) {
        return jdbcTemplate.query("""
            SELECT DISTINCT e.id_escenario
            FROM escenario e
            WHERE COALESCE(e.progresivo, FALSE) = FALSE
              AND (
                  e.id_diseno_base IN (
                      SELECT i.id_diseno FROM intento i WHERE i.id_usuario = ?
                  )
                  OR e.id_escenario IN (
                      SELECT i.id_escenario FROM intento i WHERE i.id_usuario = ?
                  )
              )
            """, (resultado, fila) -> resultado.getInt("id_escenario"), idUsuario, idUsuario);
    }

    private void eliminarEscenariosSinIntentos(List<Integer> idsEscenario) {
        for (Integer idEscenario : idsEscenario) {
            jdbcTemplate.update("""
                DELETE FROM escenario
                WHERE id_escenario = ?
                  AND COALESCE(progresivo, FALSE) = FALSE
                  AND NOT EXISTS (
                      SELECT 1 FROM intento WHERE id_escenario = ?
                  )
                """, idEscenario, idEscenario);
        }
    }

    private void asignarIdentificadorAdministrador(Usuario usuario, String identificadorSolicitado) {
        String identificador = esVacio(identificadorSolicitado)
            ? "administrador-" + usuario.getIdUsuario()
            : identificadorSolicitado.trim();
        if (identificador.length() > LONGITUD_MAXIMA_IDENTIFICADOR_ADMINISTRADOR) {
            throw new IllegalArgumentException("El identificador de administrador no puede superar los 100 caracteres");
        }
        usuarioRepository.findByIdentificadorAdministradorIgnoreCase(identificador).ifPresent(candidato -> {
            if (!candidato.getIdUsuario().equals(usuario.getIdUsuario())) {
                throw new IllegalArgumentException("Ya existe un administrador con ese identificador");
            }
        });
        usuario.setIdentificadorAdministrador(identificador);
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

    private boolean esVacio(String valor) {
        return valor == null || valor.isBlank();
    }

    private void validarContrasena(String contrasena) {
        boolean esValida = contrasena.length() >= 6
            && contrasena.matches(".*[A-Z].*")
            && contrasena.matches(".*[^A-Za-z0-9].*");

        if (!esValida) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres, una mayúscula y un carácter especial");
        }
    }
}
