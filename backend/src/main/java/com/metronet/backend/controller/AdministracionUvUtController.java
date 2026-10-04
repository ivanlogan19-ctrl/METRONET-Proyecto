package com.metronet.backend.controller;

import com.metronet.backend.service.AdministracionUvUtService;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.PublicacionNivelService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/niveles/criterio-uvut")
public class AdministracionUvUtController {
    private final AuthService auth;
    private final AdministracionUvUtService servicio;
    private final PublicacionNivelService publicacion;

    public AdministracionUvUtController(AuthService auth, AdministracionUvUtService servicio,
            PublicacionNivelService publicacion) {
        this.auth = auth;
        this.servicio = servicio;
        this.publicacion = publicacion;
    }

    @GetMapping
    public List<AdministracionUvUtService.Vista> listar(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        auth.obtenerAdministradorAutorizado(autorizacion);
        return servicio.listar();
    }

    @PostMapping("/{numero}/previsualizar")
    public AdministracionUvUtService.Vista previsualizar(@PathVariable int numero,
            @RequestBody AdministracionUvUtService.Cambio cambio,
            @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        auth.obtenerAdministradorAutorizado(autorizacion);
        return servicio.previsualizar(numero, cambio);
    }

    @PutMapping("/{numero}")
    public AdministracionUvUtService.Vista aplicar(@PathVariable int numero,
            @RequestBody AdministracionUvUtService.Cambio cambio,
            @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        var administrador = auth.obtenerAdministradorAutorizado(autorizacion);
        publicacion.publicarCriterioUvUt(numero, cambio, administrador.getIdUsuario());
        return servicio.listar().stream().filter(vista -> vista.numero() == numero).findFirst()
            .orElseThrow();
    }
}
