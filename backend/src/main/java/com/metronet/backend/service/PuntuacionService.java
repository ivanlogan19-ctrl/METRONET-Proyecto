package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.DesempenoNivelResponse;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import com.metronet.backend.dto.RankingResponse;
import java.math.BigDecimal;
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
    private final GeografiaService geografia;

    public PuntuacionService(JdbcTemplate jdbc, ObjectMapper mapper, GeografiaService geografia) {
        this.jdbc = jdbc; this.mapper = mapper; this.geografia = geografia;
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

    /** Conserva las restricciones de circulación ya configuradas, sin bonos de velocidad. */
    public List<CondicionConsignaResponse> condicionesCirculacion(int idDiseno, int idIntento, String reglas, boolean requiereSimulacion) {
        JsonNode c = configuracion(reglas);
        if (c.isMissingNode()) return List.of();
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        if (c.path("pesoVelocidad").asDouble() > 0) {
            double objetivo = c.path("velocidadObjetivoKmh").asDouble(), tolerancia = c.path("toleranciaKmh").asDouble();
            if (objetivo <= 0 || tolerancia <= 0 || tolerancia >= objetivo) {
                throw new IllegalStateException("Configuración de circulación inválida: revisá la meta y tolerancia de velocidad");
            }
            List<MedicionUnidad> unidades = medirUnidades(idDiseno);
            boolean cumplida = !unidades.isEmpty() && unidades.stream()
                .allMatch(u -> u.distanciaKm() > 0 && Math.abs(u.velocidadKmh() - objetivo) <= tolerancia);
            condiciones.add(new CondicionConsignaResponse("velocidadCirculacion",
                "Circulación de " + objetivo + " km/h ± " + tolerancia, cumplida ? 1 : 0, 1, cumplida));
        }
        if (requiereSimulacion) {
            String huella = marcaRed(idDiseno);
            boolean actual = jdbc.query("SELECT comentarios FROM simulacion WHERE id_intento = ? ORDER BY id_simulacion DESC LIMIT 1",
                (r, fila) -> r.getString("comentarios"), idIntento).stream().anyMatch(s -> s != null && s.endsWith(huella));
            condiciones.add(new CondicionConsignaResponse("simulacionActual", "Simular la red y velocidades actuales", actual ? 1 : 0, 1, actual));
        }
        return condiciones;
    }

    public DesempenoNivelResponse calcular(int idDiseno, String reglas, List<CondicionConsignaResponse> condiciones) {
        JsonNode c = configuracion(reglas);
        boolean redResuelta = !condiciones.isEmpty() && condiciones.stream()
            .filter(condicion -> !Set.of("requiereSimulacion", "simulacionActual", "velocidadCirculacion").contains(condicion.clave()))
            .allMatch(CondicionConsignaResponse::completado);
        boolean velocidadCumplida = condiciones.stream().filter(condicion -> condicion.clave().equals("velocidadCirculacion"))
            .allMatch(CondicionConsignaResponse::completado);
        boolean simulacionActual = condiciones.stream().filter(condicion -> Set.of("requiereSimulacion", "simulacionActual").contains(condicion.clave()))
            .allMatch(CondicionConsignaResponse::completado);
        boolean requiereVelocidad = condiciones.stream().anyMatch(condicion -> condicion.clave().equals("velocidadCirculacion"));
        int puntos = normalizar(condiciones);
        long satisfechas = condiciones.stream().filter(CondicionConsignaResponse::completado).count();
        String etapa = !redResuelta ? "RED" : !velocidadCumplida ? "VELOCIDAD" : !simulacionActual ? "SIMULACION" : "LISTO";
        String explicacion = condiciones.isEmpty() ? "Este escenario no tiene criterios de evaluación: no se asignan puntos."
            : satisfechas + " de " + condiciones.size() + " criterios satisfechos: " + puntos + "/100. Cada criterio obligatorio tiene el mismo peso."
                + " Las pistas, el tutorial, los errores y el tiempo no descuentan puntos."
                + (satisfechas < condiciones.size() ? " Aún quedan condiciones por cumplir antes de completar el nivel." : " Todos los criterios están satisfechos.");
        // Se conserva el contrato de respuesta; los componentes de bonus dejan de otorgar puntos.
        return new DesempenoNivelResponse(puntos, 100, puntos, 0, 0,
            redResuelta, velocidadCumplida, simulacionActual,
            requiereVelocidad ? c.path("velocidadObjetivoKmh").asDouble() : null,
            requiereVelocidad ? c.path("toleranciaKmh").asDouble() : null,
            etapa, explicacion, c.isMissingNode() ? List.of() : medirUnidades(idDiseno));
    }

    public List<MedicionUnidad> medirUnidades(int idDiseno) {
        Map<String, Double> distancias = new HashMap<>();
        jdbc.query("""
            SELECT t.nombre_linea, a.posicion_x ax, a.posicion_y ay, b.posicion_x bx, b.posicion_y by
            FROM tramo t JOIN estacion a ON a.id_diseno=t.id_diseno AND a.nombre=t.nombre_estacion_a
            JOIN estacion b ON b.id_diseno=t.id_diseno AND b.nombre=t.nombre_estacion_b WHERE t.id_diseno=?
            """, (r, fila) -> {
                double km = distanciaKm(r.getBigDecimal("ax"), r.getBigDecimal("ay"), r.getBigDecimal("bx"), r.getBigDecimal("by"));
                distancias.merge(r.getString("nombre_linea"), km, Double::sum); return km;
            }, idDiseno);
        return jdbc.query("SELECT id_tren, nombre_linea, velocidad_promedio FROM metro WHERE id_diseno=? ORDER BY id_tren", (r, fila) -> {
            double km = distancias.getOrDefault(r.getString("nombre_linea"), 0d), v = r.getDouble("velocidad_promedio");
            return new MedicionUnidad(r.getInt("id_tren"), r.getString("nombre_linea"), v, km, v > 0 ? 60 * km / v : 0);
        }, idDiseno);
    }

    private double distanciaKm(BigDecimal ax, BigDecimal ay, BigDecimal bx, BigDecimal by) {
        var a = geografia.coordenadaGeografica(ax, ay); var b = geografia.coordenadaGeografica(bx, by);
        double latA = Math.toRadians(a.y()), latB = Math.toRadians(b.y());
        double h = Math.pow(Math.sin((latB - latA) / 2), 2) + Math.cos(latA) * Math.cos(latB) * Math.pow(Math.sin(Math.toRadians(b.x() - a.x()) / 2), 2);
        return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    }

    /** Identifica la red y sus velocidades tal como fueron simuladas, usando el campo comentarios existente. */
    public String marcaRed(int idDiseno) {
        try {
            var datos = List.of(
                jdbc.queryForList("SELECT nombre,posicion_x,posicion_y,transbordo FROM estacion WHERE id_diseno=? ORDER BY nombre", idDiseno),
                jdbc.queryForList("SELECT nombre FROM linea WHERE id_diseno=? ORDER BY nombre", idDiseno),
                jdbc.queryForList("SELECT nombre_linea,nombre_estacion FROM pasa WHERE id_diseno=? ORDER BY nombre_linea,nombre_estacion", idDiseno),
                jdbc.queryForList("SELECT nombre_linea,nombre_estacion_a,nombre_estacion_b FROM tramo WHERE id_diseno=? ORDER BY nombre_linea,nombre_estacion_a,nombre_estacion_b", idDiseno),
                jdbc.queryForList("SELECT id_tren,nombre_linea,velocidad_promedio,capacidad FROM metro WHERE id_diseno=? ORDER BY id_tren", idDiseno));
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsString(datos).getBytes(StandardCharsets.UTF_8));
            return MARCA + HexFormat.of().formatHex(hash) + "]";
        } catch (Exception e) { throw new IllegalStateException("No fue posible identificar la red simulada", e); }
    }

    public static String comentarioVisible(String comentario) {
        if (comentario == null) return "";
        int indice = comentario.lastIndexOf(MARCA);
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
            SELECT u.id_usuario, COALESCE(SUM(m.puntos),0) total, COUNT(m.id_escenario) completados
            FROM usuario u LEFT JOIN mejores m ON m.id_usuario=u.id_usuario WHERE u.rol='JUGADOR'
            GROUP BY u.id_usuario ORDER BY total DESC, completados DESC, u.id_usuario ASC
            """, (r, fila) -> new RankingResponse.Entrada(fila + 1, "Jugador " + r.getInt("id_usuario"), r.getInt("total"), r.getInt("completados"), r.getInt("id_usuario") == idUsuario));
        var propio = filas.stream().filter(RankingResponse.Entrada::sosVos).findFirst();
        int maximo = jdbc.query("SELECT reglas_exito::text AS reglas_exito FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero IS NOT NULL",
            (r, fila) -> maximo(r.getString("reglas_exito"))).stream().mapToInt(Integer::intValue).sum();
        return new RankingResponse(filas, propio.map(RankingResponse.Entrada::posicion).orElse(null), propio.map(RankingResponse.Entrada::puntajeTotal).orElse(0), maximo);
    }
}
