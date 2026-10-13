package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.*;
import java.nio.file.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class ExtrasModoLibrePostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username",()->System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password",()->System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto",()->"validate");
        r.add("METRONET_CORS_ORIGENES",()->"http://127.0.0.1:5198");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired ExtrasModoLibreService extras;
    @Autowired TrofeosService trofeos;
    @Autowired RecorridoIntegralService recorrido;
    @MockitoBean ServicioCorreo correo;
    @LocalServerPort int puerto;

    private Usuario usuario(String nombre, Rol rol, boolean elegible) {
        int id=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol,campana_completada_historicamente) VALUES (?,?,?,?,?) RETURNING id_usuario",
            Integer.class,nombre,nombre+"@example.test",encoder.encode("ExtrasQA!7"),rol.name(),elegible);
        var u=new Usuario();u.setIdUsuario(id);u.setRol(rol);return u;
    }
    private void redLibre(Usuario u) {
        int diseno=jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno",Integer.class);
        jdbc.update("INSERT INTO intento(id_usuario,id_escenario,id_diseno,estado) SELECT ?,id_escenario,?,'INICIADO' FROM escenario WHERE modo='EDICION_LIBRE' LIMIT 1",u.getIdUsuario(),diseno);
    }
    @Test void permisosPersistenciaYEntregaConcurrenteUnica() throws Exception {
        var bloqueado=usuario("extras-bloqueado",Rol.JUGADOR,false);
        assertFalse(extras.consultar(bloqueado).desbloqueado());
        assertEquals(403,assertThrows(ResponseStatusException.class,()->extras.ingresar(bloqueado)).getStatusCode().value());
        assertEquals(403,assertThrows(ResponseStatusException.class,()->extras.visitar(bloqueado,1)).getStatusCode().value());
        var jugador=usuario("extras-concurrente",Rol.JUGADOR,true);redLibre(jugador);
        assertTrue(extras.ingresar(jugador).desbloqueado());
        assertEquals("Premio oculto",trofeos.consultar(jugador).getLast().nombre());
        assertEquals("???",trofeos.consultar(jugador).getLast().requisito());
        extras.bienvenida(jugador);
        for(int i=1;i<=6;i++)extras.visitar(jugador,i);
        extras.visitar(jugador,1);
        assertEquals(6,extras.consultar(jugador).visitadas().size());
        assertFalse(extras.consultar(jugador).premioObtenido());
        assertEquals(404,assertThrows(ResponseStatusException.class,()->extras.visitar(jugador,8)).getStatusCode().value());
        try(var ejecutor=Executors.newFixedThreadPool(2)) {
            var salida=new CountDownLatch(1);
            Callable<ExtrasModoLibreService.Estado> visita=()->{salida.await();return extras.visitar(jugador,7);};
            var a=ejecutor.submit(visita);var b=ejecutor.submit(visita);salida.countDown();
            assertEquals(1,(a.get().nuevoTrofeo()!=null?1:0)+(b.get().nuevoTrofeo()!=null?1:0));
        }
        assertTrue(trofeos.consultar(jugador).getLast().obtenido());
        jdbc.update("UPDATE usuario SET numero_campana_actual=numero_campana_actual+1 WHERE id_usuario=?",jugador.getIdUsuario());
        assertEquals(7,extras.consultar(jugador).visitadas().size());
        assertTrue(extras.consultar(jugador).bienvenidaVista());
        assertNull(extras.visitar(jugador,7).nuevoTrofeo());
        assertFalse(extras.consultar(bloqueado).premioObtenido());
        var admin=usuario("extras-admin-test",Rol.ADMIN,true);redLibre(admin);extras.ingresar(admin);
        for(int i=1;i<=7;i++)assertNull(extras.visitar(admin,i).nuevoTrofeo());
        assertFalse(trofeos.consultar(admin).getLast().obtenido());
    }
    @Test void navegadorServidorYPostgres() throws Exception {
        if(!"true".equals(System.getenv("METRONET_E2E_EXTRAS"))) { org.junit.jupiter.api.Assumptions.abort("Navegador requiere METRONET_E2E_EXTRAS=true"); }
        var admin=usuario("extras-editorial",Rol.ADMIN,true);recorrido.publicar(admin.getIdUsuario());
        var jugador=usuario("extras-browser",Rol.JUGADOR,true);
        usuario("extras-entrada",Rol.JUGADOR,true);
        var salida=Path.of("/tmp/metronet-extras-browser.log");
        var proceso=new ProcessBuilder("node","--test","tests/extras-modo-libre-e2e.test.cjs")
            .directory(Path.of("../frontend").toFile()).redirectErrorStream(true).redirectOutput(salida.toFile());
        proceso.environment().put("METRONET_API_PRUEBAS","http://127.0.0.1:"+puerto);
        proceso.environment().put("METRONET_E2E_CLAVE","ExtrasQA!7");
        var ejecucion=proceso.start();boolean termino=ejecucion.waitFor(4,TimeUnit.MINUTES);
        if(!termino)ejecucion.destroyForcibly();
        System.out.println(Files.readString(salida));assertTrue(termino);assertEquals(0,ejecucion.exitValue());
        assertEquals(7,jdbc.queryForObject("SELECT COUNT(*) FROM aprendizaje_extra_visita WHERE id_usuario=?",Integer.class,jugador.getIdUsuario()));
        assertTrue(extras.consultar(jugador).premioObtenido());
    }
}
