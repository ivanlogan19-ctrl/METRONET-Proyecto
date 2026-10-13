package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Configuración acotada del criterio didáctico, sin editar contenido educativo general. */
@Service
public class AdministracionUvUtService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    // Redes completas de CampanaPostgresTest. Su validez debe revalidarse en CI con cada cambio del catálogo.
    private static final int[][] TRAMOS_FIJOS = {{}, {}, {}, {}, {2}, {3}, {4}, {5, 1}, {7, 1, 1}, {7, 1, 1}, {9, 1, 1}};

    public AdministracionUvUtService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public record Cambio(Integer limiteUt, BigDecimal presupuestoUv, Integer versionEsperada) {}
    public record Vista(int numero, int version, Integer limiteUt, BigDecimal presupuestoUv,
                        int[] tramosFixture, BigDecimal uvMinimaFixture, boolean viable, String aviso) {}

    public List<Vista> listar() {
        return jdbc.query("""
            SELECT e.numero,COALESCE(c.version,0),c.limite_ut,c.presupuesto_uv,e.reglas_exito::text,e.herramientas_habilitadas::text
            FROM escenario e LEFT JOIN criterio_uv_ut c ON c.id_escenario=e.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero BETWEEN 4 AND 10 ORDER BY e.numero
            """, (r, fila) -> vista(r.getInt(1), r.getInt(2), r.getObject(3, Integer.class), r.getBigDecimal(4),
                r.getString(5), r.getString(6)));
    }

    public Vista previsualizar(int numero, Cambio cambio) {
        var actual = obtener(numero);
        if (cambio == null || cambio.versionEsperada() == null || cambio.versionEsperada() != actual.version())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La versión del nivel cambió. Actualizá la vista previa");
        if (cambio.limiteUt() == null || cambio.limiteUt() <= 0 || cambio.presupuestoUv() == null
            || cambio.presupuestoUv().signum() <= 0 || cambio.presupuestoUv().scale() > 2)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá UT enteras positivas y presupuesto UV positivo con hasta dos decimales");
        return jdbc.query("""
            SELECT e.reglas_exito::text,e.herramientas_habilitadas::text FROM escenario e
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            """, (r, fila) -> vista(numero, actual.version(), cambio.limiteUt(), cambio.presupuestoUv(),
                r.getString(1), r.getString(2)), numero).getFirst();
    }

    private Vista obtener(int numero) {
        return listar().stream().filter(v -> v.numero() == numero).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el nivel solicitado"));
    }

    private Vista vista(int numero, int version, Integer limite, BigDecimal presupuesto, String reglas, String herramientas) {
        int[] tramos = TRAMOS_FIJOS[numero];
        if (limite == null || presupuesto == null) return new Vista(numero, version, limite, presupuesto, tramos, null, false,
            "Configurá UT y presupuesto para este nivel");
        // Un conteo histórico de tramos no demuestra viabilidad en kilómetros.
        // La publicación definitiva ensaya la referencia con el servicio de simulación.
        var referencia = referenciaActual(numero);
        if (referencia == null) return new Vista(numero, version, limite, presupuesto, tramos, null, false,
            "Escala en kilómetros: prepará y validá una red de referencia en Experiencia de juego");
        try {
            var geo = new GeografiaService(mapper);
            var estaciones = new java.util.HashMap<String, com.metronet.backend.utilidades.GeometriaTerritorial.Punto>();
            for (var e : referencia.path("estaciones")) estaciones.put(e.path("nombre").asText(),
                geo.coordenadaGeografica(e.path("x").decimalValue(), e.path("y").decimalValue()));
            var longitudes = new java.util.HashMap<String, Double>();
            for (var t : referencia.path("tramos")) longitudes.merge(t.path("linea").asText(),
                DistanciasRedService.kilometros(estaciones.get(t.path("a").asText()), estaciones.get(t.path("b").asText())), Double::sum);
            BigDecimal minimo = BigDecimal.ZERO;
            for (var u : referencia.path("unidades")) {
                Double km = longitudes.get(u.path("linea").asText());
                if (km == null || km <= 0) throw new IllegalArgumentException("Referencia sin recorrido");
                minimo = minimo.add(BigDecimal.valueOf(km).divide(BigDecimal.valueOf(limite),2,RoundingMode.CEILING));
            }
            boolean viable = !referencia.path("unidades").isEmpty() && presupuesto.compareTo(minimo) >= 0;
            return new Vista(numero,version,limite,presupuesto,tramos,minimo,viable,
                "Estimación por kilómetros de la referencia; la publicación exige el ensayo completo");
        } catch (IllegalArgumentException error) {
            return new Vista(numero,version,limite,presupuesto,tramos,null,false,"Corregí las coordenadas y recorridos de la referencia");
        }
    }

    private JsonNode referenciaActual(int numero) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT to_regclass('nivel_borrador') IS NOT NULL AND to_regclass('escenario')=to_regclass('public.escenario')",Boolean.class))) return null;
        return jdbc.query("""
            SELECT b.red_referencia::text FROM nivel_borrador b JOIN escenario e ON e.id_escenario=b.id_escenario
            WHERE e.progresivo=TRUE AND e.modo='NIVEL' AND e.numero=?
            """, (r,fila) -> {
                try { return mapper.readTree(r.getString(1)); }
                catch (Exception error) { return null; }
            },numero).stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }

}
