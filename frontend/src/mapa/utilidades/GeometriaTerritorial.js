// Intersecciones exactas de segmentos con los bordes; no muestreo a pasos fijos.
const EPSILON = 1e-10;
const cruz = (a, b) => a[0] * b[1] - a[1] * b[0];
const resta = (a, b) => [a[0] - b[0], a[1] - b[1]];
const interpolar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const valido = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

function enBorde(p, a, b) {
  const r = resta(b, a), q = resta(p, a);
  return Math.abs(cruz(r, q)) <= EPSILON * Math.max(Math.hypot(...r), EPSILON) &&
    p[0] >= Math.min(a[0], b[0]) - EPSILON && p[0] <= Math.max(a[0], b[0]) + EPSILON &&
    p[1] >= Math.min(a[1], b[1]) - EPSILON && p[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function posicionEnAnillo(p, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const a = anillo[j], b = anillo[i];
    if (enBorde(p, a, b)) return 0;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) dentro = !dentro;
  }
  return dentro ? 1 : -1;
}

export default class GeometriaTerritorial {
  constructor(geometrias = []) {
    this.poligonos = geometrias.flatMap(g => g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [])
      .filter(anillos => Array.isArray(anillos) && anillos.length && anillos.every(a => Array.isArray(a) && a.length >= 4 && a.every(valido) && a[0][0] === a.at(-1)[0] && a[0][1] === a.at(-1)[1]))
      .map(anillos => ({ anillos, minX: Math.min(...anillos[0].map(p => p[0])), maxX: Math.max(...anillos[0].map(p => p[0])), minY: Math.min(...anillos[0].map(p => p[1])), maxY: Math.max(...anillos[0].map(p => p[1])) }));
  }

  contiene(p) {
    if (!valido(p)) return false;
    return this.poligonos.some(({ anillos, minX, maxX, minY, maxY }) => {
      if (p[0] < minX - EPSILON || p[0] > maxX + EPSILON || p[1] < minY - EPSILON || p[1] > maxY + EPSILON) return false;
      const exterior = posicionEnAnillo(p, anillos[0]);
      if (exterior <= 0) return exterior === 0;
      // Los bordes forman parte del territorio; sólo el interior del hueco se excluye.
      return !anillos.slice(1).some(a => posicionEnAnillo(p, a) === 1);
    });
  }

  cortes(a, b) {
    const r = resta(b, a), largo2 = r[0] ** 2 + r[1] ** 2;
    const cortes = [0, 1];
    if (largo2 === 0) return cortes;
    const agregar = t => { if (t >= -EPSILON && t <= 1 + EPSILON) cortes.push(Math.max(0, Math.min(1, t))); };
    for (const poligono of this.poligonos) {
      if (poligono.maxX < Math.min(a[0], b[0]) || poligono.minX > Math.max(a[0], b[0]) || poligono.maxY < Math.min(a[1], b[1]) || poligono.minY > Math.max(a[1], b[1])) continue;
      for (const anillo of poligono.anillos) for (let i = 1; i < anillo.length; i++) {
        const c = anillo[i - 1], d = anillo[i], s = resta(d, c), q = resta(c, a), determinante = cruz(r, s);
        const escala = Math.max(Math.hypot(...r) * Math.hypot(...s), Number.MIN_VALUE);
        if (Math.abs(determinante) > Number.EPSILON * 32 * escala) {
          const t = cruz(q, s) / determinante, u = cruz(q, r) / determinante;
          if (u >= -EPSILON && u <= 1 + EPSILON) agregar(t);
        } else if (enBorde(c, a, b) || enBorde(d, a, b) || enBorde(a, c, d)) {
          agregar((q[0] * r[0] + q[1] * r[1]) / largo2);
          const extremo = resta(d, a);
          agregar((extremo[0] * r[0] + extremo[1] * r[1]) / largo2);
        }
      }
    }
    return [...new Set(cortes)].sort((x, y) => x - y);
  }

  contieneSegmento(a, b) {
    if (!this.contiene(a) || !this.contiene(b)) return false;
    const cortes = this.cortes(a, b);
    return cortes.slice(1).every((t, i) => this.contiene(interpolar(a, b, (cortes[i] + t) / 2)));
  }

  intersectaSegmento(a, b) {
    if (!valido(a) || !valido(b)) return false;
    const cortes = this.cortes(a, b);
    return cortes.some(t => this.contiene(interpolar(a, b, t))) ||
      cortes.slice(1).some((t, i) => this.contiene(interpolar(a, b, (cortes[i] + t) / 2)));
  }
}
