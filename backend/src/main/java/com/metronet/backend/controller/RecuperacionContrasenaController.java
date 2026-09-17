package com.metronet.backend.controller;

import com.metronet.backend.dto.SolicitudRecuperacionResponse;
import com.metronet.backend.dto.SolicitudRecuperacionRequest;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ActividadAdministrativaService;
import com.metronet.backend.service.RecuperacionContrasenaService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class RecuperacionContrasenaController {
    private final AuthService authService;
    private final RecuperacionContrasenaService recuperacionContrasenaService;
    private final ActividadAdministrativaService actividadAdministrativaService;

    public RecuperacionContrasenaController(
        AuthService authService,
        RecuperacionContrasenaService recuperacionContrasenaService,
        ActividadAdministrativaService actividadAdministrativaService
    ) {
        this.authService = authService;
        this.recuperacionContrasenaService = recuperacionContrasenaService;
        this.actividadAdministrativaService = actividadAdministrativaService;
    }

    @PatchMapping("/auth/recuperar-contrasena")
    public ResponseEntity<Void> solicitar(@RequestBody SolicitudRecuperacionRequest solicitud) {
        recuperacionContrasenaService.solicitarRecuperacion(solicitud == null ? null : solicitud.email());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/admin/recuperaciones")
    public List<SolicitudRecuperacionResponse> listar(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return recuperacionContrasenaService.listarSolicitudes();
    }

    @PatchMapping("/api/admin/recuperaciones/{idSolicitud}/atendida")
    public ResponseEntity<Void> marcarAtendida(@PathVariable Integer idSolicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        Usuario administrador = authService.obtenerAdministradorAutorizado(autorizacion);
        recuperacionContrasenaService.marcarAtendida(idSolicitud);
        actividadAdministrativaService.registrarActividad(administrador, "Recuperación atendida", "Se atendió la solicitud #" + idSolicitud);
        return ResponseEntity.noContent().build();
    }
}
