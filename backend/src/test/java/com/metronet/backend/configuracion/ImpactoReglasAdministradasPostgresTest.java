package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.service.*;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/** Cambia una opción y comprueba su efecto con el evaluador y simulador del jugador. */
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class ImpactoReglasAdministradasPostgresTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private Connection conexion;
    private JdbcTemplate jdbc;
    private GeografiaService geo;
    private ValidacionPublicacionNivelService validador;
    private ObjectNode contenido,red;
    private int admin,escenario;
    private List<Integer> cantidadesAntes;

    @BeforeEach void preparar() throws Exception {
        conexion=DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv("METRONET_TEST_POSTGRES_USER"),System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        conexion.setAutoCommit(false);
        var datos=new SingleConnectionDataSource(conexion,true);
        jdbc=new JdbcTemplate(datos);geo=new GeografiaService(mapper);
        var restricciones=new RestriccionesGeograficasService(jdbc,mapper,geo);
        var objetivos=new ObjetivosPuntosInteresService(mapper,geo);
        var condiciones=new CondicionesGeograficasService(jdbc,mapper,geo,restricciones);
        var juego=new JuegoEducativoService(jdbc,mapper,objetivos,condiciones);
        var simulaciones=new SimulacionService(jdbc,org.mockito.Mockito.mock(DisenoAdministracionService.class),objetivos,juego,restricciones);
        validador=new ValidacionPublicacionNivelService(jdbc,datos,mapper,juego,simulaciones);
        admin=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Auditoría','impacto-qa@example.test','hash-prueba','ADMIN') RETURNING id_usuario",Integer.class);
        escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=1",Integer.class);
        contenido=(ObjectNode)mapper.readTree("""
            {"desafio":{"objetivo":"Comprobación aislada","instrucciones":"Comprobación aislada"},
             "reglasExito":{"minimoEstaciones":1},"criterioUvUt":null,
             "herramientasHabilitadas":{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":true}}
            """);
        red=(ObjectNode)mapper.readTree("""
            {"estaciones":[{"nombre":"A","x":660,"y":460},{"nombre":"B","x":665,"y":460},{"nombre":"C","x":670,"y":460}],
             "lineas":[{"nombre":"Principal"}],
             "tramos":[{"linea":"Principal","a":"A","b":"B"},{"linea":"Principal","a":"B","b":"C"}],
             "unidades":[{"linea":"Principal","capacidad":300,"uv":4}],"ejecuciones":[]}
            """);
        cantidadesAntes=cantidades();
    }

    @AfterEach void cerrar() throws Exception {
        if(conexion!=null)try {
            assertEquals(cantidadesAntes,cantidades(),"La previsualización no deja diseños, intentos ni resultados");
        } finally {conexion.rollback();conexion.close();}
    }

    private List<Integer> cantidades() {
        return List.of("diseno","intento","simulacion").stream()
            .map(tabla->jdbc.queryForObject("SELECT count(*) FROM "+tabla,Integer.class)).toList();
    }
    private ObjectNode reglas(){return (ObjectNode)contenido.path("reglasExito");}
    private ValidacionPublicacionNivelService.Diagnostico evaluar(){return validador.validar(escenario,admin,contenido,red,mapper.createArrayNode());}
    private CondicionConsignaResponse condicion(String clave){return evaluar().condiciones().stream()
        .filter(c->c.clave().equals(clave)).findFirst().orElseThrow(()->new AssertionError("Falta condición "+clave));}
    private void ejecuciones(String pasos) throws Exception {red.set("ejecuciones",mapper.readTree(pasos));}

    @ParameterizedTest @CsvSource({"minimoEstaciones,3,4","minimoLineas,1,2","minimoTramos,2,3","minimoMetros,1,2","maximoEstaciones,3,2"})
    void cantidadesModificanLaConsignaYLaPosibilidadDeFinalizar(String clave,int valido,int imposible) {
        reglas().put(clave,valido);assertTrue(condicion(clave).completado());assertTrue(evaluar().viable());
        reglas().put(clave,imposible);assertFalse(condicion(clave).completado());assertFalse(evaluar().viable());
        reglas().remove(clave);
        assertTrue(evaluar().condiciones().stream().noneMatch(c->c.clave().equals(clave)),"Eliminar la regla retira su objetivo");
    }

    @Test void exigirSimulacionCambiaDePendienteACumplidoTrasEjecutar() throws Exception {
        reglas().put("requiereSimulacion",true);assertFalse(condicion("simulacionActual").completado());
        ejecuciones("[{\"duracion\":6,\"velocidad\":1,\"unidades\":[{\"uv\":4}]}]");
        assertTrue(condicion("simulacionActual").completado());assertTrue(evaluar().viable());
        reglas().put("requiereSimulacion",false);ejecuciones("[]");
        assertTrue(evaluar().viable());assertTrue(evaluar().condiciones().stream().noneMatch(c->c.clave().equals("simulacionActual")));
    }

    @Test void puntosYRadioCambianElRecorridoExigido() {
        var punto=geo.resolverPunto(1,null);
        ((ObjectNode)red.path("estaciones").get(0)).put("x",geo.posicionX(punto).doubleValue()+5).put("y",geo.posicionY(punto));
        reglas().put("requiereObjetivosMismaLinea",true);
        var poi=reglas().putArray("puntosInteresObjetivo").addObject().put("idPunto",1).put("radioCobertura",10);
        assertTrue(condicion("requiereObjetivosMismaLinea").completado());
        poi.put("radioCobertura",1);assertFalse(condicion("requiereObjetivosMismaLinea").completado());
        poi.put("idPunto",99999);assertFalse(evaluar().viable(),"Un POI inexistente no se acredita");
        poi.put("idPunto",1).put("radioCobertura",10);
        reglas().put("requiereObjetivosMismaLinea",false);
        assertTrue(evaluar().condiciones().stream().noneMatch(c->c.clave().equals("requiereObjetivosMismaLinea")));
    }

    @Test void areaTipoNombreYCantidadAfectanElObjetivoTerritorial() {
        var punto=geo.resolverPunto(1,null);
        ((ObjectNode)red.path("estaciones").get(0)).put("x",geo.posicionX(punto)).put("y",geo.posicionY(punto));
        var area=reglas().putArray("areasObjetivo").addObject().put("tipo","barrio").put("nombre","AGUADA").put("minimoEstaciones",1);
        assertTrue(condicion("areaObjetivo:0").completado());
        area.put("minimoEstaciones",4);assertFalse(condicion("areaObjetivo:0").completado());
        area.put("minimoEstaciones",1).put("nombre","SIN GEOMETRIA");assertFalse(condicion("areaObjetivo:0").completado());
        area.put("nombre","AGUADA").put("tipo","zona");assertFalse(condicion("areaObjetivo:0").completado());
    }

    @Test void contarCompartidasYMarcaDeTransbordoTienenEfectosDistintos() {
        ((com.fasterxml.jackson.databind.node.ArrayNode)red.path("lineas")).addObject().put("nombre","Segunda");
        ((com.fasterxml.jackson.databind.node.ArrayNode)red.path("tramos")).addObject().put("linea","Segunda").put("a","A").put("b","B");
        ((com.fasterxml.jackson.databind.node.ArrayNode)red.path("unidades")).addObject().put("linea","Segunda").put("capacidad",150).put("uv",4);
        reglas().put("minimoTransbordos",1).put("transbordosPorConexion",false);
        assertFalse(condicion("minimoTransbordos").completado());
        ((ObjectNode)red.path("estaciones").get(0)).put("transbordo",true);
        assertEquals(1,condicion("minimoTransbordos").actual());
        reglas().put("transbordosPorConexion",true);assertEquals(2,condicion("minimoTransbordos").actual());
        reglas().put("minimoTransbordos",3);assertFalse(condicion("minimoTransbordos").completado());
    }

    @Test void geografiaActivaSeReflejaEnLaConsigna() {
        reglas().put("requiereGeografiaValida",true);assertTrue(condicion("requiereGeografiaValida").completado());
        reglas().put("requiereGeografiaValida",false);
        assertTrue(evaluar().condiciones().stream().noneMatch(c->c.clave().equals("requiereGeografiaValida")));
    }

    @ParameterizedTest @ValueSource(ints={4,5,6,7,8,9,10})
    void limiteUtYPresupuestoUvAfectanElResultadoDeCadaNivel(int numero) throws Exception {
        escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=?",Integer.class,numero);
        var criterio=contenido.putObject("criterioUvUt").put("limiteUt",2).put("presupuestoUv",4);
        ejecuciones("[{\"duracion\":2,\"velocidad\":1,\"unidades\":[{\"uv\":4}]}]");
        assertTrue(condicion("criterioUvUt").completado());
        criterio.put("limiteUt",1);assertFalse(condicion("criterioUvUt").completado());
        criterio.put("limiteUt",2).put("presupuestoUv",3);assertFalse(condicion("criterioUvUt").completado());
        criterio.put("presupuestoUv",4);assertTrue(evaluar().viable());
    }

    @ParameterizedTest @ValueSource(ints={0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31})
    void cadaCombinacionDeObjetivosRequiereSusEjecucionesReales(int mascara) throws Exception {
        var claves=List.of("velocidad","duracion","individual","global","combinacion");
        var aprendizaje=reglas().putObject("aprendizajeSimulacion");
        for(int i=0;i<claves.size();i++)aprendizaje.put(claves.get(i),(mascara&(1<<i))!=0);
        ((com.fasterxml.jackson.databind.node.ArrayNode)red.path("unidades")).addObject().put("linea","Principal").put("capacidad",150).put("uv",4);
        var pendientes=evaluar().condiciones().stream().filter(c->c.clave().startsWith("aprendizajeSimulacion:")).toList();
        assertEquals(Integer.bitCount(mascara),pendientes.size());
        assertTrue(pendientes.stream().noneMatch(CondicionConsignaResponse::completado));
        ejecuciones("""
            [{"duracion":6,"velocidad":1,"unidades":[{"uv":4},{"uv":4}]},
             {"duracion":6,"velocidad":1,"unidades":[{"uv":5},{"uv":4}]},
             {"duracion":8,"velocidad":1,"unidades":[{"uv":5},{"uv":4}]},
             {"duracion":8,"velocidad":1,"unidades":[{"uv":6},{"uv":6}]},
             {"duracion":9,"velocidad":1,"unidades":[{"uv":7},{"uv":7}]}]
            """);
        var completas=evaluar();assertTrue(completas.viable(),completas.mensaje());
        assertEquals(Integer.bitCount(mascara),completas.condiciones().stream().filter(c->c.clave().startsWith("aprendizajeSimulacion:")).count());
        assertTrue(completas.condiciones().stream().allMatch(CondicionConsignaResponse::completado));
    }
}
