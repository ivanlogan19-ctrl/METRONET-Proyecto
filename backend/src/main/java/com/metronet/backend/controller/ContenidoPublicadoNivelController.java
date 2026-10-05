package com.metronet.backend.controller;

import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ContenidoPublicadoNivelService;
import com.metronet.backend.service.JuegoEducativoService;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
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
    private final JuegoEducativoService juego;

    public ContenidoPublicadoNivelController(AuthService auth,ContenidoPublicadoNivelService contenido,JuegoEducativoService juego) {
        this.auth=auth; this.contenido=contenido; this.juego=juego;
    }

    @GetMapping("/niveles/{numero}/contenido")
    public ContenidoPublicadoNivelService.Contenido actual(@PathVariable int numero,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        var usuario=auth.obtenerUsuarioConSesion(autorizacion);
        if (!juego.puedeConsultarContenidoActual(usuario.getIdUsuario(),numero))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Este nivel todavía está bloqueado");
        return contenido.actual(numero);
    }

    @GetMapping("/intentos/{idIntento}/contenido")
    public ContenidoPublicadoNivelService.Contenido deIntento(@PathVariable int idIntento,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        var usuario=auth.obtenerUsuarioConSesion(autorizacion);
        return contenido.deIntento(idIntento,usuario.getIdUsuario());
    }
}
