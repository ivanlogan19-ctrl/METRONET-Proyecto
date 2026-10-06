package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.metronet.backend.controller.ActividadAdministrativaController;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

/** Ejercita el borrado y su autorización en H2, sin usar la base de datos del juego. */
class ActividadAdministrativaEliminacionTest {
    private SingleConnectionDataSource fuente;
    private JdbcTemplate jdbc;
    private MockMvc http;

    @BeforeEach
    void preparar() {
        fuente = new SingleConnectionDataSource(
            "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "", true
        );
        new ResourceDatabasePopulator(
            new FileSystemResource("../database/002_creacion_tablas.sql"),
            new FileSystemResource("../database/013_historial_administracion.sql")
        ).execute(fuente);
        jdbc = new JdbcTemplate(fuente);
        jdbc.update("INSERT INTO usuario(id_usuario,nombre,email,password,rol) VALUES (7,'Alex','alex@example.test','prueba','ADMIN')");
        jdbc.update("INSERT INTO actividad_administrativa(id_actividad,id_administrador,accion,detalle) VALUES "
            + "(501,7,'Rol actualizado','Usuario 7'),(502,7,'Nivel publicado','Nivel 1')");

        AuthService auth = mock(AuthService.class);
        when(auth.obtenerAdministradorAutorizado("Bearer jugador"))
            .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo administradores"));
        http = MockMvcBuilders.standaloneSetup(new ActividadAdministrativaController(
            new ActividadAdministrativaService(jdbc), auth
        )).build();
    }

    @AfterEach
    void cerrar() {
        if (fuente != null) fuente.destroy();
    }

    @Test
    void borraUnaEntradaYSenalaSiYaNoExiste() throws Exception {
        http.perform(delete("/api/admin/actividades/501").header("Authorization", "Bearer admin"))
            .andExpect(status().isNoContent());
        assertEquals(1, contar());
        assertEquals(502, jdbc.queryForObject("SELECT id_actividad FROM actividad_administrativa", Integer.class));
        http.perform(delete("/api/admin/actividades/501").header("Authorization", "Bearer admin"))
            .andExpect(status().isNotFound());
    }

    @Test
    void borraTodoSoloConAccesoDeAdministrador() throws Exception {
        http.perform(delete("/api/admin/actividades").header("Authorization", "Bearer jugador"))
            .andExpect(status().isForbidden());
        assertEquals(2, contar());
        http.perform(delete("/api/admin/actividades").header("Authorization", "Bearer admin"))
            .andExpect(status().isNoContent());
        assertEquals(0, contar());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM usuario", Integer.class));
    }

    private int contar() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM actividad_administrativa", Integer.class);
    }
}
