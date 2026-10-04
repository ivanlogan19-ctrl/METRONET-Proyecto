package com.metronet.backend.controller;

import com.metronet.backend.dto.EscenarioJuegoResponse;
import com.metronet.backend.dto.DesempenoNivelResponse;
import com.metronet.backend.dto.RankingResponse;
import com.metronet.backend.service.PuntuacionService;
import com.metronet.backend.dto.ConsignaDisenoResponse;
import com.metronet.backend.dto.EvaluacionEscenarioResponse;
import com.metronet.backend.dto.InicioEscenarioResponse;
import com.metronet.backend.dto.IniciarNivelRequest;
import com.metronet.backend.dto.ProgresoJuegoResponse;
import com.metronet.backend.dto.ReiniciarRecorridoRequest;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.JuegoEducativoService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/juego")
public class JuegoEducativoController {
    private final AuthService authService;
    private final JuegoEducativoService juegoEducativoService;
    private final PuntuacionService puntuacionService;

    public JuegoEducativoController(AuthService authService, JuegoEducativoService juegoEducativoService) {
        this(authService, juegoEducativoService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public JuegoEducativoController(AuthService authService, JuegoEducativoService juegoEducativoService, PuntuacionService puntuacionService) {
        this.authService = authService;
        this.juegoEducativoService = juegoEducativoService;
        this.puntuacionService = puntuacionService;
    }

    @GetMapping("/escenarios")
    public List<EscenarioJuegoResponse> obtenerProgreso(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return juegoEducativoService.obtenerProgreso(obtenerUsuario(autorizacion).getIdUsuario());
    }

    @GetMapping("/progreso")
    public ProgresoJuegoResponse obtenerResumenProgreso(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return juegoEducativoService.obtenerResumenProgreso(obtenerUsuario(autorizacion).getIdUsuario());
    }

    @PostMapping("/escenarios/{idEscenario}/iniciar")
    public InicioEscenarioResponse iniciarEscenario(
        @PathVariable Integer idEscenario,
        @RequestBody(required = false) IniciarNivelRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        int usuario=obtenerUsuario(autorizacion).getIdUsuario();
        return solicitud==null ? juegoEducativoService.iniciarEscenario(usuario,idEscenario)
            : juegoEducativoService.iniciarEscenario(usuario,idEscenario,solicitud.versionEsperada());
    }

    @PostMapping("/escenarios/{idEscenario}/volver-a-jugar")
    public InicioEscenarioResponse volverAJugar(
        @PathVariable Integer idEscenario,
        @RequestBody(required = false) IniciarNivelRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        int usuario=obtenerUsuario(autorizacion).getIdUsuario();
        return solicitud==null ? juegoEducativoService.volverAJugar(usuario,idEscenario)
            : juegoEducativoService.volverAJugar(usuario,idEscenario,solicitud.versionEsperada());
    }

    @PostMapping("/recorrido/reiniciar")
    public ProgresoJuegoResponse reiniciarRecorrido(
        @RequestBody(required = false) ReiniciarRecorridoRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        Integer numeroCampanaEsperado = solicitud == null ? null : solicitud.numeroCampanaActual();
        return juegoEducativoService.reiniciarRecorrido(obtenerUsuario(autorizacion).getIdUsuario(), numeroCampanaEsperado);
    }

    @PostMapping("/disenos/{idDiseno}/evaluar")
    public EvaluacionEscenarioResponse evaluarEscenario(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return juegoEducativoService.evaluarEscenario(obtenerUsuario(autorizacion).getIdUsuario(), idDiseno);
    }

    @GetMapping("/disenos/{idDiseno}/consigna")
    public ConsignaDisenoResponse obtenerConsigna(
        @PathVariable Integer idDiseno,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        return juegoEducativoService.obtenerConsigna(obtenerUsuario(autorizacion), idDiseno);
    }

    @GetMapping("/disenos/{idDiseno}/desempeno")
    public DesempenoNivelResponse desempeno(@PathVariable Integer idDiseno, @RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return juegoEducativoService.obtenerDesempeno(obtenerUsuario(autorizacion).getIdUsuario(), idDiseno);
    }

    @GetMapping("/ranking")
    public RankingResponse ranking(@RequestHeader(value = "Authorization", required = false) String autorizacion) {
        return puntuacionService.ranking(obtenerUsuario(autorizacion).getIdUsuario());
    }

    private Usuario obtenerUsuario(String autorizacion) { return authService.obtenerUsuarioConSesion(autorizacion); }
}
