package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.EdicionNivelRequest;
import com.metronet.backend.service.AdministracionNivelesService;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/** Verifica 019 sobre una base PostgreSQL descartable; revierte su propia edición. */
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql:.*")
class SieteTarjetasPostgresTest {
    @Test
    void guardaSieteEnAdminYConservaPublicacionHistorica() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            try {
                var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion,true));
                var mapper = new ObjectMapper();
                var servicio = new AdministracionNivelesService(jdbc,mapper);
                int idAdmin = jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol) VALUES
                    ('Admin 70 QA','admin-70-qa@local.test','hash-de-prueba','ADMIN') RETURNING id_usuario
                    """,Integer.class);
                assertEquals(10,servicio.listar().size());
                var inicial = servicio.versiones(1).stream().filter(v -> v.version()==1).findFirst().orElseThrow();
                assertEquals(6,inicial.tarjetas().size());
                var vigente = servicio.versiones(1).getFirst();
                assertEquals(7,vigente.tarjetas().size());
                var borrador = servicio.borrador(1);
                assertEquals(7,borrador.tarjetas().size());
                var tarjetas = borrador.tarjetas().deepCopy();
                ((ObjectNode) tarjetas.get(6)).put("titulo", "Título editorial QA");
                var contenido = borrador.contenido();
                ObjectNode red = mapper.createObjectNode();
                for (String tipo : new String[]{"estaciones","lineas","tramos","unidades"})
                    red.set(tipo,mapper.createArrayNode());
                var guardado = servicio.guardar(1,new EdicionNivelRequest(
                    borrador.versionBase(),borrador.revision(),contenido.path("desafio"),
                    contenido.path("reglasExito"),contenido.path("herramientasHabilitadas"),
                    contenido.path("criterioUvUt"),red,contenido.path("ayudas"),tarjetas),idAdmin);
                assertEquals(borrador.revision()+1,guardado.revision());
                assertEquals("Título editorial QA",guardado.tarjetas().get(6).path("titulo").asText());
                assertEquals(6,servicio.versiones(1).stream().filter(v -> v.version()==1)
                    .findFirst().orElseThrow().tarjetas().size());
                jdbc.update("""
                    UPDATE nivel_publicacion SET red_referencia=CAST(? AS jsonb)
                    WHERE id_escenario=(SELECT id_escenario FROM escenario WHERE numero=1 AND progresivo=TRUE)
                      AND numero_version=2
                    """, "{\"estaciones\":[{},{}],\"lineas\":[{}],\"tramos\":[{}],\"unidades\":[]}");
                var reversion = servicio.prepararReversion(1,1,idAdmin);
                assertEquals(7,reversion.tarjetas().size());
                assertEquals(inicial.tarjetas().get(0).path("titulo").asText(),
                    reversion.tarjetas().get(0).path("titulo").asText());
                assertEquals("1-7",reversion.tarjetas().get(6).path("id").asText());
            } finally { conexion.rollback(); }
        }
    }
}
