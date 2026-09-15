package com.metronet.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

import com.metronet.backend.entity.Estacion;

public interface EstacionRepository extends JpaRepository<Estacion, Integer> {

    List<Estacion> findByIdDiseno(Integer idDiseno);

    boolean existsByIdDisenoAndNombre(Integer idDiseno, String nombre);

    Optional<Estacion> findByIdDisenoAndNombre(
        Integer idDiseno,
        String nombre
)   ;
}