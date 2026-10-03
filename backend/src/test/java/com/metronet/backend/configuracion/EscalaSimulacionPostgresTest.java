package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.*;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import com.metronet.backend.service.*;
import java.util.UUID;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class EscalaSimulacionPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username", () -> System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password", () -> System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired UsuarioRepository usuarios;
    @Autowired PasswordEncoder encoder;
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    @Autowired CondicionesGeograficasService condiciones;
    @MockitoBean ServicioCorreo correo;

    @ParameterizedTest @EnumSource(Rol.class)
    void contratoRestPersistenciaYRecuperacionConservanMagnitudesEHistoricos(Rol rol) throws Exception {
        var u = new Usuario(); String identificador = UUID.randomUUID().toString();
        u.setNombre("Escala de prueba"); u.setEmail(identificador + "@example.test");
        u.setPassword(encoder.encode("Clave1!")); u.setRol(rol);
        if (rol == Rol.ADMIN) u.setIdentificadorAdministrador(identificador);
        u = usuarios.saveAndFlush(u);
        jdbc.update("UPDATE usuario SET campana_completada_historicamente=TRUE WHERE id_usuario=?", u.getIdUsuario());
        String token = "Bearer " + (rol == Rol.ADMIN
            ? auth.iniciarSesionAdministrador(new LoginAdministradorRequest(identificador, "Clave1!")).token()
            : auth.iniciarSesion(new LoginRequest(u.getEmail(), "Clave1!")).token());
        int id = enviar("/api/simulaciones", "{\"nombre\":\"Escala didáctica\"}", token).path("idDiseno").asInt();
        String ruta = "/api/simulaciones/" + id;
        enviar(ruta + "/estaciones", "{\"nombre\":\"A\",\"posicionX\":660,\"posicionY\":460}", token);
        enviar(ruta + "/estaciones", "{\"nombre\":\"B\",\"posicionX\":670,\"posicionY\":460}", token);
        enviar(ruta + "/lineas", "{\"nombre\":\"Línea\",\"estaciones\":[\"A\",\"B\"]}", token);
        int metro = enviar(ruta + "/unidades", "{\"nombreLinea\":\"Línea\",\"capacidad\":300,\"velocidadPromedio\":4}", token).path("idTren").asInt();
        enviar(ruta + "/guardar", "{}", token);
        enviar(ruta + "/validacion", "{}", token);
        for (int ritmo : new int[]{1, 2}) {
            var resultado = enviar(ruta + "/ejecutar", "{\"velocidad\":" + ritmo + ",\"duracion\":6}", token);
            assertEquals("UV_H_V1", resultado.path("escala").asText());
            assertEquals(6, resultado.path("duracion").asInt());
            assertEquals(ritmo, resultado.path("velocidad").asInt());
            assertEquals(4, resultado.path("unidades").get(0).path("velocidad").asInt());
            assertFalse(resultado.path("comentarios").asText().contains("METRONET-"));
            var recuperado = json.readTree(http.perform(get(ruta + "/resultados").header("Authorization", token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertEquals(resultado, recuperado.get(0));
            assertEquals(4d, jdbc.queryForObject("SELECT velocidad_promedio FROM metro WHERE id_diseno=? AND id_tren=?", Double.class, id, metro));
        }
        for (String horas : new String[]{"0", "-1", "null", "1.5"}) {
            http.perform(post(ruta + "/ejecutar").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"velocidad\":1,\"duracion\":" + horas + "}")).andExpect(status().isBadRequest());
        }
        for (String uv : new String[]{"0", "-1", "null", "0.001"}) {
            http.perform(patch(ruta + "/unidades/" + metro).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombreLinea\":\"Línea\",\"capacidad\":300,\"velocidadPromedio\":" + uv + "}")).andExpect(status().isBadRequest());
        }
        int intento = jdbc.queryForObject("SELECT id_intento FROM intento WHERE id_diseno=?", Integer.class, id);
        jdbc.update("INSERT INTO simulacion(id_intento,velocidad,duracion,comentarios,estado) VALUES (?,1,60,'Registro anterior en segundos','COMPLETADA')", intento);
        http.perform(get(ruta + "/resultados").header("Authorization", token)).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].escala").value("HISTORICA")).andExpect(jsonPath("$[0].duracion").value(60))
            .andExpect(jsonPath("$[0].unidades").isEmpty());
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM simulacion WHERE id_intento=?", Integer.class, intento));
    }

    @Test
    void resultadoCuentaSoloTransbordosEntreLineas() throws Exception {
        var u = new Usuario(); String identificador = UUID.randomUUID().toString();
        u.setNombre("Transbordo de prueba"); u.setEmail(identificador + "@example.test");
        u.setPassword(encoder.encode("Clave1!")); u.setRol(Rol.ADMIN); u.setIdentificadorAdministrador(identificador);
        usuarios.saveAndFlush(u);
        String token = "Bearer " + auth.iniciarSesionAdministrador(new LoginAdministradorRequest(identificador, "Clave1!")).token();
        int id = enviar("/api/simulaciones", "{\"nombre\":\"Transbordos\"}", token).path("idDiseno").asInt();
        String ruta = "/api/simulaciones/" + id;
        enviar(ruta + "/estaciones", "{\"nombre\":\"A\",\"posicionX\":660,\"posicionY\":460}", token);
        enviar(ruta + "/estaciones", "{\"nombre\":\"B\",\"posicionX\":670,\"posicionY\":460}", token);
        enviar(ruta + "/estaciones", "{\"nombre\":\"C\",\"posicionX\":680,\"posicionY\":460}", token);
        enviar(ruta + "/lineas", "{\"nombre\":\"Azul\",\"estaciones\":[\"A\",\"B\",\"C\"]}", token);
        enviar(ruta + "/unidades", "{\"nombreLinea\":\"Azul\",\"capacidad\":300,\"velocidadPromedio\":4}", token);
        http.perform(patch(ruta + "/estaciones/A").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nombre\":\"A\",\"posicionX\":660,\"posicionY\":460,\"transbordo\":true}"))
            .andExpect(status().isOk());
        enviar(ruta + "/validacion", "{}", token);
        var sinSegundaLinea = enviar(ruta + "/ejecutar", "{\"velocidad\":1,\"duracion\":6}", token);
        assertTrue(sinSegundaLinea.path("comentarios").asText().contains("0 punto(s) de transbordo"));

        enviar(ruta + "/estaciones", "{\"nombre\":\"D\",\"posicionX\":690,\"posicionY\":460}", token);
        enviar(ruta + "/lineas", "{\"nombre\":\"Rosa\",\"estaciones\":[\"A\",\"C\",\"D\"]}", token);
        cambiarTransbordo(ruta, token, "A", 660, false);
        assertEquals(0, transbordosDeConsigna(id));
        cambiarTransbordo(ruta, token, "A", 660, true);
        assertEquals(1, transbordosDeConsigna(id));
        enviar(ruta + "/validacion", "{}", token);
        var conSegundaLinea = enviar(ruta + "/ejecutar", "{\"velocidad\":1,\"duracion\":6}", token);
        assertTrue(conSegundaLinea.path("comentarios").asText().contains("1 punto(s) de transbordo"));
        assertEquals(1, transbordosDeConsigna(id));

        http.perform(patch(ruta + "/tramos").header("Authorization", token)
            .param("lineaActual", "Rosa").param("estacionAActual", "A").param("estacionBActual", "C")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nombreLinea\":\"Rosa\",\"estacionA\":\"B\",\"estacionB\":\"C\"}"))
            .andExpect(status().isOk());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM pasa WHERE id_diseno=? AND nombre_linea='Rosa' AND nombre_estacion='A'", Integer.class, id));
        assertEquals(0, transbordosDeConsigna(id));
        enviar(ruta + "/validacion", "{}", token);
        var sinConexionReal = enviar(ruta + "/ejecutar", "{\"velocidad\":1,\"duracion\":6}", token);
        assertTrue(sinConexionReal.path("comentarios").asText().contains("0 punto(s) de transbordo"));

        cambiarTransbordo(ruta, token, "B", 670, true);
        assertEquals(1, transbordosDeConsigna(id));
        http.perform(delete(ruta + "/tramos").header("Authorization", token)
            .param("linea", "Rosa").param("estacionA", "B").param("estacionB", "C"))
            .andExpect(status().isOk());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM pasa WHERE id_diseno=? AND nombre_linea='Rosa' AND nombre_estacion='B'", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM pasa WHERE id_diseno=? AND nombre_linea='Rosa' AND nombre_estacion='C'", Integer.class, id));
        assertEquals(0, transbordosDeConsigna(id));
        enviar(ruta + "/validacion", "{}", token);
        var trasEliminar = enviar(ruta + "/ejecutar", "{\"velocidad\":1,\"duracion\":6}", token);
        assertTrue(trasEliminar.path("comentarios").asText().contains("0 punto(s) de transbordo"));
    }

    private void cambiarTransbordo(String ruta, String token, String nombre, int x, boolean transbordo) throws Exception {
        http.perform(patch(ruta + "/estaciones/" + nombre).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nombre\":\"" + nombre + "\",\"posicionX\":" + x + ",\"posicionY\":460,\"transbordo\":" + transbordo + "}"))
            .andExpect(status().isOk());
    }

    private int transbordosDeConsigna(int idDiseno) {
        return condiciones.evaluar(idDiseno, Map.of("minimoTransbordos", 1), java.util.List.of()).stream()
            .filter(condicion -> condicion.clave().equals("minimoTransbordos"))
            .findFirst().orElseThrow().actual();
    }
    private JsonNode enviar(String ruta, String cuerpo, String token) throws Exception {
        return json.readTree(http.perform(post(ruta).header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content(cuerpo))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
}
