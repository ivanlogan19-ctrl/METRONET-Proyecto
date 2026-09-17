package com.metronet.backend.controller;

import com.metronet.backend.dto.SolicitudRecuperacionRequest;
import com.metronet.backend.dto.SolicitudCodigoRecuperacionResponse;
import com.metronet.backend.dto.VerificarCodigoRecuperacionRequest;
import com.metronet.backend.dto.VerificacionCodigoRecuperacionResponse;
import com.metronet.backend.dto.CambiarContrasenaRecuperacionRequest;
import com.metronet.backend.service.RecuperacionContrasenaService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class RecuperacionContrasenaController {
    private final RecuperacionContrasenaService recuperacionContrasenaService;

    public RecuperacionContrasenaController(RecuperacionContrasenaService recuperacionContrasenaService) {
        this.recuperacionContrasenaService = recuperacionContrasenaService;
    }

    @PatchMapping("/auth/recuperar-contrasena")
    public ResponseEntity<SolicitudCodigoRecuperacionResponse> solicitar(@RequestBody SolicitudRecuperacionRequest solicitud) {
        SolicitudCodigoRecuperacionResponse respuesta = recuperacionContrasenaService.solicitarRecuperacion(solicitud == null ? null : solicitud.email());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(respuesta);
    }

    @PostMapping("/auth/recuperar-contrasena/reenviar-codigo")
    public ResponseEntity<SolicitudCodigoRecuperacionResponse> reenviarCodigo(@RequestBody SolicitudRecuperacionRequest solicitud) {
        SolicitudCodigoRecuperacionResponse respuesta = recuperacionContrasenaService.reenviarCodigo(solicitud == null ? null : solicitud.email());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(respuesta);
    }

    @PostMapping("/auth/recuperar-contrasena/verificar-codigo")
    public ResponseEntity<VerificacionCodigoRecuperacionResponse> verificarCodigo(@RequestBody VerificarCodigoRecuperacionRequest solicitud) {
        return ResponseEntity.ok(recuperacionContrasenaService.verificarCodigo(solicitud));
    }

    @PatchMapping("/auth/recuperar-contrasena/cambiar-contrasena")
    public ResponseEntity<Void> cambiarContrasena(@RequestBody CambiarContrasenaRecuperacionRequest solicitud) {
        recuperacionContrasenaService.cambiarContrasena(solicitud);
        return ResponseEntity.noContent().build();
    }

}
