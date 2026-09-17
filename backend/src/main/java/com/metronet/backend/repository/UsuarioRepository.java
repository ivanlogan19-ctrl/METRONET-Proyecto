package com.metronet.backend.repository;

import com.metronet.backend.entity.Usuario;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    Optional<Usuario> findByEmailIgnoreCase(String email);

    Optional<Usuario> findByIdentificadorAdministradorIgnoreCase(String identificadorAdministrador);

    boolean existsByEmailIgnoreCase(String email);
}
