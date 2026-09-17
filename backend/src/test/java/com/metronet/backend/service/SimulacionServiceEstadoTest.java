package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.SimulacionResumenResponse;
import com.metronet.backend.dto.ValidacionDisenoResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

@ExtendWith(MockitoExtension.class)
class SimulacionServiceEstadoTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private DisenoAdministracionService disenoAdministracionService;

    @Test
    void guardarDisenoNoDegradaUnEstadoCompletado() {
        SimulacionResumenResponse resumen = resumenConEstado("COMPLETADO");
        configurarResumen(resumen);

        SimulacionResumenResponse respuesta = crearServicio().guardarDiseno(7, 21);

        assertEquals("COMPLETADO", respuesta.estado());
        verify(jdbcTemplate).update(
            contains("estado NOT IN ('VALIDADO', 'COMPLETADA', 'COMPLETADO')"), eq(7), eq(21)
        );
    }

    @Test
    void revalidarDisenoCompletoConservaElEstadoCompletado() {
        configurarResumen(resumenConEstado("COMPLETADO"));
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM estacion"), eq(Integer.class), any(Object[].class))).thenReturn(2);
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM linea"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM tramo"), eq(Integer.class), any(Object[].class))).thenReturn(1);

        ValidacionDisenoResponse respuesta = crearServicio().validarDiseno(7, 21);

        assertTrue(respuesta.valido());
        verify(jdbcTemplate).update(
            contains("UPDATE intento SET estado = ?"), eq("COMPLETADO"), eq(7), eq(21)
        );
    }

    private SimulacionService crearServicio() {
        return new SimulacionService(jdbcTemplate, disenoAdministracionService);
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
