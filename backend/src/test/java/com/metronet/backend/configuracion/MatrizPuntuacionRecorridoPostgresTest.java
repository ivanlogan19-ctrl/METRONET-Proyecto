package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.metronet.backend.dto.*;
import com.metronet.backend.service.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

/** Cinco campañas de jugador contra PostgreSQL: no se fuerza progreso ni puntaje mediante SQL. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class MatrizPuntuacionRecorridoPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username", () -> System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password", () -> System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired RecorridoIntegralService recorrido;
    @Autowired AdministracionNivelesService niveles;
    @Autowired JuegoEducativoService juego;
    @Autowired SimulacionService simulaciones;
    @MockitoBean ServicioCorreo correo;

    @ParameterizedTest(name="Campaña completa con {0} puntos en los niveles que admiten penalizaciones")
    @ValueSource(ints={100,90,80,70,60})
    void completaConTodosLosPuntajesYRestableceElSiguienteNivel(int objetivo) throws Exception {
        int admin = usuario("Publicador matriz", "ADMIN");
        recorrido.publicar(admin);
        int jugador = usuario("Jugador matriz", "JUGADOR");
        int[] gratuitas = {1,2,2,3,1,1,1,2,2,4};
        for (int numero=1; numero<=10; numero++) {
            final int nivel = numero;
            String caso = "Nivel " + nivel + ", puntaje " + objetivo;
            var escenario = juego.obtenerProgreso(jugador).stream()
                .filter(e -> Integer.valueOf(nivel).equals(e.numero())).findFirst().orElseThrow();
            assertTrue(escenario.desbloqueado(), caso + ": se habilita por completar el anterior");
            var inicio = juego.iniciarEscenario(jugador, escenario.idEscenario());
            int diseno = inicio.idDiseno();
            var inicial = juego.obtenerDesempeno(jugador, diseno);
            assertEquals(100, inicial.puntaje(), caso + ": no arrastra descuentos");
            assertEquals(gratuitas[nivel-1], inicial.desglosePuntuacion().practicasGratuitas());
            assertTrue(inicial.desglosePuntuacion().descuentos().isEmpty());
            assertTrue(simulaciones.listarResultados(jugador, diseno).isEmpty());
            assertFalse(juego.evaluarEscenario(jugador, diseno).completado());

            // Nivel 1: toda red válida para simular ya satisface su consigna al ejecutarse.
            // No se alteran sus reglas para fabricar una penalización imposible en ese flujo.
            int esperado = nivel == 1 ? 100 : objetivo;
            if (esperado < 100) {
                construirParcial(jugador, diseno);
                assertTrue(simulaciones.validarDiseno(jugador, diseno).preparadoParaSimular());
                int descuentos = (100-esperado)/10;
                for (int i=1; i<=gratuitas[nivel-1]+descuentos; i++) {
                    var resultado = ejecutar(jugador, diseno, 6);
                    assertEquals(100-10*Math.max(0,i-gratuitas[nivel-1]), resultado.puntaje(), caso);
                    var evaluacion = juego.evaluarEscenario(jugador, diseno);
                    assertFalse(evaluacion.completado(), caso + ": faltan objetivos");
                    assertFalse(juego.obtenerResumenProgreso(jugador).modoLibreDesbloqueado());
                    if (nivel < 10) assertFalse(juego.obtenerProgreso(jugador).stream()
                        .filter(e -> Integer.valueOf(nivel+1).equals(e.numero())).findFirst().orElseThrow().desbloqueado());
                }
                if (esperado == 60) for (int i=0; i<2; i++) {
                    assertEquals(60, ejecutar(jugador, diseno, 6).puntaje(), caso + ": tope de descuento");
                }
                var detalle = juego.obtenerDesempeno(jugador, diseno).desglosePuntuacion();
                assertEquals(descuentos, detalle.descuentos().size());
                assertTrue(detalle.descuentos().stream().allMatch(d -> d.puntos()==10 && !d.motivos().isEmpty()));
                simulaciones.guardarDiseno(jugador, diseno);
                assertEquals(detalle, juego.obtenerDesempeno(jugador, diseno).desglosePuntuacion(), "Guardar no descuenta");
                for (var unidad : simulaciones.obtenerSimulacion(jugador, diseno).unidadesMetro())
                    simulaciones.eliminarUnidadMetro(jugador, diseno, unidad.idTren());
                simulaciones.eliminarLinea(jugador, diseno, "Parcial");
                simulaciones.eliminarEstacion(jugador, diseno, "P0");
                simulaciones.eliminarEstacion(jugador, diseno, "P1");
            }

            // Usa el diseño y los pasos de referencia publicados, a través de los Services reales.
            JsonNode referencia = niveles.versiones(nivel).getFirst().redReferencia();
            List<UnidadMetroSimulacionResponse> unidades = construirReferencia(jugador, diseno, referencia);
            simulaciones.guardarDiseno(jugador, diseno);
            assertTrue(simulaciones.validarDiseno(jugador, diseno).preparadoParaSimular(), caso);
            assertFalse(juego.evaluarEscenario(jugador, diseno).completado(), "Guardar no reemplaza la simulación pendiente");
            for (JsonNode paso : referencia.path("ejecuciones")) {
                for (int i=0; i<unidades.size(); i++) {
                    var unidad = unidades.get(i);
                    simulaciones.actualizarUnidadMetro(jugador, diseno, unidad.idTren(), new ActualizarUnidadMetroRequest(
                        unidad.nombreLinea(), unidad.capacidad(), paso.path("unidades").get(i).path("uv").decimalValue()));
                }
                simulaciones.validarDiseno(jugador, diseno);
                var resultado = ejecutar(jugador, diseno, paso.path("duracion").asInt());
                assertEquals(0, resultado.registroPuntuacion().descuento(), caso + ": avanzar no penaliza");
                assertEquals(esperado, resultado.puntaje(), caso);
            }
            var finalizada = juego.evaluarEscenario(jugador, diseno);
            assertTrue(finalizada.completado(), caso);
            assertEquals(100, finalizada.progreso(), caso);
            assertEquals(esperado, finalizada.puntaje(), caso);
            assertEquals(esperado, jdbc.queryForObject("SELECT puntaje FROM intento WHERE id_intento=?", Integer.class, inicio.idIntento()));
            assertEquals(nivel==10, finalizada.modoLibreDesbloqueado(), caso);
            assertEquals(finalizada.puntaje(), juego.evaluarEscenario(jugador, diseno).puntaje(), "Reevaluar no vuelve a cobrar");
            System.out.printf("MATRIZ PUNTOS nivel=%d objetivo=%d resultado=%d aprobado=true%n",nivel,objetivo,esperado);
        }
        assertEquals(10, juego.obtenerResumenProgreso(jugador).nivelesCompletados());
        assertEquals(100+9*objetivo, jdbc.queryForObject("SELECT SUM(puntaje) FROM intento WHERE id_usuario=? AND estado='COMPLETADO'", Integer.class, jugador));
    }

    private int usuario(String nombre, String rol) {
        return jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES (?,?,?,?) RETURNING id_usuario",
            Integer.class, nombre, java.util.UUID.randomUUID()+"@example.test", "!sin-acceso", rol);
    }
    private void construirParcial(int jugador, int diseno) {
        for (int i=0; i<2; i++) simulaciones.crearEstacion(jugador, diseno,
            new CrearEstacionSimulacionRequest("P"+i, BigDecimal.valueOf(620+i*10), BigDecimal.valueOf(465)));
        simulaciones.crearLinea(jugador, diseno, new CrearLineaSimulacionRequest("Parcial", List.of("P0","P1")));
        simulaciones.crearUnidadMetro(jugador, diseno, new CrearUnidadMetroSimulacionRequest("Parcial",300,BigDecimal.valueOf(4)));
    }
    private List<UnidadMetroSimulacionResponse> construirReferencia(int jugador, int diseno, JsonNode red) {
        for (JsonNode e : red.path("estaciones")) simulaciones.crearEstacion(jugador, diseno,
            new CrearEstacionSimulacionRequest(e.path("nombre").asText(),e.path("x").decimalValue(),e.path("y").decimalValue()));
        for (JsonNode l : red.path("lineas")) {
            var estaciones = new LinkedHashSet<String>();
            for (JsonNode t : red.path("tramos")) if (t.path("linea").asText().equals(l.path("nombre").asText())) {
                estaciones.add(t.path("a").asText()); estaciones.add(t.path("b").asText());
            }
            simulaciones.crearLinea(jugador, diseno, new CrearLineaSimulacionRequest(l.path("nombre").asText(), new ArrayList<>(estaciones)));
        }
        var unidades = new ArrayList<UnidadMetroSimulacionResponse>();
        for (JsonNode u : red.path("unidades")) unidades.add(simulaciones.crearUnidadMetro(jugador,diseno,
            new CrearUnidadMetroSimulacionRequest(u.path("linea").asText(),u.path("capacidad").asInt(),u.path("uv").decimalValue())));
        return unidades;
    }
    private ResultadoSimulacionResponse ejecutar(int jugador, int diseno, int horas) {
        return simulaciones.ejecutarSimulacion(jugador, diseno, new EjecutarSimulacionRequest(BigDecimal.ONE, horas));
    }
}
