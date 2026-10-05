package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class TrofeosServiceTest {
    private Usuario usuario(Rol rol) {
        var usuario = new Usuario(); usuario.setIdUsuario(42); usuario.setRol(rol); return usuario;
    }

    @Test void usaLogrosDistintosYMejorPuntajeSinAtribuirPremiosAlAdmin() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        var puntuacion = mock(PuntuacionService.class);
        var completados = new AtomicInteger(5);
        when(puntuacion.maximo(anyString())).thenReturn(100);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(42))).thenAnswer(invocacion -> {
            @SuppressWarnings("unchecked") RowMapper<Object> mapper = invocacion.getArgument(1);
            List<Object> filas = new ArrayList<>();
            for (int numero=1; numero<=10; numero++) {
                var r = mock(java.sql.ResultSet.class);
                when(r.getInt(1)).thenReturn(numero);
                when(r.getString(2)).thenReturn("{}");
                when(r.getObject(3)).thenReturn(numero <= completados.get() ? numero : null);
                when(r.getObject(4, Integer.class)).thenReturn(numero <= completados.get()
                    ? (numero == 5 && completados.get() == 5 ? 90 : 100) : null);
                filas.add(mapper.mapRow(r, numero - 1));
            }
            return filas;
        });
        var servicio = new TrofeosService(jdbc, puntuacion);
        completados.set(0);
        assertTrue(servicio.consultar(usuario(Rol.JUGADOR)).stream().noneMatch(TrofeosService.Trofeo::obtenido));
        completados.set(5);
        var parcial = servicio.consultar(usuario(Rol.JUGADOR));
        assertEquals(List.of(false, false, false, true, true), parcial.stream()
            .map(TrofeosService.Trofeo::obtenido).toList());
        completados.set(10);
        assertTrue(servicio.consultar(usuario(Rol.JUGADOR)).stream().allMatch(TrofeosService.Trofeo::obtenido));
        assertTrue(servicio.consultar(usuario(Rol.ADMIN)).stream().noneMatch(TrofeosService.Trofeo::obtenido));
    }
}
