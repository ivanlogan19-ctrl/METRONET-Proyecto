package com.metronet.backend.controller;

import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ExtrasModoLibreService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/juego/aprendizaje/extras")
public class ExtrasModoLibreController {
    private final AuthService auth;
    private final ExtrasModoLibreService extras;
    public ExtrasModoLibreController(AuthService auth, ExtrasModoLibreService extras) { this.auth=auth; this.extras=extras; }
    @GetMapping public ExtrasModoLibreService.Estado consultar(@RequestHeader(value="Authorization", required=false) String token) {
        return extras.consultar(auth.obtenerUsuarioConSesion(token));
    }
    @PostMapping("/ingreso") public ExtrasModoLibreService.Estado ingresar(@RequestHeader(value="Authorization", required=false) String token) {
        return extras.ingresar(auth.obtenerUsuarioConSesion(token));
    }
    @PutMapping("/bienvenida") public ExtrasModoLibreService.Estado bienvenida(@RequestHeader(value="Authorization", required=false) String token) {
        return extras.bienvenida(auth.obtenerUsuarioConSesion(token));
    }
    @PutMapping("/tarjetas/{tarjeta}") public ExtrasModoLibreService.Estado visitar(@RequestHeader(value="Authorization", required=false) String token, @PathVariable int tarjeta) {
        return extras.visitar(auth.obtenerUsuarioConSesion(token), tarjeta);
    }
}
