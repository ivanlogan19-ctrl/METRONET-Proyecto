package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.metronet.backend.dto.ActualizarConfiguracionRequest;
import com.metronet.backend.dto.ConfiguracionResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ConfiguracionServiceTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void normalizaUnaVelocidadPermitidaAntesDeGuardarla() {
        ConfiguracionResponse esperada = new ConfiguracionResponse(
            ConfiguracionService.CLAVE_VELOCIDAD_SIMULACION,
            "2",
            "Velocidad predeterminada"
        );
        when(jdbcTemplate.update(
            "UPDATE configuracion SET valor = ? WHERE clave = ?",
            "2",
            ConfiguracionService.CLAVE_VELOCIDAD_SIMULACION
        )).thenReturn(1);
        when(jdbcTemplate.queryForObject(
            contains("SELECT clave, valor, descripcion"),
            ArgumentMatchers.<RowMapper<ConfiguracionResponse>>any(),
            eq(ConfiguracionService.CLAVE_VELOCIDAD_SIMULACION)
        )).thenReturn(esperada);

        ConfiguracionResponse respuesta = crearServicio().actualizarConfiguracion(
            ConfiguracionService.CLAVE_VELOCIDAD_SIMULACION,
            new ActualizarConfiguracionRequest("2.0")
        );

        assertEquals(esperada, respuesta);
        verify(jdbcTemplate).update(
            "UPDATE configuracion SET valor = ? WHERE clave = ?",
            "2",
            ConfiguracionService.CLAVE_VELOCIDAD_SIMULACION
        );
    }

    @Test
    void rechazaUnaVelocidadFueraDeLasOpcionesDisponibles() {
        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().actualizarConfiguracion(
                ConfiguracionService.CLAVE_VELOCIDAD_SIMULACION,
                new ActualizarConfiguracionRequest("3")
            )
        );

        assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
        assertEquals("La velocidad de simulación debe ser 0.5, 1, 2 o 4", excepcion.getReason());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void rechazaUnaCapacidadQueNoEsEnteraPositivaYRazonable() {
        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().actualizarConfiguracion(
                ConfiguracionService.CLAVE_CAPACIDAD_UNIDAD,
                new ActualizarConfiguracionRequest("2001")
            )
        );

        assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
        assertEquals("La capacidad de una unidad debe ser un número entero entre 1 y 2000", excepcion.getReason());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void normalizaElModoMantenimiento() {
        ConfiguracionResponse esperada = new ConfiguracionResponse(
            ConfiguracionService.CLAVE_MODO_MANTENIMIENTO,
            "activado",
            "Estado de mantenimiento"
        );
        when(jdbcTemplate.update(
            "UPDATE configuracion SET valor = ? WHERE clave = ?",
            "activado",
            ConfiguracionService.CLAVE_MODO_MANTENIMIENTO
        )).thenReturn(1);
        when(jdbcTemplate.queryForObject(
            anyString(),
            ArgumentMatchers.<RowMapper<ConfiguracionResponse>>any(),
            eq(ConfiguracionService.CLAVE_MODO_MANTENIMIENTO)
        )).thenReturn(esperada);

        ConfiguracionResponse respuesta = crearServicio().actualizarConfiguracion(
            ConfiguracionService.CLAVE_MODO_MANTENIMIENTO,
            new ActualizarConfiguracionRequest(" ACTIVADO ")
        );

        assertEquals("activado", respuesta.valor());
    }

    @Test
    void rechazaUnEstadoDeMantenimientoNoReconocido() {
        ResponseStatusException excepcion = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().actualizarConfiguracion(
                ConfiguracionService.CLAVE_MODO_MANTENIMIENTO,
                new ActualizarConfiguracionRequest("pausado")
            )
        );

        assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
        assertEquals("El modo de mantenimiento debe ser activado o desactivado", excepcion.getReason());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void identificaElModoMantenimientoActivo() {
        when(jdbcTemplate.query(
            contains("SELECT valor FROM configuracion"),
            ArgumentMatchers.<RowMapper<String>>any(),
            eq(ConfiguracionService.CLAVE_MODO_MANTENIMIENTO)
        )).thenReturn(List.of("activado"));

        assertTrue(crearServicio().estaModoMantenimientoActivo());
    }

    @Test
    void interpretaLaAusenciaDeConfiguracionComoMantenimientoDesactivado() {
        when(jdbcTemplate.query(
            anyString(),
            ArgumentMatchers.<RowMapper<String>>any(),
            eq(ConfiguracionService.CLAVE_MODO_MANTENIMIENTO)
        )).thenReturn(List.of());

        assertFalse(crearServicio().estaModoMantenimientoActivo());
    }

    private ConfiguracionService crearServicio() {
        return new ConfiguracionService(jdbcTemplate);
    }
}
