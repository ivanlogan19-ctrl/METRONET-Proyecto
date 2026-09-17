package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CrearSimulacionRequest;
import com.metronet.backend.dto.SimulacionResumenResponse;
import com.metronet.backend.dto.ValidacionDisenoResponse;
import com.metronet.backend.enums.Rol;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class SimulacionServiceEstadoTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private DisenoAdministracionService disenoAdministracionService;

    @Mock
    private JuegoEducativoService juegoEducativoService;

    @Test
    void bloqueaElModoLibreParaUnJugadorQueNoCompletoLosNiveles() {
        when(juegoEducativoService.tieneModoLibreDesbloqueado(7)).thenReturn(false);

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().crearSimulacion(7, Rol.JUGADOR, new CrearSimulacionRequest("Red personal"))
        );

        assertEquals(HttpStatus.FORBIDDEN, excepcion.getStatusCode());
        assertEquals("Completá los cuatro niveles para desbloquear el Modo Libre", excepcion.getReason());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void permiteElModoLibreParaUnAdministradorSinRevisarElProgreso() {
        SimulacionResumenResponse resumen = resumenConEstado("EN_DISENO");
        configurarResumen(resumen);
        when(jdbcTemplate.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class)).thenReturn(21);
        when(jdbcTemplate.queryForObject(
            contains("INSERT INTO escenario"), eq(Integer.class), eq("Red administrativa")
        )).thenReturn(4);

        SimulacionResumenResponse respuesta = crearServicio().crearSimulacion(
            7, Rol.ADMIN, new CrearSimulacionRequest("Red administrativa")
        );

        assertEquals(resumen, respuesta);
        verifyNoInteractions(juegoEducativoService);
    }

    @Test
    void guardarDisenoNoDegradaUnEstadoCompletadoNoProgresivo() {
        SimulacionResumenResponse resumen = resumenConEstado("COMPLETADO");
        configurarResumen(resumen);

        SimulacionResumenResponse respuesta = crearServicio().guardarDiseno(7, 21);

        assertEquals("COMPLETADO", respuesta.estado());
        verify(jdbcTemplate).update(
            contains("estado NOT IN ('VALIDADO', 'COMPLETADA', 'COMPLETADO')"), eq(7), eq(21)
        );
        verify(disenoAdministracionService).verificarDisenoEditable(21);
    }

    @Test
    void bloqueaLaRevalidacionDeUnLogroCompletadoAntesDeModificarlo() {
        configurarResumen(resumenConEstado("COMPLETADO"));
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Logro protegido"))
            .when(disenoAdministracionService).verificarDisenoEditable(21);

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().validarDiseno(7, 21)
        );

        assertEquals(HttpStatus.CONFLICT, excepcion.getStatusCode());
        verify(jdbcTemplate, never()).update(contains("UPDATE intento SET estado = ?"), any(), any(), any());
    }

    @Test
    void consultarValidacionNoActualizaElEstadoDelIntento() {
        configurarResumen(resumenConEstado("EN_DISENO"));
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM estacion"), eq(Integer.class), any(Object[].class))).thenReturn(2);
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM linea"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM tramo"), eq(Integer.class), any(Object[].class))).thenReturn(1);

        ValidacionDisenoResponse respuesta = crearServicio().consultarValidacionDiseno(7, 21);

        assertTrue(respuesta.valido());
        verify(jdbcTemplate, never()).update(contains("UPDATE intento SET estado = ?"), any(), any(), any());
    }

    @Test
    void eliminaElDisenoAntesDelEscenarioNoProgresivoQueYaNoTieneIntentos() {
        configurarResumen(resumenConEstado("EN_DISENO"));
        when(jdbcTemplate.query(
            contains("COALESCE(e.progresivo, FALSE) = FALSE"),
            ArgumentMatchers.<RowMapper<Integer>>any(),
            any(Object[].class)
        )).thenReturn(List.of(4));
        when(jdbcTemplate.update(contains("DELETE FROM diseno"), eq(21))).thenReturn(1);

        crearServicio().eliminarDiseno(7, 21);

        InOrder orden = inOrder(jdbcTemplate);
        orden.verify(jdbcTemplate).update(contains("DELETE FROM diseno"), eq(21));
        orden.verify(jdbcTemplate).update(contains("AND NOT EXISTS"), eq(4), eq(4));
    }

    @Test
    void impideEliminarUnDisenoAjenoAntesDeModificarLaPersistencia() {
        when(jdbcTemplate.query(
            contains("FROM intento i"), ArgumentMatchers.<RowMapper<SimulacionResumenResponse>>any(), any(Object[].class)
        )).thenReturn(List.of());

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().eliminarDiseno(8, 21)
        );

        assertEquals(HttpStatus.NOT_FOUND, excepcion.getStatusCode());
        verify(jdbcTemplate, never()).update(contains("DELETE FROM diseno"), eq(21));
        verifyNoInteractions(disenoAdministracionService);
    }

    private SimulacionService crearServicio() {
        return new SimulacionService(
            jdbcTemplate,
            disenoAdministracionService,
            new ObjetivosPuntosInteresService(new ObjectMapper()),
            juegoEducativoService
        );
    }

    private void configurarResumen(SimulacionResumenResponse resumen) {
        when(jdbcTemplate.query(
            contains("FROM intento i"), ArgumentMatchers.<RowMapper<SimulacionResumenResponse>>any(), any(Object[].class)
        )).thenReturn(List.of(resumen));
    }

    private SimulacionResumenResponse resumenConEstado(String estado) {
        return new SimulacionResumenResponse(21, 4, "Nivel de prueba", estado, "NIVEL", "Inicial", "Objetivo", "Instrucciones", null);
    }
}
