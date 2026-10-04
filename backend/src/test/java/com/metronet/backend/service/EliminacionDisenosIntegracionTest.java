package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.metronet.backend.controller.DisenoAdministracionController;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.controller.SimulacionController;
import com.metronet.backend.dto.LoginAdministradorRequest;
import com.metronet.backend.dto.LoginRequest;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** SQL, claves foráneas, servicios y autorización reales sobre H2; no toca PostgreSQL. */
class EliminacionDisenosIntegracionTest {
    private SingleConnectionDataSource fuente;
    private JdbcTemplate jdbc;
    private MockMvc http;
    private String admin, jugador;
    private ActividadAdministrativaService actividad;

    @BeforeEach
    void preparar() {
        fuente = new SingleConnectionDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "", true);
        new ResourceDatabasePopulator(
            new FileSystemResource("../database/002_creacion_tablas.sql"),
            new FileSystemResource("../database/005_apellido_usuario.sql"),
            new FileSystemResource("../database/007_simulaciones_jugador.sql"),
            new FileSystemResource("../database/014_progresion_educativa.sql")
        ).execute(fuente);
        jdbc = new JdbcTemplate(fuente);
        jdbc.execute("CREATE TABLE intento_catalogo_v1(id_intento INT, reglas_exito VARCHAR, herramientas_habilitadas VARCHAR, objetivo VARCHAR, instrucciones VARCHAR)");
        jdbc.execute("CREATE TABLE intento_uv_ut(id_intento INT, version INT, limite_ut INT, presupuesto_uv DECIMAL(8,2), reglas_exito VARCHAR, herramientas_habilitadas VARCHAR, objetivo VARCHAR, instrucciones VARCHAR)");
        jdbc.execute("CREATE TABLE resultado_uv_ut(id_simulacion INT, version INT, huella_problema VARCHAR, huella_ejecucion VARCHAR, limite_ut INT, presupuesto_uv DECIMAL(8,2), ut_ejecutadas INT, suma_uv DECIMAL(8,2), completo BOOLEAN, unidades VARCHAR)");
        jdbc.update("INSERT INTO usuario(id_usuario,nombre,email,password,rol) VALUES (7,'Admin','admin@example.test','prueba','ADMIN'),(8,'Jugador','jugador@example.test','prueba','JUGADOR')");
        jdbc.update("INSERT INTO diseno(id_diseno) VALUES (101),(102),(103)");
        jdbc.update("INSERT INTO escenario(id_escenario,nombre,modo) VALUES (201,'Red propia','EDICION_LIBRE'),(202,'Red ajena','EDICION_LIBRE')");
        jdbc.update("INSERT INTO escenario(id_escenario,nombre,modo,numero,progresivo) VALUES (203,'Nivel completado','NIVEL',99,TRUE)");
        jdbc.update("INSERT INTO intento(id_intento,id_usuario,id_escenario,id_diseno,estado,puntaje,progreso) VALUES (301,7,201,101,'GUARDADO',NULL,0),(302,8,202,102,'GUARDADO',NULL,0),(303,8,203,103,'COMPLETADO',100,100)");
        jdbc.update("INSERT INTO simulacion(id_intento,puntaje) VALUES (303,100)");
        jdbc.update("INSERT INTO linea(id_diseno,nombre,modificable) VALUES (103,'Línea 1',TRUE)");
        jdbc.update("INSERT INTO estacion(id_diseno,nombre,posicion_x,posicion_y,transbordo,modificable) VALUES (103,'Estación 1',10,20,FALSE,TRUE),(103,'Estación 2',20,30,FALSE,TRUE)");
        jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (103,'Línea 1','Estación 1')");
        jdbc.update("INSERT INTO tramo(id_diseno,nombre_linea,nombre_estacion_a,nombre_estacion_b) VALUES (103,'Línea 1','Estación 1','Estación 2')");
        jdbc.update("INSERT INTO metro(id_diseno,nombre_linea,capacidad,velocidad_promedio) VALUES (103,'Línea 1',300,40)");

        UsuarioRepository usuarios = mock(UsuarioRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.matches(anyString(), anyString())).thenReturn(true);
        Usuario administrador = usuario(7, Rol.ADMIN), propietario = usuario(8, Rol.JUGADOR);
        when(usuarios.findByIdentificadorAdministradorIgnoreCase("admin")).thenReturn(Optional.of(administrador));
        when(usuarios.findByEmailIgnoreCase("jugador@example.test")).thenReturn(Optional.of(propietario));
        when(usuarios.findById(7)).thenReturn(Optional.of(administrador));
        when(usuarios.findById(8)).thenReturn(Optional.of(propietario));
        AuthService auth = new AuthService(usuarios, encoder);
        admin = "Bearer " + auth.iniciarSesionAdministrador(new LoginAdministradorRequest("admin", "prueba")).token();
        jugador = "Bearer " + auth.iniciarSesion(new LoginRequest("jugador@example.test", "prueba")).token();
        var restricciones = mock(RestriccionesGeograficasService.class);
        var disenos = new DisenoAdministracionService(jdbc, restricciones);
        var objetivos = mock(ObjetivosPuntosInteresService.class);
        when(objetivos.obtenerObjetivos(anyString())).thenReturn(List.of());
        var simulaciones = new SimulacionService(jdbc, disenos, objetivos, mock(JuegoEducativoService.class), restricciones);
        actividad = mock(ActividadAdministrativaService.class);
        http = MockMvcBuilders.standaloneSetup(new DisenoAdministracionController(auth, disenos, actividad), new SimulacionController(auth, simulaciones)).build();
    }

    @AfterEach
    void cerrar() { if (fuente != null) fuente.destroy(); }

    @Test
    void administradorEliminaPropiosYAjenoYNoReaparecenEnNingunListado() throws Exception {
        http.perform(get("/api/admin/disenos").header("Authorization", admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].nombre").value("Red propia"))
            .andExpect(jsonPath("$[0].idUsuario").value(7));
        for (int id : new int[]{101, 102}) {
            http.perform(delete("/api/admin/disenos/" + id).header("Authorization", admin)).andExpect(status().isOk());
        }
        http.perform(get("/api/admin/disenos").header("Authorization", admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].idDiseno").value(103));
        http.perform(get("/api/simulaciones").header("Authorization", admin)).andExpect(jsonPath("$.length()").value(0));
        http.perform(get("/api/simulaciones").header("Authorization", jugador))
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].idDiseno").value(103));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM escenario WHERE id_escenario IN (201,202)", Integer.class));
        verify(actividad, times(2)).registrarActividad(any(), eq("Diseño eliminado"), anyString());
        http.perform(delete("/api/admin/disenos/102").header("Authorization", admin)).andExpect(status().isNotFound());
    }

    @Test
    void administradorPuedeBorrarCompletadoConIntentoPuntajeYRedSinBorrarElNivel() throws Exception {
        var mapper = new ObjectMapper();
        var puntuacion = new PuntuacionService(jdbc, mapper);
        assertEquals(100, puntuacion.ranking(8).puntajeTotal());
        http.perform(delete("/api/admin/disenos/103").header("Authorization", admin)).andExpect(status().isOk());
        for (String tabla : List.of("diseno", "intento", "linea", "estacion", "pasa", "tramo", "metro")) {
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM " + tabla + " WHERE id_diseno=103", Integer.class), tabla);
        }
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM simulacion WHERE id_intento=303", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM escenario WHERE id_escenario=203", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM diseno WHERE id_diseno=102", Integer.class));
        assertNull(jdbc.queryForObject("SELECT SUM(puntaje) FROM intento WHERE id_usuario=8", Integer.class));
        assertEquals(0, puntuacion.ranking(8).puntajeTotal());
        http.perform(get("/api/simulaciones").header("Authorization", jugador)).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void jugadorNoPuedeUsarBorradoAdministrativoNiBorrarAjenoOLogroProtegido() throws Exception {
        http.perform(delete("/api/admin/disenos/101").header("Authorization", jugador)).andExpect(status().isUnauthorized());
        http.perform(get("/api/admin/disenos").header("Authorization", jugador)).andExpect(status().isUnauthorized());
        http.perform(delete("/api/admin/disenos/101")).andExpect(status().isUnauthorized());
        http.perform(delete("/api/simulaciones/101").header("Authorization", jugador)).andExpect(status().isNotFound());
        http.perform(delete("/api/simulaciones/103").header("Authorization", jugador)).andExpect(status().isConflict());
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM diseno", Integer.class));
        verifyNoInteractions(actividad);
    }

    @Test
    void jugadorSiguePudiendoEliminarSuDisenoLibre() throws Exception {
        http.perform(delete("/api/simulaciones/102").header("Authorization", jugador)).andExpect(status().isOk());
        http.perform(get("/api/simulaciones").header("Authorization", jugador))
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].idDiseno").value(103));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM diseno WHERE id_diseno=102", Integer.class));
    }

    private Usuario usuario(int id, Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(id); usuario.setRol(rol); usuario.setNombre(rol.name());
        usuario.setEmail(rol == Rol.ADMIN ? "admin@example.test" : "jugador@example.test");
        usuario.setPassword("$2a$10$prueba");
        return usuario;
    }
}
