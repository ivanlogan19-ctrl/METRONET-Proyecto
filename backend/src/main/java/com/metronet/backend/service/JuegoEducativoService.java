package com.metronet.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.ConsignaDisenoResponse;
import com.metronet.backend.dto.EscenarioJuegoResponse;
import com.metronet.backend.dto.EvaluacionEscenarioResponse;
import com.metronet.backend.dto.InicioEscenarioResponse;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import com.metronet.backend.dto.ProgresoJuegoResponse;
import com.metronet.backend.dto.ReferenciaObjetivoConsignaResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class JuegoEducativoService {
    private static final int CANTIDAD_NIVELES = 4;
    private static final String ESTADO_BLOQUEADO = "BLOQUEADO";
    private static final String ESTADO_COMPLETADO = "COMPLETADO";
    private static final String ESTADO_EN_DESARROLLO = "EN_DESARROLLO";
    private static final String MODO_EDICION_LIBRE = "EDICION_LIBRE";
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ObjetivosPuntosInteresService objetivosPuntosInteresService;

    public JuegoEducativoService(
        JdbcTemplate jdbcTemplate,
        ObjectMapper objectMapper,
        ObjetivosPuntosInteresService objetivosPuntosInteresService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.objetivosPuntosInteresService = objetivosPuntosInteresService;
    }

    public List<EscenarioJuegoResponse> obtenerProgreso(Integer idUsuario) {
        return obtenerResumenProgreso(idUsuario).escenarios();
    }

    public ProgresoJuegoResponse obtenerResumenProgreso(Integer idUsuario) {
        ProgresoUsuario progresoUsuario = obtenerProgresoUsuario(idUsuario);
        List<EscenarioBase> escenarios = listarEscenariosProgresivos();
        List<EscenarioJuegoResponse> respuesta = new ArrayList<>();
        for (EscenarioBase escenario : escenarios) {
            IntentoJuego intento = obtenerIntentoActual(idUsuario, escenario.idEscenario(), progresoUsuario.numeroCampanaActual());
            boolean completadoEnCampanaActual = escenario.numero() != null
                && nivelCompletado(idUsuario, escenario.numero(), progresoUsuario.numeroCampanaActual());
            boolean desbloqueado = esDesbloqueado(idUsuario, escenario, progresoUsuario);
            String estado = intento == null ? (desbloqueado ? "DISPONIBLE" : ESTADO_BLOQUEADO) : intento.estado();
            Integer progreso = intento == null ? 0 : intento.progreso();
            EstadisticasIntento estadisticas = obtenerEstadisticas(idUsuario, escenario.idEscenario());
            respuesta.add(new EscenarioJuegoResponse(
                escenario.idEscenario(), escenario.numero(), escenario.nombre(), escenario.objetivo(), escenario.dificultad(),
                escenario.instrucciones(), estado, progreso, desbloqueado, leerHerramientas(escenario.herramientas()),
                completadoEnCampanaActual, estadisticas.cantidadIntentos(), estadisticas.mejorPuntaje(), estadisticas.ultimoPuntaje()
            ));
        }
        int cantidadNiveles = (int) escenarios.stream().filter(escenario -> escenario.numero() != null).count();
        int nivelesCompletados = contarNivelesCompletados(idUsuario, progresoUsuario.numeroCampanaActual(), cantidadNiveles);
        boolean campanaCompletada = cantidadNiveles > 0 && nivelesCompletados == cantidadNiveles;
        return new ProgresoJuegoResponse(
            respuesta,
            progresoUsuario.numeroCampanaActual(),
            cantidadNiveles,
            nivelesCompletados,
            campanaCompletada,
            progresoUsuario.campanaCompletadaHistoricamente(),
            progresoUsuario.campanaCompletadaHistoricamente()
        );
    }

    public boolean tieneModoLibreDesbloqueado(Integer idUsuario) {
        return obtenerProgresoUsuario(idUsuario).campanaCompletadaHistoricamente();
    }

    @Transactional
    public InicioEscenarioResponse iniciarEscenario(Integer idUsuario, Integer idEscenario) {
        ProgresoUsuario progresoUsuario = obtenerProgresoUsuario(idUsuario);
        EscenarioBase escenario = obtenerEscenario(idEscenario);
        if (!esDesbloqueado(idUsuario, escenario, progresoUsuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Completá los niveles anteriores para desbloquear este escenario");
        }
        IntentoJuego intentoExistente = obtenerIntentoActual(idUsuario, idEscenario, progresoUsuario.numeroCampanaActual());
        if (intentoExistente != null) {
            if (ESTADO_COMPLETADO.equals(intentoExistente.estado())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Este escenario ya fue completado. Elegí Volver a jugar para crear un nuevo intento");
            }
            return new InicioEscenarioResponse(intentoExistente.idDiseno(), idEscenario, intentoExistente.idIntento(), intentoExistente.estado());
        }
        return crearIntento(idUsuario, escenario, progresoUsuario.numeroCampanaActual());
    }

    @Transactional
    public InicioEscenarioResponse volverAJugar(Integer idUsuario, Integer idEscenario) {
        ProgresoUsuario progresoUsuario = obtenerProgresoUsuario(idUsuario);
        EscenarioBase escenario = obtenerEscenario(idEscenario);
        if (escenario.numero() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El Modo Libre se inicia desde su acción principal");
        }
        if (!esDesbloqueado(idUsuario, escenario, progresoUsuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Completá los niveles anteriores para desbloquear este escenario");
        }
        IntentoJuego intentoActual = obtenerIntentoActual(idUsuario, idEscenario, progresoUsuario.numeroCampanaActual());
        if (intentoActual != null && !ESTADO_COMPLETADO.equals(intentoActual.estado())) {
            return new InicioEscenarioResponse(intentoActual.idDiseno(), idEscenario, intentoActual.idIntento(), intentoActual.estado());
        }
        if (!nivelCompletado(idUsuario, escenario.numero(), progresoUsuario.numeroCampanaActual())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este escenario todavía no fue completado en el recorrido actual");
        }
        return crearIntento(idUsuario, escenario, progresoUsuario.numeroCampanaActual());
    }

    @Transactional
    public ProgresoJuegoResponse reiniciarRecorrido(Integer idUsuario, Integer numeroCampanaEsperado) {
        ProgresoUsuario progresoUsuario = obtenerProgresoUsuario(idUsuario);
        if (numeroCampanaEsperado != null && numeroCampanaEsperado != progresoUsuario.numeroCampanaActual()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El recorrido cambió. Actualizá la pantalla antes de reiniciarlo otra vez");
        }
        int actualizados = jdbcTemplate.update("""
            UPDATE usuario
            SET numero_campana_actual = numero_campana_actual + 1
            WHERE id_usuario = ? AND numero_campana_actual = ?
            """, idUsuario, progresoUsuario.numeroCampanaActual());
        if (actualizados != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No fue posible reiniciar el recorrido. Actualizá la pantalla e intentá nuevamente");
        }
        return obtenerResumenProgreso(idUsuario);
    }

    private InicioEscenarioResponse crearIntento(Integer idUsuario, EscenarioBase escenario, int numeroCampana) {
        Integer idDiseno = jdbcTemplate.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
        Integer idIntento = jdbcTemplate.queryForObject("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, numero_campana, estado, progreso, puntaje)
            VALUES (?, ?, ?, ?, 'EN_DESARROLLO', 0, NULL)
            RETURNING id_intento
            """, Integer.class, idUsuario, escenario.idEscenario(), idDiseno, numeroCampana);
        return new InicioEscenarioResponse(idDiseno, escenario.idEscenario(), idIntento, ESTADO_EN_DESARROLLO);
    }

    @Transactional
    public EvaluacionEscenarioResponse evaluarEscenario(Integer idUsuario, Integer idDiseno) {
        ProgresoUsuario progresoUsuario = obtenerProgresoUsuario(idUsuario);
        IntentoEvaluable intento = obtenerIntentoPorDiseno(idUsuario, idDiseno);
        if (intento == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "El diseño no pertenece a un escenario progresivo");
        }
        if (MODO_EDICION_LIBRE.equals(intento.modo())) {
            return new EvaluacionEscenarioResponse(true, 100, intento.puntaje(), "Modo Libre activo: todas las herramientas están habilitadas.", null, true);
        }
        if (intento.numeroCampana() != progresoUsuario.numeroCampanaActual()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este intento pertenece a un recorrido anterior. Elegí Volver a jugar para crear un intento nuevo");
        }
        EvaluacionCondiciones evaluacion = evaluarCondiciones(intento, idDiseno);
        int progreso = evaluacion.progreso();
        boolean completado = evaluacion.completado();
        Integer puntaje = completado ? 100 : null;
        String estado = estadoLuegoDeEvaluacion(completado, intento.estado());
        jdbcTemplate.update("""
            UPDATE intento SET estado = ?, progreso = GREATEST(progreso, ?), puntaje = COALESCE(?, puntaje),
            fecha_finalizacion = CASE WHEN ? THEN COALESCE(fecha_finalizacion, ?) ELSE fecha_finalizacion END
            WHERE id_intento = ?
            """, estado, progreso, puntaje, completado, LocalDateTime.now(), intento.idIntento());
        Integer siguiente = completado && intento.numero() < CANTIDAD_NIVELES ? obtenerIdNivel(intento.numero() + 1) : null;
        boolean campanaCompletada = completado && nivelesCompletados(idUsuario, progresoUsuario.numeroCampanaActual());
        if (campanaCompletada) {
            jdbcTemplate.update("""
                UPDATE usuario SET campana_completada_historicamente = TRUE
                WHERE id_usuario = ?
                """, idUsuario);
        }
        boolean modoLibre = campanaCompletada || progresoUsuario.campanaCompletadaHistoricamente();
        String mensaje = completado
            ? (modoLibre ? "¡Nivel completado! Modo Libre desbloqueado." : "¡Consigna completada! El siguiente nivel ya está disponible.")
            : mensajePendiente(progreso, evaluacion.requiereCoberturaPuntosInteres(), evaluacion.coberturaPuntosInteres());
        return new EvaluacionEscenarioResponse(completado, progreso, puntaje, mensaje, siguiente, modoLibre);
    }

    @Transactional(readOnly = true)
    public ConsignaDisenoResponse obtenerConsigna(Usuario solicitante, Integer idDiseno) {
        IntentoEvaluable intento = obtenerIntentoParaConsigna(solicitante, idDiseno);
        if (intento == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe una consigna disponible para este diseño");
        }
        EvaluacionCondiciones evaluacion = evaluarCondiciones(intento, idDiseno);
        return new ConsignaDisenoResponse(
            determinarEstadoGlobal(intento, evaluacion),
            evaluacion.progreso(),
            evaluacion.condiciones(),
            evaluacion.referenciasObjetivo()
        );
    }

    private List<EscenarioBase> listarEscenariosProgresivos() {
        return jdbcTemplate.query("""
            SELECT id_escenario, numero, nombre, objetivo, dificultad, instrucciones, modo, reglas_exito::text, herramientas_habilitadas::text
            FROM escenario WHERE progresivo = TRUE ORDER BY numero NULLS LAST, id_escenario
            """, (resultado, fila) -> new EscenarioBase(
                resultado.getInt("id_escenario"), resultado.getObject("numero", Integer.class), resultado.getString("nombre"),
                resultado.getString("objetivo"), resultado.getString("dificultad"), resultado.getString("instrucciones"),
                resultado.getString("modo"), resultado.getString("reglas_exito"), resultado.getString("herramientas_habilitadas")
            ));
    }

    private EscenarioBase obtenerEscenario(Integer idEscenario) {
        return listarEscenariosProgresivos().stream().filter(escenario -> escenario.idEscenario().equals(idEscenario)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el escenario educativo solicitado"));
    }

    private ProgresoUsuario obtenerProgresoUsuario(Integer idUsuario) {
        return jdbcTemplate.query("""
            SELECT numero_campana_actual, campana_completada_historicamente
            FROM usuario WHERE id_usuario = ?
            """, (resultado, fila) -> new ProgresoUsuario(
                resultado.getInt("numero_campana_actual"),
                resultado.getBoolean("campana_completada_historicamente")
            ), idUsuario).stream().findFirst().orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el usuario del recorrido solicitado")
            );
    }

    private IntentoJuego obtenerIntentoActual(Integer idUsuario, Integer idEscenario, int numeroCampana) {
        return jdbcTemplate.query("""
            SELECT id_intento, id_diseno, estado, progreso
            FROM intento
            WHERE id_usuario = ? AND id_escenario = ? AND numero_campana = ?
            ORDER BY id_intento DESC LIMIT 1
            """,
            (resultado, fila) -> new IntentoJuego(resultado.getInt("id_intento"), resultado.getInt("id_diseno"), resultado.getString("estado"), resultado.getInt("progreso")),
            idUsuario, idEscenario, numeroCampana).stream().findFirst().orElse(null);
    }

    private IntentoEvaluable obtenerIntentoPorDiseno(Integer idUsuario, Integer idDiseno) {
        return jdbcTemplate.query("""
            SELECT i.id_intento, i.estado, i.puntaje, i.numero_campana, e.numero, e.modo, e.reglas_exito::text
            FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_usuario = ? AND i.id_diseno = ? AND e.progresivo = TRUE
            """, (resultado, fila) -> new IntentoEvaluable(
                resultado.getInt("id_intento"), resultado.getString("estado"), resultado.getObject("puntaje", Integer.class),
                resultado.getInt("numero_campana"), resultado.getObject("numero", Integer.class), resultado.getString("modo"), resultado.getString("reglas_exito")
            ), idUsuario, idDiseno).stream().findFirst().orElse(null);
    }

    private IntentoEvaluable obtenerIntentoParaConsigna(Usuario solicitante, Integer idDiseno) {
        String filtroPropietario = solicitante.getRol() == Rol.ADMIN ? "" : " AND i.id_usuario = ?";
        String consulta = """
            SELECT i.id_intento, i.estado, i.puntaje, i.numero_campana, e.numero, e.modo, e.reglas_exito::text
            FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_diseno = ? AND e.progresivo = TRUE%s
            ORDER BY i.id_intento DESC LIMIT 1
            """.formatted(filtroPropietario);
        return solicitante.getRol() == Rol.ADMIN
            ? jdbcTemplate.query(consulta, this::mapearIntentoEvaluable, idDiseno).stream().findFirst().orElse(null)
            : jdbcTemplate.query(consulta, this::mapearIntentoEvaluable, idDiseno, solicitante.getIdUsuario()).stream().findFirst().orElse(null);
    }

    private IntentoEvaluable mapearIntentoEvaluable(java.sql.ResultSet resultado, int fila) throws java.sql.SQLException {
        return new IntentoEvaluable(
            resultado.getInt("id_intento"), resultado.getString("estado"), resultado.getObject("puntaje", Integer.class),
            resultado.getInt("numero_campana"), resultado.getObject("numero", Integer.class), resultado.getString("modo"), resultado.getString("reglas_exito")
        );
    }

    private boolean esDesbloqueado(Integer idUsuario, EscenarioBase escenario, ProgresoUsuario progresoUsuario) {
        if (MODO_EDICION_LIBRE.equals(escenario.modo())) return progresoUsuario.campanaCompletadaHistoricamente();
        return escenario.numero() != null && (
            escenario.numero() == 1 || nivelCompletado(idUsuario, escenario.numero() - 1, progresoUsuario.numeroCampanaActual())
        );
    }

    private boolean nivelCompletado(Integer idUsuario, int numero, int numeroCampana) {
        Integer cantidad = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_usuario = ? AND i.numero_campana = ? AND e.progresivo = TRUE
              AND e.numero = ? AND i.estado = 'COMPLETADO'
            """, Integer.class, idUsuario, numeroCampana, numero);
        return cantidad != null && cantidad > 0;
    }

    private boolean nivelesCompletados(Integer idUsuario, int numeroCampana) {
        for (int numero = 1; numero <= CANTIDAD_NIVELES; numero++) {
            if (!nivelCompletado(idUsuario, numero, numeroCampana)) return false;
        }
        return true;
    }

    private int contarNivelesCompletados(Integer idUsuario, int numeroCampana, int cantidadNiveles) {
        int completados = 0;
        for (int numero = 1; numero <= cantidadNiveles; numero++) {
            if (nivelCompletado(idUsuario, numero, numeroCampana)) completados++;
        }
        return completados;
    }

    private EstadisticasIntento obtenerEstadisticas(Integer idUsuario, Integer idEscenario) {
        return jdbcTemplate.query("""
            SELECT COUNT(*) AS cantidad_intentos, MAX(i.puntaje) AS mejor_puntaje,
                   (
                       SELECT reciente.puntaje
                       FROM intento reciente
                       WHERE reciente.id_usuario = ? AND reciente.id_escenario = ?
                       ORDER BY reciente.id_intento DESC LIMIT 1
                   ) AS ultimo_puntaje
            FROM intento i
            WHERE i.id_usuario = ? AND i.id_escenario = ?
            """, (resultado, fila) -> new EstadisticasIntento(
                resultado.getInt("cantidad_intentos"),
                resultado.getObject("mejor_puntaje", Integer.class),
                resultado.getObject("ultimo_puntaje", Integer.class)
            ), idUsuario, idEscenario, idUsuario, idEscenario).stream().findFirst().orElse(
                new EstadisticasIntento(0, null, null)
            );
    }

    private Integer obtenerIdNivel(int numero) {
        return jdbcTemplate.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo = TRUE AND numero = ?", Integer.class, numero);
    }

    private int contar(String consulta, Integer idDiseno) {
        Integer resultado = jdbcTemplate.queryForObject(consulta, Integer.class, idDiseno);
        return resultado == null ? 0 : resultado;
    }

    private EvaluacionCondiciones evaluarCondiciones(IntentoEvaluable intento, Integer idDiseno) {
        Map<String, Object> reglas = leerJson(intento.reglasExito());
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        int estaciones = contar("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", idDiseno);
        int lineas = contar("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", idDiseno);
        int tramos = contar("SELECT COUNT(*) FROM tramo WHERE id_diseno = ?", idDiseno);
        int metros = contar("SELECT COUNT(*) FROM metro WHERE id_diseno = ?", idDiseno);
        agregarCondicion(
            condiciones,
            "minimoEstaciones",
            "Ubicar al menos " + entero(reglas, "minimoEstaciones") + " estaciones",
            estaciones,
            entero(reglas, "minimoEstaciones"),
            reglas.containsKey("minimoEstaciones")
        );
        agregarCondicion(
            condiciones,
            "minimoLineas",
            "Crear al menos " + entero(reglas, "minimoLineas") + " líneas",
            lineas,
            entero(reglas, "minimoLineas"),
            reglas.containsKey("minimoLineas")
        );
        agregarCondicion(
            condiciones,
            "minimoTramos",
            "Crear al menos " + entero(reglas, "minimoTramos") + " conexiones",
            tramos,
            entero(reglas, "minimoTramos"),
            reglas.containsKey("minimoTramos")
        );
        agregarCondicion(
            condiciones,
            "minimoMetros",
            "Asignar al menos " + entero(reglas, "minimoMetros") + " unidades de metro",
            metros,
            entero(reglas, "minimoMetros"),
            reglas.containsKey("minimoMetros")
        );
        boolean redEsValida = redValida(idDiseno);
        agregarCondicion(
            condiciones,
            "requiereRedValida",
            "Validar la consistencia de la red",
            redEsValida ? 1 : 0,
            1,
            booleano(reglas, "requiereRedValida")
        );
        boolean simulacionRealizada = tieneSimulacion(intento.idIntento());
        agregarCondicion(
            condiciones,
            "requiereSimulacion",
            "Ejecutar una simulación",
            simulacionRealizada ? 1 : 0,
            1,
            booleano(reglas, "requiereSimulacion")
        );
        boolean requiereCoberturaPuntosInteres = booleano(reglas, "requiereCoberturaPuntosInteres");
        List<PuntoInteresObjetivoResponse> puntosInteresObjetivo = requiereCoberturaPuntosInteres
            ? objetivosPuntosInteresService.obtenerObjetivos(intento.reglasExito())
            : List.of();
        List<ReferenciaObjetivoConsignaResponse> referenciasObjetivo = obtenerReferenciasObjetivo(idDiseno, puntosInteresObjetivo);
        int puntosCubiertos = (int) referenciasObjetivo.stream().filter(ReferenciaObjetivoConsignaResponse::cubierto).count();
        boolean coberturaPuntosInteres = !requiereCoberturaPuntosInteres || (
            !referenciasObjetivo.isEmpty() && puntosCubiertos == referenciasObjetivo.size()
        );
        if (requiereCoberturaPuntosInteres) {
            condiciones.add(new CondicionConsignaResponse(
                "requiereCoberturaPuntosInteres",
                "Cubrir los puntos de interés objetivo",
                puntosCubiertos,
                referenciasObjetivo.size(),
                coberturaPuntosInteres
            ));
        }
        int aprobadas = (int) condiciones.stream().filter(CondicionConsignaResponse::completado).count();
        int progreso = condiciones.isEmpty() ? 100 : Math.round((aprobadas * 100f) / condiciones.size());
        boolean completado = condiciones.stream().allMatch(CondicionConsignaResponse::completado);
        return new EvaluacionCondiciones(
            condiciones,
            referenciasObjetivo,
            progreso,
            completado,
            requiereCoberturaPuntosInteres,
            coberturaPuntosInteres
        );
    }

    private List<ReferenciaObjetivoConsignaResponse> obtenerReferenciasObjetivo(
        Integer idDiseno,
        List<PuntoInteresObjetivoResponse> puntosInteresObjetivo
    ) {
        if (puntosInteresObjetivo.isEmpty()) return List.of();
        List<CoordenadaEstacion> estaciones = jdbcTemplate.query("""
            SELECT posicion_x, posicion_y FROM estacion WHERE id_diseno = ?
            """, (resultado, fila) -> new CoordenadaEstacion(
                resultado.getBigDecimal("posicion_x"), resultado.getBigDecimal("posicion_y")
            ), idDiseno);
        return puntosInteresObjetivo.stream().map(punto -> new ReferenciaObjetivoConsignaResponse(
            punto.idPunto(),
            punto.nombrePunto(),
            estaciones.stream().anyMatch(estacion -> cubrePunto(estacion, punto))
        )).toList();
    }

    private String determinarEstadoGlobal(IntentoEvaluable intento, EvaluacionCondiciones evaluacion) {
        if (evaluacion.completado()) return ESTADO_COMPLETADO.equals(intento.estado()) ? ESTADO_COMPLETADO : "LISTO";
        return evaluacion.progreso() == 0 ? "INICIADO" : "PARCIAL";
    }

    private void agregarCondicion(
        List<CondicionConsignaResponse> condiciones,
        String clave,
        String texto,
        int actual,
        int requerido,
        boolean aplica
    ) {
        if (aplica) condiciones.add(new CondicionConsignaResponse(clave, texto, actual, requerido, actual >= requerido));
    }

    private boolean redValida(Integer idDiseno) {
        if (contar("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", idDiseno) < 2 || contar("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", idDiseno) < 1 || contar("SELECT COUNT(*) FROM tramo WHERE id_diseno = ?", idDiseno) < 1) return false;
        Integer aisladas = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM (
                SELECT e.nombre FROM estacion e LEFT JOIN pasa p ON p.id_diseno = e.id_diseno AND p.nombre_estacion = e.nombre
                WHERE e.id_diseno = ? GROUP BY e.nombre HAVING COUNT(p.nombre_estacion) = 0
            ) AS estaciones_aisladas
            """, Integer.class, idDiseno);
        return (aisladas == null || aisladas == 0) && !tieneRamificaciones(idDiseno);
    }

    private boolean tieneRamificaciones(Integer idDiseno) {
        Integer cantidad = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM (
                SELECT nombre_linea, nombre_estacion FROM (
                    SELECT nombre_linea, nombre_estacion_a AS nombre_estacion FROM tramo WHERE id_diseno = ?
                    UNION ALL
                    SELECT nombre_linea, nombre_estacion_b AS nombre_estacion FROM tramo WHERE id_diseno = ?
                ) AS extremos
                GROUP BY nombre_linea, nombre_estacion
                HAVING COUNT(*) > 2
            ) AS ramificaciones
            """, Integer.class, idDiseno, idDiseno);
        return cantidad != null && cantidad > 0;
    }

    private boolean tieneSimulacion(Integer idIntento) {
        Integer cantidad = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM simulacion WHERE id_intento = ?", Integer.class, idIntento);
        return cantidad != null && cantidad > 0;
    }

    private boolean cubrePunto(CoordenadaEstacion estacion, PuntoInteresObjetivoResponse punto) {
        BigDecimal diferenciaX = estacion.posicionX().subtract(punto.posicionX());
        BigDecimal diferenciaY = estacion.posicionY().subtract(punto.posicionY());
        return Math.hypot(diferenciaX.doubleValue(), diferenciaY.doubleValue()) <= punto.radioCobertura().doubleValue();
    }

    private String mensajePendiente(int progreso, boolean requiereCobertura, boolean coberturaCumplida) {
        if (requiereCobertura && !coberturaCumplida) {
            return "Progreso " + progreso + "%. Ubicá una estación dentro del radio de cada punto de interés objetivo.";
        }
        return "Progreso " + progreso + "%. Revisá la consigna y completá los elementos pendientes.";
    }

    private String estadoLuegoDeEvaluacion(boolean completado, String estadoActual) {
        if (completado) return "COMPLETADO";
        if ("VALIDADO".equals(estadoActual) || "COMPLETADA".equals(estadoActual)) return estadoActual;
        return "EN_DESARROLLO";
    }

    private int entero(Map<String, Object> valores, String clave) { return valores.get(clave) instanceof Number numero ? numero.intValue() : 0; }
    private boolean booleano(Map<String, Object> valores, String clave) { return Boolean.TRUE.equals(valores.get(clave)); }

    private Map<String, Object> leerJson(String json) {
        try { return objectMapper.readValue(json == null ? "{}" : json, new TypeReference<LinkedHashMap<String, Object>>() {}); }
        catch (Exception error) { throw new IllegalStateException("No fue posible leer la configuración del escenario", error); }
    }

    private Map<String, Boolean> leerHerramientas(String json) {
        Map<String, Boolean> herramientas = new LinkedHashMap<>();
        leerJson(json).forEach((clave, valor) -> herramientas.put(clave, Boolean.TRUE.equals(valor)));
        return herramientas;
    }

    private record EscenarioBase(Integer idEscenario, Integer numero, String nombre, String objetivo, String dificultad, String instrucciones, String modo, String reglasExito, String herramientas) {}
    private record ProgresoUsuario(int numeroCampanaActual, boolean campanaCompletadaHistoricamente) {}
    private record IntentoJuego(Integer idIntento, Integer idDiseno, String estado, Integer progreso) {}
    private record IntentoEvaluable(Integer idIntento, String estado, Integer puntaje, int numeroCampana, Integer numero, String modo, String reglasExito) {}
    private record EvaluacionCondiciones(
        List<CondicionConsignaResponse> condiciones,
        List<ReferenciaObjetivoConsignaResponse> referenciasObjetivo,
        int progreso,
        boolean completado,
        boolean requiereCoberturaPuntosInteres,
        boolean coberturaPuntosInteres
    ) {}
    private record EstadisticasIntento(int cantidadIntentos, Integer mejorPuntaje, Integer ultimoPuntaje) {}
    private record CoordenadaEstacion(BigDecimal posicionX, BigDecimal posicionY) {}
}
