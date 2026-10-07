package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/** Consulta el mismo catálogo y los mismos polígonos que utiliza el mapa Phaser. */
@Service
public class GeografiaService {
    private final List<Punto> puntos = new ArrayList<>();
    private final List<Barrio> barrios = new ArrayList<>();
    private final JsonNode zonas;
    private double minX = Double.POSITIVE_INFINITY;
    private double maxX = Double.NEGATIVE_INFINITY;
    private double minY = Double.POSITIVE_INFINITY;
    private double maxY = Double.NEGATIVE_INFINITY;

    @org.springframework.beans.factory.annotation.Autowired
    public GeografiaService(ObjectMapper mapper) {
        this(leer(mapper, "puntos-interes.json"), leer(mapper, "barrios_wgs84.geojson"), leer(mapper, "zonas.json"));
    }

    GeografiaService(JsonNode catalogo, JsonNode geometria, JsonNode zonas) {
        this.zonas = zonas;
        for (JsonNode feature : geometria.path("features")) {
            JsonNode forma = feature.path("geometry");
            if (!geometriaValida(forma)) continue;
            barrios.add(new Barrio(normalizar(feature.path("properties").path("BARRIO").asText()), forma));
            ampliarLimites(forma.path("coordinates"));
        }
        for (JsonNode barrio : catalogo.path("barrios")) {
            for (JsonNode punto : barrio.path("puntos")) {
                if (!punto.path("id").isIntegralNumber() || !punto.path("longitud").isNumber()
                    || !punto.path("latitud").isNumber() || punto.path("nombre").asText().isBlank()) continue;
                puntos.add(new Punto(punto.path("id").intValue(), punto.path("nombre").asText(),
                    punto.path("longitud").doubleValue(), punto.path("latitud").doubleValue()));
            }
        }
    }

    private static JsonNode leer(ObjectMapper mapper, String archivo) {
        try (var entrada = new ClassPathResource("geografia/" + archivo).getInputStream()) {
            return mapper.readTree(entrada);
        } catch (IOException error) {
            throw new IllegalStateException("No fue posible leer el catálogo geográfico: " + archivo, error);
        }
    }

    public Punto resolverPunto(Integer id, String nombre) {
        if (!Double.isFinite(minX) || !Double.isFinite(minY) || maxX <= minX || maxY <= minY) return null;
        List<Punto> coincidencias = puntos.stream().filter(punto -> id != null
            ? id.equals(punto.id()) : normalizar(punto.nombre()).equals(normalizar(nombre))).toList();
        return coincidencias.size() == 1 ? coincidencias.getFirst() : null;
    }

    public BigDecimal posicionX(Punto punto) {
        return BigDecimal.valueOf((punto.longitud() - minX) / (maxX - minX) * 1000);
    }

    public BigDecimal posicionY(Punto punto) {
        return BigDecimal.valueOf((maxY - punto.latitud()) / (maxY - minY) * 620);
    }

    public boolean tieneGeometria(String tipo, String nombre) {
        return !barriosDelArea(tipo, nombre).isEmpty();
    }

    public boolean zonaIncluyeBarrio(String zona, String barrio) {
        if (!tieneGeometria("zona", zona) || !tieneGeometria("barrio", barrio)) return false;
        String nombreBarrio = normalizar(barrio);
        for (JsonNode integrante : zonas.path(normalizar(zona)))
            if (normalizar(integrante.asText()).equals(nombreBarrio)) return true;
        return false;
    }

    public List<JsonNode> geometriasMapa() {
        return barrios.stream().map(Barrio::geometria).toList();
    }

    public List<JsonNode> geometriasArea(String tipo, String nombre) {
        return barriosDelArea(tipo, nombre).stream().map(Barrio::geometria).toList();
    }

    public com.metronet.backend.utilidades.GeometriaTerritorial.Punto coordenadaGeografica(BigDecimal x, BigDecimal y) {
        if (x == null || y == null) return null;
        return new com.metronet.backend.utilidades.GeometriaTerritorial.Punto(
            minX + x.doubleValue() / 1000 * (maxX - minX), maxY - y.doubleValue() / 620 * (maxY - minY));
    }

    public boolean pertenece(String tipo, String nombre, BigDecimal posicionX, BigDecimal posicionY) {
        if (posicionX == null || posicionY == null) return false;
        double longitud = minX + posicionX.doubleValue() / 1000 * (maxX - minX);
        double latitud = maxY - posicionY.doubleValue() / 620 * (maxY - minY);
        return barriosDelArea(tipo, nombre).stream().anyMatch(barrio -> contiene(barrio.geometria(), longitud, latitud));
    }

    private List<Barrio> barriosDelArea(String tipo, String nombre) {
        String clave = normalizar(nombre);
        if ("barrio".equals(tipo)) return barrios.stream().filter(barrio -> barrio.nombre().equals(clave)).toList();
        if (!"zona".equals(tipo)) return List.of();
        JsonNode integrantes = zonas.path(clave);
        if (!integrantes.isArray() || integrantes.isEmpty()) return List.of();
        List<Barrio> resultado = new ArrayList<>();
        for (JsonNode integrante : integrantes) {
            List<Barrio> encontrados = barriosDelArea("barrio", integrante.asText());
            // Una zona incompleta no se valida sólo a partir de su nombre.
            if (encontrados.isEmpty()) return List.of();
            resultado.addAll(encontrados);
        }
        return resultado;
    }

    static String normalizar(String nombre) {
        String valor = nombre == null ? "" : nombre.trim().toUpperCase(Locale.ROOT);
        valor = valor.replace("Ã‘", "Ñ").replace("Ã\u0091", "Ñ").replace("Ã“", "Ó")
            .replace("Ã\u0093", "Ó").replace("Ã‰", "É").replace("Ã\u0089", "É")
            .replace("Ã\u0081", "Á").replace("Ã\u008d", "Í").replace("Ãš", "Ú");
        return Normalizer.normalize(valor, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
            .replaceAll("\\bPQUE\\b", "PARQUE").replaceAll("\\bPBLO\\b", "PUEBLO").replaceAll("\\s+", " ");
    }

    private void ampliarLimites(JsonNode coordenadas) {
        if (coordenadas.size() >= 2 && coordenadas.get(0).isNumber() && coordenadas.get(1).isNumber()) {
            minX = Math.min(minX, coordenadas.get(0).doubleValue());
            maxX = Math.max(maxX, coordenadas.get(0).doubleValue());
            minY = Math.min(minY, coordenadas.get(1).doubleValue());
            maxY = Math.max(maxY, coordenadas.get(1).doubleValue());
        } else for (JsonNode hijo : coordenadas) ampliarLimites(hijo);
    }

    private static boolean geometriaValida(JsonNode geometria) {
        JsonNode coordenadas = geometria.path("coordinates");
        if ("Polygon".equals(geometria.path("type").asText())) return poligonoValido(coordenadas);
        if (!"MultiPolygon".equals(geometria.path("type").asText()) || !coordenadas.isArray() || coordenadas.isEmpty()) return false;
        for (JsonNode poligono : coordenadas) if (!poligonoValido(poligono)) return false;
        return true;
    }

    private static boolean poligonoValido(JsonNode anillos) {
        if (!anillos.isArray() || anillos.isEmpty()) return false;
        for (JsonNode anillo : anillos) {
            if (!anillo.isArray() || anillo.size() < 4) return false;
            for (JsonNode punto : anillo) {
                if (!punto.isArray() || punto.size() < 2 || !punto.get(0).isNumber() || !punto.get(1).isNumber()) return false;
            }
            if (!anillo.get(0).equals(anillo.get(anillo.size() - 1))) return false;
        }
        return true;
    }

    static boolean contiene(JsonNode geometria, double x, double y) {
        if (!geometriaValida(geometria)) return false;
        if ("Polygon".equals(geometria.path("type").asText())) return enPoligono(geometria.path("coordinates"), x, y);
        for (JsonNode poligono : geometria.path("coordinates")) if (enPoligono(poligono, x, y)) return true;
        return false;
    }

    private static boolean enPoligono(JsonNode anillos, double x, double y) {
        if (!enAnillo(anillos.get(0), x, y)) return false;
        for (int i = 1; i < anillos.size(); i++) if (enAnillo(anillos.get(i), x, y)) return false;
        return true;
    }

    private static boolean enAnillo(JsonNode anillo, double x, double y) {
        boolean dentro = false;
        for (int i = 0, j = anillo.size() - 1; i < anillo.size(); j = i++) {
            double xi = anillo.get(i).get(0).doubleValue(), yi = anillo.get(i).get(1).doubleValue();
            double xj = anillo.get(j).get(0).doubleValue(), yj = anillo.get(j).get(1).doubleValue();
            // Tolerancia numérica para el borde del polígono; no es un radio de cobertura.
            double producto = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
            if (Math.abs(producto) < 1e-12 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj)
                && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true;
            if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
        }
        return dentro;
    }

    public record Punto(Integer id, String nombre, double longitud, double latitud) {}
    private record Barrio(String nombre, JsonNode geometria) {}
}
