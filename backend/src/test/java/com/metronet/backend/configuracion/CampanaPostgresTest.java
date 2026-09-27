package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.*;
import java.sql.DriverManager;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/** SQL real de catálogo/progreso sobre tablas TEMP privadas de la conexión y rollback.
 * No modifica tablas ni secuencias persistentes; no sustituye una prueba HTTP de extremo a extremo. */
@EnabledIfEnvironmentVariable(named = "METRONET_TEST_POSTGRES_URL", matches = "jdbc:postgresql:.*")
class CampanaPostgresTest {
    static Stream<Arguments> nivelesYRoles() {
        return IntStream.rangeClosed(1, 10).boxed()
            .flatMap(nivel -> Stream.of(Rol.JUGADOR, Rol.ADMIN).map(rol -> Arguments.of(nivel, rol)));
    }

    @ParameterizedTest(name = "Nivel {0}, {1}: inicio, reanudación, repetición y campaña nueva")
    @MethodSource("nivelesYRoles")
    void cadaNivelComienzaVacioYSinConsignasResueltas(int nivel, Rol rol) throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                prepararTablasTemporales(jdbc);
                new InicializadorCatalogoEscenariosProgresivos().inicializarCatalogoEscenariosProgresivos(jdbc).run();
                jdbc.update("UPDATE usuario SET rol=? WHERE id_usuario=7", rol.name());
                var usuario = new Usuario(); usuario.setIdUsuario(7); usuario.setRol(rol);
                var mapper = new ObjectMapper();
                var geo = new GeografiaService(mapper);
                var restricciones = new RestriccionesGeograficasService(jdbc, mapper, geo);
                var juego = new JuegoEducativoService(jdbc, mapper, new ObjetivosPuntosInteresService(mapper, geo),
                    new CondicionesGeograficasService(jdbc, mapper, geo, restricciones));
                int escenario = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE numero=?", Integer.class, nivel);
                prepararNivelesAnteriores(jdbc, nivel, 1);
                var inicio = juego.iniciarEscenario(7, escenario);
                verificarInicioVacio(jdbc, juego, usuario, inicio.idDiseno());
                assertTrue(inicio.mostrarTutorial());

                // Reanudar conserva exclusivamente lo que este usuario ya construyó.
                jdbc.update("INSERT INTO estacion VALUES (?,'Propia',710,460,FALSE)", inicio.idDiseno());
                var reanudado = juego.iniciarEscenario(7, escenario);
                assertEquals(inicio.idDiseno(), reanudado.idDiseno());
                assertFalse(reanudado.mostrarTutorial());
                assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno=?", Integer.class, reanudado.idDiseno()));

                // El fixture representa un intento anterior finalizado; la solución real se prueba abajo.
                jdbc.update("UPDATE intento SET estado='COMPLETADO',progreso=100,puntaje=100 WHERE id_intento=?", inicio.idIntento());
                var repetido = juego.volverAJugar(7, escenario);
                assertNotEquals(inicio.idDiseno(), repetido.idDiseno());
                assertFalse(repetido.mostrarTutorial());
                verificarInicioVacio(jdbc, juego, usuario, repetido.idDiseno());

                juego.reiniciarRecorrido(7, 1);
                prepararNivelesAnteriores(jdbc, nivel, 2);
                var nuevo = juego.iniciarEscenario(7, escenario);
                assertEquals(2, nuevo.numeroCampana());
                assertTrue(nuevo.mostrarTutorial());
                verificarInicioVacio(jdbc, juego, usuario, nuevo.idDiseno());
                assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM estacion WHERE id_diseno=?", Integer.class, inicio.idDiseno()), "No se borra el diseño anterior");
            } finally { conexion.rollback(); }
        }
    }

    private static void prepararNivelesAnteriores(JdbcTemplate jdbc, int nivel, int campana) {
        for (int anterior = 1; anterior < nivel; anterior++) {
            int diseno = jdbc.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
            jdbc.update("""
                INSERT INTO intento(id_usuario,id_escenario,id_diseno,numero_campana,estado,progreso,puntaje)
                SELECT 7,id_escenario,?,?,'COMPLETADO',100,100 FROM escenario WHERE numero=?
                """, diseno, campana, anterior);
        }
    }

    private static void verificarInicioVacio(JdbcTemplate jdbc, JuegoEducativoService juego, Usuario usuario, int diseno) {
        for (String tabla : List.of("estacion", "linea", "tramo", "metro", "pasa")) {
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM " + tabla + " WHERE id_diseno=?", Integer.class, diseno), tabla);
        }
        var consigna = juego.obtenerConsigna(usuario, diseno);
        assertFalse(consigna.condiciones().isEmpty());
        assertAll(
            () -> assertTrue(consigna.condiciones().stream().noneMatch(c -> c.completado()),
                "Condiciones resueltas sin construir: " + consigna.condiciones().stream().filter(c -> c.completado()).map(c -> c.clave()).toList()),
            () -> assertEquals("INICIADO", consigna.estadoGlobal()),
            () -> assertEquals(0, consigna.progreso()),
            () -> assertEquals(0, juego.obtenerDesempeno(7, diseno).puntaje())
        );
        var evaluacion = juego.evaluarEscenario(7, diseno);
        assertFalse(evaluacion.completado());
        assertEquals(0, evaluacion.progreso());
        assertEquals(0, evaluacion.puntaje());
    }

    @Test
    void instruccionesAnterioresSeActualizanSinAlterarConsignasPersonalizadasNiReglas() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                prepararTablasTemporales(jdbc);
                var inicializador = new InicializadorCatalogoEscenariosProgresivos().inicializarCatalogoEscenariosProgresivos(jdbc);
                inicializador.run();
                var reglas = jdbc.queryForList("SELECT numero,reglas_exito::text,herramientas_habilitadas::text FROM escenario ORDER BY id_escenario");
                var actuales = jdbc.queryForList("SELECT numero,instrucciones FROM escenario WHERE numero IN (8,10) ORDER BY numero");
                jdbc.update("UPDATE escenario SET instrucciones=replace(instrucciones,'Guardá tu diseño y simulá','Validá y simulá') WHERE numero IN (8,10)");
                inicializador.run(); inicializador.run();
                assertEquals(actuales, jdbc.queryForList("SELECT numero,instrucciones FROM escenario WHERE numero IN (8,10) ORDER BY numero"));
                assertEquals(reglas, jdbc.queryForList("SELECT numero,reglas_exito::text,herramientas_habilitadas::text FROM escenario ORDER BY id_escenario"));
                jdbc.update("UPDATE escenario SET instrucciones='Consigna personalizada: Validá tu hipótesis' WHERE numero=8");
                inicializador.run();
                assertEquals("Consigna personalizada: Validá tu hipótesis", jdbc.queryForObject("SELECT instrucciones FROM escenario WHERE numero=8", String.class));
            } finally { conexion.rollback(); }
        }
    }

    @Test
    void escalaActualizaSoloSeedsIdenticosYConservaPersonalizados() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv("METRONET_TEST_POSTGRES_USER"), System.getenv("METRONET_TEST_POSTGRES_PASSWORD"))) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                prepararTablasTemporales(jdbc);
                var inicializador = new InicializadorCatalogoEscenariosProgresivos().inicializarCatalogoEscenariosProgresivos(jdbc);
                inicializador.run();
                var mapper = new ObjectMapper();
                try (var entrada = new org.springframework.core.io.ClassPathResource("educacion/niveles-pre-uv.json").getInputStream()) {
                    for (var anterior : mapper.readTree(entrada)) {
                        jdbc.update("UPDATE escenario SET objetivo=?, instrucciones=?, reglas_exito=CAST(? AS jsonb) WHERE numero=?",
                            anterior.path("objetivo").asText(), anterior.path("instruccionesLegadas").asText(anterior.path("instrucciones").asText()), anterior.path("reglasExito").toString(), anterior.path("numero").asInt());
                    }
                }
                jdbc.update("UPDATE escenario SET instrucciones='Consigna particular' WHERE numero=8");
                inicializador.run(); inicializador.run();
                assertEquals(6, jdbc.queryForObject("SELECT COUNT(*) FROM escenario WHERE reglas_exito ? 'aprendizajeSimulacion'", Integer.class));
                assertEquals("Consigna particular", jdbc.queryForObject("SELECT instrucciones FROM escenario WHERE numero=8", String.class));
                assertFalse(jdbc.queryForObject("SELECT reglas_exito ? 'aprendizajeSimulacion' FROM escenario WHERE numero=8", Boolean.class));
            } finally { conexion.rollback(); }
        }
    }

    @Test
    void catalogoIdempotenteDiezSolucionesRecargaReinicioYLogroHistoricoEnPostgres() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                prepararTablasTemporales(jdbc);
                var inicializador = new InicializadorCatalogoEscenariosProgresivos().inicializarCatalogoEscenariosProgresivos(jdbc);
                inicializador.run(); inicializador.run();
                assertEquals(11, jdbc.queryForObject("SELECT COUNT(*) FROM escenario", Integer.class));
                var mapper = new ObjectMapper();
                var geo = new GeografiaService(mapper);
                var restricciones = new RestriccionesGeograficasService(jdbc, mapper, geo);
                var juego = new JuegoEducativoService(jdbc, mapper, new ObjetivosPuntosInteresService(mapper, geo), new CondicionesGeograficasService(jdbc, mapper, geo, restricciones));
                for (int nivel = 1; nivel <= 10; nivel++) {
                    int idEscenario = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE numero=?", Integer.class, nivel);
                    var reglas = mapper.readTree(jdbc.queryForObject("SELECT reglas_exito::text FROM escenario WHERE numero=?", String.class, nivel));
                    jdbc.update("INSERT INTO intento VALUES (?,7,?,?,1,'EN_DESARROLLO',0,NULL,NULL)", nivel, idEscenario, nivel);
                    assertEquals(nivel, juego.iniciarEscenario(7, idEscenario).idDiseno(), "Reanudar conserva diseño");
                    assertFalse(juego.evaluarEscenario(7, nivel).completado());
                    int indice = 0;
                    for (var objetivo : reglas.path("puntosInteresObjetivo")) {
                        var poi = geo.resolverPunto(objetivo.path("idPunto").asInt(), null);
                        jdbc.update("INSERT INTO estacion VALUES (?,?,?,?,TRUE)", nivel, "E" + indice++, geo.posicionX(poi), geo.posicionY(poi));
                    }
                    int cantidad = reglas.path("minimoEstaciones").asInt();
                    while (indice < cantidad) { jdbc.update("INSERT INTO estacion VALUES (?,?,?,?,TRUE)", nivel, "E" + indice, 660 + indice * 5, 460); indice++; }
                    jdbc.update("INSERT INTO linea VALUES (?,'Principal')", nivel);
                    for (int i = 0; i < cantidad; i++) {
                        jdbc.update("INSERT INTO pasa VALUES (?,'Principal',?)", nivel, "E" + i);
                        if (i > 0) jdbc.update("INSERT INTO tramo VALUES (?,'Principal',?,?)", nivel, "E" + (i - 1), "E" + i);
                    }
                    for (int i = 1; i < reglas.path("minimoLineas").asInt(); i++) {
                        String linea = "Enlace" + i;
                        String origen = "E" + (nivel == 10 ? i - 1 : 0);
                        jdbc.update("INSERT INTO linea VALUES (?,?)", nivel, linea);
                        jdbc.update("INSERT INTO pasa VALUES (?,?,?),(?,?,'E2')", nivel, linea, origen, nivel, linea);
                        jdbc.update("INSERT INTO tramo VALUES (?,?,?,'E2')", nivel, linea, origen);
                    }
                    for (int i = 0; i < reglas.path("minimoMetros").asInt(); i++) jdbc.update("INSERT INTO metro(id_diseno,nombre_linea,velocidad_promedio) VALUES (?,?,?)", nivel, i == 0 ? "Principal" : "Enlace" + i, 4);
                    if (reglas.path("requiereSimulacion").asBoolean()) {
                        ComparacionesSimulacionFixture.registrar(jdbc, juego, nivel, 6);
                        assertFalse(juego.evaluarEscenario(7, nivel).completado(), "Play no basta en nivel " + nivel);
                        ComparacionesSimulacionFixture.practicar(jdbc, juego, nivel);
                    }
                    assertTrue(restricciones.observarDiseno(nivel).isEmpty(), "Territorio nivel " + nivel);
                    var resultado = juego.evaluarEscenario(7, nivel);
                    assertTrue(resultado.completado(), "Nivel " + nivel);
                    assertEquals(100, resultado.puntaje(), "Todos los criterios del nivel " + nivel);
                    assertEquals(nivel == 10, resultado.idSiguienteEscenario() == null);
                    assertEquals(nivel, juego.obtenerResumenProgreso(7).nivelesCompletados());
                }
                // Una instancia nueva lee el mismo progreso persistido, sin estado del navegador.
                var recargado = new JuegoEducativoService(jdbc, mapper, new ObjetivosPuntosInteresService(mapper, geo), new CondicionesGeograficasService(jdbc, mapper, geo, restricciones));
                assertTrue(recargado.obtenerResumenProgreso(7).campanaCompletada());
                assertFalse(recargado.obtenerResumenProgreso(7).tutorialSimulacionDisponible());
                var puntos = new PuntuacionService(jdbc, mapper);
                var ranking = puntos.ranking(7);
                assertEquals(1, ranking.tuPosicion());
                assertEquals(10, ranking.jugadores().getFirst().nivelesCompletados());
                assertEquals(1000, ranking.puntajeTotal());
                int escenarioSeis = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE numero=6", Integer.class);
                jdbc.update("INSERT INTO intento VALUES (20,7,?,20,1,'COMPLETADO',100,50,NULL)", escenarioSeis);
                assertEquals(ranking.puntajeTotal(), puntos.ranking(7).puntajeTotal());
                var reinicio = recargado.reiniciarRecorrido(7, 1);
                assertEquals(0, reinicio.nivelesCompletados());
                assertTrue(reinicio.tutorialSimulacionDisponible());
                assertTrue(reinicio.modoLibreDesbloqueado());
                assertEquals(11, jdbc.queryForObject("SELECT COUNT(*) FROM intento WHERE estado='COMPLETADO'", Integer.class));
                assertEquals(ranking.puntajeTotal(), puntos.ranking(7).puntajeTotal());
                jdbc.update("UPDATE usuario SET rol='ADMIN' WHERE id_usuario=7");
                assertTrue(recargado.obtenerResumenProgreso(7).escenarios().stream().allMatch(e -> e.desbloqueado()));
                assertEquals(0, puntos.ranking(7).jugadores().size());
                jdbc.update("UPDATE escenario SET objetivo='Consigna personalizada', reglas_exito=reglas_exito || '{\"maximoEstaciones\":20}'::jsonb WHERE numero=5");
                inicializador.run();
                assertEquals("Consigna personalizada", jdbc.queryForObject("SELECT objetivo FROM escenario WHERE numero=5", String.class));
                assertEquals(20, jdbc.queryForObject("SELECT (reglas_exito->>'maximoEstaciones')::int FROM escenario WHERE numero=5", Integer.class));
                verificarPuntajeSimulaciones(jdbc, juego, mapper, geo, restricciones);
            } finally { conexion.rollback(); }
            assertNull(jdbc.queryForObject("SELECT to_regclass('pg_temp.escenario')::text", String.class));
        }
    }

    private static void prepararTablasTemporales(JdbcTemplate jdbc) {
        jdbc.execute("CREATE TEMP TABLE diseno(id_diseno INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE usuario(id_usuario INT PRIMARY KEY, numero_campana_actual INT, campana_completada_historicamente BOOLEAN) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE escenario(id_escenario INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, numero INT, nombre VARCHAR, objetivo VARCHAR, dificultad VARCHAR, instrucciones VARCHAR, modo VARCHAR, progresivo BOOLEAN, reglas_exito JSONB, herramientas_habilitadas JSONB) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE intento(id_intento INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, id_usuario INT, id_escenario INT, id_diseno INT, numero_campana INT, estado VARCHAR, progreso INT, puntaje INT, fecha_finalizacion TIMESTAMP) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE estacion(id_diseno INT, nombre VARCHAR, posicion_x NUMERIC(10,2), posicion_y NUMERIC(10,2), transbordo BOOLEAN) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE linea(id_diseno INT, nombre VARCHAR) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE tramo(id_diseno INT, nombre_linea VARCHAR, nombre_estacion_a VARCHAR, nombre_estacion_b VARCHAR) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE pasa(id_diseno INT, nombre_linea VARCHAR, nombre_estacion VARCHAR) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE metro(id_diseno INT, id_tren INT GENERATED BY DEFAULT AS IDENTITY, nombre_linea VARCHAR, velocidad_promedio NUMERIC(10,2), capacidad INT DEFAULT 300) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE simulacion(id_intento INT, comentarios TEXT, id_simulacion INT GENERATED BY DEFAULT AS IDENTITY, puntaje INT DEFAULT 0, duracion INT DEFAULT 6) ON COMMIT DROP");
        jdbc.update("INSERT INTO usuario VALUES (7,1,FALSE)");
        jdbc.execute("ALTER TABLE usuario ADD COLUMN rol VARCHAR DEFAULT 'JUGADOR'");
    }

    private void verificarPuntajeSimulaciones(JdbcTemplate jdbc, JuegoEducativoService juego, ObjectMapper mapper,
        GeografiaService geo, RestriccionesGeograficasService restricciones) {
        // Solo se amplían las tablas TEMP privadas creadas por esta prueba.
        jdbc.execute("ALTER TABLE escenario ADD COLUMN id_diseno_base INT");
        jdbc.execute("ALTER TABLE simulacion ADD COLUMN velocidad NUMERIC, ADD COLUMN estado VARCHAR, ADD COLUMN fecha_ejecucion TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        jdbc.update("UPDATE usuario SET numero_campana_actual=1 WHERE id_usuario=7");
        var simulaciones = new SimulacionService(jdbc, org.mockito.Mockito.mock(DisenoAdministracionService.class),
            new ObjetivosPuntosInteresService(mapper, geo), juego, restricciones);
        for (int duracion : new int[]{1, 6, 9, 25}) {
            var resultado = simulaciones.ejecutarSimulacion(7, 6,
                new com.metronet.backend.dto.EjecutarSimulacionRequest(java.math.BigDecimal.ONE, duracion));
            assertEquals(100, resultado.puntaje());
            assertEquals("UV_H_V1", resultado.escala());
            assertEquals(duracion, resultado.duracion());
            assertFalse(resultado.unidades().isEmpty());
            assertEquals(resultado, simulaciones.listarResultados(7, 6).getFirst());
            assertEquals(100, juego.evaluarEscenario(7, 6).puntaje());
        }
        jdbc.update("UPDATE metro SET velocidad_promedio=90 WHERE id_diseno=6");
        var parcial = simulaciones.ejecutarSimulacion(7, 6,
            new com.metronet.backend.dto.EjecutarSimulacionRequest(java.math.BigDecimal.ONE, 10));
        var evaluacion = juego.evaluarEscenario(7, 6);
        assertEquals(100, parcial.puntaje(), "No hay velocidad óptima inventada");
        assertEquals(parcial.puntaje(), evaluacion.puntaje());
        assertTrue(evaluacion.completado());
        assertEquals(100, jdbc.queryForObject("SELECT puntaje FROM intento WHERE id_intento=6", Integer.class), "El logro anterior se conserva");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> simulaciones.ejecutarSimulacion(7, 6,
            new com.metronet.backend.dto.EjecutarSimulacionRequest(java.math.BigDecimal.ONE, 0)));
        assertEquals(parcial.puntaje(), juego.obtenerDesempeno(7, 6).puntaje(), "Un error no descuenta puntos");
        jdbc.update("UPDATE intento SET estado='VALIDADO', puntaje=NULL WHERE id_intento=6");
        var nuevoParcial = simulaciones.ejecutarSimulacion(7, 6,
            new com.metronet.backend.dto.EjecutarSimulacionRequest(java.math.BigDecimal.ONE, 10));
        assertEquals(nuevoParcial.puntaje(), jdbc.queryForObject("SELECT puntaje FROM intento WHERE id_intento=6", Integer.class),
            "El resultado parcial se persiste aunque el navegador todavía no solicite la evaluación final");
        assertEquals("COMPLETADA", jdbc.queryForObject("SELECT estado FROM intento WHERE id_intento=6", String.class));
        jdbc.update("UPDATE escenario SET progresivo=FALSE, modo='EDICION_LIBRE', reglas_exito='{}'::jsonb WHERE numero=6");
        var libre = simulaciones.ejecutarSimulacion(7, 6,
            new com.metronet.backend.dto.EjecutarSimulacionRequest(java.math.BigDecimal.ONE, 10));
        assertEquals(0, libre.puntaje(), "Una red sin criterios no obtiene puntos por agregar elementos");
    }
}
