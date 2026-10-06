package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.DesempenoNivelResponse;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import com.metronet.backend.dto.RankingResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Puntuación educativa de redes válidas. Las metas son configuración didáctica, no límites reales de operación. */
@Service
public class PuntuacionService {
    private static final String MARCA = " [METRONET-RED-v1:";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public PuntuacionService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc; this.mapper = mapper;
    }

    public int maximo(String reglas) {
        return 100;
    }

    private JsonNode configuracion(String reglas) {
        try { return mapper.readTree(reglas == null ? "{}" : reglas).path("puntuacion"); }
        catch (Exception e) { throw new IllegalStateException("Configuración de puntuación ilegible", e); }
    }

    /** Cada condición obligatoria pesa lo mismo; se redondea una sola vez. */
    public static int normalizar(List<CondicionConsignaResponse> condiciones) {
        if (condiciones.isEmpty()) return 0;
        long satisfechas = condiciones.stream().filter(CondicionConsignaResponse::completado).count();
        return (int) Math.round(100d * satisfechas / condiciones.size());
    }

    /** Las interacciones se comprueban comparando ejecuciones persistidas del mismo intento. */
    public List<CondicionConsignaResponse> condicionesCirculacion(int idDiseno, int idIntento, String reglas, boolean requiereSimulacion) {
        return condicionesCirculacion(idDiseno, idIntento, reglas, requiereSimulacion, false);
    }

    public List<CondicionConsignaResponse> condicionesCirculacion(int idDiseno, int idIntento, String reglas,
            boolean requiereSimulacion, boolean escalaUt) {
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        JsonNode aprendizaje;
        try { aprendizaje = mapper.readTree(reglas == null ? "{}" : reglas).path("aprendizajeSimulacion"); }
        catch (Exception e) { throw new IllegalStateException("Reglas de simulación ilegibles", e); }
        if (configuracion(reglas).has("velocidadObjetivoKmh")) {
            // Un escenario personalizado antiguo requiere revisión explícita;
            // su meta física no se convierte en UV ni se da por satisfecha.
            condiciones.add(new CondicionConsignaResponse("configuracionEscala",
                "Consigna con escala anterior: solicitar actualización al administrador", 0, 1, false));
        }
        if (!requiereSimulacion && aprendizaje.isMissingNode()) return condiciones;
        var ejecuciones = jdbc.query("SELECT duracion, comentarios FROM simulacion WHERE id_intento=? ORDER BY id_simulacion",
            (r, fila) -> new Ejecucion(r.getInt("duracion"), r.getString("comentarios"), RegistroSimulacionDidactica.leer(r.getString("comentarios"))), idIntento);
        Set<String> realizadas = new HashSet<>();
        String estructuraActual = marcaEstructura(idDiseno);
        for (int i = 1; i < ejecuciones.size(); i++) {
            Ejecucion anterior = ejecuciones.get(i - 1), actual = ejecuciones.get(i);
            if (anterior.registro == null || actual.registro == null
                || !estructuraActual.equals(anterior.registro.estructura()) || !estructuraActual.equals(actual.registro.estructura())) continue;
            List<MedicionUnidad> antes = anterior.registro.unidades(), despues = actual.registro.unidades();
            if (antes.isEmpty() || antes.size() != despues.size()) continue;
            Map<Integer, Double> velocidades = new HashMap<>();
            antes.forEach(u -> velocidades.put(u.idTren(), u.velocidad()));
            if (despues.stream().anyMatch(u -> !velocidades.containsKey(u.idTren()))) continue;
            long cambios = despues.stream().filter(u -> Double.compare(velocidades.get(u.idTren()), u.velocidad()) != 0).count();
            boolean horas = anterior.duracion != actual.duracion;
            if (cambios > 0 && !horas) realizadas.add("velocidad");
            if (horas && cambios == 0) realizadas.add("duracion");
            if (despues.size() > 1 && cambios == 1 && !horas) realizadas.add("individual");
            if (despues.size() > 1 && cambios == despues.size() && !horas
                && despues.stream().map(MedicionUnidad::velocidad).distinct().count() == 1) realizadas.add("global");
            if (cambios > 0 && horas) realizadas.add("combinacion");
        }
        Map<String, String> textos = Map.of(
            "velocidad", "Cambiar UV, mantener horas y volver a ejecutar",
            "duracion", "Cambiar horas, mantener UV y volver a ejecutar",
            "individual", "Cambiar solo un metro, mantener horas y volver a ejecutar",
            "global", "Cambiar todos los metros a una misma UV, mantener horas y volver a ejecutar",
            "combinacion", "Cambiar UV y horas y volver a ejecutar");
        for (String clave : List.of("velocidad", "duracion", "individual", "global", "combinacion")) {
            if (!aprendizaje.path(clave).asBoolean()) continue;
            boolean cumplida = realizadas.contains(clave);
            condiciones.add(new CondicionConsignaResponse("aprendizajeSimulacion:" + clave,
                escalaUt ? textos.get(clave).replace("horas", "UT") : textos.get(clave), cumplida ? 1 : 0, 1, cumplida));
        }
        if (requiereSimulacion) {
            boolean actual = escalaUt ? simulacionVigenteUvUt(idIntento, idDiseno)
                : !ejecuciones.isEmpty() && ejecuciones.getLast().registro != null
                    && ejecuciones.getLast().comentarios.endsWith(marcaRed(idDiseno));
            condiciones.add(new CondicionConsignaResponse("simulacionActual", "Simular la red y UV actuales", actual ? 1 : 0, 1, actual));
        }
        return condiciones;
    }

    private record Ejecucion(int duracion, String comentarios, RegistroSimulacionDidactica registro) {}

    public DesempenoNivelResponse calcular(int idDiseno, String reglas, List<CondicionConsignaResponse> condiciones) {
        JsonNode c = configuracion(reglas);
        boolean redResuelta = !condiciones.isEmpty() && condiciones.stream()
            .filter(condicion -> !Set.of("requiereSimulacion", "simulacionActual", "criterioUvUt").contains(condicion.clave()) && !condicion.clave().startsWith("aprendizajeSimulacion:"))
            .allMatch(CondicionConsignaResponse::completado);
        boolean aprendizajeCumplido = condiciones.stream().filter(condicion -> condicion.clave().startsWith("aprendizajeSimulacion:"))
            .allMatch(CondicionConsignaResponse::completado);
        boolean simulacionActual = condiciones.stream().filter(condicion -> Set.of("requiereSimulacion", "simulacionActual", "criterioUvUt").contains(condicion.clave()))
            .allMatch(CondicionConsignaResponse::completado);
        int puntos = normalizar(condiciones);
        long satisfechas = condiciones.stream().filter(CondicionConsignaResponse::completado).count();
        String etapa = !redResuelta ? "RED" : !aprendizajeCumplido ? "EXPERIMENTAR" : !simulacionActual ? "SIMULACION" : "LISTO";
        String explicacion = condiciones.isEmpty() ? "Este diseño no tiene criterios de evaluación: no se asignan puntos."
            : satisfechas + " de " + condiciones.size() + " criterios satisfechos: " + puntos + "/100. Cada criterio obligatorio tiene el mismo peso."
                + " Las pistas, el tutorial, los errores y el tiempo no descuentan puntos."
                + (satisfechas < condiciones.size() ? " Aún quedan condiciones por cumplir antes de completar el nivel." : " Todos los criterios están satisfechos.");
        // Se conserva el desglose de puntos; no hay bonos por valores de velocidad.
        return new DesempenoNivelResponse(puntos, 100, puntos, 0, 0,
            redResuelta, aprendizajeCumplido, simulacionActual,
            etapa, explicacion, c.isMissingNode() ? List.of() : medirUnidades(idDiseno));
    }

    public List<MedicionUnidad> medirUnidades(int idDiseno) {
        return jdbc.query("""
            SELECT m.id_tren, m.nombre_linea, m.velocidad_promedio,
                (SELECT COUNT(*) FROM tramo t WHERE t.id_diseno=m.id_diseno AND t.nombre_linea=m.nombre_linea) tramos
            FROM metro m WHERE m.id_diseno=? ORDER BY m.id_tren
            """, (r, fila) -> new MedicionUnidad(r.getInt("id_tren"), r.getString("nombre_linea"),
                r.getDouble("velocidad_promedio"), r.getInt("tramos")), idDiseno);
    }

    public String marcaDidactica(int idDiseno) {
        return new RegistroSimulacionDidactica(marcaEstructura(idDiseno), medirUnidades(idDiseno)).codificar() + marcaRed(idDiseno);
    }

    private String marcaEstructura(int idDiseno) { return marcaRed(idDiseno, false); }

    /** V2 compara solo componentes que intervienen en recorridos y asignación UV. */
    public String marcaProblemaUvUt(int idDiseno) { return marcaRed(idDiseno, false, false); }
    public String marcaEjecucionUvUt(int idDiseno) { return marcaRed(idDiseno, true, false); }

    /** Identifica la red y sus velocidades tal como fueron simuladas, usando el campo comentarios existente. */
    public String marcaRed(int idDiseno) { return marcaRed(idDiseno, true); }

    private String marcaRed(int idDiseno, boolean incluirVelocidad) { return marcaRed(idDiseno, incluirVelocidad, true); }

    private String marcaRed(int idDiseno, boolean incluirVelocidad, boolean incluirCapacidad) {
        try {
            var datos = List.of(
                jdbc.queryForList("SELECT nombre,posicion_x,posicion_y,transbordo FROM estacion WHERE id_diseno=? ORDER BY nombre", idDiseno),
                jdbc.queryForList("SELECT nombre FROM linea WHERE id_diseno=? ORDER BY nombre", idDiseno),
                jdbc.queryForList("SELECT nombre_linea,nombre_estacion FROM pasa WHERE id_diseno=? ORDER BY nombre_linea,nombre_estacion", idDiseno),
                jdbc.queryForList("SELECT nombre_linea,nombre_estacion_a,nombre_estacion_b FROM tramo WHERE id_diseno=? ORDER BY nombre_linea,nombre_estacion_a,nombre_estacion_b", idDiseno),
                jdbc.queryForList("SELECT id_tren,nombre_linea" + (incluirVelocidad ? ",velocidad_promedio" : "")
                    + (incluirCapacidad ? ",capacidad" : "") + " FROM metro WHERE id_diseno=? ORDER BY id_tren", idDiseno));
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsString(datos).getBytes(StandardCharsets.UTF_8));
            return MARCA + HexFormat.of().formatHex(hash) + "]";
        } catch (Exception e) { throw new IllegalStateException("No fue posible identificar la red simulada", e); }
    }

    private boolean simulacionVigenteUvUt(int idIntento, int idDiseno) {
        var ultima = jdbc.query("""
            SELECT r.huella_ejecucion FROM resultado_uv_ut r
            JOIN simulacion s ON s.id_simulacion=r.id_simulacion
            WHERE s.id_intento=? ORDER BY s.id_simulacion DESC LIMIT 1
            """, (r, fila) -> r.getString(1), idIntento);
        return !ultima.isEmpty() && ultima.getFirst().equals(marcaEjecucionUvUt(idDiseno));
    }

    public static String comentarioVisible(String comentario) {
        if (comentario == null) return "";
        int indice = comentario.indexOf(RegistroSimulacionDidactica.MARCA);
        if (indice < 0) indice = comentario.lastIndexOf(MARCA);
        return indice < 0 ? comentario : comentario.substring(0, indice);
    }

    public RankingResponse ranking(int idUsuario) {
        var filas = jdbc.query("""
            WITH mejores AS (
                SELECT i.id_usuario, i.id_escenario, MAX(i.puntaje) puntos
                FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario
                WHERE i.estado='COMPLETADO' AND i.puntaje IS NOT NULL AND e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero IS NOT NULL
                GROUP BY i.id_usuario,i.id_escenario
            )
            SELECT u.id_usuario, u.nombre, u.apellido, COALESCE(SUM(m.puntos),0) total, COUNT(m.id_escenario) completados
            FROM usuario u LEFT JOIN mejores m ON m.id_usuario=u.id_usuario WHERE u.rol='JUGADOR'
            GROUP BY u.id_usuario, u.nombre, u.apellido ORDER BY total DESC, completados DESC, u.id_usuario ASC
            """, (r, fila) -> {
                String nombre = r.getString("nombre");
                String apellido = r.getString("apellido");
                String nombreVisible = ((nombre == null ? "" : nombre.trim()) + " "
                    + (apellido == null ? "" : apellido.trim())).trim();
                return new RankingResponse.Entrada(fila + 1, nombreVisible.isEmpty() ? "Jugador " + r.getInt("id_usuario") : nombreVisible,
                    r.getInt("total"), r.getInt("completados"), r.getInt("id_usuario") == idUsuario);
            });
        var propio = filas.stream().filter(RankingResponse.Entrada::sosVos).findFirst();
        int maximo = jdbc.query("SELECT reglas_exito::text AS reglas_exito FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero IS NOT NULL",
            (r, fila) -> maximo(r.getString("reglas_exito"))).stream().mapToInt(Integer::intValue).sum();
        return new RankingResponse(filas, propio.map(RankingResponse.Entrada::posicion).orElse(null), propio.map(RankingResponse.Entrada::puntajeTotal).orElse(0), maximo);
    }
}
