package com.metronet.backend.configuracion;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.repository.UsuarioRepository;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile("!test")
public class MigradorContrasenasLegadas {
    @Bean
    CommandLineRunner migrarContrasenasLegadas(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        return argumentos -> {
            List<Usuario> usuariosLegados = usuarioRepository.findAll().stream()
                .filter(usuario -> esContrasenaLegada(usuario.getPassword()))
                .toList();
            usuariosLegados.forEach(usuario -> actualizarContrasena(usuario, passwordEncoder));
            usuarioRepository.saveAll(usuariosLegados);
        };
    }

    private void actualizarContrasena(Usuario usuario, PasswordEncoder passwordEncoder) {
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
    }

    private boolean esHashBCrypt(String contrasena) {
        return contrasena != null && contrasena.matches("^\\$2[aby]\\$\\d{2}\\$.*");
    }

    private boolean esContrasenaLegada(String contrasena) {
        return contrasena != null && !contrasena.isBlank() && !esHashBCrypt(contrasena);
    }
}
