package com.metronet.backend.service;

import com.metronet.backend.dto.ActualizarUsuarioRequest;
import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
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
        if (solicitud == null || esVacio(solicitud.nombre()) || esVacio(solicitud.apellido()) || esVacio(solicitud.email())) {
            throw new IllegalArgumentException("Completá nombre, apellido y correo electrónico");
        }

        Usuario usuario = usuarioRepository.findById(idUsuario).orElseThrow(() ->
            new IllegalArgumentException("No existe el usuario solicitado")
        );
        String email = solicitud.email().trim().toLowerCase();

        usuarioRepository.findByEmail(email).ifPresent(candidato -> {
            if (!candidato.getIdUsuario().equals(idUsuario)) {
                throw new IllegalArgumentException("Ya existe una cuenta con ese correo electrónico");
            }
        });

        usuario.setNombre(solicitud.nombre().trim());
        usuario.setApellido(solicitud.apellido().trim());
        usuario.setEmail(email);
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
            usuario.getRol()
        );
    }

    private boolean esVacio(String valor) {
        return valor == null || valor.isBlank();
    }
}
