package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AprendizajeService;
import com.metronet.backend.service.ContenidoPublicadoNivelService;
import com.metronet.backend.service.PuntuacionService;
import com.metronet.backend.service.TrofeosService;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.web.server.ResponseStatusException;

/** Solo se ejecuta en el clúster descartable preparado por probar-postgres.sh. */
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",
    matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class AprendizajeTrofeosPostgresTest {
    @Test void historialDeSeisTarjetasDesbloqueaSieteActualesYTrofeosUsanMejorIntento() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv("METRONET_TEST_POSTGRES_USER"), System.getenv("METRONET_TEST_POSTGRES_PASSWORD"))) {
            conexion.setAutoCommit(false);
            try {
                var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
                var mapper = new ObjectMapper();
                var contenido = new ContenidoPublicadoNivelService(jdbc, mapper);
                var aprendizaje = new AprendizajeService(jdbc, contenido);
                var trofeos = new TrofeosService(jdbc, new PuntuacionService(jdbc, mapper));
                var vacio = usuario(jdbc, "vacio", Rol.JUGADOR);
                var parcial = usuario(jdbc, "parcial", Rol.JUGADOR);
                var completo = usuario(jdbc, "completo", Rol.JUGADOR);
                var admin = usuario(jdbc, "admin", Rol.ADMIN);

                assertEquals(0, desbloqueados(aprendizaje, vacio));
                assertEquals(403, assertThrows(ResponseStatusException.class,
                    () -> aprendizaje.contenido(1, vacio)).getStatusCode().value());
                int intentoHistorico = completar(jdbc, parcial, 1, 1, 80, 1);
                completar(jdbc, parcial, 4, 2, 90, 2);
                assertEquals(6, contenido.deIntento(intentoHistorico, parcial.getIdUsuario()).tarjetas().size());
                assertEquals(2, desbloqueados(aprendizaje, parcial));
                assertEquals(7, aprendizaje.contenido(1, parcial).tarjetas().size());
                assertEquals(403, assertThrows(ResponseStatusException.class,
                    () -> aprendizaje.contenido(2, parcial)).getStatusCode().value());
                assertEquals(10, desbloqueados(aprendizaje, admin));
                assertEquals(70, aprendizaje.niveles(admin).stream()
                    .mapToInt(n -> n.contenido().tarjetas().size()).sum());
                assertTrue(trofeos.consultar(admin).stream().noneMatch(TrofeosService.Trofeo::obtenido));

                for (int numero=1; numero<=10; numero++) completar(jdbc, completo, numero, 1,
                    numero == 5 ? 99 : 100, 2);
                assertEquals(10, desbloqueados(aprendizaje, completo));
                assertFalse(trofeos.consultar(completo).getFirst().obtenido());
                assertTrue(trofeos.consultar(completo).stream().skip(1)
                    .allMatch(TrofeosService.Trofeo::obtenido));
                completar(jdbc, completo, 5, 2, 100, 2);
                assertTrue(trofeos.consultar(completo).stream().allMatch(TrofeosService.Trofeo::obtenido));
            } finally { conexion.rollback(); }
        }
    }

    private int desbloqueados(AprendizajeService servicio, Usuario usuario) {
        return (int) servicio.niveles(usuario).stream().filter(AprendizajeService.Nivel::desbloqueado).count();
    }

    private Usuario usuario(JdbcTemplate jdbc, String etiqueta, Rol rol) {
        int id = jdbc.queryForObject("""
            INSERT INTO usuario(nombre,email,password,rol) VALUES (?,?,'!prueba-inhabilitada',?) RETURNING id_usuario
            """, Integer.class, "QA " + etiqueta, "qa-" + etiqueta + "@example.invalid", rol.name());
        var usuario = new Usuario(); usuario.setIdUsuario(id); usuario.setRol(rol); return usuario;
    }

    private int completar(JdbcTemplate jdbc, Usuario usuario, int numero, int campana, int puntos, int version) {
        int diseno = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
        return jdbc.queryForObject("""
            INSERT INTO intento(id_usuario,id_escenario,id_diseno,numero_campana,estado,puntaje,id_nivel_publicacion)
            SELECT ?,e.id_escenario,?,?,'COMPLETADO',?,p.id_nivel_publicacion
            FROM escenario e JOIN nivel_publicacion p ON p.id_escenario=e.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=? AND p.numero_version=?
            RETURNING id_intento
            """, Integer.class, usuario.getIdUsuario(), diseno, campana, puntos, numero, version);
    }
}
