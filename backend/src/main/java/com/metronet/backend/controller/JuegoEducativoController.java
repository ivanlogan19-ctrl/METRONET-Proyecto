package com.metronet.backend.controller;

import com.metronet.backend.dto.EscenarioJuegoResponse;
import com.metronet.backend.dto.EvaluacionEscenarioResponse;
import com.metronet.backend.dto.InicioEscenarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.JuegoEducativoService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/juego")
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"}, allowedHeaders = "*")
public class JuegoEducativoController {
    private final AuthService authService;
    private final JuegoEducativoService juegoEducativoService;

    public JuegoEducativoController(AuthService authService, JuegoEducativoService juegoEducativoService) {
        this.authService = authService;
        this.juegoEducativoService = juegoEducativoService;
    }

    @GetMapping("/escenarios")
    public List<EscenarioJuegoResponse> obtenerProgreso(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return juegoEducativoService.obtenerProgreso(obtenerUsuario(autorizacion).getIdUsuario());
    }

    @PostMapping("/escenarios/{idEscenario}/iniciar")
    public InicioEscenarioResponse iniciarEscenario(
        @PathVariable Integer idEscenario,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return juegoEducativoService.iniciarEscenario(obtenerUsuario(autorizacion).getIdUsuario(), idEscenario);
    }

    @PostMapping("/disenos/{idDiseno}/evaluar")
    public EvaluacionEscenarioResponse evaluarEscenario(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return juegoEducativoService.evaluarEscenario(obtenerUsuario(autorizacion).getIdUsuario(), idDiseno);
    }

    private Usuario obtenerUsuario(String autorizacion) { return authService.obtenerUsuarioConSesion(autorizacion); }
}
