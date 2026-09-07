package com.metronet.backend.repository;

import com.metronet.backend.entity.Tramo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TramoRepository extends JpaRepository<Tramo, Integer> {

    List<Tramo> findByIdDisenoAndNombreLinea(
        Integer idDiseno,
        String nombreLinea
    );

    boolean existsByIdDisenoAndEstacionAAndEstacionB(
        Integer idDiseno,
        String estacionA,
        String estacionB
    );
}