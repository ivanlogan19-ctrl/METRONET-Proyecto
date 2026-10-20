// Identidad ferroviaria: no reutilizar colores de POI ni tokens territoriales.
export const PALETA_RED = Object.freeze({
  lineas: Object.freeze([0x3983ff, 0xff4edb, 0xffe637, 0xa06aff, 0xff682e, 0xc9ed35, 0xee3760, 0xabbcff]),
  estaciones: Object.freeze({ normal: 0xfff1d4, seleccionada: 0xffffff, invalida: 0xff3358 }),
  metros: Object.freeze([0xe99238, 0xffc184, 0xd87816]),
  transbordo: 0xd6fdff,
});

export function coloresDeLineas(lineas = []) {
  const colores = new Map();
  const usados = new Set([...Object.values(PALETA_RED.estaciones), ...PALETA_RED.metros, PALETA_RED.transbordo]);
  let indiceAdicional = 0;
  [...lineas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })).forEach((linea, indice) => {
    let color = PALETA_RED.lineas[indice];
    while (color === undefined || usados.has(color)) color = colorAdicional(indiceAdicional++);
    colores.set(linea.nombre, color);
    usados.add(color);
  });
  return colores;
}

// Distribuye los tonos adicionales; el conjunto anterior evita colisiones RGB.
function colorAdicional(indice) {
  const tono = ((indice + 1) * 0.618033988749895 % 1) * 6;
  const saturacion = 0.65 + (indice % 3) * 0.1;
  const brillo = 0.95 - (Math.floor(indice / 3) % 3) * 0.08;
  const canal = desplazamiento => {
    const posicion = (desplazamiento + tono) % 6;
    return Math.round(255 * brillo * (1 - saturacion * Math.max(0, Math.min(posicion, 4 - posicion, 1))));
  };
  return (canal(5) << 16) | (canal(3) << 8) | canal(1);
}
export function colorMetro(idTren) { return PALETA_RED.metros[Math.abs(Number(idTren) || 0) % PALETA_RED.metros.length]; }
