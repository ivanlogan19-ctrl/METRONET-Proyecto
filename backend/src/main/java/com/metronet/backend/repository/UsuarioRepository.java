package com.metronet.backend.repository;

import com.metronet.backend.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {

    Usuario findByEmail(String email);
    boolean existsByEmail(String email);

}