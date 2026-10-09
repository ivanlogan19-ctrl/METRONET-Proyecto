package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.dto.*;
import com.metronet.backend.service.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class PuntuacionDescuentosPostgresTest {
    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username",()->System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password",()->System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto",()->"validate");
    }
    @Autowired RecorridoIntegralService recorrido;
    @Autowired JdbcTemplate jdbc;
    @Autowired JuegoEducativoService juego;
    @Autowired SimulacionService simulaciones;
    @Autowired AdministracionNivelesService niveles;
    @Autowired PublicacionNivelService publicador;
    @MockitoBean ServicioCorreo correo;
    @Autowired org.springframework.transaction.PlatformTransactionManager transacciones;

    @Test void cobraUnaVezPorEjecucionConMotivosYApruebaEnSesentaAlCompletarLaConsigna() throws Exception {
        int admin = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('QA Puntos','puntos-qa@example.test','!sin-acceso','ADMIN') RETURNING id_usuario",Integer.class);
        recorrido.publicar(admin);
        int escenario = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=2",Integer.class);
        var intento = juego.iniciarEscenario(admin,escenario);
        int diseno = intento.idDiseno();
        red(diseno);
        assertTrue(simulaciones.validarDiseno(admin,diseno).preparadoParaSimular());
        var antes = juego.evaluarEscenario(admin,diseno);
        assertEquals(100, antes.puntaje()); assertFalse(antes.completado());
        int[] puntos = {100,90,80,70,60,60,60};
        ResultadoSimulacionResponse ultima = null;
        for (int esperado : puntos) {
            ultima = simulaciones.ejecutarSimulacion(admin,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,6));
            assertEquals(esperado, ultima.puntaje());
            assertNotNull(ultima.registroPuntuacion());
            assertFalse(ultima.comentarios().contains("METRONET-UV"));
        }
        assertFalse(juego.evaluarEscenario(admin,diseno).completado(), "60 no aprueba con la comparación UV pendiente");
        var desglose = juego.obtenerDesempeno(admin,diseno).desglosePuntuacion();
        assertEquals(4,desglose.descuentos().size());
        assertEquals(40,desglose.totalDescontado());
        assertEquals(2,desglose.descuentos().getFirst().numeroEjecucion());
        assertTrue(desglose.descuentos().getFirst().motivos().stream().anyMatch(m -> m.contains("Cambiar UV")));
        int idUltima = ultima.idSimulacion();
        String evidencia = jdbc.queryForObject("SELECT comentarios FROM simulacion WHERE id_simulacion=?",String.class,idUltima);
        for (int i=0;i<3;i++) {
            juego.registrarPuntuacionSimulacion(admin,diseno,idUltima);
            assertEquals(60,juego.evaluarEscenario(admin,diseno).puntaje());
            assertEquals(desglose,juego.obtenerDesempeno(admin,diseno).desglosePuntuacion());
            assertEquals(7,simulaciones.listarResultados(admin,diseno).size());
        }
        assertEquals(evidencia,jdbc.queryForObject("SELECT comentarios FROM simulacion WHERE id_simulacion=?",String.class,idUltima));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
            () -> simulaciones.ejecutarSimulacion(admin,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,0)));
        assertEquals(7,simulaciones.listarResultados(admin,diseno).size(),"Una solicitud rechazada no consume ejecución ni puntos");
        int metro = jdbc.queryForObject("SELECT id_tren FROM metro WHERE id_diseno=?",Integer.class,diseno);
        simulaciones.actualizarUnidadMetro(admin,diseno,metro,new ActualizarUnidadMetroRequest("Principal",300,BigDecimal.valueOf(5)));
        simulaciones.validarDiseno(admin,diseno);
        var completa = simulaciones.ejecutarSimulacion(admin,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,6));
        assertEquals(0,completa.registroPuntuacion().descuento());
        var finalizada = juego.evaluarEscenario(admin,diseno);
        assertTrue(finalizada.completado()); assertEquals(100,finalizada.progreso()); assertEquals(60,finalizada.puntaje());
        assertEquals(60,jdbc.queryForObject("SELECT puntaje FROM intento WHERE id_intento=?",Integer.class,intento.idIntento()));
        var repetido = juego.volverAJugar(admin,escenario);
        assertEquals(100,juego.obtenerDesempeno(admin,repetido.idDiseno()).puntaje());
        assertTrue(juego.obtenerDesempeno(admin,repetido.idDiseno()).desglosePuntuacion().descuentos().isEmpty());
        assertEquals(60,jdbc.queryForObject("SELECT puntaje FROM intento WHERE id_intento=?",Integer.class,intento.idIntento()));
    }

    @org.junit.jupiter.params.ParameterizedTest(name="Exceso corregido permite aprobar con {0} puntos")
    @org.junit.jupiter.params.provider.ValueSource(ints={90,80,70,60})
    void excesoOperableSimulaDescuentaUnaVezYPermiteFinalizarTrasCorregir(int esperado) throws Exception {
        int admin = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Publicador exceso',?,'!sin-acceso','ADMIN') RETURNING id_usuario",
            Integer.class, java.util.UUID.randomUUID()+"@example.test");
        recorrido.publicar(admin);
        // Publicación de prueba con un máximo explícito, usando el flujo administrativo existente.
        // El catálogo de producción no se modifica ni se interpreta un mínimo como un máximo.
        var borrador = niveles.borrador(1);
        var c = borrador.contenido();
        com.fasterxml.jackson.databind.node.ObjectNode reglas = c.path("reglasExito").deepCopy();
        reglas.put("maximoEstaciones", 2);
        var guardado = niveles.guardar(1, new EdicionNivelRequest(borrador.versionBase(), borrador.revision(),
            c.path("desafio"), reglas, c.path("herramientasHabilitadas"), c.path("criterioUvUt"),
            borrador.redReferencia(), c.path("ayudas"), borrador.tarjetas()), admin);
        var previa = publicador.previsualizar(1, admin);
        publicador.publicar(1, new PublicarNivelRequest(guardado.versionBase(), guardado.revision(), previa.diagnostico().huella(), true), admin);
        int jugador = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Jugador exceso',?,'!sin-acceso','JUGADOR') RETURNING id_usuario",
            Integer.class, java.util.UUID.randomUUID()+"@example.test");
        int escenario = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1",Integer.class);
        var inicio = juego.iniciarEscenario(jugador, escenario);
        int diseno = inicio.idDiseno();
        red(diseno);
        assertTrue(simulaciones.validarDiseno(jugador,diseno).preparadoParaSimular(), "El máximo de la consigna no invalida una red operable");
        simulaciones.guardarDiseno(jugador,diseno);
        for (int i=1; i<=(100-esperado)/10; i++) {
            var resultado = simulaciones.ejecutarSimulacion(jugador,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,6));
            assertEquals(100-10*i, resultado.puntaje());
            assertEquals(10, resultado.registroPuntuacion().descuento());
            assertEquals(java.util.List.of("3 estaciones; máximo 2"), resultado.registroPuntuacion().excesos());
            juego.registrarPuntuacionSimulacion(jugador,diseno,resultado.idSimulacion());
            assertEquals(resultado.puntaje(),juego.obtenerDesempeno(jugador,diseno).puntaje(),"Releer o repetir registro no cobra otra vez");
            assertFalse(juego.evaluarEscenario(jugador,diseno).completado(), "Finalizar exige corregir el exceso");
        }
        if (esperado==60) assertEquals(60,simulaciones.ejecutarSimulacion(jugador,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,6)).puntaje());
        var detalle = juego.obtenerDesempeno(jugador,diseno).desglosePuntuacion();
        assertEquals((100-esperado)/10,detalle.descuentos().size());
        assertTrue(detalle.descuentos().stream().allMatch(d -> d.excesos().equals(java.util.List.of("3 estaciones; máximo 2"))));
        simulaciones.eliminarEstacion(jugador,diseno,"E2");
        assertTrue(simulaciones.validarDiseno(jugador,diseno).preparadoParaSimular());
        simulaciones.guardarDiseno(jugador,diseno);
        assertFalse(juego.evaluarEscenario(jugador,diseno).completado(),"Cambiar la red exige simular el estado actual");
        var corregida = simulaciones.ejecutarSimulacion(jugador,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,6));
        assertEquals(0,corregida.registroPuntuacion().descuento());
        assertEquals(esperado,corregida.puntaje());
        assertEquals(0,juego.obtenerResumenProgreso(jugador).nivelesCompletados(),"Simular no finaliza automáticamente");
        var finalizada = juego.evaluarEscenario(jugador,diseno);
        assertTrue(finalizada.completado());
        assertEquals(esperado,finalizada.puntaje());
        assertEquals(1,juego.obtenerResumenProgreso(jugador).nivelesCompletados());
    }

    @Test void eliminarElementosRevierteLosObjetivosSinContarObjetosBorrados() throws Exception {
        int admin = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('QA eliminación',?,'!sin-acceso','ADMIN') RETURNING id_usuario",
            Integer.class, java.util.UUID.randomUUID()+"@example.test");
        recorrido.publicar(admin);
        int escenario = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo AND numero=1",Integer.class);
        int diseno = juego.iniciarEscenario(admin,escenario).idDiseno();
        red(diseno);
        simulaciones.validarDiseno(admin,diseno);
        simulaciones.ejecutarSimulacion(admin,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,6));
        var usuario = new com.metronet.backend.entity.Usuario();
        usuario.setIdUsuario(admin); usuario.setRol(com.metronet.backend.enums.Rol.ADMIN);
        assertTrue(juego.obtenerConsigna(usuario,diseno).condiciones().stream().allMatch(CondicionConsignaResponse::completado));
        int metro = simulaciones.obtenerSimulacion(admin,diseno).unidadesMetro().getFirst().idTren();
        simulaciones.eliminarUnidadMetro(admin,diseno,metro);
        var sinMetro = juego.obtenerConsigna(usuario,diseno);
        assertFalse(sinMetro.condiciones().stream().filter(c -> c.clave().equals("minimoMetros")).findFirst().orElseThrow().completado());
        assertFalse(sinMetro.condiciones().stream().filter(c -> c.clave().equals("simulacionActual")).findFirst().orElseThrow().completado());
        simulaciones.eliminarEstacion(admin,diseno,"E2");
        simulaciones.eliminarEstacion(admin,diseno,"E1");
        simulaciones.eliminarLinea(admin,diseno,"Principal");
        var actual = juego.obtenerConsigna(usuario,diseno);
        for (String clave : java.util.List.of("minimoEstaciones","minimoLineas","minimoTramos","minimoMetros"))
            assertFalse(actual.condiciones().stream().filter(c -> c.clave().equals(clave)).findFirst().orElseThrow().completado(), clave);
        assertFalse(juego.evaluarEscenario(admin,diseno).completado());
        assertEquals(100,juego.obtenerDesempeno(admin,diseno).puntaje(),"Eliminar y consultar no ejecuta otro descuento");
    }

    @Test
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void ejecucionesConcurrentesSeOrdenanSinDuplicarDescuentos() throws Exception {
        var tx = new org.springframework.transaction.support.TransactionTemplate(transacciones);
        // Caso privado fuera de los diez niveles: no publica ni altera el catálogo compartido.
        int[] ids = tx.execute(estado -> {
            int usuario = jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Concurrente',?,'!sin-acceso','ADMIN') RETURNING id_usuario",
                Integer.class, "concurrente-" + java.util.UUID.randomUUID() + "@example.test");
            int diseno = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno",Integer.class);
            var reglas = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
            reglas.put("minimoEstaciones",3).put("minimoLineas",1).put("minimoMetros",1).put("requiereSimulacion",true);
            reglas.putObject("aprendizajeSimulacion").put("velocidad",true);
            reglas.set("puntuacion",PoliticaPuntuacion.configuracionNivel(2));
            int escenario = jdbc.queryForObject("""
                INSERT INTO escenario(nombre,id_diseno_base,numero,modo,progresivo,reglas_exito,herramientas_habilitadas)
                VALUES ('Concurrencia QA',?,99,'NIVEL',true,CAST(? AS jsonb),'{}') RETURNING id_escenario
                """,Integer.class,diseno,reglas.toString());
            jdbc.update("INSERT INTO intento(id_usuario,id_diseno,id_escenario,estado,numero_campana) VALUES (?,?,?,'VALIDADO',1)",usuario,diseno,escenario);
            red(diseno);
            return new int[]{usuario,diseno,escenario};
        });
        try {
            for (int i=0;i<1;i++) simulaciones.ejecutarSimulacion(ids[0],ids[1],new EjecutarSimulacionRequest(BigDecimal.ONE,6));
            var salida = new java.util.concurrent.CountDownLatch(1);
            try (var ejecutor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
                java.util.concurrent.Callable<ResultadoSimulacionResponse> accion = () -> {
                    salida.await();
                    return simulaciones.ejecutarSimulacion(ids[0],ids[1],new EjecutarSimulacionRequest(BigDecimal.ONE,6));
                };
                var a = ejecutor.submit(accion); var b = ejecutor.submit(accion); salida.countDown();
                var resultados = java.util.stream.Stream.of(a.get(20,java.util.concurrent.TimeUnit.SECONDS),b.get(20,java.util.concurrent.TimeUnit.SECONDS))
                    .sorted(java.util.Comparator.comparingInt(ResultadoSimulacionResponse::idSimulacion)).toList();
                assertEquals(java.util.List.of(90,80),resultados.stream().map(ResultadoSimulacionResponse::puntaje).toList());
                assertEquals(java.util.List.of(2,3),resultados.stream().map(r -> r.registroPuntuacion().numeroEjecucion()).toList());
            }
            var desglose = juego.obtenerDesempeno(ids[0],ids[1]).desglosePuntuacion();
            assertEquals(20,desglose.totalDescontado()); assertEquals(2,desglose.descuentos().size());
        } finally {
            tx.executeWithoutResult(estado -> {
                jdbc.update("DELETE FROM intento WHERE id_usuario=?",ids[0]);
                jdbc.update("DELETE FROM escenario WHERE id_escenario=?",ids[2]);
                jdbc.update("DELETE FROM diseno WHERE id_diseno=?",ids[1]);
                jdbc.update("DELETE FROM usuario WHERE id_usuario=?",ids[0]);
            });
        }
    }

    private void red(int diseno) {
        for (int i=0;i<3;i++) jdbc.update("INSERT INTO estacion(id_diseno,nombre,posicion_x,posicion_y,transbordo) VALUES (?,?,?,?,false)",diseno,"E"+i,620+i*10,465);
        jdbc.update("INSERT INTO linea(id_diseno,nombre) VALUES (?,'Principal')",diseno);
        for (int i=0;i<3;i++) jdbc.update("INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES (?,'Principal',?)",diseno,"E"+i);
        for (int i=0;i<2;i++) jdbc.update("INSERT INTO tramo(id_diseno,nombre_linea,nombre_estacion_a,nombre_estacion_b) VALUES (?,'Principal',?,?)",diseno,"E"+i,"E"+(i+1));
        jdbc.update("INSERT INTO metro(id_diseno,nombre_linea,capacidad,velocidad_promedio) VALUES (?,'Principal',300,4)",diseno);
    }
}
