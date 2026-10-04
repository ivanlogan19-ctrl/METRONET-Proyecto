package com.metronet.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Evalúa tramos lógicos con UV/UT; las ejecuciones V1 nunca pasan por este servicio. */
@Service
public class CriterioUvUtService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final PuntuacionService puntuacion;

    public CriterioUvUtService(JdbcTemplate jdbc, ObjectMapper mapper, PuntuacionService puntuacion) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.puntuacion = puntuacion;
    }

    public record Configuracion(int version, int limiteUt, BigDecimal presupuestoUv) {}
    public record Presentacion(String objetivo, String instrucciones, String herramientas) {}
    public record Unidad(int idTren, String linea, int tramos, BigDecimal uv, BigDecimal utLlegada, boolean termino) {}
    public record Resultado(int version, String huellaProblema, String huellaEjecucion, int limiteUt,
                            BigDecimal presupuestoUv, int utEjecutadas, BigDecimal sumaUv,
                            boolean completo, List<Unidad> unidades, BigDecimal mejorUv) {}

    public Configuracion configuracionIntento(int idIntento) {
        return jdbc.query("SELECT version,limite_ut,presupuesto_uv FROM intento_uv_ut WHERE id_intento=?",
            (r, fila) -> new Configuracion(r.getInt(1), r.getInt(2), r.getBigDecimal(3)), idIntento)
            .stream().findFirst().orElse(null);
    }

    public void iniciarIntento(int idIntento, int idEscenario) {
        jdbc.update("""
            INSERT INTO intento_uv_ut(id_intento,version,limite_ut,presupuesto_uv,reglas_exito,herramientas_habilitadas,objetivo,instrucciones)
            SELECT ?,c.version,c.limite_ut,c.presupuesto_uv,e.reglas_exito,e.herramientas_habilitadas,
              e.objetivo,regexp_replace(e.instrucciones, '\\mhoras?\\M', 'UT', 'gi') ||
              ' Completá todos los recorridos en hasta ' || c.limite_ut || ' UT con un máximo de ' || c.presupuesto_uv || ' UV asignadas.'
            FROM criterio_uv_ut c JOIN escenario e ON e.id_escenario=c.id_escenario
            WHERE c.id_escenario=? AND e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 4 AND 10
            """, idIntento, idEscenario);
    }

    public Presentacion presentacion(Integer idIntento, int idEscenario, String objetivo, String instrucciones, String herramientas) {
        if (idIntento != null) {
            var vigente = jdbc.query("SELECT objetivo,instrucciones,herramientas_habilitadas::text FROM intento_uv_ut WHERE id_intento=?",
                (r, fila) -> new Presentacion(r.getString(1), r.getString(2), r.getString(3)), idIntento);
            if (!vigente.isEmpty()) return vigente.getFirst();
            var anterior = jdbc.query("SELECT objetivo,instrucciones,herramientas_habilitadas::text FROM intento_catalogo_v1 WHERE id_intento=?",
                (r, fila) -> new Presentacion(r.getString(1), r.getString(2), r.getString(3)), idIntento);
            return anterior.isEmpty() ? new Presentacion(objetivo, instrucciones, herramientas) : anterior.getFirst();
        }
        var nueva = jdbc.query("SELECT limite_ut,presupuesto_uv FROM criterio_uv_ut WHERE id_escenario=?",
            (r, fila) -> new Configuracion(1, r.getInt(1), r.getBigDecimal(2)), idEscenario);
        if (nueva.isEmpty()) return new Presentacion(objetivo, instrucciones, herramientas);
        var c = nueva.getFirst();
        return new Presentacion(objetivo, instruccionesV2(instrucciones, c), herramientas);
    }

    private String instruccionesV2(String texto, Configuracion c) {
        return (texto == null ? "" : texto.replaceAll("(?i)\\bhoras?\\b", "UT"))
            + " Completá todos los recorridos en hasta " + c.limiteUt() + " UT con un máximo de "
            + c.presupuestoUv().stripTrailingZeros().toPlainString() + " UV asignadas.";
    }

    public Resultado registrar(int idIntento, int idDiseno, int idSimulacion, int utEjecutadas) {
        Configuracion c = configuracionIntento(idIntento);
        if (c == null) return null;
        List<Unidad> unidades = new ArrayList<>();
        Map<String, Integer> longitudes = longitudes(idDiseno);
        List<Metro> metros = jdbc.query("SELECT id_tren,nombre_linea,velocidad_promedio FROM metro WHERE id_diseno=? ORDER BY id_tren",
            (r, fila) -> new Metro(r.getInt(1), r.getString(2), r.getBigDecimal(3)), idDiseno);
        Set<String> atendidas = new HashSet<>();
        BigDecimal suma = BigDecimal.ZERO;
        boolean completo = utEjecutadas <= c.limiteUt() && !metros.isEmpty();
        for (Metro metro : metros) {
            int tramos = longitudes.getOrDefault(metro.linea(), 0);
            if (tramos == 0 || metro.uv() == null || metro.uv().signum() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cada metro necesita una ruta operable y UV positiva");
            }
            atendidas.add(metro.linea());
            suma = suma.add(metro.uv());
            boolean termino = metro.uv().multiply(BigDecimal.valueOf(utEjecutadas)).compareTo(BigDecimal.valueOf(tramos)) >= 0;
            completo &= termino;
            unidades.add(new Unidad(metro.id(), metro.linea(), tramos, metro.uv(),
                BigDecimal.valueOf(tramos).divide(metro.uv(), 4, RoundingMode.HALF_UP), termino));
        }
        completo &= atendidas.containsAll(longitudes.keySet()) && suma.compareTo(c.presupuestoUv()) <= 0;
        String problema = puntuacion.marcaProblemaUvUt(idDiseno);
        String ejecucion = puntuacion.marcaEjecucionUvUt(idDiseno);
        try {
            jdbc.update("""
                INSERT INTO resultado_uv_ut(id_simulacion,version,huella_problema,huella_ejecucion,limite_ut,presupuesto_uv,ut_ejecutadas,suma_uv,completo,unidades)
                VALUES (?,?,?,?,?,?,?,?,?,CAST(? AS jsonb))
                """, idSimulacion, c.version(), problema, ejecucion, c.limiteUt(), c.presupuestoUv(), utEjecutadas,
                suma, completo, mapper.writeValueAsString(unidades));
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalStateException("No fue posible registrar el resultado UV/UT", error);
        }
        return ultimo(idIntento, idDiseno);
    }

    public Resultado ultimo(int idIntento, int idDiseno) {
        Configuracion c = configuracionIntento(idIntento);
        if (c == null) return null;
        String problema = puntuacion.marcaProblemaUvUt(idDiseno);
        String ejecucion = puntuacion.marcaEjecucionUvUt(idDiseno);
        return jdbc.query("""
            SELECT r.version,r.huella_problema,r.huella_ejecucion,r.limite_ut,r.presupuesto_uv,r.ut_ejecutadas,r.suma_uv,r.completo,r.unidades::text,
              (SELECT MIN(r2.suma_uv) FROM resultado_uv_ut r2 JOIN simulacion s2 ON s2.id_simulacion=r2.id_simulacion
               WHERE s2.id_intento=? AND r2.huella_problema=? AND r2.completo=TRUE AND r2.version=r.version) mejor_uv
            FROM resultado_uv_ut r JOIN simulacion s ON s.id_simulacion=r.id_simulacion
            WHERE s.id_intento=? ORDER BY s.id_simulacion DESC LIMIT 1
            """, (r, fila) -> {
                try {
                    var tipo = mapper.getTypeFactory().constructCollectionType(List.class, Unidad.class);
                    return new Resultado(r.getInt(1), r.getString(2), r.getString(3), r.getInt(4), r.getBigDecimal(5),
                        r.getInt(6), r.getBigDecimal(7), r.getBoolean(8), mapper.readValue(r.getString(9), tipo), r.getBigDecimal(10));
                } catch (Exception error) { throw new IllegalStateException("Resultado UV/UT ilegible", error); }
            }, idIntento, problema, idIntento).stream().findFirst().map(resultado ->
                ejecucion.equals(resultado.huellaEjecucion()) && problema.equals(resultado.huellaProblema())
                    ? resultado : new Resultado(resultado.version(), resultado.huellaProblema(), resultado.huellaEjecucion(),
                        resultado.limiteUt(), resultado.presupuestoUv(), resultado.utEjecutadas(), resultado.sumaUv(),
                        false, resultado.unidades(), resultado.mejorUv())).orElse(null);
    }

    public Resultado resultadoDeSimulacion(int idSimulacion) {
        return jdbc.query("""
            SELECT r.version,r.huella_problema,r.huella_ejecucion,r.limite_ut,r.presupuesto_uv,r.ut_ejecutadas,r.suma_uv,r.completo,r.unidades::text,
              (SELECT MIN(r2.suma_uv) FROM resultado_uv_ut r2 JOIN simulacion s2 ON s2.id_simulacion=r2.id_simulacion
               WHERE s2.id_intento=s.id_intento AND r2.huella_problema=r.huella_problema AND r2.completo=TRUE AND r2.version=r.version) mejor_uv
            FROM resultado_uv_ut r JOIN simulacion s ON s.id_simulacion=r.id_simulacion
            WHERE r.id_simulacion=?
            """, (r, fila) -> {
                try {
                    var tipo = mapper.getTypeFactory().constructCollectionType(List.class, Unidad.class);
                    return new Resultado(r.getInt(1), r.getString(2), r.getString(3), r.getInt(4), r.getBigDecimal(5),
                        r.getInt(6), r.getBigDecimal(7), r.getBoolean(8), mapper.readValue(r.getString(9), tipo), r.getBigDecimal(10));
                } catch (Exception error) { throw new IllegalStateException("Resultado UV/UT ilegible", error); }
            }, idSimulacion).stream().findFirst().orElse(null);
    }

    public CondicionConsignaResponse condicion(int idIntento, int idDiseno) {
        Configuracion c = configuracionIntento(idIntento);
        if (c == null) return null;
        Resultado r = ultimo(idIntento, idDiseno);
        boolean completo = r != null && r.completo();
        return new CondicionConsignaResponse("criterioUvUt",
            "Completar todos los recorridos en hasta " + c.limiteUt() + " UT con un máximo de " + c.presupuestoUv().stripTrailingZeros().toPlainString() + " UV asignadas",
            completo ? 1 : 0, 1, completo);
    }

    private Map<String, Integer> longitudes(int idDiseno) {
        List<String> lineas = jdbc.queryForList("SELECT nombre FROM linea WHERE id_diseno=?", String.class, idDiseno);
        List<Tramo> tramos = jdbc.query("SELECT nombre_linea,nombre_estacion_a,nombre_estacion_b FROM tramo WHERE id_diseno=?",
            (r, fila) -> new Tramo(r.getString(1), r.getString(2), r.getString(3)), idDiseno);
        Map<String, Integer> resultado = new HashMap<>();
        for (String linea : lineas) {
            List<Tramo> ruta = tramos.stream().filter(t -> t.linea().equals(linea)).toList();
            if (ruta.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cada línea necesita un recorrido");
            Map<String, Set<String>> adyacentes = new HashMap<>();
            for (Tramo t : ruta) {
                adyacentes.computeIfAbsent(t.a(), k -> new HashSet<>()).add(t.b());
                adyacentes.computeIfAbsent(t.b(), k -> new HashSet<>()).add(t.a());
            }
            if (adyacentes.values().stream().anyMatch(vecinos -> vecinos.size() > 2))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Una línea ramificada no tiene recorrido único");
            Set<String> visitados = new HashSet<>();
            ArrayDeque<String> pendientes = new ArrayDeque<>();
            pendientes.add(ruta.getFirst().a());
            while (!pendientes.isEmpty()) {
                String estacion = pendientes.removeFirst();
                if (visitados.add(estacion)) pendientes.addAll(adyacentes.getOrDefault(estacion, Set.of()));
            }
            if (visitados.size() != adyacentes.size() || ruta.size() != (adyacentes.values().stream().mapToInt(Set::size).sum() / 2))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La línea tiene tramos desconectados o repetidos");
            resultado.put(linea, ruta.size());
        }
        return resultado;
    }

    private record Metro(int id, String linea, BigDecimal uv) {}
    private record Tramo(String linea, String a, String b) {}
}
