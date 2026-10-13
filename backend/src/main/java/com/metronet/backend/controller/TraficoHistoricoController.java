package com.metronet.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.metronet.backend.service.TraficoHistoricoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TraficoHistoricoController {
    private final TraficoHistoricoService servicio;
    public TraficoHistoricoController(TraficoHistoricoService servicio) { this.servicio = servicio; }

    @GetMapping("/api/trafico/historico")
    public JsonNode consultar() { return servicio.consultar(); }
}
