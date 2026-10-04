package com.metronet.backend.controller;

import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ContenidoPublicadoNivelService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/juego")
public class ContenidoPublicadoNivelController {
    private final AuthService auth;
    private final ContenidoPublicadoNivelService contenido;

    public ContenidoPublicadoNivelController(AuthService auth,ContenidoPublicadoNivelService contenido) {
        this.auth=auth; this.contenido=contenido;
    }

    @GetMapping("/niveles/{numero}/contenido")
    public ContenidoPublicadoNivelService.Contenido actual(@PathVariable int numero,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        auth.obtenerUsuarioConSesion(autorizacion);
        return contenido.actual(numero);
    }

    @GetMapping("/intentos/{idIntento}/contenido")
    public ContenidoPublicadoNivelService.Contenido deIntento(@PathVariable int idIntento,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        var usuario=auth.obtenerUsuarioConSesion(autorizacion);
        return contenido.deIntento(idIntento,usuario.getIdUsuario());
    }
}
