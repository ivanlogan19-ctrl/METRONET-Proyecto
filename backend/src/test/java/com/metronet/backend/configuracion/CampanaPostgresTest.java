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
    @Test
    void actualizaSoloElSeed014DelNivelCuatroYActivaLosSieteCriterios() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                prepararTablasTemporales(jdbc);
                String herramientas = "{\"estaciones\":true,\"lineas\":true,\"conexiones\":true,\"metros\":true,\"simulacion\":true}";
                String reglas014 = "{\"minimoEstaciones\":3,\"minimoLineas\":1,\"minimoTramos\":2,\"minimoMetros\":1,\"requiereRedValida\":true,\"requiereSimulacion\":true}";
                int legado = jdbc.queryForObject("""
                    INSERT INTO escenario(numero,nombre,objetivo,dificultad,instrucciones,modo,progresivo,reglas_exito,herramientas_habilitadas)
                    VALUES (4,'Nivel 4 · Simulación completa','Validá la red, asigná un metro y ejecutá una simulación.',
                    'Avanzado','Completá una red válida y simulá la circulación de la unidad de metro.','NIVEL',TRUE,CAST(? AS jsonb),CAST(? AS jsonb))
                    RETURNING id_escenario
                    """, Integer.class, reglas014, herramientas);
                int personalizado = jdbc.queryForObject("""
                    INSERT INTO escenario(numero,nombre,objetivo,dificultad,instrucciones,modo,progresivo,reglas_exito,herramientas_habilitadas)
                    VALUES (4,'Mi práctica','Objetivo propio','Avanzado','Instrucciones propias','NIVEL',TRUE,CAST(? AS jsonb),CAST(? AS jsonb))
                    RETURNING id_escenario
                    """, Integer.class, reglas014, herramientas);
                var inicializador = new InicializadorCatalogoEscenariosProgresivos();
                inicializador.inicializarCatalogoEscenariosProgresivos(jdbc).run();
                inicializador.inicializarCatalogoEscenariosProgresivos(jdbc).run();
                assertEquals(7, jdbc.queryForObject("SELECT count(*) FROM criterio_uv_ut", Integer.class));
                assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM criterio_uv_ut WHERE id_escenario=?", Integer.class, legado));
                assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM criterio_uv_ut WHERE id_escenario=?", Integer.class, personalizado));
                assertEquals("Objetivo propio", jdbc.queryForObject("SELECT objetivo FROM escenario WHERE id_escenario=?", String.class, personalizado));
                assertTrue(jdbc.queryForObject("SELECT reglas_exito=CAST(? AS jsonb) FROM escenario WHERE id_escenario=?", Boolean.class, reglas014, personalizado));
            } finally { conexion.rollback(); }
        }
    }

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
                var actuales = jdbc.queryForList("SELECT numero,objetivo,instrucciones FROM escenario WHERE numero IS NOT NULL ORDER BY numero");
                var mapper = new ObjectMapper();
                try (var entrada = new org.springframework.core.io.ClassPathResource("educacion/niveles-consignas-anteriores.json").getInputStream()) {
                    for (var anterior : mapper.readTree(entrada)) {
                        jdbc.update("UPDATE escenario SET objetivo=?, instrucciones=? WHERE numero=?",
                            anterior.path("objetivo").asText(), anterior.path("instrucciones").asText(), anterior.path("numero").asInt());
                    }
                }
                jdbc.update("UPDATE escenario SET reglas_exito=reglas_exito - 'requiereRedValida' WHERE numero=3");
                jdbc.update("UPDATE escenario SET instrucciones=replace(instrucciones,'Guardá tu diseño y simulá','Validá y simulá') WHERE numero IN (8,10)");
                inicializador.run(); inicializador.run();
                assertEquals(actuales, jdbc.queryForList("SELECT numero,objetivo,instrucciones FROM escenario WHERE numero IS NOT NULL ORDER BY numero"));
                assertEquals(reglas, jdbc.queryForList("SELECT numero,reglas_exito::text,herramientas_habilitadas::text FROM escenario ORDER BY id_escenario"));
                jdbc.update("UPDATE escenario SET instrucciones='Consigna personalizada: Validá tu hipótesis' WHERE numero=8");
                inicializador.run();
                assertEquals("Consigna personalizada: Validá tu hipótesis", jdbc.queryForObject("SELECT instrucciones FROM escenario WHERE numero=8", String.class));
            } finally { conexion.rollback(); }
        }
    }

    @Test
    void nivelCuatroConTextoPersonalizadoNoSeSobrescribePorReglaLegada() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                prepararTablasTemporales(jdbc);
                var inicializador = new InicializadorCatalogoEscenariosProgresivos().inicializarCatalogoEscenariosProgresivos(jdbc);
                inicializador.run();
                String anterior = "{\"minimoEstaciones\":3,\"minimoLineas\":1,\"minimoTramos\":2,\"minimoMetros\":1,\"requiereRedValida\":true,\"requiereSimulacion\":true}";
                jdbc.update("UPDATE escenario SET instrucciones='Consigna personalizada', reglas_exito=CAST(? AS jsonb) WHERE numero=4", anterior);
                inicializador.run();
                assertEquals("Consigna personalizada", jdbc.queryForObject("SELECT instrucciones FROM escenario WHERE numero=4", String.class));
                assertTrue(jdbc.queryForObject("SELECT NOT (reglas_exito ? 'aprendizajeSimulacion') FROM escenario WHERE numero=4", Boolean.class));
                var preUv = new ObjectMapper();
                try (var entrada = new org.springframework.core.io.ClassPathResource("educacion/niveles-pre-uv.json").getInputStream()) {
                    var nivel = preUv.readTree(entrada).get(0);
                    jdbc.update("UPDATE escenario SET objetivo=?, instrucciones=? WHERE numero=4", nivel.path("objetivo").asText(), nivel.path("instrucciones").asText());
                }
                inicializador.run(); inicializador.run();
                assertTrue(jdbc.queryForObject("SELECT reglas_exito ? 'aprendizajeSimulacion' FROM escenario WHERE numero=4", Boolean.class));
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
                assertEquals(7, jdbc.queryForObject("SELECT COUNT(*) FROM criterio_uv_ut", Integer.class),
                    "La activación canónica V2 es idempotente y no crea configuraciones para niveles 1–3");
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

    @Test
    void criterioUvUtEsViableEnRedesGeograficasDeNivelesCuatroADiez() throws Exception {
        try (var conexion = DriverManager.getConnection(System.getenv("METRONET_TEST_POSTGRES_URL"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_USER", "postgres"),
            System.getenv().getOrDefault("METRONET_TEST_POSTGRES_PASSWORD", ""))) {
            conexion.setAutoCommit(false);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(conexion, true));
            try {
                prepararTablasTemporales(jdbc);
                new InicializadorCatalogoEscenariosProgresivos().inicializarCatalogoEscenariosProgresivos(jdbc).run();
                var mapper = new ObjectMapper();
                var geo = new GeografiaService(mapper);
                var restricciones = new RestriccionesGeograficasService(jdbc, mapper, geo);
                var criterio = new CriterioUvUtService(jdbc, mapper, new PuntuacionService(jdbc, mapper));
                var admin = new AdministracionUvUtService(jdbc, mapper);
                var juego = new JuegoEducativoService(jdbc, mapper, new ObjetivosPuntosInteresService(mapper, geo),
                    new CondicionesGeograficasService(jdbc, mapper, geo, restricciones));
                java.math.BigDecimal[] presupuestos = {null, null, null, null,
                    new java.math.BigDecimal("2"), new java.math.BigDecimal("2.5"), new java.math.BigDecimal("3"),
                    new java.math.BigDecimal("4"), new java.math.BigDecimal("5.5"),
                    new java.math.BigDecimal("5.5"), new java.math.BigDecimal("6.5")};
                for (int nivel = 4; nivel <= 10; nivel++) {
                    int escenario = jdbc.queryForObject("SELECT id_escenario FROM escenario WHERE numero=?", Integer.class, nivel);
                    var cambio = new AdministracionUvUtService.Cambio(2, presupuestos[nivel], 1);
                    var vista = admin.previsualizar(nivel, cambio);
                    assertTrue(vista.viable(), "Presupuesto nivel " + nivel);
                    // Esta prueba usa tablas temporales sin publicaciones: prepara el criterio del motor directamente.
                    jdbc.update("UPDATE criterio_uv_ut SET version=2,limite_ut=?,presupuesto_uv=? WHERE id_escenario=?",
                        cambio.limiteUt(), cambio.presupuestoUv(), escenario);
                    assertEquals(2, jdbc.queryForObject(
                        "SELECT version FROM criterio_uv_ut WHERE id_escenario=?", Integer.class, escenario));
                    jdbc.update("INSERT INTO diseno(id_diseno) VALUES (?)", nivel);
                    jdbc.update("INSERT INTO intento VALUES (?,7,?,?,1,'EN_DESARROLLO',0,NULL,NULL)", nivel, escenario, nivel);
                    criterio.iniciarIntento(nivel, escenario);
                    assertEquals(0, presupuestos[nivel].compareTo(criterio.configuracionIntento(nivel).presupuestoUv()));
                    var reglas = mapper.readTree(jdbc.queryForObject("SELECT reglas_exito::text FROM escenario WHERE id_escenario=?", String.class, escenario));
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
                    int[] longitudes = vista.tramosFixture();
                    for (int i = 0; i < longitudes.length; i++) {
                        var uv = java.math.BigDecimal.valueOf(longitudes[i]).divide(java.math.BigDecimal.valueOf(2), 2, java.math.RoundingMode.UNNECESSARY);
                        jdbc.update("INSERT INTO metro(id_diseno,nombre_linea,velocidad_promedio) VALUES (?,?,?)",
                            nivel, i == 0 ? "Principal" : "Enlace" + i, uv);
                    }
                    assertTrue(restricciones.observarDiseno(nivel).isEmpty(), "Territorio nivel " + nivel);
                    assertTrue(juego.obtenerDesempeno(7, nivel).redResuelta(), "La red completa permite ajustar UV antes de Play en nivel " + nivel);
                    int simulacion = jdbc.queryForObject("INSERT INTO simulacion(id_intento,comentarios,duracion) VALUES (?,'Prueba UV/UT',2) RETURNING id_simulacion", Integer.class, nivel);
                    var resultado = criterio.registrar(nivel, nivel, simulacion, 2);
                    assertTrue(resultado.completo(), "Llegada de todas las unidades nivel " + nivel + ": " + resultado.unidades() + ", suma " + resultado.sumaUv());
                    assertTrue(resultado.sumaUv().compareTo(presupuestos[nivel]) <= 0, "UV del nivel " + nivel);
                    assertTrue(criterio.condicion(nivel, nivel).completado());
                    assertEquals(0, resultado.sumaUv().compareTo(resultado.mejorUv()));
                    jdbc.update("UPDATE metro SET capacidad=capacidad+1 WHERE id_diseno=?", nivel);
                    assertTrue(criterio.ultimo(nivel, nivel).completo(), "Capacidad heredada no altera la llegada V2");
                    assertTrue(juego.obtenerDesempeno(7, nivel).simulacionActual(), "Capacidad heredada no invalida Play V2");
                    assertThrows(org.springframework.web.server.ResponseStatusException.class,
                        () -> admin.previsualizar(vista.numero(), cambio), "La versión publicada impide sobrescribir una vista vieja");
                    int tardia = jdbc.queryForObject("INSERT INTO simulacion(id_intento,comentarios,duracion) VALUES (?,'Prueba tardía',3) RETURNING id_simulacion", Integer.class, nivel);
                    assertFalse(criterio.registrar(nivel, nivel, tardia, 3).completo(), "Superar el límite UT no completa el nivel");
                    assertTrue(criterio.resultadoDeSimulacion(simulacion).completo(), "El resultado anterior queda intacto");
                    assertEquals(0, resultado.sumaUv().compareTo(criterio.resultadoDeSimulacion(tardia).mejorUv()),
                        "La marca educativa compara la misma red y no altera el puntaje histórico");
                }
                jdbc.execute("ALTER TABLE escenario ADD COLUMN id_diseno_base INT");
                jdbc.execute("ALTER TABLE simulacion ADD COLUMN velocidad NUMERIC, ADD COLUMN estado VARCHAR, ADD COLUMN fecha_ejecucion TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
                ComparacionesSimulacionFixture.practicar(jdbc, juego, 10);
                jdbc.update("UPDATE metro SET velocidad_promedio=CASE WHEN nombre_linea='Principal' THEN 4.5 ELSE 0.5 END WHERE id_diseno=10");
                jdbc.update("UPDATE intento SET estado='VALIDADO' WHERE id_intento=10");
                var simulaciones = new SimulacionService(jdbc, org.mockito.Mockito.mock(DisenoAdministracionService.class),
                    new ObjetivosPuntosInteresService(mapper, geo), juego, restricciones);
                var ejecucion = simulaciones.ejecutarSimulacion(7, 10,
                    new com.metronet.backend.dto.EjecutarSimulacionRequest(java.math.BigDecimal.ONE, 2));
                assertEquals("UV_UT_V2", ejecucion.escala());
                assertTrue(ejecucion.resultadoUvUt().completo(), "Play guarda el resultado V2 para el nivel 10");
                assertEquals(ejecucion, simulaciones.listarResultados(7, 10).getFirst());
                assertTrue(juego.evaluarEscenario(7, 10).completado(), "Las comparaciones, la red y la llegada permiten terminar el nivel 10");
            } finally { conexion.rollback(); }
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
        jdbc.execute("CREATE TEMP TABLE criterio_uv_ut(id_escenario INT, version INT, limite_ut INT, presupuesto_uv NUMERIC(8,2)) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE intento_catalogo_v1(id_intento INT, reglas_exito JSONB, herramientas_habilitadas JSONB, objetivo TEXT, instrucciones TEXT) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE intento_uv_ut(id_intento INT, version INT, limite_ut INT, presupuesto_uv NUMERIC(8,2), reglas_exito JSONB, herramientas_habilitadas JSONB, objetivo TEXT, instrucciones TEXT) ON COMMIT DROP");
        jdbc.execute("CREATE TEMP TABLE resultado_uv_ut(id_simulacion INT, version INT, huella_problema TEXT, huella_ejecucion TEXT, limite_ut INT, presupuesto_uv NUMERIC(8,2), ut_ejecutadas INT, suma_uv NUMERIC(8,2), completo BOOLEAN, unidades JSONB) ON COMMIT DROP");
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
