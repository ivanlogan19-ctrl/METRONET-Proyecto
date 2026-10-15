package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.service.*;
import com.metronet.backend.dto.*;
import java.math.BigDecimal;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
class VinculoUvUtNivelesPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username",()->System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password",()->System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto",()->"validate");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired SimulacionService simulaciones;
    @Autowired JuegoEducativoService juego;
    @Autowired RecorridoIntegralService recorrido;
    @MockitoBean ServicioCorreo correo;

    @ParameterizedTest(name="Nivel {0}: dos líneas, precisión, guardado y reloj")
    @ValueSource(ints={1,2,3,4,5,6,7,8,9,10})
    void conservaCalculosPorLineaYSimulaHastaSuDuracion(int numero) throws Exception {
        int usuario=jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Unidades QA','unidades-qa@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        recorrido.publicar(usuario);
        int escenario=jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=?",Integer.class,numero);
        int diseno=juego.iniciarEscenario(usuario,escenario).idDiseno();
        // Red geográfica fija para comparar la misma operación en los diez escenarios.
        for(int i=0;i<3;i++) jdbc.update("INSERT INTO estacion(id_diseno,nombre,posicion_x,posicion_y,transbordo,modificable) VALUES (?,?,?,?,FALSE,TRUE)",diseno,"E"+i,660+i*10,460);
        for(String linea:java.util.List.of("A","B")) jdbc.update("INSERT INTO linea(id_diseno,nombre,modificable) VALUES (?,?,TRUE)",diseno,linea);
        for(String[] t:new String[][]{{"A","E0","E1"},{"B","E1","E2"}}) {
            jdbc.update("INSERT INTO tramo(id_diseno,nombre_linea,nombre_estacion_a,nombre_estacion_b) VALUES (?,?,?,?)",diseno,t[0],t[1],t[2]);
            for(int i=1;i<3;i++) jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,?,?)",diseno,t[0],t[i]);
        }
        int tren=jdbc.queryForObject("INSERT INTO metro(id_diseno,nombre_linea,capacidad,velocidad_promedio) VALUES (?,'A',300,1) RETURNING id_tren",Integer.class,diseno);
        jdbc.update("INSERT INTO metro(id_diseno,nombre_linea,capacidad,velocidad_promedio) VALUES (?,'A',300,1),(?,'B',300,1)",diseno,diseno);
        var inicial=simulaciones.obtenerSimulacion(usuario,diseno);
        assertTrue(inicial.vinculoUvUtPorLinea());
        var otra=inicial.unidadesMetro().stream().filter(u->u.nombreLinea().equals("B")).findFirst().orElseThrow();
        double km=inicial.tramos().stream().filter(t->t.nombreLinea().equals("A")).mapToDouble(TramoSimulacionResponse::distanciaKm).sum();
        simulaciones.actualizarUnidadMetro(usuario,diseno,tren,new ActualizarUnidadMetroRequest("A",300,new BigDecimal("3.33"),null,"UV"));
        var guardado=simulaciones.obtenerSimulacion(usuario,diseno);
        for(var u:guardado.unidadesMetro()) if(u.nombreLinea().equals("A")) {
            assertEquals(3.33,u.velocidadPromedio().doubleValue());
            assertEquals(km/3.33,u.duracionUt(),1e-8);
        } else assertEquals(otra,u,"Cambiar A conserva B");
        simulaciones.actualizarUnidadMetro(usuario,diseno,tren,new ActualizarUnidadMetroRequest("A",300,BigDecimal.ONE,1.25,"UT"));
        var preciso=simulaciones.obtenerSimulacion(usuario,diseno);
        for(var u:preciso.unidadesMetro()) if(u.nombreLinea().equals("A")) {
            assertEquals(1.25,u.duracionUt());
            assertEquals(km/1.25,u.velocidadPromedio().doubleValue(),1e-8);
        }
        simulaciones.guardarDiseno(usuario,diseno);
        assertEquals(preciso.unidadesMetro(),simulaciones.obtenerSimulacion(usuario,diseno).unidadesMetro(),"Guardar conserva precisión y referencia");
        simulaciones.validarDiseno(usuario,diseno);
        var resultado=simulaciones.ejecutarSimulacion(usuario,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,1.25));
        assertEquals(preciso.unidadesMetro().stream().mapToDouble(UnidadMetroSimulacionResponse::duracionUt).max().orElseThrow(),resultado.duracion());
        for(var u:resultado.unidades()) assertEquals(u.distanciaKm(),u.distanciaRecorridaKm(),1e-7,"Cada tren completa su propia distancia");
    }
}
