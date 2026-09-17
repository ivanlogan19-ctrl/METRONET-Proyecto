package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
class DisenoAdministracionServiceTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void eliminaElDisenoAntesDelEscenarioNoProgresivoSinIntentosRestantes() {
        when(jdbcTemplate.queryForObject(
            contains("FROM diseno"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(true);
        when(jdbcTemplate.queryForObject(
            contains("JOIN escenario escenarioJuego"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(false);
        when(jdbcTemplate.query(
            contains("COALESCE(e.progresivo, FALSE) = FALSE"),
            ArgumentMatchers.<RowMapper<Integer>>any(),
            any(Object[].class)
        )).thenReturn(List.of(41));

        crearServicio().eliminarDiseno(25);

        InOrder orden = inOrder(jdbcTemplate);
        orden.verify(jdbcTemplate).update(contains("DELETE FROM diseno"), eq(25));
        orden.verify(jdbcTemplate).update(
            contains("AND NOT EXISTS"),
            eq(41),
            eq(41)
        );
    }

    @Test
    void conservaElCatalogoCuandoNoHayEscenariosNoProgresivosRelacionados() {
        when(jdbcTemplate.queryForObject(
            contains("FROM diseno"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(true);
        when(jdbcTemplate.queryForObject(
            contains("JOIN escenario escenarioJuego"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(false);
        when(jdbcTemplate.query(
            contains("COALESCE(e.progresivo, FALSE) = FALSE"),
            ArgumentMatchers.<RowMapper<Integer>>any(),
            any(Object[].class)
        )).thenReturn(List.of());

        crearServicio().eliminarDiseno(26);

        verify(jdbcTemplate).update(contains("DELETE FROM diseno"), eq(26));
        verify(jdbcTemplate, never()).update(contains("AND NOT EXISTS"), any(), any());
    }

    @Test
    void rechazaLaEliminacionDeUnDisenoInexistente() {
        when(jdbcTemplate.queryForObject(
            contains("FROM diseno"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(false);

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().eliminarDiseno(99)
        );

        assertEquals(HttpStatus.NOT_FOUND, excepcion.getStatusCode());
        verify(jdbcTemplate, never()).update(eq("DELETE FROM diseno WHERE id_diseno = ?"), eq(99));
    }

    @Test
    void bloqueaLaEliminacionDeUnLogroProgresivoCompletado() {
        when(jdbcTemplate.queryForObject(
            contains("FROM diseno"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(true);
        when(jdbcTemplate.queryForObject(
            contains("JOIN escenario escenarioJuego"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(true);

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().eliminarDiseno(25)
        );

        assertEquals(HttpStatus.CONFLICT, excepcion.getStatusCode());
        verify(jdbcTemplate, never()).update(eq("DELETE FROM diseno WHERE id_diseno = ?"), eq(25));
    }

    @Test
    void bloqueaLaEdicionDeUnLogroProgresivoCompletado() {
        when(jdbcTemplate.queryForObject(
            contains("JOIN escenario escenarioJuego"), eq(Boolean.class), any(Object[].class)
        )).thenReturn(true);

        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().crearLinea(25, null)
        );

        assertEquals(HttpStatus.CONFLICT, excepcion.getStatusCode());
        verify(jdbcTemplate, never()).update(contains("INSERT INTO linea"), eq(25), any());
    }

    private DisenoAdministracionService crearServicio() {
        return new DisenoAdministracionService(jdbcTemplate);
    }
}
