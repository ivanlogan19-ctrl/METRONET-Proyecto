package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.AreaTerritorialResponse;
import com.metronet.backend.dto.ConfiguracionTerritorialResponse;
import com.metronet.backend.utilidades.GeometriaTerritorial;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RestriccionesGeograficasService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final GeografiaService geografia;
    private final GeometriaTerritorial territorio;
    private final Map<String, GeometriaTerritorial> areas = new ConcurrentHashMap<>();

    public RestriccionesGeograficasService(JdbcTemplate jdbc, ObjectMapper mapper, GeografiaService geografia) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.geografia = geografia;
        this.territorio = new GeometriaTerritorial(geografia.geometriasMapa());
    }

    public ConfiguracionTerritorialResponse obtenerConfiguracion(Integer idDiseno) {
        List<String> reglas = jdbc.query("""
            SELECT e.reglas_exito::text AS reglas_exito FROM intento i
            JOIN escenario e ON e.id_escenario = i.id_escenario
            WHERE i.id_diseno = ? ORDER BY i.id_intento DESC LIMIT 1
            """, (r, fila) -> r.getString("reglas_exito"), idDiseno);
        return leerConfiguracion(reglas.isEmpty() ? null : reglas.getFirst());
    }

    public ConfiguracionTerritorialResponse leerConfiguracion(String reglas) {
        List<AreaTerritorialResponse> configuradas = new ArrayList<>();
        List<String> errores = new ArrayList<>();
        try {
            JsonNode raiz = mapper.readTree(reglas == null || reglas.isBlank() ? "{}" : reglas);
            if (raiz == null || !raiz.isObject()) throw new IllegalArgumentException();
            JsonNode lista = raiz.path("restriccionesGeograficas");
            if (lista.isMissingNode()) return new ConfiguracionTerritorialResponse(List.of(), List.of());
            if (!lista.isArray()) throw new IllegalArgumentException();
            for (JsonNode area : lista) {
                String tipo = area.path("tipo").asText(), nombre = area.path("nombre").asText();
                boolean valida = geografia.tieneGeometria(tipo, nombre);
                for (String clave : List.of("prohibirEstaciones", "prohibirTramos")) {
                    valida &= !area.has(clave) || area.path(clave).isBoolean();
                }
                if (!valida) errores.add("Área territorial sin geometría o configuración válida: " + nombre);
                else configuradas.add(new AreaTerritorialResponse(tipo, GeografiaService.normalizar(nombre),
                    area.path("prohibirEstaciones").asBoolean(false), area.path("prohibirTramos").asBoolean(false)));
            }
        } catch (Exception error) {
            errores.add("La configuración de restricciones geográficas no es válida.");
        }
        return new ConfiguracionTerritorialResponse(configuradas, errores);
    }

    public static BigDecimal redondear(BigDecimal valor) {
        return valor == null ? null : valor.setScale(2, RoundingMode.HALF_UP);
    }

    public String errorEstacion(BigDecimal x, BigDecimal y, ConfiguracionTerritorialResponse configuracion) {
        if (!configuracion.errores().isEmpty()) return configuracion.errores().getFirst();
        var punto = geografia.coordenadaGeografica(x, y);
        if (!territorio.contiene(punto)) return "La estación debe quedar dentro del territorio de Montevideo representado en el mapa.";
        for (var area : configuracion.areas()) if (area.prohibirEstaciones() && geometria(area).contiene(punto)) {
            return "No se permiten estaciones en " + area.nombre() + " según la consigna.";
        }
        return null;
    }

    public String errorTramo(BigDecimal ax, BigDecimal ay, BigDecimal bx, BigDecimal by, ConfiguracionTerritorialResponse configuracion) {
        if (!configuracion.errores().isEmpty()) return configuracion.errores().getFirst();
        var a = geografia.coordenadaGeografica(ax, ay);
        var b = geografia.coordenadaGeografica(bx, by);
        if (!territorio.contieneSegmento(a, b)) return "La conexión sale del territorio válido del mapa. Elegí otras estaciones o agregá una estación intermedia dentro del territorio.";
        for (var area : configuracion.areas()) if (area.prohibirTramos() && geometria(area).intersectaSegmento(a, b)) {
            return "La conexión atraviesa " + area.nombre() + ", donde la consigna prohíbe tramos.";
        }
        return null;
    }

    private GeometriaTerritorial geometria(AreaTerritorialResponse area) {
        return areas.computeIfAbsent(area.tipo() + "|" + area.nombre(), clave -> new GeometriaTerritorial(geografia.geometriasArea(area.tipo(), area.nombre())));
    }

    // Se invoca dentro de las transacciones de edición: serializa los cambios de geometría de un diseño.
    private void bloquearDiseno(Integer idDiseno) {
        jdbc.queryForObject("SELECT id_diseno FROM diseno WHERE id_diseno = ? FOR UPDATE", Integer.class, idDiseno);
    }

    public void validarEstacion(Integer idDiseno, String nombreActual, BigDecimal x, BigDecimal y) {
        bloquearDiseno(idDiseno);
        var configuracion = obtenerConfiguracion(idDiseno);
        rechazar(errorEstacion(x, y, configuracion));
        if (nombreActual == null) return;
        Map<String, Estacion> estaciones = estaciones(idDiseno);
        for (Tramo tramo : tramos(idDiseno)) {
            String vecino = nombreActual.equals(tramo.a()) ? tramo.b() : nombreActual.equals(tramo.b()) ? tramo.a() : null;
            if (vecino == null) continue;
            Estacion otro = estaciones.get(vecino);
            if (otro == null) rechazar("Una estación de la conexión ya no está disponible.");
            rechazar(errorTramo(x, y, otro.x(), otro.y(), configuracion));
        }
    }

    public void validarRecorrido(Integer idDiseno, List<String> nombres) {
        bloquearDiseno(idDiseno);
        var configuracion = obtenerConfiguracion(idDiseno);
        Map<String, Estacion> estaciones = estaciones(idDiseno);
        for (int i = 1; i < nombres.size(); i++) {
            Estacion a = estaciones.get(nombres.get(i - 1)), b = estaciones.get(nombres.get(i));
            if (a == null || b == null) rechazar("Una estación de la conexión ya no está disponible.");
            rechazar(errorTramo(a.x(), a.y(), b.x(), b.y(), configuracion));
        }
    }

    public List<String> observarDiseno(Integer idDiseno) {
        return observarDiseno(idDiseno, obtenerConfiguracion(idDiseno));
    }

    public List<String> observarDiseno(Integer idDiseno, ConfiguracionTerritorialResponse configuracion) {
        if (!configuracion.errores().isEmpty()) return configuracion.errores();
        List<String> problemas = new ArrayList<>();
        Map<String, Estacion> estaciones = estaciones(idDiseno);
        for (Estacion estacion : estaciones.values()) {
            String error = errorEstacion(estacion.x(), estacion.y(), configuracion);
            if (error != null) problemas.add("Estación «" + estacion.nombre() + "»: " + error);
        }
        for (Tramo tramo : tramos(idDiseno)) {
            Estacion a = estaciones.get(tramo.a()), b = estaciones.get(tramo.b());
            String error = a == null || b == null ? "Una estación no está disponible." : errorTramo(a.x(), a.y(), b.x(), b.y(), configuracion);
            if (error != null) problemas.add("Conexión «" + tramo.a() + " — " + tramo.b() + "»: " + error);
        }
        return List.copyOf(problemas);
    }

    public void validarDiseno(Integer idDiseno) {
        bloquearDiseno(idDiseno);
        List<String> errores = observarDiseno(idDiseno);
        if (!errores.isEmpty()) rechazar(errores.getFirst());
    }

    private Map<String, Estacion> estaciones(Integer idDiseno) {
        return jdbc.query("SELECT nombre, posicion_x, posicion_y FROM estacion WHERE id_diseno = ?",
            (r, fila) -> new Estacion(r.getString("nombre"), r.getBigDecimal("posicion_x"), r.getBigDecimal("posicion_y")), idDiseno)
            .stream().collect(Collectors.toMap(Estacion::nombre, Function.identity()));
    }

    private List<Tramo> tramos(Integer idDiseno) {
        return jdbc.query("SELECT nombre_estacion_a, nombre_estacion_b FROM tramo WHERE id_diseno = ?",
            (r, fila) -> new Tramo(r.getString("nombre_estacion_a"), r.getString("nombre_estacion_b")), idDiseno);
    }

    private static void rechazar(String error) { if (error != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error); }
    private record Estacion(String nombre, BigDecimal x, BigDecimal y) {}
    private record Tramo(String a, String b) {}
}
