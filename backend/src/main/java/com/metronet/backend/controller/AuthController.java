package com.metronet.backend.controller;

import com.metronet.backend.dto.LoginRequest;
import com.metronet.backend.dto.LoginAdministradorRequest;
import com.metronet.backend.dto.PerfilRequest;
import com.metronet.backend.dto.RegistroRequest;
import com.metronet.backend.dto.SesionAdministradorResponse;
import com.metronet.backend.dto.SesionUsuarioResponse;
import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@CrossOrigin(
    origins = {"http://127.0.0.1:5173", "http://localhost:5173"},
    allowedHeaders = "*"
)
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<SesionUsuarioResponse> iniciarSesion(@RequestBody LoginRequest solicitud) {
        return ResponseEntity.ok(authService.iniciarSesion(solicitud));
    }

    @PostMapping("/registro")
    public ResponseEntity<UsuarioResponse> registrar(@RequestBody RegistroRequest solicitud) {
        return ResponseEntity.ok(authService.registrar(solicitud));
    }

    @PostMapping("/login/admin")
    public ResponseEntity<SesionAdministradorResponse> iniciarSesionAdministrador(
        @RequestBody LoginAdministradorRequest solicitud
    ) {
        return ResponseEntity.ok(authService.iniciarSesionAdministrador(solicitud));
    }

    @PostMapping("/logout/admin")
    public ResponseEntity<Void> cerrarSesionAdministrador(
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        authService.cerrarSesionAdministrador(autorizacion);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/perfil")
    public ResponseEntity<UsuarioResponse> obtenerPerfil(
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return ResponseEntity.ok(authService.obtenerPerfil(autorizacion));
    }

    @PatchMapping("/perfil")
    public ResponseEntity<UsuarioResponse> actualizarPerfil(
        @RequestHeader(value = "Authorization", required = false) String autorizacion,
        @RequestBody PerfilRequest solicitud
    ) {
        return ResponseEntity.ok(authService.actualizarPerfil(autorizacion, solicitud));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> cerrarSesionUsuario(
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        authService.cerrarSesionUsuario(autorizacion);
        return ResponseEntity.noContent().build();
    }
}
