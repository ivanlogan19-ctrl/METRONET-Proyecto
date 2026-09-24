package com.metronet.backend.utilidades;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/** Geometría plana de segmentos. Particiona en cada cruce de borde, sin muestreo fijo. */
public final class GeometriaTerritorial {
    private static final double EPSILON = 1e-10;
    private final List<Poligono> poligonos = new ArrayList<>();

    public GeometriaTerritorial(List<JsonNode> geometrias) {
        for (JsonNode geometria : geometrias) {
            if ("Polygon".equals(geometria.path("type").asText())) agregar(geometria.path("coordinates"));
            if ("MultiPolygon".equals(geometria.path("type").asText())) {
                for (JsonNode poligono : geometria.path("coordinates")) agregar(poligono);
            }
        }
    }

    private void agregar(JsonNode coordenadas) {
        if (!coordenadas.isArray() || coordenadas.isEmpty()) return;
        List<List<Punto>> anillos = new ArrayList<>();
        for (JsonNode anillo : coordenadas) {
            if (!anillo.isArray() || anillo.size() < 4) return;
            List<Punto> puntos = new ArrayList<>();
            for (JsonNode punto : anillo) {
                if (!punto.isArray() || punto.size() < 2 || !punto.get(0).isNumber() || !punto.get(1).isNumber()) return;
                puntos.add(new Punto(punto.get(0).doubleValue(), punto.get(1).doubleValue()));
            }
            if (!puntos.getFirst().equals(puntos.getLast())) return;
            anillos.add(List.copyOf(puntos));
        }
        List<Punto> exterior = anillos.getFirst();
        poligonos.add(new Poligono(List.copyOf(anillos), exterior.stream().mapToDouble(Punto::x).min().orElseThrow(),
            exterior.stream().mapToDouble(Punto::x).max().orElseThrow(), exterior.stream().mapToDouble(Punto::y).min().orElseThrow(),
            exterior.stream().mapToDouble(Punto::y).max().orElseThrow()));
    }

    public boolean contiene(Punto p) {
        if (!valido(p)) return false;
        for (Poligono poligono : poligonos) {
            if (p.x < poligono.minX - EPSILON || p.x > poligono.maxX + EPSILON || p.y < poligono.minY - EPSILON || p.y > poligono.maxY + EPSILON) continue;
            int exterior = posicionEnAnillo(p, poligono.anillos.getFirst());
            if (exterior == 0) return true;
            if (exterior == 1 && poligono.anillos.stream().skip(1).noneMatch(a -> posicionEnAnillo(p, a) == 1)) return true;
        }
        return false;
    }

    public boolean contieneSegmento(Punto a, Punto b) {
        if (!contiene(a) || !contiene(b)) return false;
        List<Double> cortes = cortes(a, b);
        for (int i = 1; i < cortes.size(); i++) if (!contiene(interpolar(a, b, (cortes.get(i - 1) + cortes.get(i)) / 2))) return false;
        return true;
    }

    public boolean intersectaSegmento(Punto a, Punto b) {
        if (!valido(a) || !valido(b)) return false;
        List<Double> cortes = cortes(a, b);
        for (double t : cortes) if (contiene(interpolar(a, b, t))) return true;
        for (int i = 1; i < cortes.size(); i++) if (contiene(interpolar(a, b, (cortes.get(i - 1) + cortes.get(i)) / 2))) return true;
        return false;
    }

    private List<Double> cortes(Punto a, Punto b) {
        Punto r = resta(b, a);
        double largo2 = r.x * r.x + r.y * r.y;
        TreeSet<Double> cortes = new TreeSet<>(List.of(0d, 1d));
        if (largo2 == 0) return List.copyOf(cortes);
        for (Poligono poligono : poligonos) {
            if (poligono.maxX < Math.min(a.x, b.x) || poligono.minX > Math.max(a.x, b.x)
                || poligono.maxY < Math.min(a.y, b.y) || poligono.minY > Math.max(a.y, b.y)) continue;
            for (List<Punto> anillo : poligono.anillos) for (int i = 1; i < anillo.size(); i++) {
                Punto c = anillo.get(i - 1), d = anillo.get(i), s = resta(d, c), q = resta(c, a);
                double determinante = cruz(r, s);
                double escala = Math.max(Math.hypot(r.x, r.y) * Math.hypot(s.x, s.y), Double.MIN_VALUE);
                if (Math.abs(determinante) > Math.ulp(1d) * 32 * escala) {
                    double t = cruz(q, s) / determinante, u = cruz(q, r) / determinante;
                    if (u >= -EPSILON && u <= 1 + EPSILON) agregarCorte(cortes, t);
                } else if (enBorde(c, a, b) || enBorde(d, a, b) || enBorde(a, c, d)) {
                    agregarCorte(cortes, (q.x * r.x + q.y * r.y) / largo2);
                    Punto extremo = resta(d, a);
                    agregarCorte(cortes, (extremo.x * r.x + extremo.y * r.y) / largo2);
                }
            }
        }
        return List.copyOf(cortes);
    }

    private static void agregarCorte(TreeSet<Double> cortes, double t) {
        if (t >= -EPSILON && t <= 1 + EPSILON) cortes.add(Math.max(0, Math.min(1, t)));
    }

    private static int posicionEnAnillo(Punto p, List<Punto> anillo) {
        boolean dentro = false;
        for (int i = 0, j = anillo.size() - 1; i < anillo.size(); j = i++) {
            Punto a = anillo.get(j), b = anillo.get(i);
            if (enBorde(p, a, b)) return 0;
            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
        }
        return dentro ? 1 : -1;
    }

    private static boolean enBorde(Punto p, Punto a, Punto b) {
        Punto r = resta(b, a), q = resta(p, a);
        return Math.abs(cruz(r, q)) <= EPSILON * Math.max(Math.hypot(r.x, r.y), EPSILON)
            && p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
            && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON;
    }

    private static boolean valido(Punto p) { return p != null && Double.isFinite(p.x) && Double.isFinite(p.y); }
    private static Punto resta(Punto a, Punto b) { return new Punto(a.x - b.x, a.y - b.y); }
    private static double cruz(Punto a, Punto b) { return a.x * b.y - a.y * b.x; }
    private static Punto interpolar(Punto a, Punto b, double t) { return new Punto(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
    public record Punto(double x, double y) {}
    private record Poligono(List<List<Punto>> anillos, double minX, double maxX, double minY, double maxY) {}
}
