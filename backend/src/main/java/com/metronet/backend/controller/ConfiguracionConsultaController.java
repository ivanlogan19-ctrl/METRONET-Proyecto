package com.metronet.backend.controller;

import com.metronet.backend.dto.ConfiguracionResponse;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ConfiguracionService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/configuraciones")
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class ConfiguracionConsultaController {
    private final AuthService authService;
    private final ConfiguracionService configuracionService;

    public ConfiguracionConsultaController(AuthService authService, ConfiguracionService configuracionService) {
        this.authService = authService;
        this.configuracionService = configuracionService;
    }

    @GetMapping
    public List<ConfiguracionResponse> listar(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerUsuarioConSesion(autorizacion);
        return configuracionService.listarConfiguraciones();
    }
}
