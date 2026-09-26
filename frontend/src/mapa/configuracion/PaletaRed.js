// Identidad ferroviaria: no reutilizar colores de POI ni tokens territoriales.
export const PALETA_RED = Object.freeze({
  lineas: Object.freeze([0x3983ff, 0xff4edb, 0xffe637, 0xa06aff, 0xff682e, 0xc9ed35, 0xee3760, 0xabbcff]),
  estaciones: Object.freeze({ normal: 0xfff1d4, seleccionada: 0xffffff, invalida: 0xff3358 }),
  metros: Object.freeze([0xe99238, 0xffc184, 0xd87816]),
  transbordo: 0xd6fdff,
});

export function coloresDeLineas(lineas = [], tramos = []) {
  const colores = new Map();
  const estaciones = new Map(lineas.map(l => [l.nombre, new Set(tramos.filter(t => t.nombreLinea === l.nombre).flatMap(t => [t.estacionA, t.estacionB]))]));
  const uso = new Map(PALETA_RED.lineas.map(color => [color, 0]));
  [...lineas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })).forEach(linea => {
    const adyacentes = new Set([...colores].filter(([nombre]) => [...(estaciones.get(nombre) ?? [])].some(e => estaciones.get(linea.nombre)?.has(e))).map(([, color]) => color));
    const candidatas = PALETA_RED.lineas.filter(c => !adyacentes.has(c));
    const color = [...(candidatas.length ? candidatas : PALETA_RED.lineas)].sort((a,b) => uso.get(a)-uso.get(b))[0];
    colores.set(linea.nombre, color);
    uso.set(color, uso.get(color) + 1);
  });
  return colores;
}
export function colorMetro(idTren) { return PALETA_RED.metros[Math.abs(Number(idTren) || 0) % PALETA_RED.metros.length]; }
