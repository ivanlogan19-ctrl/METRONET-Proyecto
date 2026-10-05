package com.metronet.backend.controller;

import com.metronet.backend.service.AprendizajeService;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ContenidoPublicadoNivelService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/juego/aprendizaje")
public class AprendizajeController {
    private final AuthService auth;
    private final AprendizajeService aprendizaje;

    public AprendizajeController(AuthService auth, AprendizajeService aprendizaje) {
        this.auth = auth;
        this.aprendizaje = aprendizaje;
    }

    @GetMapping
    public List<AprendizajeService.Nivel> niveles(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return aprendizaje.niveles(auth.obtenerUsuarioConSesion(autorizacion));
    }

    @GetMapping("/niveles/{numero}")
    public ContenidoPublicadoNivelService.Contenido contenido(@PathVariable int numero,
        @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return aprendizaje.contenido(numero, auth.obtenerUsuarioConSesion(autorizacion));
    }
}
