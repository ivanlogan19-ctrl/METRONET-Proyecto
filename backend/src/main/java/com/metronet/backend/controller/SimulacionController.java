package com.metronet.backend.controller;

import com.metronet.backend.dto.ActualizarEstacionRequest;
import com.metronet.backend.dto.ActualizarEscenarioRequest;
import com.metronet.backend.dto.ActualizarLineaSimulacionRequest;
import com.metronet.backend.dto.ActualizarTramoRequest;
import com.metronet.backend.dto.ActualizarUnidadMetroRequest;
import com.metronet.backend.dto.CrearEstacionSimulacionRequest;
import com.metronet.backend.dto.CrearEscenarioRequest;
import com.metronet.backend.dto.CrearLineaSimulacionRequest;
import com.metronet.backend.dto.CrearUnidadMetroSimulacionRequest;
import com.metronet.backend.dto.CrearSimulacionRequest;
import com.metronet.backend.dto.EjecutarSimulacionRequest;
import com.metronet.backend.dto.EstacionSimulacionResponse;
import com.metronet.backend.dto.LineaSimulacionResponse;
import com.metronet.backend.dto.SimulacionDetalleResponse;
import com.metronet.backend.dto.SimulacionResumenResponse;
import com.metronet.backend.dto.ResultadoSimulacionResponse;
import com.metronet.backend.dto.UnidadMetroSimulacionResponse;
import com.metronet.backend.dto.ValidacionDisenoResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.SimulacionService;
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
@RequestMapping("/api/simulaciones")
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class SimulacionController {
    private final AuthService authService;
    private final SimulacionService simulacionService;

    public SimulacionController(AuthService authService, SimulacionService simulacionService) {
        this.authService = authService;
        this.simulacionService = simulacionService;
    }

    @GetMapping
    public List<SimulacionResumenResponse> listar(
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.listarSimulaciones(obtenerJugador(autorizacion).getIdUsuario());
    }

    @PostMapping
    public SimulacionResumenResponse crear(
        @RequestBody CrearSimulacionRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.crearSimulacion(obtenerJugador(autorizacion).getIdUsuario(), solicitud);
    }

    @GetMapping("/{idDiseno}")
    public SimulacionDetalleResponse obtener(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.obtenerSimulacion(obtenerJugador(autorizacion).getIdUsuario(), idDiseno);
    }

    @PostMapping("/{idDiseno}/estaciones")
    public EstacionSimulacionResponse crearEstacion(
        @PathVariable Integer idDiseno,
        @RequestBody CrearEstacionSimulacionRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.crearEstacion(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, solicitud);
    }

    @PostMapping("/{idDiseno}/lineas")
    public LineaSimulacionResponse crearLinea(
        @PathVariable Integer idDiseno,
        @RequestBody CrearLineaSimulacionRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.crearLinea(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, solicitud);
    }

    @PostMapping("/{idDiseno}/escenarios")
    public SimulacionResumenResponse crearEscenario(
        @PathVariable Integer idDiseno,
        @RequestBody CrearEscenarioRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.crearEscenario(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, solicitud);
    }

    @PostMapping("/{idDiseno}/guardar")
    public SimulacionResumenResponse guardar(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.guardarDiseno(obtenerJugador(autorizacion).getIdUsuario(), idDiseno);
    }

    @PostMapping("/{idDiseno}/unidades")
    public UnidadMetroSimulacionResponse crearUnidad(
        @PathVariable Integer idDiseno,
        @RequestBody CrearUnidadMetroSimulacionRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.crearUnidadMetro(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, solicitud);
    }

    @DeleteMapping("/{idDiseno}/unidades/{idTren}")
    public void eliminarUnidad(
        @PathVariable Integer idDiseno,
        @PathVariable Integer idTren,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.eliminarUnidadMetro(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, idTren);
    }

    @PatchMapping("/{idDiseno}/unidades/{idTren}")
    public void actualizarUnidad(
        @PathVariable Integer idDiseno,
        @PathVariable Integer idTren,
        @RequestBody ActualizarUnidadMetroRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.actualizarUnidadMetro(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, idTren, solicitud);
    }

    @PatchMapping("/{idDiseno}/escenario")
    public SimulacionResumenResponse actualizarEscenario(
        @PathVariable Integer idDiseno,
        @RequestBody ActualizarEscenarioRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.actualizarEscenario(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, solicitud);
    }

    @DeleteMapping("/{idDiseno}")
    public void eliminarDiseno(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.eliminarDiseno(obtenerJugador(autorizacion).getIdUsuario(), idDiseno);
    }

    @PostMapping("/{idDiseno}/ejecutar")
    public ResultadoSimulacionResponse ejecutar(
        @PathVariable Integer idDiseno,
        @RequestBody EjecutarSimulacionRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.ejecutarSimulacion(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, solicitud);
    }

    @GetMapping("/{idDiseno}/resultados")
    public List<ResultadoSimulacionResponse> resultados(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.listarResultados(obtenerJugador(autorizacion).getIdUsuario(), idDiseno);
    }

    @PatchMapping("/{idDiseno}/estaciones/{nombreEstacion}")
    public void actualizarEstacion(
        @PathVariable Integer idDiseno,
        @PathVariable String nombreEstacion,
        @RequestBody ActualizarEstacionRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.actualizarEstacion(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, nombreEstacion, solicitud);
    }

    @DeleteMapping("/{idDiseno}/estaciones/{nombreEstacion}")
    public void eliminarEstacion(
        @PathVariable Integer idDiseno,
        @PathVariable String nombreEstacion,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.eliminarEstacion(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, nombreEstacion);
    }

    @PatchMapping("/{idDiseno}/lineas/{nombreLinea}")
    public void actualizarLinea(
        @PathVariable Integer idDiseno,
        @PathVariable String nombreLinea,
        @RequestBody ActualizarLineaSimulacionRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.actualizarLinea(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, nombreLinea, solicitud);
    }

    @DeleteMapping("/{idDiseno}/lineas/{nombreLinea}")
    public void eliminarLinea(
        @PathVariable Integer idDiseno,
        @PathVariable String nombreLinea,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.eliminarLinea(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, nombreLinea);
    }

    @PostMapping("/{idDiseno}/tramos")
    public void crearTramo(
        @PathVariable Integer idDiseno,
        @RequestBody ActualizarTramoRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.crearTramo(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, solicitud);
    }

    @PatchMapping("/{idDiseno}/tramos")
    public void actualizarTramo(
        @PathVariable Integer idDiseno,
        @RequestParam String lineaActual,
        @RequestParam String estacionAActual,
        @RequestParam String estacionBActual,
        @RequestBody ActualizarTramoRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.actualizarTramo(
            obtenerJugador(autorizacion).getIdUsuario(), idDiseno, lineaActual, estacionAActual, estacionBActual, solicitud
        );
    }

    @DeleteMapping("/{idDiseno}/tramos")
    public void eliminarTramo(
        @PathVariable Integer idDiseno,
        @RequestParam String linea,
        @RequestParam String estacionA,
        @RequestParam String estacionB,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        simulacionService.eliminarTramo(obtenerJugador(autorizacion).getIdUsuario(), idDiseno, linea, estacionA, estacionB);
    }

    @GetMapping("/{idDiseno}/validacion")
    public ValidacionDisenoResponse validarDiseno(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return simulacionService.validarDiseno(obtenerJugador(autorizacion).getIdUsuario(), idDiseno);
    }

    private Usuario obtenerJugador(String autorizacion) {
        return authService.obtenerUsuarioConSesion(autorizacion);
    }
}
