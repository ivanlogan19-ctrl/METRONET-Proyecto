export const BANDAS_POBLACION = [
  { maximo: 1000, color: 0x343552, etiqueta: '0–1.000 habitantes/km²' },
  { maximo: 5000, color: 0x575087, etiqueta: 'Más de 1.000–5.000 habitantes/km²' },
  { maximo: 10000, color: 0x7b66b4, etiqueta: 'Más de 5.000–10.000 habitantes/km²' },
  { maximo: 20000, color: 0xa486d8, etiqueta: 'Más de 10.000–20.000 habitantes/km²' },
  { maximo: Infinity, color: 0xd3b2fa, etiqueta: 'Más de 20.000 habitantes/km²' },
];
export const COLOR_SIN_DATOS = 0x697383;
export function densidadPoblacion({ poblacion, areaKm2 }) {
  return Number.isFinite(poblacion) && poblacion >= 0 && Number.isFinite(areaKm2) && areaKm2 > 0 ? poblacion / areaKm2 : null;
}
export function colorPoblacion(propiedades) {
  const densidad = densidadPoblacion(propiedades);
  return densidad === null ? COLOR_SIN_DATOS : BANDAS_POBLACION.find(b => densidad <= b.maximo).color;
}
export function validarPoblacion(datos) {
  if (datos?.type !== 'FeatureCollection' || ![2011, 2023].includes(datos.metadata?.anio) || !datos.features?.length
    || datos.features.length + (datos.metadata.sinGeometria?.length ?? 0) !== datos.metadata.totalFuente) throw new Error('Cobertura censal inválida');
  const ids = new Set();
  for (const f of datos.features) {
    const p = f.properties, g = f.geometry;
    if (!p || !Number.isInteger(p.id) || ids.has(p.id) || !['Polygon', 'MultiPolygon'].includes(g?.type)) throw new Error('Zona censal inválida');
    ids.add(p.id);
    for (const [valor, minimo] of [[p.poblacion, 0], [p.areaKm2, 0]]) if (valor !== null && (!Number.isFinite(valor) || valor < minimo)) throw new Error('Dato censal inválido');
    const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    if (!poligonos?.length || poligonos.some(poly => !poly.length || poly.some(r => r.length < 4 || r.some(c => c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || c[0] < -57 || c[0] > -55 || c[1] < -36 || c[1] > -34)))) throw new Error('Geometría censal inválida');
  }
  return datos;
}
