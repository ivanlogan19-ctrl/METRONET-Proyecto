package com.metronet.backend.controller;

import com.metronet.backend.dto.ActividadAdministrativaResponse;
import com.metronet.backend.service.ActividadAdministrativaService;
import com.metronet.backend.service.AuthService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/actividades")
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

    @DeleteMapping("/{idActividad}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarUna(
        @PathVariable int idActividad,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        if (!actividadAdministrativaService.borrarActividad(idActividad)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La entrada de actividad ya no existe");
        }
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarTodas(
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        actividadAdministrativaService.borrarTodasLasActividades();
    }
}
