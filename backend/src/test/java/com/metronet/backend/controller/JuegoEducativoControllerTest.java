package com.metronet.backend.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.metronet.backend.dto.EscenarioJuegoResponse;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.ConsignaDisenoResponse;
import com.metronet.backend.dto.InicioEscenarioResponse;
import com.metronet.backend.dto.ProgresoJuegoResponse;
import com.metronet.backend.dto.ReferenciaObjetivoConsignaResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.JuegoEducativoService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class JuegoEducativoControllerTest {
    private static final String AUTORIZACION = "Bearer token-jugador";
    private static final Integer ID_USUARIO = 7;

    @Mock
    private AuthService authService;

    @Mock
    private JuegoEducativoService juegoEducativoService;

    @Mock
    private com.metronet.backend.service.PuntuacionService puntuacionService;

    private MockMvc mockMvc;

    @BeforeEach
    void prepararMockMvc() {
        mockMvc = MockMvcBuilders.standaloneSetup(new JuegoEducativoController(authService, juegoEducativoService, puntuacionService))
            .setControllerAdvice(new ManejadorExcepcionesApi())
            .build();
    }

    @Test
    void rankingAutenticadoNoExponeDatosPersonales() throws Exception {
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(usuario());
        when(puntuacionService.ranking(ID_USUARIO)).thenReturn(new com.metronet.backend.dto.RankingResponse(
            List.of(new com.metronet.backend.dto.RankingResponse.Entrada(1, "Jugador 7", 90, 1, true)), 1, 90, 1000));
        mockMvc.perform(get("/api/juego/ranking").header("Authorization", AUTORIZACION)).andExpect(status().isOk())
            .andExpect(jsonPath("$.jugadores[0].jugador").value("Jugador 7"))
            .andExpect(jsonPath("$.jugadores[0].email").doesNotExist()).andExpect(jsonPath("$.tuPosicion").value(1));
    }

    @Test
    void rankingSinSesionSeRechazaAntesDeConsultarPuntos() throws Exception {
        when(authService.obtenerUsuarioConSesion(null)).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        mockMvc.perform(get("/api/juego/ranking")).andExpect(status().isUnauthorized());
        verifyNoInteractions(puntuacionService);
    }

    @Test
    void evaluarNoAceptaPuntosNiPosicionEnviadosPorElNavegador() throws Exception {
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(usuario());
        when(juegoEducativoService.evaluarEscenario(ID_USUARIO, 55)).thenReturn(new com.metronet.backend.dto.EvaluacionEscenarioResponse(true,100,88,"Evaluado en backend",null,false));
        mockMvc.perform(post("/api/juego/disenos/55/evaluar").header("Authorization", AUTORIZACION)
            .contentType(MediaType.APPLICATION_JSON).content("{\"puntaje\":999999,\"idUsuario\":9,\"posicion\":1}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.puntaje").value(88));
        verify(juegoEducativoService).evaluarEscenario(ID_USUARIO, 55);
    }

    @Test
    void evaluacionExponeSoloLosPremiosNuevosDelResultado() throws Exception {
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(usuario());
        var premio = new com.metronet.backend.service.TrofeosService.Trofeo(
            "estacion", "Primera estación", "Completar el Nivel 1.", "Completaste el primer nivel.", true);
        when(juegoEducativoService.evaluarEscenario(ID_USUARIO, 55)).thenReturn(
            new com.metronet.backend.dto.EvaluacionEscenarioResponse(true, 100, 100,
                "Nivel completado", 2, false, null, List.of(premio)));
        mockMvc.perform(post("/api/juego/disenos/55/evaluar").header("Authorization", AUTORIZACION))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trofeosNuevos.length()").value(1))
            .andExpect(jsonPath("$.trofeosNuevos[0].id").value("estacion"))
            .andExpect(jsonPath("$.trofeosNuevos[0].motivo").value("Completaste el primer nivel."));
    }

    @Test
    void obtieneElResumenDeLaCampanaActualDelJugadorAutenticado() throws Exception {
        ProgresoJuegoResponse progreso = progreso(3, 2, false, true, true);
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(usuario());
        when(juegoEducativoService.obtenerResumenProgreso(ID_USUARIO)).thenReturn(progreso);

        mockMvc.perform(get("/api/juego/progreso").header("Authorization", AUTORIZACION))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.numeroCampanaActual").value(3))
            .andExpect(jsonPath("$.cantidadNiveles").value(4))
            .andExpect(jsonPath("$.nivelesCompletados").value(2))
            .andExpect(jsonPath("$.campanaCompletada").value(false))
            .andExpect(jsonPath("$.campanaCompletadaHistoricamente").value(true))
            .andExpect(jsonPath("$.modoLibreDesbloqueado").value(true))
            .andExpect(jsonPath("$.escenarios[0].nombre").value("Escenario 1 · Fundamentos"))
            .andExpect(jsonPath("$.escenarios[0].completadoEnCampanaActual").value(true))
            .andExpect(jsonPath("$.escenarios[0].cantidadIntentos").value(3))
            .andExpect(jsonPath("$.escenarios[0].mejorPuntaje").value(100));

        verify(juegoEducativoService).obtenerResumenProgreso(ID_USUARIO);
    }

    @Test
    void vuelveAJugarCreandoUnNuevoIntentoSoloParaElJugadorAutenticado() throws Exception {
        InicioEscenarioResponse inicio = new InicioEscenarioResponse(55, 1, 81, "EN_DESARROLLO", 3, false);
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(usuario());
        when(juegoEducativoService.volverAJugar(ID_USUARIO, 1)).thenReturn(inicio);

        mockMvc.perform(post("/api/juego/escenarios/1/volver-a-jugar").header("Authorization", AUTORIZACION))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.idDiseno").value(55))
            .andExpect(jsonPath("$.idEscenario").value(1))
            .andExpect(jsonPath("$.idIntento").value(81))
            .andExpect(jsonPath("$.estado").value("EN_DESARROLLO"))
            .andExpect(jsonPath("$.numeroCampana").value(3))
            .andExpect(jsonPath("$.mostrarTutorial").value(false));

        verify(juegoEducativoService).volverAJugar(ID_USUARIO, 1);
    }

    @Test
    void reiniciaElRecorridoIndicandoLaCampanaQueElJugadorEstaViendo() throws Exception {
        ProgresoJuegoResponse progresoReiniciado = progreso(4, 0, false, true, true);
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(usuario());
        when(juegoEducativoService.reiniciarRecorrido(ID_USUARIO, 3)).thenReturn(progresoReiniciado);

        mockMvc.perform(post("/api/juego/recorrido/reiniciar")
                .header("Authorization", AUTORIZACION)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"numeroCampanaActual\":3}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.numeroCampanaActual").value(4))
            .andExpect(jsonPath("$.nivelesCompletados").value(0))
            .andExpect(jsonPath("$.escenarios[0].estado").value("DISPONIBLE"))
            .andExpect(jsonPath("$.escenarios[1].estado").value("BLOQUEADO"))
            .andExpect(jsonPath("$.escenarios[2].nombre").value("Modo Libre"))
            .andExpect(jsonPath("$.escenarios[2].desbloqueado").value(true))
            .andExpect(jsonPath("$.modoLibreDesbloqueado").value(true));

        verify(juegoEducativoService).reiniciarRecorrido(ID_USUARIO, 3);
    }

    @Test
    void reiniciaElRecorridoSinCampanaIndicadaParaMantenerCompatibilidadConLaInterfaz() throws Exception {
        ProgresoJuegoResponse progresoReiniciado = progreso(2, 0, false, false, false);
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(usuario());
        when(juegoEducativoService.reiniciarRecorrido(ID_USUARIO, null)).thenReturn(progresoReiniciado);

        mockMvc.perform(post("/api/juego/recorrido/reiniciar").header("Authorization", AUTORIZACION))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.numeroCampanaActual").value(2))
            .andExpect(jsonPath("$.modoLibreDesbloqueado").value(false));

        verify(juegoEducativoService).reiniciarRecorrido(eq(ID_USUARIO), isNull());
    }

    @Test
    void obtieneLaConsignaConCondicionesYReferenciasDelDiseno() throws Exception {
        Usuario jugador = usuario();
        ConsignaDisenoResponse consigna = new ConsignaDisenoResponse(
            "PARCIAL",
            50,
            List.of(new CondicionConsignaResponse("minimoEstaciones", "Ubicar al menos 2 estaciones", 1, 2, false)),
            List.of(new ReferenciaObjetivoConsignaResponse(1, "Palacio Legislativo", true))
        );
        when(authService.obtenerUsuarioConSesion(AUTORIZACION)).thenReturn(jugador);
        when(juegoEducativoService.obtenerConsigna(jugador, 55)).thenReturn(consigna);

        mockMvc.perform(get("/api/juego/disenos/55/consigna").header("Authorization", AUTORIZACION))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.estadoGlobal").value("PARCIAL"))
            .andExpect(jsonPath("$.progreso").value(50))
            .andExpect(jsonPath("$.condiciones[0].clave").value("minimoEstaciones"))
            .andExpect(jsonPath("$.condiciones[0].completado").value(false))
            .andExpect(jsonPath("$.referenciasObjetivo[0].idPunto").value(1))
            .andExpect(jsonPath("$.referenciasObjetivo[0].cubierto").value(true));

        verify(juegoEducativoService).obtenerConsigna(jugador, 55);
    }

    @Test
    void rechazaLaConsultaDeConsignaSinAutorizacionConRespuestaControlada() throws Exception {
        when(authService.obtenerUsuarioConSesion(null)).thenThrow(
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión no es válida")
        );

        mockMvc.perform(get("/api/juego/disenos/55/consigna"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.detail").value("La sesión no es válida"));

        verifyNoInteractions(juegoEducativoService);
    }

    private ProgresoJuegoResponse progreso(
        int numeroCampanaActual,
        int nivelesCompletados,
        boolean campanaCompletada,
        boolean campanaCompletadaHistoricamente,
        boolean modoLibreDesbloqueado
    ) {
        EscenarioJuegoResponse escenarioUno = new EscenarioJuegoResponse(
            1, 1, "Escenario 1 · Fundamentos", "Construí una red inicial", "Inicial", "Instrucciones",
            nivelesCompletados > 0 ? "COMPLETADO" : "DISPONIBLE", nivelesCompletados > 0 ? 100 : 0, true,
            Map.of("crearLinea", true), nivelesCompletados > 0, 3, 100, 100
        );
        EscenarioJuegoResponse escenarioDos = new EscenarioJuegoResponse(
            2, 2, "Escenario 2 · Conexiones", "Conectá estaciones", "Intermedio", "Instrucciones",
            "BLOQUEADO", 0, false, Map.of("crearLinea", true), false, 0, null, null
        );
        EscenarioJuegoResponse modoLibre = new EscenarioJuegoResponse(
            5, null, "Modo Libre", "Diseñá sin restricciones", "Libre", "Instrucciones",
            modoLibreDesbloqueado ? "DISPONIBLE" : "BLOQUEADO", 0, modoLibreDesbloqueado,
            Map.of("crearLinea", true), false, 0, null, null
        );
        return new ProgresoJuegoResponse(
            List.of(escenarioUno, escenarioDos, modoLibre), numeroCampanaActual, 4, nivelesCompletados,
            campanaCompletada, campanaCompletadaHistoricamente, modoLibreDesbloqueado, true
        );
    }

    private Usuario usuario() {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(ID_USUARIO);
        return usuario;
    }
}
