package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.service.AdministracionNivelesService;
import java.sql.DriverManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.web.server.ResponseStatusException;

/** Se ejecuta sobre el clúster descartable; todas las filas se revierten. */
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql:.*")
class LimpiezaHistorialNivelesPostgresTest {
    @Test
    void soloEliminaVersionesSinUsoYElArranqueNoDependeDeV1() throws Exception {
        try (var conexion=DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER","postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD",""))) {
            conexion.setAutoCommit(false);
            try {
                var jdbc=new JdbcTemplate(new SingleConnectionDataSource(conexion,true));
                var mapper=new ObjectMapper();
                var servicio=new AdministracionNivelesService(jdbc,mapper);
                int admin=jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol)
                    VALUES ('Limpieza QA','limpieza-qa@example.test','!sin-acceso','ADMIN') RETURNING id_usuario
                    """,Integer.class);
                int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1",Integer.class);
                long usada=jdbc.queryForObject("SELECT id_nivel_publicacion FROM nivel_publicacion WHERE id_escenario=? AND numero_version=1",Long.class,escenario);
                int diseno=jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno",Integer.class);
                jdbc.update("INSERT INTO intento(id_usuario,id_escenario,id_diseno,id_nivel_publicacion,estado,puntaje) VALUES (?,?,?,?,'COMPLETADO',80)",admin,escenario,diseno,usada);
                for(int version=3;version<=5;version++) {
                    long id=jdbc.queryForObject("""
                        INSERT INTO nivel_publicacion(id_escenario,numero_version,contenido,red_referencia,huella)
                        SELECT id_escenario,?,contenido,red_referencia,huella FROM nivel_publicacion
                        WHERE id_escenario=? AND numero_version=2 RETURNING id_nivel_publicacion
                        """,Long.class,version,escenario);
                    jdbc.update("""
                        INSERT INTO nivel_publicacion_tarjeta
                        SELECT ?,t.posicion,t.id_tarjeta,t.titulo,t.texto,t.aprendizaje,t.fuente,
                        t.url_fuente,t.descripcion_imagen,t.id_svg_catalogo,t.sha256_svg
                        FROM nivel_publicacion_tarjeta t JOIN nivel_publicacion p USING(id_nivel_publicacion)
                        WHERE p.id_escenario=? AND p.numero_version=2
                        """,id,escenario);
                }
                jdbc.update("UPDATE nivel_borrador SET version_base=4 WHERE id_escenario=?",escenario);
                var borrador=servicio.borrador(1);
                var otroNivel=servicio.versiones(2);
                assertTrue(jdbc.queryForObject("SELECT has_table_privilege('metronet_app','nivel_publicacion','DELETE')",Boolean.class));
                var obsoleta=assertThrows(ResponseStatusException.class,()->servicio.borrarVersionesSinUso(1,4,admin));
                assertEquals(HttpStatus.CONFLICT,obsoleta.getStatusCode());
                assertEquals(5,servicio.versiones(1).size());
                var resultado=servicio.borrarVersionesSinUso(1,5,admin);
                assertEquals(List.of(2,3),resultado.versionesEliminadas());
                assertEquals(3,resultado.versionesConservadas());
                assertEquals(List.of(5,4,1),servicio.versiones(1).stream().map(AdministracionNivelesService.Version::version).toList());
                assertEquals(borrador,servicio.borrador(1));
                assertEquals(otroNivel,servicio.versiones(2));
                assertEquals(80,jdbc.queryForObject("SELECT puntaje FROM intento WHERE id_diseno=?",Integer.class,diseno));
                assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM nivel_publicacion_tarjeta t LEFT JOIN nivel_publicacion p USING(id_nivel_publicacion) WHERE p.id_nivel_publicacion IS NULL",Integer.class));
                assertTrue(servicio.borrarVersionesSinUso(1,5,admin).versionesEliminadas().isEmpty());
                assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM actividad_administrativa WHERE id_administrador=?",Integer.class,admin));
                // En otro nivel V1 no está vinculada: puede borrarse y el preflight sigue válido.
                assertEquals(List.of(1),servicio.borrarVersionesSinUso(2,2,admin).versionesEliminadas());
                new PreflightAdministracionNiveles().verificarAdministracionNiveles(jdbc,mapper).run();
                // Y sigue detectando publicaciones vigentes incompletas.
                jdbc.update("DELETE FROM nivel_publicacion_tarjeta WHERE id_nivel_publicacion=(SELECT id_nivel_publicacion FROM nivel_publicacion WHERE id_escenario=? AND numero_version=5) AND posicion=7",escenario);
                assertThrows(IllegalStateException.class,()->new PreflightAdministracionNiveles().verificarAdministracionNiveles(jdbc,mapper).run());
            } finally { conexion.rollback(); }
        }
    }
}
