package com.metronet.backend.service;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.repository.UsuarioRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class RecuperacionContrasenaServiceTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Test
    void noRegistraSolicitudParaCorreoInexistenteONoValido() {
        RecuperacionContrasenaService servicio = new RecuperacionContrasenaService(jdbcTemplate, usuarioRepository);
        when(usuarioRepository.findByEmailIgnoreCase("nadie@metronet.uy")).thenReturn(Optional.empty());

        servicio.solicitarRecuperacion("nadie@metronet.uy");
        servicio.solicitarRecuperacion("correo-invalido");

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void registraSolicitudPendienteParaCuentaExistente() {
        RecuperacionContrasenaService servicio = new RecuperacionContrasenaService(jdbcTemplate, usuarioRepository);
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(7);
        when(usuarioRepository.findByEmailIgnoreCase("ana@metronet.uy")).thenReturn(Optional.of(usuario));

        servicio.solicitarRecuperacion("Ana@METRONET.UY");

        verify(jdbcTemplate).update(contains("INSERT INTO solicitud_recuperacion_contrasena"), eq(7));
    }
}
