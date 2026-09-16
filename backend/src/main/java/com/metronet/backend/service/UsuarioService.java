package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarUsuarioRequest;
import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import com.metronet.backend.utilidades.ValidadorDatos;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UsuarioResponse> listarUsuarios() {
        return usuarioRepository.findAll().stream().map(this::convertirARespuesta).toList();
    }

    public UsuarioResponse actualizarRol(Integer idUsuario, Rol rol) {
        if (rol == null) {
            throw new IllegalArgumentException("Seleccioná un rol válido");
        }

        Usuario usuario = usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new IllegalArgumentException("No existe el usuario solicitado")
        );

        usuario.setRol(rol);
        return convertirARespuesta(usuarioRepository.save(usuario));
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

        usuarioRepository.findByEmail(email).ifPresent(candidato -> {
            if (!candidato.getIdUsuario().equals(idUsuario)) {
                throw new IllegalArgumentException("Ya existe una cuenta con ese correo electrónico");
            }
        });

        usuario.setNombre(solicitud.nombre().trim());
        usuario.setApellido(solicitud.apellido() == null ? null : solicitud.apellido().trim());
        usuario.setEmail(email);

        if (usuario.getRol() == Rol.ADMIN) {
            if (esVacio(solicitud.identificadorAdministrador())) {
                throw new IllegalArgumentException("Completá el identificador de administrador");
            }

            String identificador = solicitud.identificadorAdministrador().trim();
            usuarioRepository.findByIdentificadorAdministradorIgnoreCase(identificador).ifPresent(candidato -> {
                if (!candidato.getIdUsuario().equals(idUsuario)) {
                    throw new IllegalArgumentException("Ya existe un administrador con ese identificador");
                }
            });
            usuario.setIdentificadorAdministrador(identificador);
        }

        if (!esVacio(solicitud.nuevaContrasena())) {
            validarContrasena(solicitud.nuevaContrasena());
            usuario.setPassword(passwordEncoder.encode(solicitud.nuevaContrasena()));
        }
        return convertirARespuesta(usuarioRepository.save(usuario));
    }

    public void eliminarUsuario(Integer idUsuario) {
        Usuario usuario = usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new IllegalArgumentException("No existe el usuario solicitado")
        );

        usuarioRepository.delete(usuario);
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
