package com.metronet.backend.repository;

import com.metronet.backend.entity.RecuperacionContrasena;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecuperacionContrasenaRepository extends JpaRepository<RecuperacionContrasena, Integer> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RecuperacionContrasena r JOIN FETCH r.usuario WHERE r.idSolicitud = :idSolicitud")
    Optional<RecuperacionContrasena> findByIdParaActualizacion(@Param("idSolicitud") Integer idSolicitud);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RecuperacionContrasena r JOIN FETCH r.usuario WHERE r.usuario.idUsuario = :idUsuario ORDER BY r.fechaSolicitud DESC")
    List<RecuperacionContrasena> findByUsuarioIdParaActualizacion(@Param("idUsuario") Integer idUsuario);
}
