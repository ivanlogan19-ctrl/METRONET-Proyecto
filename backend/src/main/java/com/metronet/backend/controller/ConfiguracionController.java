package com.metronet.backend.controller;

import com.metronet.backend.dto.ActualizarConfiguracionRequest;
import com.metronet.backend.dto.ConfiguracionResponse;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ConfiguracionService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/configuracion")
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class ConfiguracionController {
    private final AuthService authService;
    private final ConfiguracionService configuracionService;

    public ConfiguracionController(AuthService authService, ConfiguracionService configuracionService) {
        this.authService = authService;
        this.configuracionService = configuracionService;
    }

    @GetMapping
    public List<ConfiguracionResponse> listar(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return configuracionService.listarConfiguraciones();
    }

    @PatchMapping("/{clave}")
    public ConfiguracionResponse actualizar(@PathVariable String clave, @RequestBody ActualizarConfiguracionRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return configuracionService.actualizarConfiguracion(clave, solicitud);
    }
}
