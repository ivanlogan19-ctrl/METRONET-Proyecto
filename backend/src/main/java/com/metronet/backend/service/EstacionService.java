package com.metronet.backend.service;

import org.springframework.stereotype.Service;

import java.util.List;

import com.metronet.backend.entity.Estacion;
import com.metronet.backend.repository.EstacionRepository;

@Service
public class EstacionService {

    private final EstacionRepository estacionRepository;

    public EstacionService(EstacionRepository estacionRepository) {
        this.estacionRepository = estacionRepository;
    }

    public Estacion crearEstacion(Estacion estacion) {
        return estacionRepository.save(estacion);
    }

    public List<Estacion> obtenerEstacionesPorDiseno(Integer idDiseno) {
        return estacionRepository.findByIdDiseno(idDiseno);
    }

    public Estacion actualizarEstacion(Estacion estacion) {
        return estacionRepository.save(estacion);
    }

    public void eliminarEstacion(Integer idEstacion) {
        estacionRepository.deleteById(idEstacion);
    }
}
