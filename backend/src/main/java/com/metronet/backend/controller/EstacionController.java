package com.metronet.backend.controller;

import org.springframework.web.bind.annotation.*;

import java.util.List;

import com.metronet.backend.entity.Estacion;
import com.metronet.backend.service.EstacionService;

@RestController
@RequestMapping("/estaciones")
@CrossOrigin(origins = "http://localhost:5173")
public class EstacionController {

    private final EstacionService estacionService;

    public EstacionController(EstacionService estacionService) {
        this.estacionService = estacionService;
    }

    @PostMapping
    public Estacion crearEstacion(@RequestBody Estacion estacion) {
        return estacionService.crearEstacion(estacion);
    }

    @GetMapping
    public List<Estacion> obtenerEstaciones(@RequestParam Integer idDiseno) {
        return estacionService.obtenerEstacionesPorDiseno(idDiseno);
    }

    @PutMapping
    public Estacion actualizarEstacion(@RequestBody Estacion estacion) {
        return estacionService.actualizarEstacion(estacion);
    }

    @DeleteMapping("/{idEstacion}")
    public void eliminarEstacion(@PathVariable Integer idEstacion) {
        estacionService.eliminarEstacion(idEstacion);
    }
}
