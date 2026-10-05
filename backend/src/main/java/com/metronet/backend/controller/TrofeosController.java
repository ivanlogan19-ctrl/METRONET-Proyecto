package com.metronet.backend.controller;

import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.TrofeosService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/juego/trofeos")
public class TrofeosController {
    private final AuthService auth;
    private final TrofeosService trofeos;

    public TrofeosController(AuthService auth, TrofeosService trofeos) {
        this.auth = auth;
        this.trofeos = trofeos;
    }

    @GetMapping
    public List<TrofeosService.Trofeo> consultar(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return trofeos.consultar(auth.obtenerUsuarioConSesion(autorizacion));
    }
}
