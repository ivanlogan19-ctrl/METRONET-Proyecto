package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.*;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.UsuarioRepository;
import com.metronet.backend.service.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class SeguridadPostgresTest {
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
    @Autowired UsuarioService gestion;
    @Autowired JuegoEducativoService juego;
    @Autowired RecuperacionContrasenaService recuperacion;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ServicioCorreo correo;
    private final List<Integer> creados = new ArrayList<>();
    private Usuario crear(Rol rol) {
        String clave = UUID.randomUUID().toString();
        Usuario u = new Usuario(); u.setNombre("Auditoría"); u.setApellido("Prueba");
        u.setEmail(clave+"@example.test"); u.setPassword(encoder.encode("Clave1!")); u.setRol(rol);
        if (rol==Rol.ADMIN) u.setIdentificadorAdministrador(clave);
        u=usuarios.save(u); creados.add(u.getIdUsuario()); return u;
    }
    private String token(Usuario u) {
        return "Bearer " + (u.getRol()==Rol.ADMIN
            ? auth.iniciarSesionAdministrador(new LoginAdministradorRequest(u.getIdentificadorAdministrador(), "Clave1!")).token()
            : auth.iniciarSesion(new LoginRequest(u.getEmail(), "Clave1!")).token());
    }
    @AfterEach void limpiar() { creados.forEach(gestion::eliminarUsuario); }

    @Test void idorNoPermiteLeerModificarSimularNiBorrarDisenoAjeno() throws Exception {
        Usuario a=crear(Rol.JUGADOR), b=crear(Rol.JUGADOR);
        String sesionA=token(a), sesionB=token(b);
        Integer nivel = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1", Integer.class);
        int diseno=juego.iniciarEscenario(b.getIdUsuario(),nivel).idDiseno();
        String raiz="/api/simulaciones/"+diseno;
        for (String caso : new String[]{"GET "+raiz,"GET "+raiz+"/resultados","GET "+raiz+"/validacion",
                "DELETE "+raiz,"POST "+raiz+"/guardar","POST "+raiz+"/validacion",
                "POST "+raiz+"/estaciones","POST "+raiz+"/lineas","POST "+raiz+"/unidades",
                "POST "+raiz+"/ejecutar","PATCH "+raiz+"/estaciones/A","DELETE "+raiz+"/lineas/A",
                "POST "+raiz+"/tramos","POST /api/juego/disenos/"+diseno+"/evaluar",
                "GET /api/juego/disenos/"+diseno+"/consigna"}) {
            String[] partes=caso.split(" ");
            http.perform(request(HttpMethod.valueOf(partes[0]),partes[1]).header("Authorization",sesionA)
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        }
        http.perform(get(raiz).header("Authorization",sesionB)).andExpect(status().isOk())
            .andExpect(jsonPath("$.estaciones.length()").value(0));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM diseno WHERE id_diseno=?",Integer.class,diseno));
    }

    @Test void rutasAdministrativasRechazanAnonimoYJugadorYAdmitenAdministrador() throws Exception {
        String jugador=token(crear(Rol.JUGADOR)), admin=token(crear(Rol.ADMIN));
        for (String ruta : new String[]{"/api/admin/usuarios","/api/admin/disenos","/api/admin/configuracion","/api/admin/actividades",
                "/api/admin/niveles/criterio-uvut", "/api/admin/niveles",
                "/api/admin/niveles/1/borrador", "/api/admin/niveles/1/versiones"}) {
            http.perform(get(ruta)).andExpect(status().isUnauthorized());
            http.perform(get(ruta).header("Authorization",jugador)).andExpect(status().isUnauthorized());
            http.perform(get(ruta).header("Authorization",admin)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control","no-store"));
        }
        for (String caso : new String[]{"DELETE /api/admin/usuarios/999","PATCH /api/admin/usuarios/999/rol",
                "DELETE /api/admin/disenos/999","PATCH /api/admin/configuracion/modo_mantenimiento",
                "POST /api/admin/niveles/criterio-uvut/4/previsualizar","PUT /api/admin/niveles/criterio-uvut/4",
                "PUT /api/admin/niveles/1/borrador", "POST /api/admin/niveles/1/previsualizar",
                "POST /api/admin/niveles/1/publicar",
                "POST /api/admin/niveles/1/versiones/1/preparar-reversion"}) {
            String[] p=caso.split(" ");
            http.perform(request(HttpMethod.valueOf(p[0]),p[1]).header("Authorization",jugador)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        }
    }

    @Test void reenvioRealUsaTransaccionYCodigoSoloAutorizaUnCambio() throws Exception {
        Usuario u=crear(Rol.JUGADOR); String sesion=token(u);
        when(correo.estaDisponible()).thenReturn(true);
        var codigo=org.mockito.ArgumentCaptor.forClass(String.class);
        recuperacion.reenviarCodigo(u.getEmail()); // Sin transacción externa: prueba la frontera real del Service.
        verify(correo).enviarCodigoRecuperacion(eq(u.getEmail()),codigo.capture());
        String hash=jdbc.queryForObject("SELECT codigo_hash FROM solicitud_recuperacion_contrasena WHERE id_usuario=?",String.class,u.getIdUsuario());
        assertNotEquals(codigo.getValue(),hash); assertTrue(encoder.matches(codigo.getValue(),hash));
        var permiso=recuperacion.verificarCodigo(new VerificarCodigoRecuperacionRequest(u.getEmail(), null, codigo.getValue()));
        var cambio=new CambiarContrasenaRecuperacionRequest(permiso.idSolicitud(),permiso.tokenRecuperacion(),"Nueva1!","Nueva1!");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> recuperacion.cambiarContrasena(
            new CambiarContrasenaRecuperacionRequest(permiso.idSolicitud(),"token-no-valido","Nueva1!","Nueva1!")));
        recuperacion.cambiarContrasena(cambio);
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> recuperacion.cambiarContrasena(cambio));
        http.perform(get("/auth/perfil").header("Authorization",sesion)).andExpect(status().isUnauthorized());
        assertNotNull(auth.iniciarSesion(new LoginRequest(u.getEmail(),"Nueva1!")).token());
    }

    @Test void registroYPerfilIgnoranRolEIdentidadEnviadosPorElCliente() throws Exception {
        String email=UUID.randomUUID()+"@example.test";
        String nombre="O'Reilly'; SELECT 1; --";
        String body=json.writeValueAsString(java.util.Map.of("nombre",nombre,"apellido","Prueba","email",email,
            "password","Clave1!","aceptaDatos",true,"rol","ADMIN","idUsuario",999));
        var respuesta=http.perform(post("/auth/registro").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rol").value("JUGADOR"))
            .andExpect(jsonPath("$.password").doesNotExist()).andReturn();
        int id=json.readTree(respuesta.getResponse().getContentAsString()).get("idUsuario").asInt();
        creados.add(id);
        Usuario usuario=usuarios.findById(id).orElseThrow();
        assertEquals(nombre,usuario.getNombre());
        String sesion=token(usuario);
        http.perform(patch("/auth/perfil/datos-personales").header("Authorization",sesion)
            .contentType(MediaType.APPLICATION_JSON).content("{\"nombre\":\"Actualizado\",\"apellido\":\"Prueba\",\"rol\":\"ADMIN\",\"idUsuario\":999}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rol").value("JUGADOR"));
        assertEquals(Rol.JUGADOR,usuarios.findById(id).orElseThrow().getRol());
        http.perform(get("/auth/perfil").header("Authorization","Bearer token-inventado"))
            .andExpect(status().isUnauthorized());
    }

    @Test void corsSqlInjectionDatosMalformadosYHeaders() throws Exception {
        http.perform(options("/auth/login").header("Origin","https://example.invalid")
            .header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
        http.perform(options("/auth/login").header("Origin","http://127.0.0.1:5173")
            .header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","Content-Type"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://127.0.0.1:5173"));
        http.perform(post("/auth/login/admin").contentType(MediaType.APPLICATION_JSON)
            .content("{\"usuario\":\"' OR '1'='1\",\"password\":\"Clave1!\"}"))
            .andExpect(status().isUnauthorized()).andExpect(header().string("X-Content-Type-Options","nosniff"));
        http.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{invalido"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").exists())
            .andExpect(jsonPath("$.trace").doesNotExist());
    }
}
