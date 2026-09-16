package com.metronet.backend.controller;

import com.metronet.backend.dto.ActualizarConexionRequest;
import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarLineaRequest;
import com.metronet.backend.dto.ActualizarTramoRequest;
import com.metronet.backend.dto.ActualizarUnidadMetroRequest;
import com.metronet.backend.dto.CrearConexionRequest;
import com.metronet.backend.dto.CrearEstacionAdministracionRequest;
import com.metronet.backend.dto.CrearLineaAdministracionRequest;
import com.metronet.backend.dto.DisenoDetalleResponse;
import com.metronet.backend.dto.DisenoResumenResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ActividadAdministrativaService;
import com.metronet.backend.service.DisenoAdministracionService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    private final ActividadAdministrativaService actividadAdministrativaService;

    public DisenoAdministracionController(
        AuthService authService,
        DisenoAdministracionService disenoService,
        ActividadAdministrativaService actividadAdministrativaService
    ) {
        this.authService = authService;
        this.disenoService = disenoService;
        this.actividadAdministrativaService = actividadAdministrativaService;
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

    @DeleteMapping("/{idDiseno}")
    public void eliminarDiseno(@PathVariable Integer idDiseno, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        Usuario administrador = authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.eliminarDiseno(idDiseno);
        actividadAdministrativaService.registrarActividad(administrador, "Diseño eliminado", "Se eliminó el diseño #" + idDiseno);
    }

    @PostMapping("/{idDiseno}/lineas")
    public void crearLinea(@PathVariable Integer idDiseno, @RequestBody CrearLineaAdministracionRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.crearLinea(idDiseno, solicitud);
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

    @PostMapping("/{idDiseno}/estaciones")
    public void crearEstacion(@PathVariable Integer idDiseno, @RequestBody CrearEstacionAdministracionRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.crearEstacion(idDiseno, solicitud);
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

    @PostMapping("/{idDiseno}/conexiones")
    public void crearConexion(@PathVariable Integer idDiseno, @RequestBody CrearConexionRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.crearConexion(idDiseno, solicitud);
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

    @PostMapping("/{idDiseno}/tramos")
    public void crearTramo(@PathVariable Integer idDiseno, @RequestBody ActualizarTramoRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.crearTramo(idDiseno, solicitud);
    }

    @PatchMapping("/{idDiseno}/tramos")
    public void actualizarTramo(@PathVariable Integer idDiseno, @RequestParam String lineaActual, @RequestParam String estacionAActual, @RequestParam String estacionBActual, @RequestBody ActualizarTramoRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.actualizarTramo(idDiseno, lineaActual, estacionAActual, estacionBActual, solicitud);
    }

    @DeleteMapping("/{idDiseno}/tramos")
    public void eliminarTramo(@PathVariable Integer idDiseno, @RequestParam String linea, @RequestParam String estacionA, @RequestParam String estacionB, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.eliminarTramo(idDiseno, linea, estacionA, estacionB);
    }

    @PostMapping("/{idDiseno}/unidades")
    public void crearUnidad(@PathVariable Integer idDiseno, @RequestBody ActualizarUnidadMetroRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.crearUnidadMetro(idDiseno, solicitud);
    }

    @PatchMapping("/{idDiseno}/unidades/{idTren}")
    public void actualizarUnidad(@PathVariable Integer idDiseno, @PathVariable Integer idTren, @RequestBody ActualizarUnidadMetroRequest solicitud, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.actualizarUnidadMetro(idDiseno, idTren, solicitud);
    }

    @DeleteMapping("/{idDiseno}/unidades/{idTren}")
    public void eliminarUnidad(@PathVariable Integer idDiseno, @PathVariable Integer idTren, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        disenoService.eliminarUnidadMetro(idDiseno, idTren);
    }
}
