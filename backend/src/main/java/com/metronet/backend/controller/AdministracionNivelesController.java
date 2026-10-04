package com.metronet.backend.controller;

import com.metronet.backend.dto.EdicionNivelRequest;
import com.metronet.backend.dto.PublicarNivelRequest;
import com.metronet.backend.service.AdministracionNivelesService;
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
@RequestMapping("/api/admin/niveles")
public class AdministracionNivelesController {
    private final AuthService auth;
    private final AdministracionNivelesService niveles;
    private final PublicacionNivelService publicacion;

    public AdministracionNivelesController(AuthService auth, AdministracionNivelesService niveles,
        PublicacionNivelService publicacion) {
        this.auth = auth;
        this.niveles = niveles;
        this.publicacion = publicacion;
    }

    @GetMapping
    public List<AdministracionNivelesService.Resumen> listar(
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        auth.obtenerAdministradorAutorizado(autorizacion);
        return niveles.listar();
    }

    @GetMapping("/{numero}/borrador")
    public AdministracionNivelesService.Borrador borrador(@PathVariable int numero,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        auth.obtenerAdministradorAutorizado(autorizacion);
        return niveles.borrador(numero);
    }

    @PutMapping("/{numero}/borrador")
    public AdministracionNivelesService.Borrador guardar(@PathVariable int numero,
        @RequestBody EdicionNivelRequest edicion,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        var admin = auth.obtenerAdministradorAutorizado(autorizacion);
        return niveles.guardar(numero,edicion,admin.getIdUsuario());
    }

    @PostMapping("/{numero}/previsualizar")
    public PublicacionNivelService.VistaPrevia previsualizar(@PathVariable int numero,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        var admin=auth.obtenerAdministradorAutorizado(autorizacion);
        return publicacion.previsualizar(numero,admin.getIdUsuario());
    }

    @PostMapping("/{numero}/publicar")
    public PublicacionNivelService.Publicada publicar(@PathVariable int numero,
        @RequestBody PublicarNivelRequest pedido,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        var admin=auth.obtenerAdministradorAutorizado(autorizacion);
        return publicacion.publicar(numero,pedido,admin.getIdUsuario());
    }

    @GetMapping("/{numero}/versiones")
    public List<AdministracionNivelesService.Version> versiones(@PathVariable int numero,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        auth.obtenerAdministradorAutorizado(autorizacion);
        return niveles.versiones(numero);
    }

    @PostMapping("/{numero}/versiones/{version}/preparar-reversion")
    public AdministracionNivelesService.Borrador prepararReversion(@PathVariable int numero,@PathVariable int version,
        @RequestHeader(value="Authorization",required=false) String autorizacion) {
        var admin = auth.obtenerAdministradorAutorizado(autorizacion);
        return niveles.prepararReversion(numero,version,admin.getIdUsuario());
    }
}
