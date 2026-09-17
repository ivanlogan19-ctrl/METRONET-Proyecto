package com.metronet.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.EscenarioJuegoResponse;
import com.metronet.backend.dto.EvaluacionEscenarioResponse;
import com.metronet.backend.dto.InicioEscenarioResponse;
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
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JuegoEducativoService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public List<EscenarioJuegoResponse> obtenerProgreso(Integer idUsuario) {
        List<EscenarioBase> escenarios = listarEscenariosProgresivos();
        boolean nivelesCompletados = nivelesCompletados(idUsuario);
        List<EscenarioJuegoResponse> respuesta = new ArrayList<>();
        for (EscenarioBase escenario : escenarios) {
            IntentoJuego intento = obtenerIntento(idUsuario, escenario.idEscenario());
            boolean desbloqueado = esDesbloqueado(idUsuario, escenario, nivelesCompletados);
            String estado = intento == null ? (desbloqueado ? "DISPONIBLE" : "BLOQUEADO") : intento.estado();
            Integer progreso = intento == null ? 0 : intento.progreso();
            respuesta.add(new EscenarioJuegoResponse(
                escenario.idEscenario(), escenario.numero(), escenario.nombre(), escenario.objetivo(), escenario.dificultad(),
                escenario.instrucciones(), estado, progreso, desbloqueado, leerHerramientas(escenario.herramientas())
            ));
        }
        return respuesta;
    }

    @Transactional
    public InicioEscenarioResponse iniciarEscenario(Integer idUsuario, Integer idEscenario) {
        EscenarioBase escenario = obtenerEscenario(idEscenario);
        if (!esDesbloqueado(idUsuario, escenario, nivelesCompletados(idUsuario))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Completá los niveles anteriores para desbloquear este escenario");
        }
        IntentoJuego intentoExistente = obtenerIntento(idUsuario, idEscenario);
        if (intentoExistente != null) {
            return new InicioEscenarioResponse(intentoExistente.idDiseno(), idEscenario, intentoExistente.idIntento(), intentoExistente.estado());
        }
        Integer idDiseno = jdbcTemplate.queryForObject("INSERT INTO diseno DEFAULT VALUES RETURNING id_diseno", Integer.class);
        Integer idIntento = jdbcTemplate.queryForObject("""
            INSERT INTO intento (id_usuario, id_escenario, id_diseno, estado, progreso, puntaje)
            VALUES (?, ?, ?, 'EN_DESARROLLO', 0, NULL)
            RETURNING id_intento
            """, Integer.class, idUsuario, idEscenario, idDiseno);
        return new InicioEscenarioResponse(idDiseno, idEscenario, idIntento, "EN_DESARROLLO");
    }

    @Transactional
    public EvaluacionEscenarioResponse evaluarEscenario(Integer idUsuario, Integer idDiseno) {
        IntentoEvaluable intento = obtenerIntentoPorDiseno(idUsuario, idDiseno);
        if (intento == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "El diseño no pertenece a un escenario progresivo");
        }
        if ("EDICION_LIBRE".equals(intento.modo())) {
            return new EvaluacionEscenarioResponse(true, 100, intento.puntaje(), "Modo Libre activo: todas las herramientas están habilitadas.", null, true);
        }
        Map<String, Object> reglas = leerJson(intento.reglasExito());
        List<Boolean> condiciones = new ArrayList<>();
        int estaciones = contar("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", idDiseno);
        int lineas = contar("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", idDiseno);
        int tramos = contar("SELECT COUNT(*) FROM tramo WHERE id_diseno = ?", idDiseno);
        int metros = contar("SELECT COUNT(*) FROM metro WHERE id_diseno = ?", idDiseno);
        agregarCondicion(condiciones, estaciones >= entero(reglas, "minimoEstaciones"), reglas.containsKey("minimoEstaciones"));
        agregarCondicion(condiciones, lineas >= entero(reglas, "minimoLineas"), reglas.containsKey("minimoLineas"));
        agregarCondicion(condiciones, tramos >= entero(reglas, "minimoTramos"), reglas.containsKey("minimoTramos"));
        agregarCondicion(condiciones, metros >= entero(reglas, "minimoMetros"), reglas.containsKey("minimoMetros"));
        agregarCondicion(condiciones, redValida(idDiseno), booleano(reglas, "requiereRedValida"));
        agregarCondicion(condiciones, tieneSimulacion(intento.idIntento()), booleano(reglas, "requiereSimulacion"));
        int aprobadas = (int) condiciones.stream().filter(Boolean::booleanValue).count();
        int progreso = condiciones.isEmpty() ? 100 : Math.round((aprobadas * 100f) / condiciones.size());
        boolean completado = !condiciones.contains(Boolean.FALSE);
        Integer puntaje = completado ? 100 : null;
        String estado = estadoLuegoDeEvaluacion(completado, intento.estado());
        jdbcTemplate.update("""
            UPDATE intento SET estado = ?, progreso = GREATEST(progreso, ?), puntaje = COALESCE(?, puntaje),
            fecha_finalizacion = CASE WHEN ? THEN COALESCE(fecha_finalizacion, ?) ELSE fecha_finalizacion END
            WHERE id_intento = ?
            """, estado, progreso, puntaje, completado, LocalDateTime.now(), intento.idIntento());
        Integer siguiente = completado && intento.numero() < CANTIDAD_NIVELES ? obtenerIdNivel(intento.numero() + 1) : null;
        boolean modoLibre = completado && intento.numero() == CANTIDAD_NIVELES || nivelesCompletados(idUsuario);
        String mensaje = completado
            ? (modoLibre ? "¡Nivel completado! Modo Libre desbloqueado." : "¡Consigna completada! El siguiente nivel ya está disponible.")
            : "Progreso " + progreso + "%. Revisá la consigna y completá los elementos pendientes.";
        return new EvaluacionEscenarioResponse(completado, progreso, puntaje, mensaje, siguiente, modoLibre);
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

    private IntentoJuego obtenerIntento(Integer idUsuario, Integer idEscenario) {
        return jdbcTemplate.query("SELECT id_intento, id_diseno, estado, progreso FROM intento WHERE id_usuario = ? AND id_escenario = ? ORDER BY id_intento DESC LIMIT 1",
            (resultado, fila) -> new IntentoJuego(resultado.getInt("id_intento"), resultado.getInt("id_diseno"), resultado.getString("estado"), resultado.getInt("progreso")),
            idUsuario, idEscenario).stream().findFirst().orElse(null);
    }

    private IntentoEvaluable obtenerIntentoPorDiseno(Integer idUsuario, Integer idDiseno) {
        return jdbcTemplate.query("""
            SELECT i.id_intento, i.estado, i.puntaje, e.numero, e.modo, e.reglas_exito::text
            FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_usuario = ? AND i.id_diseno = ? AND e.progresivo = TRUE
            """, (resultado, fila) -> new IntentoEvaluable(
                resultado.getInt("id_intento"), resultado.getString("estado"), resultado.getObject("puntaje", Integer.class),
                resultado.getObject("numero", Integer.class), resultado.getString("modo"), resultado.getString("reglas_exito")
            ), idUsuario, idDiseno).stream().findFirst().orElse(null);
    }

    private boolean esDesbloqueado(Integer idUsuario, EscenarioBase escenario, boolean nivelesCompletados) {
        if ("EDICION_LIBRE".equals(escenario.modo())) return nivelesCompletados;
        return escenario.numero() != null && (escenario.numero() == 1 || nivelCompletado(idUsuario, escenario.numero() - 1));
    }

    private boolean nivelCompletado(Integer idUsuario, int numero) {
        Integer cantidad = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM intento i JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_usuario = ? AND e.progresivo = TRUE AND e.numero = ? AND i.estado = 'COMPLETADO'
            """, Integer.class, idUsuario, numero);
        return cantidad != null && cantidad > 0;
    }

    private boolean nivelesCompletados(Integer idUsuario) {
        for (int numero = 1; numero <= CANTIDAD_NIVELES; numero++) if (!nivelCompletado(idUsuario, numero)) return false;
        return true;
    }

    private Integer obtenerIdNivel(int numero) {
        return jdbcTemplate.queryForObject("SELECT id_escenario FROM escenario WHERE progresivo = TRUE AND numero = ?", Integer.class, numero);
    }

    private int contar(String consulta, Integer idDiseno) {
        Integer resultado = jdbcTemplate.queryForObject(consulta, Integer.class, idDiseno);
        return resultado == null ? 0 : resultado;
    }

    private boolean redValida(Integer idDiseno) {
        if (contar("SELECT COUNT(*) FROM estacion WHERE id_diseno = ?", idDiseno) < 2 || contar("SELECT COUNT(*) FROM linea WHERE id_diseno = ?", idDiseno) < 1 || contar("SELECT COUNT(*) FROM tramo WHERE id_diseno = ?", idDiseno) < 1) return false;
        Integer aisladas = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM (
                SELECT e.nombre FROM estacion e LEFT JOIN pasa p ON p.id_diseno = e.id_diseno AND p.nombre_estacion = e.nombre
                WHERE e.id_diseno = ? GROUP BY e.nombre HAVING COUNT(p.nombre_estacion) = 0
            ) AS estaciones_aisladas
            """, Integer.class, idDiseno);
        return aisladas == null || aisladas == 0;
    }

    private boolean tieneSimulacion(Integer idIntento) {
        Integer cantidad = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM simulacion WHERE id_intento = ?", Integer.class, idIntento);
        return cantidad != null && cantidad > 0;
    }

    private String estadoLuegoDeEvaluacion(boolean completado, String estadoActual) {
        if (completado) return "COMPLETADO";
        if ("VALIDADO".equals(estadoActual) || "COMPLETADA".equals(estadoActual)) return estadoActual;
        return "EN_DESARROLLO";
    }

    private void agregarCondicion(List<Boolean> condiciones, boolean resultado, boolean aplica) { if (aplica) condiciones.add(resultado); }
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
    private record IntentoJuego(Integer idIntento, Integer idDiseno, String estado, Integer progreso) {}
    private record IntentoEvaluable(Integer idIntento, String estado, Integer puntaje, Integer numero, String modo, String reglasExito) {}
}
