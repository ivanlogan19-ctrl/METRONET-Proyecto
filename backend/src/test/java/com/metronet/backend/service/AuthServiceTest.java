package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.RegistroRequest;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock
    private UsuarioRepository usuarioRepository;

    @Captor
    private ArgumentCaptor<Usuario> usuarioCaptor;

    @Test
    void registraLaContrasenaConHash() {
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
        AuthService authService = new AuthService(usuarioRepository, passwordEncoder);
        RegistroRequest solicitud = new RegistroRequest("Ana", "Pérez", "ana@metronet.uy", "Clave1!", true);

        when(usuarioRepository.existsByEmail("ana@metronet.uy")).thenReturn(false);
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));

        authService.registrar(solicitud);

        org.mockito.Mockito.verify(usuarioRepository).save(usuarioCaptor.capture());
        String contrasenaAlmacenada = usuarioCaptor.getValue().getPassword();
        assertNotEquals(solicitud.password(), contrasenaAlmacenada);
        assertTrue(passwordEncoder.matches(solicitud.password(), contrasenaAlmacenada));
    }
}
