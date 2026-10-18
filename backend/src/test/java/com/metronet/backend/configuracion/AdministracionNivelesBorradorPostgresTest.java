package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.EdicionNivelRequest;
import com.metronet.backend.service.AdministracionNivelesService;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.web.server.ResponseStatusException;

/** Borrador y revisión optimista sobre 018 en PostgreSQL descartable. */
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql:.*")
class AdministracionNivelesBorradorPostgresTest {
    @Test
    void guardaUnaRevisionYRechazaLaSegundaEdicionObsoleta() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            try {
                var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion,true));
                var mapper = new ObjectMapper();
                var servicio = new AdministracionNivelesService(new com.metronet.backend.repository.AdministracionNivelesRepository(jdbc),mapper);
                int idAdmin = jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol) VALUES
                      ('Admin QA','admin-borrador-qa@local.test','hash-de-prueba','ADMIN') RETURNING id_usuario
                    """,Integer.class);
                // La reversión requiere una referencia publicada; esta prueba la prepara
                // en su propia transacción para no depender de otras clases de prueba.
                assertEquals(1, jdbc.update("""
                    UPDATE nivel_publicacion SET red_referencia=CAST(? AS jsonb)
                    WHERE id_nivel_publicacion=(
                        SELECT p.id_nivel_publicacion FROM nivel_publicacion p
                        JOIN escenario e USING(id_escenario)
                        WHERE e.progresivo=TRUE AND e.numero=1
                        ORDER BY p.numero_version DESC LIMIT 1)
                    """, """
                    {"estaciones":[{"nombre":"A","x":10,"y":10},{"nombre":"B","x":20,"y":20}],
                     "lineas":["L1"],"tramos":[{"linea":"L1","a":"A","b":"B"}],"unidades":[]}
                    """));
                assertEquals(10,servicio.listar().size());
                var anterior = servicio.borrador(1);
                int versionesIniciales = servicio.versiones(1).size();
                assertTrue(versionesIniciales >= 2);
                assertEquals(6,servicio.versiones(1).getLast().tarjetas().size());
                assertEquals(7,servicio.versiones(1).getFirst().tarjetas().size());
                ObjectNode reglasAlteradas = anterior.contenido().path("reglasExito").deepCopy();
                reglasAlteradas.withObject("puntuacion").put("maximo", 80);
                var edicionPuntuacion = new EdicionNivelRequest(anterior.versionBase(),anterior.revision(),
                    anterior.contenido().path("desafio"),reglasAlteradas,
                    anterior.contenido().path("herramientasHabilitadas"),
                    anterior.contenido().path("criterioUvUt"),anterior.redReferencia(),
                    anterior.contenido().path("ayudas"),anterior.tarjetas());
                var puntuacionInerte = assertThrows(ResponseStatusException.class,
                    () -> servicio.guardar(1,edicionPuntuacion,idAdmin));
                assertEquals(HttpStatus.BAD_REQUEST,puntuacionInerte.getStatusCode());
                for (String urlInvalida : new String[]{"https:foo","https:///sin-host","ftp://fuente.test/tarjeta"}) {
                    var tarjetasInvalidas = anterior.tarjetas().deepCopy();
                    ((ObjectNode)tarjetasInvalidas.get(0)).put("urlFuente",urlInvalida);
                    var edicionFuente = new EdicionNivelRequest(anterior.versionBase(),anterior.revision(),
                        anterior.contenido().path("desafio"),anterior.contenido().path("reglasExito"),
                        anterior.contenido().path("herramientasHabilitadas"),
                        anterior.contenido().path("criterioUvUt"),anterior.redReferencia(),
                        anterior.contenido().path("ayudas"),tarjetasInvalidas);
                    var fuenteInvalida = assertThrows(ResponseStatusException.class,
                        () -> servicio.guardar(1,edicionFuente,idAdmin));
                    assertEquals(HttpStatus.BAD_REQUEST,fuenteInvalida.getStatusCode());
                }
                ObjectNode red = mapper.createObjectNode();
                for (String tipo : new String[]{"estaciones","lineas","tramos","unidades"}) red.set(tipo,mapper.createArrayNode());
                var contenido = anterior.contenido();
                var pedido = new EdicionNivelRequest(anterior.versionBase(),anterior.revision(),
                    contenido.path("desafio"),contenido.path("reglasExito"),contenido.path("herramientasHabilitadas"),
                    contenido.path("criterioUvUt"),red,contenido.path("ayudas"),anterior.tarjetas());
                var guardado = servicio.guardar(1,pedido,idAdmin);
                assertEquals(anterior.revision()+1,guardado.revision());
                var conflicto = assertThrows(ResponseStatusException.class,() -> servicio.guardar(1,pedido,idAdmin));
                assertEquals(HttpStatus.CONFLICT,conflicto.getStatusCode());
                var reversion = servicio.prepararReversion(1,1,idAdmin);
                assertEquals(guardado.revision()+1,reversion.revision());
                assertFalse(reversion.redReferencia().path("estaciones").isEmpty(), "Reutiliza una referencia publicada al restaurar versiones antiguas");
                jdbc.update("UPDATE nivel_publicacion SET red_referencia='{}'::jsonb WHERE id_escenario=(SELECT id_escenario FROM escenario WHERE numero=1 AND progresivo=TRUE)");
                var sinReferencia = assertThrows(ResponseStatusException.class,
                    () -> servicio.prepararReversion(1,1,idAdmin));
                assertEquals(HttpStatus.CONFLICT,sinReferencia.getStatusCode());
                assertEquals(reversion.revision(),servicio.borrador(1).revision());
                assertEquals(versionesIniciales,servicio.versiones(1).size(),"Preparar una reversión no publica");
            } finally { conexion.rollback(); }
        }
    }
}
