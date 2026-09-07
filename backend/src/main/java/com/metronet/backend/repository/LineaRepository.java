package com.metronet.backend.repository;

import com.metronet.backend.entity.Linea;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LineaRepository extends JpaRepository<Linea, Integer> {

    boolean existsByIdDisenoAndNombre(Integer idDiseno, String nombre);
    
    List<Linea> findByIdDiseno(Integer idDiseno);
    
}