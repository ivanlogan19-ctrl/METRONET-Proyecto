package com.metronet.backend.controller;

import com.metronet.backend.dto.ActividadAdministrativaResponse;
import com.metronet.backend.service.ActividadAdministrativaService;
import com.metronet.backend.service.AuthService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/actividades")
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class ActividadAdministrativaController {
    private final ActividadAdministrativaService actividadAdministrativaService;
    private final AuthService authService;

    public ActividadAdministrativaController(
        ActividadAdministrativaService actividadAdministrativaService,
        AuthService authService
    ) {
        this.actividadAdministrativaService = actividadAdministrativaService;
        this.authService = authService;
    }

    @GetMapping
    public List<ActividadAdministrativaResponse> listar(
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return actividadAdministrativaService.listarActividades();
    }
}
