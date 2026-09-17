package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.ConsignaDisenoResponse;
import com.metronet.backend.dto.EscenarioJuegoResponse;
import com.metronet.backend.dto.InicioEscenarioResponse;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import com.metronet.backend.dto.ProgresoJuegoResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class JuegoEducativoServiceTest {
    private static final Integer ID_USUARIO = 7;
    private static final Integer ID_ESCENARIO = 1;
    private static final int NUMERO_CAMPANA = 3;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private ObjetivosPuntosInteresService objetivosPuntosInteresService;

    @Test
    void volverAJugarCreaUnNuevoDisenoEIntentoSinBorrarElIntentoCompletado() throws Exception {
        prepararUsuario(NUMERO_CAMPANA, true);
        prepararEscenarioNivelUno();
        prepararIntentoActual(40, 90, "COMPLETADO", 100);
        when(jdbcTemplate.queryForObject(
            contains("e.numero = ? AND i.estado = 'COMPLETADO'"), eq(Integer.class), any(Object[].class)
        )).thenReturn(1);
        when(jdbcTemplate.queryForObject(
            "INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class
        )).thenReturn(91);
        when(jdbcTemplate.queryForObject(
            contains("INSERT INTO intento"), eq(Integer.class), any(Object[].class)
        )).thenReturn(41);

        InicioEscenarioResponse respuesta = crearServicio().volverAJugar(ID_USUARIO, ID_ESCENARIO);

        assertEquals(91, respuesta.idDiseno());
        assertEquals(ID_ESCENARIO, respuesta.idEscenario());
        assertEquals(41, respuesta.idIntento());
        assertEquals("EN_DESARROLLO", respuesta.estado());
        ArgumentCaptor<Object[]> argumentosIntento = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).queryForObject(
            contains("INSERT INTO intento"), eq(Integer.class), argumentosIntento.capture()
        );
        assertEquals(List.of(ID_USUARIO, ID_ESCENARIO, 91, NUMERO_CAMPANA), List.of(argumentosIntento.getValue()));
        verify(jdbcTemplate, never()).update(contains("DELETE"), any(Object[].class));
    }

    @Test
    void iniciarEscenarioDevuelveElIntentoActivoSinCrearDuplicados() throws Exception {
        prepararUsuario(NUMERO_CAMPANA, false);
        prepararEscenarioNivelUno();
        prepararIntentoActual(12, 25, "EN_DESARROLLO", 45);

        InicioEscenarioResponse respuesta = crearServicio().iniciarEscenario(ID_USUARIO, ID_ESCENARIO);

        assertEquals(25, respuesta.idDiseno());
        assertEquals(ID_ESCENARIO, respuesta.idEscenario());
        assertEquals(12, respuesta.idIntento());
        assertEquals("EN_DESARROLLO", respuesta.estado());
        verify(jdbcTemplate, never()).queryForObject(
            contains("INSERT INTO diseno"), eq(Integer.class)
        );
        verify(jdbcTemplate, never()).queryForObject(
            contains("INSERT INTO intento"), eq(Integer.class), any(Object[].class)
        );
    }

    @Test
    void reiniciarRecorridoSoloAvanzaLaCampanaYConservaElLogroHistorico() throws Exception {
        prepararUsuario(NUMERO_CAMPANA, true);
        when(jdbcTemplate.update(
            contains("SET numero_campana_actual = numero_campana_actual + 1"), eq(ID_USUARIO), eq(NUMERO_CAMPANA)
        )).thenReturn(1);
        ProgresoJuegoResponse progresoReiniciado = new ProgresoJuegoResponse(
            List.of(), NUMERO_CAMPANA + 1, 4, 0, false, true, true
        );
        JuegoEducativoService servicio = spy(crearServicio());
        doReturn(progresoReiniciado).when(servicio).obtenerResumenProgreso(ID_USUARIO);

        ProgresoJuegoResponse respuesta = servicio.reiniciarRecorrido(ID_USUARIO, NUMERO_CAMPANA);

        assertSame(progresoReiniciado, respuesta);
        assertTrue(respuesta.campanaCompletadaHistoricamente());
        assertTrue(respuesta.modoLibreDesbloqueado());
        ArgumentCaptor<String> consulta = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).update(consulta.capture(), eq(ID_USUARIO), eq(NUMERO_CAMPANA));
        assertTrue(consulta.getValue().contains("numero_campana_actual = numero_campana_actual + 1"));
        assertFalse(consulta.getValue().contains("campana_completada_historicamente = FALSE"));
        verify(jdbcTemplate, never()).update(contains("DELETE"), any(Object[].class));
    }

    @Test
    void reiniciarCampanaCompletadaMantieneModoLibreYDejaElNuevoRecorridoEnEstadoInicial() throws Exception {
        AtomicInteger numeroCampanaActual = new AtomicInteger(NUMERO_CAMPANA);
        prepararUsuarioDinamico(numeroCampanaActual, true);
        prepararEscenariosNivelInicialYModoLibre();
        prepararIntentosActualesVacios();
        prepararNivelesSinCompletar();
        prepararEstadisticasSinIntentos();
        when(jdbcTemplate.update(
            contains("SET numero_campana_actual = numero_campana_actual + 1"), eq(ID_USUARIO), eq(NUMERO_CAMPANA)
        )).thenAnswer(invocacion -> {
            assertEquals(NUMERO_CAMPANA, numeroCampanaActual.get());
            numeroCampanaActual.incrementAndGet();
            return 1;
        });

        ProgresoJuegoResponse respuesta = crearServicio().reiniciarRecorrido(ID_USUARIO, NUMERO_CAMPANA);
        EscenarioJuegoResponse escenarioInicial = respuesta.escenarios().get(0);
        EscenarioJuegoResponse modoLibre = respuesta.escenarios().get(1);

        assertEquals(NUMERO_CAMPANA + 1, respuesta.numeroCampanaActual());
        assertEquals(0, respuesta.nivelesCompletados());
        assertFalse(respuesta.campanaCompletada());
        assertTrue(respuesta.campanaCompletadaHistoricamente());
        assertTrue(respuesta.modoLibreDesbloqueado());
        assertEquals("DISPONIBLE", escenarioInicial.estado());
        assertTrue(escenarioInicial.desbloqueado());
        assertFalse(escenarioInicial.completadoEnCampanaActual());
        assertEquals("DISPONIBLE", modoLibre.estado());
        assertTrue(modoLibre.desbloqueado());
        verify(jdbcTemplate, never()).update(contains("DELETE"), any(Object[].class));
    }

    @Test
    void modoLibrePermaneceBloqueadoParaUsuarioQueNuncaCompletoLaCampana() throws Exception {
        prepararUsuario(1, false);
        prepararEscenariosNivelInicialYModoLibre();
        prepararIntentosActualesVacios();
        prepararNivelesSinCompletar();
        prepararEstadisticasSinIntentos();

        ProgresoJuegoResponse respuesta = crearServicio().obtenerResumenProgreso(ID_USUARIO);
        EscenarioJuegoResponse modoLibre = respuesta.escenarios().get(1);

        assertFalse(respuesta.campanaCompletadaHistoricamente());
        assertFalse(respuesta.modoLibreDesbloqueado());
        assertEquals("BLOQUEADO", modoLibre.estado());
        assertFalse(modoLibre.desbloqueado());
    }

    @Test
    void obtieneUnaConsignaCalculadaSinPersistirElProgreso() throws Exception {
        Usuario jugador = usuario(Rol.JUGADOR);
        prepararIntentoParaConsigna(12, "EN_DESARROLLO", """
            {"minimoEstaciones":3,"minimoLineas":1,"requiereCoberturaPuntosInteres":true}
            """);
        prepararContadoresConsigna(2, 1, 0, 0);
        prepararEstacionesConsigna(new BigDecimal("0"), new BigDecimal("0"));
        when(objetivosPuntosInteresService.obtenerObjetivos(contains("requiereCoberturaPuntosInteres"))).thenReturn(List.of(
            new PuntoInteresObjetivoResponse(1, "Palacio Legislativo", BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("5")),
            new PuntoInteresObjetivoResponse(26, "Rambla de Carrasco", new BigDecimal("30"), BigDecimal.ZERO, new BigDecimal("5"))
        ));

        ConsignaDisenoResponse respuesta = crearServicio().obtenerConsigna(jugador, 55);

        assertEquals("PARCIAL", respuesta.estadoGlobal());
        assertEquals(33, respuesta.progreso());
        assertEquals(3, respuesta.condiciones().size());
        assertEquals("minimoEstaciones", respuesta.condiciones().get(0).clave());
        assertEquals(2, respuesta.condiciones().get(0).actual());
        assertEquals(3, respuesta.condiciones().get(0).requerido());
        assertFalse(respuesta.condiciones().get(0).completado());
        assertEquals("minimoLineas", respuesta.condiciones().get(1).clave());
        assertTrue(respuesta.condiciones().get(1).completado());
        assertEquals("requiereCoberturaPuntosInteres", respuesta.condiciones().get(2).clave());
        assertEquals(1, respuesta.condiciones().get(2).actual());
        assertEquals(2, respuesta.condiciones().get(2).requerido());
        assertEquals(2, respuesta.referenciasObjetivo().size());
        assertTrue(respuesta.referenciasObjetivo().get(0).cubierto());
        assertFalse(respuesta.referenciasObjetivo().get(1).cubierto());
        verify(jdbcTemplate, never()).update(any(String.class), any(Object[].class));
    }

    @Test
    void impideQueUnJugadorConsulteLaConsignaDeUnDisenoAjeno() throws Exception {
        Usuario jugador = usuario(Rol.JUGADOR);
        when(jdbcTemplate.query(
            contains("FROM intento i JOIN escenario e"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenReturn(List.of());

        ResponseStatusException error = assertThrows(
            ResponseStatusException.class,
            () -> crearServicio().obtenerConsigna(jugador, 55)
        );

        assertEquals(404, error.getStatusCode().value());
        ArgumentCaptor<String> consulta = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> argumentos = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).query(consulta.capture(), ArgumentMatchers.<RowMapper<Object>>any(), argumentos.capture());
        assertTrue(consulta.getValue().contains("i.id_usuario = ?"));
        assertEquals(List.of(55, ID_USUARIO), List.of(argumentos.getValue()));
        verify(jdbcTemplate, never()).update(any(String.class), any(Object[].class));
    }

    @Test
    void permiteQueUnAdministradorConsulteUnaConsignaSinFiltroDePropietario() throws Exception {
        Usuario administrador = usuario(Rol.ADMIN);
        when(jdbcTemplate.query(
            contains("FROM intento i JOIN escenario e"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenReturn(List.of());

        assertThrows(ResponseStatusException.class, () -> crearServicio().obtenerConsigna(administrador, 55));

        ArgumentCaptor<String> consulta = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> argumentos = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).query(consulta.capture(), ArgumentMatchers.<RowMapper<Object>>any(), argumentos.capture());
        assertFalse(consulta.getValue().contains("i.id_usuario = ?"));
        assertEquals(List.of(55), List.of(argumentos.getValue()));
    }

    private JuegoEducativoService crearServicio() {
        return new JuegoEducativoService(jdbcTemplate, new ObjectMapper(), objetivosPuntosInteresService);
    }

    private Usuario usuario(Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(ID_USUARIO);
        usuario.setRol(rol);
        return usuario;
    }

    private void prepararIntentoParaConsigna(int idIntento, String estado, String reglasExito) throws SQLException {
        when(jdbcTemplate.query(
            contains("FROM intento i JOIN escenario e"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenAnswer(invocacion -> mapear(invocacion.getArgument(1), resultadoIntentoEvaluable(idIntento, estado, reglasExito)));
    }

    private void prepararContadoresConsigna(int estaciones, int lineas, int tramos, int metros) {
        when(jdbcTemplate.queryForObject(any(String.class), eq(Integer.class), any(Object[].class))).thenAnswer(invocacion -> {
            String consulta = invocacion.getArgument(0);
            if (consulta.contains("FROM estacion WHERE id_diseno")) return estaciones;
            if (consulta.contains("FROM linea WHERE id_diseno")) return lineas;
            if (consulta.contains("FROM tramo WHERE id_diseno")) return tramos;
            if (consulta.contains("FROM metro WHERE id_diseno")) return metros;
            if (consulta.contains("FROM simulacion")) return 0;
            if (consulta.contains("estaciones_aisladas") || consulta.contains("ramificaciones")) return 0;
            return 0;
        });
    }

    private void prepararEstacionesConsigna(BigDecimal posicionX, BigDecimal posicionY) throws SQLException {
        when(jdbcTemplate.query(
            contains("SELECT posicion_x, posicion_y FROM estacion"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenAnswer(invocacion -> mapear(invocacion.getArgument(1), resultadoCoordenadaEstacion(posicionX, posicionY)));
    }

    private void prepararUsuario(int numeroCampana, boolean campanaCompletadaHistoricamente) throws SQLException {
        when(jdbcTemplate.query(
            contains("SELECT numero_campana_actual, campana_completada_historicamente"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenAnswer(invocacion -> mapear(
            invocacion.getArgument(1), resultadoUsuario(numeroCampana, campanaCompletadaHistoricamente)
        ));
    }

    private void prepararUsuarioDinamico(AtomicInteger numeroCampana, boolean campanaCompletadaHistoricamente) throws SQLException {
        when(jdbcTemplate.query(
            contains("SELECT numero_campana_actual, campana_completada_historicamente"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenAnswer(invocacion -> mapear(
            invocacion.getArgument(1), resultadoUsuario(numeroCampana.get(), campanaCompletadaHistoricamente)
        ));
    }

    private void prepararEscenarioNivelUno() throws SQLException {
        when(jdbcTemplate.query(
            contains("FROM escenario WHERE progresivo = TRUE"),
            ArgumentMatchers.<RowMapper<Object>>any()
        )).thenAnswer(invocacion -> mapear(invocacion.getArgument(1), resultadoEscenarioNivelUno()));
    }

    private void prepararEscenariosNivelInicialYModoLibre() throws SQLException {
        when(jdbcTemplate.query(
            contains("FROM escenario WHERE progresivo = TRUE"),
            ArgumentMatchers.<RowMapper<Object>>any()
        )).thenAnswer(invocacion -> mapearVarios(
            invocacion.getArgument(1),
            resultadoEscenario(1, 1, "Escenario 1 · Fundamentos", "NIVEL"),
            resultadoEscenario(5, null, "Modo Libre", "EDICION_LIBRE")
        ));
    }

    private void prepararIntentoActual(int idIntento, int idDiseno, String estado, int progreso) throws SQLException {
        when(jdbcTemplate.query(
            contains("WHERE id_usuario = ? AND id_escenario = ? AND numero_campana = ?"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenAnswer(invocacion -> mapear(invocacion.getArgument(1), resultadoIntento(idIntento, idDiseno, estado, progreso)));
    }

    private void prepararIntentosActualesVacios() {
        when(jdbcTemplate.query(
            contains("WHERE id_usuario = ? AND id_escenario = ? AND numero_campana = ?"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenReturn(List.of());
    }

    private void prepararNivelesSinCompletar() {
        when(jdbcTemplate.queryForObject(
            contains("e.numero = ? AND i.estado = 'COMPLETADO'"), eq(Integer.class), any(Object[].class)
        )).thenReturn(0);
    }

    private void prepararEstadisticasSinIntentos() throws SQLException {
        when(jdbcTemplate.query(
            contains("SELECT COUNT(*) AS cantidad_intentos"),
            ArgumentMatchers.<RowMapper<Object>>any(),
            any(Object[].class)
        )).thenAnswer(invocacion -> mapear(invocacion.getArgument(1), resultadoEstadisticasSinIntentos()));
    }

    private List<Object> mapear(RowMapper<?> mapeador, ResultSet resultado) throws SQLException {
        return List.of(mapeador.mapRow(resultado, 0));
    }

    private List<Object> mapearVarios(RowMapper<?> mapeador, ResultSet... resultados) throws SQLException {
        List<Object> filas = new ArrayList<>();
        for (int fila = 0; fila < resultados.length; fila++) filas.add(mapeador.mapRow(resultados[fila], fila));
        return filas;
    }

    private ResultSet resultadoUsuario(int numeroCampana, boolean campanaCompletadaHistoricamente) throws SQLException {
        ResultSet resultado = org.mockito.Mockito.mock(ResultSet.class);
        when(resultado.getInt("numero_campana_actual")).thenReturn(numeroCampana);
        when(resultado.getBoolean("campana_completada_historicamente")).thenReturn(campanaCompletadaHistoricamente);
        return resultado;
    }

    private ResultSet resultadoEscenarioNivelUno() throws SQLException {
        return resultadoEscenario(ID_ESCENARIO, 1, "Escenario 1 · Fundamentos", "NIVEL");
    }

    private ResultSet resultadoEscenario(Integer idEscenario, Integer numero, String nombre, String modo) throws SQLException {
        ResultSet resultado = org.mockito.Mockito.mock(ResultSet.class);
        when(resultado.getInt("id_escenario")).thenReturn(idEscenario);
        when(resultado.getObject("numero", Integer.class)).thenReturn(numero);
        when(resultado.getString("nombre")).thenReturn(nombre);
        when(resultado.getString("objetivo")).thenReturn("Construí una red inicial");
        when(resultado.getString("dificultad")).thenReturn("Inicial");
        when(resultado.getString("instrucciones")).thenReturn("Agregá una línea y dos estaciones.");
        when(resultado.getString("modo")).thenReturn(modo);
        when(resultado.getString("reglas_exito")).thenReturn("{}");
        when(resultado.getString("herramientas_habilitadas")).thenReturn("{}");
        return resultado;
    }

    private ResultSet resultadoEstadisticasSinIntentos() throws SQLException {
        ResultSet resultado = org.mockito.Mockito.mock(ResultSet.class);
        when(resultado.getInt("cantidad_intentos")).thenReturn(0);
        return resultado;
    }

    private ResultSet resultadoIntento(int idIntento, int idDiseno, String estado, int progreso) throws SQLException {
        ResultSet resultado = org.mockito.Mockito.mock(ResultSet.class);
        when(resultado.getInt("id_intento")).thenReturn(idIntento);
        when(resultado.getInt("id_diseno")).thenReturn(idDiseno);
        when(resultado.getString("estado")).thenReturn(estado);
        when(resultado.getInt("progreso")).thenReturn(progreso);
        return resultado;
    }

    private ResultSet resultadoIntentoEvaluable(int idIntento, String estado, String reglasExito) throws SQLException {
        ResultSet resultado = org.mockito.Mockito.mock(ResultSet.class);
        when(resultado.getInt("id_intento")).thenReturn(idIntento);
        when(resultado.getString("estado")).thenReturn(estado);
        when(resultado.getObject("puntaje", Integer.class)).thenReturn(null);
        when(resultado.getInt("numero_campana")).thenReturn(NUMERO_CAMPANA);
        when(resultado.getObject("numero", Integer.class)).thenReturn(1);
        when(resultado.getString("modo")).thenReturn("NIVEL");
        when(resultado.getString("reglas_exito")).thenReturn(reglasExito);
        return resultado;
    }

    private ResultSet resultadoCoordenadaEstacion(BigDecimal posicionX, BigDecimal posicionY) throws SQLException {
        ResultSet resultado = org.mockito.Mockito.mock(ResultSet.class);
        when(resultado.getBigDecimal("posicion_x")).thenReturn(posicionX);
        when(resultado.getBigDecimal("posicion_y")).thenReturn(posicionY);
        return resultado;
    }
}
