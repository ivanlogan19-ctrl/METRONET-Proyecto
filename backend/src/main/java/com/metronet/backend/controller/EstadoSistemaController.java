package com.metronet.backend.controller;

import com.metronet.backend.service.ConfiguracionService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/estado")
public class EstadoSistemaController {
    private final ConfiguracionService configuracionService;

    public EstadoSistemaController(ConfiguracionService configuracionService) {
        this.configuracionService = configuracionService;
    }

    @GetMapping
    public Map<String, Boolean> consultar() {
        return Map.of("mantenimiento", configuracionService.estaModoMantenimientoActivo());
    }
}
