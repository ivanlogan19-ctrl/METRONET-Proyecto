package com.metronet.backend.repository;

import com.metronet.backend.entity.Tramo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TramoRepository extends JpaRepository<Tramo, Integer> {

    List<Tramo> findByIdDisenoAndIdLinea(
        Integer idDiseno,
        Integer idLinea
    );

    boolean existsByIdDisenoAndIdEstacionAAndIdEstacionB(
        Integer idDiseno,
        Integer idEstacionA,
        Integer idEstacionB
    );
}