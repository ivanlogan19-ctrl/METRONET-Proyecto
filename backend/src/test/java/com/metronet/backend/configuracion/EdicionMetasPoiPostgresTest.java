package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.*;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class EdicionMetasPoiPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username",()->System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password",()->System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto",()->"validate");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired JuegoEducativoService juego;
    @Autowired RecorridoIntegralService recorrido;
    @Autowired AdministracionNivelesService borradores;
    @Autowired PublicacionNivelService publicaciones;
    @Autowired GeografiaService geografia;
    @MockitoBean ServicioCorreo correo;

    @Test void publicaMetaYUnPoiEnNivelUnoSinCambiarIntentosAnteriores() throws Exception {
        int admin=usuario("admin-metas@example.test");
        recorrido.publicar(admin);
        int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1",Integer.class);
        int anterior=juego.iniciarEscenario(admin,escenario).idDiseno();
        var borrador=borradores.borrador(1);
        ObjectNode reglas=borrador.contenido().path("reglasExito").deepCopy();
        reglas.put("minimoEstaciones",1);
        reglas.putObject("textosMetas").put("minimoEstaciones","Ubicá {cantidad} estaciones para comenzar");
        reglas.put("requierePoiIndividuales",true);
        reglas.putArray("puntosInteresObjetivo").addObject().put("idPunto",1).put("radioCobertura",40);
        ObjectNode red=borrador.redReferencia().deepCopy();
        var punto=geografia.resolverPunto(1,null);
        ((ObjectNode)red.path("estaciones").get(0)).put("x",geografia.posicionX(punto)).put("y",geografia.posicionY(punto));
        var c=borrador.contenido();
        var guardado=borradores.guardar(1,new EdicionNivelRequest(borrador.versionBase(),borrador.revision(),
            c.path("desafio"),reglas,c.path("herramientasHabilitadas"),c.path("criterioUvUt"),red,c.path("ayudas"),borrador.tarjetas()),admin);
        assertEquals(reglas,guardado.contenido().path("reglasExito"));
        var vista=publicaciones.previsualizar(1,admin);
        assertTrue(vista.diagnostico().viable(),vista.diagnostico().mensaje());
        assertTrue(vista.diagnostico().condiciones().stream().anyMatch(m->m.clave().equals("poi:1")&&m.completado()));
        publicaciones.publicar(1,new PublicarNivelRequest(vista.versionPublicada(),vista.revisionBorrador(),vista.diagnostico().huella(),true),admin);
        Usuario antes=new Usuario();antes.setIdUsuario(admin);antes.setRol(Rol.ADMIN);
        assertEquals(2,juego.obtenerConsigna(antes,anterior).condiciones().stream().filter(m->m.clave().equals("minimoEstaciones")).findFirst().orElseThrow().requerido());
        int nuevoUsuario=usuario("nuevo-metas@example.test");
        int nuevo=juego.iniciarEscenario(nuevoUsuario,escenario).idDiseno();
        Usuario jugador=new Usuario();jugador.setIdUsuario(nuevoUsuario);jugador.setRol(Rol.ADMIN);
        var consigna=juego.obtenerConsigna(jugador,nuevo);
        var meta=consigna.condiciones().stream().filter(m->m.clave().equals("minimoEstaciones")).findFirst().orElseThrow();
        assertEquals(1,meta.requerido());assertEquals("Ubicá 1 estaciones para comenzar",meta.texto());
        assertTrue(meta.textoPersonalizado());assertFalse(meta.completado());
        assertEquals(5,consigna.condiciones().stream().filter(m->!m.clave().startsWith("poi:")).count());
        assertEquals(1,consigna.referenciasObjetivo().size());
        assertEquals("Palacio Legislativo",consigna.referenciasObjetivo().getFirst().nombrePunto());
        assertFalse(consigna.referenciasObjetivo().getFirst().cubierto());
    }
    private int usuario(String email) {
        return jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Metas QA',?,'!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class,email);
    }
}
