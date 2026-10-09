package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.EdicionNivelRequest;
import com.metronet.backend.service.AdministracionNivelesService;
import com.metronet.backend.service.AdministracionNivelesService.Borrador;
import java.sql.DriverManager;
import java.util.List;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.web.server.ResponseStatusException;

/** Matriz de contratos sobre los diez borradores en PostgreSQL descartable.
 * Detecta combinaciones ignoradas, valores inválidos aceptados y publicación
 * accidental al guardar. Cada caso revierte todos sus datos al finalizar. */
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql:.*")
class AuditoriaExperienciaNivelesPostgresTest {
    @ParameterizedTest(name="Nivel {0}: combinaciones, límites y guardado privado")
    @ValueSource(ints={1,2,3,4,5,6,7,8,9,10})
    void revisaCombinacionesSinAlterarPublicaciones(int numero) throws Exception {
        try (var conexion=DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
                System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER","postgres"),
                System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD",""))) {
            conexion.setAutoCommit(false);
            try {
                var mapper=new ObjectMapper();
                var jdbc=new JdbcTemplate(new SingleConnectionDataSource(conexion,true));
                var servicio=new AdministracionNivelesService(jdbc,mapper);
                var almacenado=servicio.borrador(numero);
                // El seed no tiene una referencia diseñada; el editor envía
                // sus cinco listas vacías incluso antes de agregar elementos.
                ObjectNode red=mapper.createObjectNode();
                for(String tipo:List.of("estaciones","lineas","tramos","unidades","ejecuciones"))red.putArray(tipo);
                var inicial=new Borrador(numero,almacenado.versionBase(),almacenado.revision(),
                    almacenado.contenido(),red,almacenado.tarjetas());
                assertDoesNotThrow(()->servicio.validarBorrador(inicial));
                var versiones=servicio.versiones(numero);
                String escenarios=jdbc.queryForObject("SELECT jsonb_agg(to_jsonb(e) ORDER BY id_escenario)::text FROM escenario e",String.class);

                // Las 32 combinaciones de cinco herramientas. La única relación
                // de este contrato exige líneas y conexiones para transbordos.
                var herramientas=List.of("estaciones","lineas","conexiones","metros","simulacion");
                for(int mascara=0;mascara<32;mascara++) {
                    ObjectNode contenido=inicial.contenido().deepCopy();
                    ObjectNode valores=contenido.withObject("herramientasHabilitadas");
                    for(int bit=0;bit<5;bit++)valores.put(herramientas.get(bit),(mascara&(1<<bit))!=0);
                    var variante=conContenido(inicial,contenido);
                    boolean requiereTransbordos=contenido.path("reglasExito").path("transbordosPorConexion").asBoolean(false);
                    if(requiereTransbordos&&((mascara&2)==0||(mascara&4)==0))rechaza(servicio,variante);
                    else assertDoesNotThrow(()->servicio.validarBorrador(variante));
                }

                // Todas las combinaciones de los cinco objetivos de simulación.
                var objetivos=List.of("velocidad","duracion","individual","global","combinacion");
                for(int mascara=0;mascara<32;mascara++) {
                    ObjectNode contenido=inicial.contenido().deepCopy();
                    ObjectNode valores=mapper.createObjectNode();
                    for(int bit=0;bit<5;bit++)valores.put(objetivos.get(bit),(mascara&(1<<bit))!=0);
                    contenido.withObject("reglasExito").set("aprendizajeSimulacion",valores);
                    assertDoesNotThrow(()->servicio.validarBorrador(conContenido(inicial,contenido)));
                }

                for(String clave:List.of("minimoEstaciones","minimoLineas","minimoTramos","minimoMetros","minimoTransbordos","maximoEstaciones")) {
                    for(String valor:List.of("0","-1","1.5","\"2\"","true")) {
                        ObjectNode contenido=inicial.contenido().deepCopy();
                        contenido.withObject("reglasExito").set(clave,mapper.readTree(valor));
                        rechaza(servicio,conContenido(inicial,contenido));
                    }
                }
                for(String reglas:List.of(
                    "{\"minimoEstaciones\":4,\"maximoEstaciones\":3}",
                    "{\"requiereSimulacion\":1}","{\"inexistente\":true}",
                    "{\"puntosInteresObjetivo\":[]}",
                    "{\"puntosInteresObjetivo\":[{\"idPunto\":0,\"radioCobertura\":10}]}",
                    "{\"puntosInteresObjetivo\":[{\"idPunto\":1,\"radioCobertura\":0}]}",
                    "{\"areasObjetivo\":[]}",
                    "{\"areasObjetivo\":[{\"tipo\":\"inexistente\",\"nombre\":\"Centro\",\"minimoEstaciones\":1}]}",
                    "{\"aprendizajeSimulacion\":{\"global\":1}}")) {
                    ObjectNode contenido=inicial.contenido().deepCopy();
                    contenido.set("reglasExito",mapper.readTree(reglas));
                    rechaza(servicio,conContenido(inicial,contenido));
                }

                int administrador=jdbc.queryForObject("""
                    INSERT INTO usuario(nombre,email,password,rol) VALUES
                    ('Auditoría aislada','auditoria-experiencia@local.test','!acceso-inhabilitado','ADMIN') RETURNING id_usuario
                    """,Integer.class);
                ObjectNode editado=inicial.contenido().deepCopy();
                editado.withObject("desafio").put("nombre","Nivel "+numero+" · Edición de prueba");
                var pedido=new EdicionNivelRequest(inicial.versionBase(),inicial.revision(),
                    editado.path("desafio"),editado.path("reglasExito"),editado.path("herramientasHabilitadas"),
                    editado.path("criterioUvUt"),inicial.redReferencia(),editado.path("ayudas"),inicial.tarjetas());
                var guardado=servicio.guardar(numero,pedido,administrador);
                assertEquals(inicial.revision()+1,guardado.revision());
                assertEquals(editado,servicio.borrador(numero).contenido());
                assertEquals(inicial.tarjetas(),guardado.tarjetas());
                assertEquals(inicial.redReferencia(),guardado.redReferencia());
                assertEquals(versiones,servicio.versiones(numero),"Guardar no publica ni borra versiones");
                assertEquals(escenarios,jdbc.queryForObject("SELECT jsonb_agg(to_jsonb(e) ORDER BY id_escenario)::text FROM escenario e",String.class),
                    "Guardar no modifica los niveles disponibles para jugar");
                var conflicto=assertThrows(ResponseStatusException.class,()->servicio.guardar(numero,pedido,administrador));
                assertEquals(HttpStatus.CONFLICT,conflicto.getStatusCode());
            } finally { conexion.rollback(); }
        }
    }

    private static Borrador conContenido(Borrador base,ObjectNode contenido) {
        return new Borrador(base.numero(),base.versionBase(),base.revision(),contenido,base.redReferencia(),base.tarjetas());
    }

    private static void rechaza(AdministracionNivelesService servicio,Borrador borrador) {
        var error=assertThrows(ResponseStatusException.class,()->servicio.validarBorrador(borrador));
        assertEquals(HttpStatus.BAD_REQUEST,error.getStatusCode());
    }
}
