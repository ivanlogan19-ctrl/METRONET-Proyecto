package com.metronet.backend.controller;

import com.metronet.backend.dto.ActualizarConexionRequest;
import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarLineaRequest;
import com.metronet.backend.dto.DisenoDetalleResponse;
import com.metronet.backend.dto.DisenoResumenResponse;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.DisenoAdministracionService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/disenos")
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class DisenoAdministracionController {
    private final AuthService authService;
    private final DisenoAdministracionService disenoService;

    public DisenoAdministracionController(AuthService authService, DisenoAdministracionService disenoService) {
        this.authService = authService;
        this.disenoService = disenoService;
    }

    @GetMapping
    public List<DisenoResumenResponse> listar(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return disenoService.listarDisenos();
    }

    @GetMapping("/{idDiseno}")
    public DisenoDetalleResponse obtener(@PathVariable Integer idDiseno, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return disenoService.obtenerDiseno(idDiseno);
    }

    @PatchMapping("/{idDiseno}/lineas/{nombreLinea}")
    public void actualizarLinea(@PathVariable Integer idDiseno, @PathVariable String nombreLinea, @RequestBody ActualizarLineaRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.actualizarLinea(idDiseno, nombreLinea, solicitud);
    }

    @DeleteMapping("/{idDiseno}/lineas/{nombreLinea}")
    public void eliminarLinea(@PathVariable Integer idDiseno, @PathVariable String nombreLinea, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.eliminarLinea(idDiseno, nombreLinea);
    }

    @PatchMapping("/{idDiseno}/estaciones/{nombreEstacion}")
    public void actualizarEstacion(@PathVariable Integer idDiseno, @PathVariable String nombreEstacion, @RequestBody ActualizarEstacionRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.actualizarEstacion(idDiseno, nombreEstacion, solicitud);
    }

    @DeleteMapping("/{idDiseno}/estaciones/{nombreEstacion}")
    public void eliminarEstacion(@PathVariable Integer idDiseno, @PathVariable String nombreEstacion, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.eliminarEstacion(idDiseno, nombreEstacion);
    }

    @PatchMapping("/{idDiseno}/conexiones")
    public void actualizarConexion(@PathVariable Integer idDiseno, @RequestParam String lineaActual, @RequestParam String estacionActual, @RequestBody ActualizarConexionRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.actualizarConexion(idDiseno, lineaActual, estacionActual, solicitud);
    }

    @DeleteMapping("/{idDiseno}/conexiones")
    public void eliminarConexion(@PathVariable Integer idDiseno, @RequestParam String linea, @RequestParam String estacion, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.eliminarConexion(idDiseno, linea, estacion);
    }
}
