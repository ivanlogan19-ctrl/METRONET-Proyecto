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
        BigDecimal minimo = BigDecimal.ZERO;
        for (int longitud : tramos) minimo = minimo.add(BigDecimal.valueOf(longitud)
            .divide(BigDecimal.valueOf(limite), 2, RoundingMode.CEILING));
        boolean canonico = reglasCanonicas(numero, reglas, herramientas);
        boolean viable = canonico && presupuesto.compareTo(minimo) >= 0;
        String aviso = !canonico ? "La consigna o sus herramientas difieren del fixture verificado; requiere un fixture nuevo"
            : !viable ? "El presupuesto no alcanza para la red geográfica verificada"
            : "Fixture geográfico verificable; cambios aplicables solo a intentos nuevos";
        return new Vista(numero, version, limite, presupuesto, tramos, minimo, viable, aviso);
    }

    private boolean reglasCanonicas(int numero, String reglas, String herramientas) {
        try (var entrada = new org.springframework.core.io.ClassPathResource("educacion/niveles.json").getInputStream()) {
            JsonNode catalogo = mapper.readTree(entrada);
            for (JsonNode nivel : catalogo) if (nivel.path("numero").asInt() == numero) {
                JsonNode actual = mapper.readTree(reglas);
                JsonNode actualHerramientas = mapper.readTree(herramientas);
                return actual.equals(nivel.path("reglasExito")) && actualHerramientas.equals(nivel.path("herramientasHabilitadas"))
                    && actualHerramientas.path("metros").asBoolean() && actualHerramientas.path("simulacion").asBoolean()
                    && (actual.path("minimoMetros").asInt() == TRAMOS_FIJOS[numero].length
                        || (numero == 4 && actual.path("minimoMetros").isMissingNode()
                            && actual.path("requiereSimulacion").asBoolean()));
            }
        } catch (Exception error) { throw new IllegalStateException("No fue posible leer el catálogo de niveles", error); }
        return false;
    }
}
