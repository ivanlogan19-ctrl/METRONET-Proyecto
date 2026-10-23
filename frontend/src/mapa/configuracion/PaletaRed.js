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
  const ordenadas = [...lineas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  // Los nombres automáticos mantienen su color aunque se elimine otra línea.
  for (const linea of ordenadas) {
    const numero = Number(/^Línea (\d+)$/.exec(linea.nombre)?.[1]);
    if (!Number.isSafeInteger(numero) || numero < 1) continue;
    let indice = numero - 1;
    let color = PALETA_RED.lineas[indice] ?? colorAdicional(indice - PALETA_RED.lineas.length);
    while (usados.has(color)) color = colorAdicional(++indice);
    colores.set(linea.nombre, color);
    usados.add(color);
  }
  let indiceAdicional = 0;
  ordenadas.forEach((linea, indice) => {
    if (colores.has(linea.nombre)) return;
    let color = PALETA_RED.lineas[indice];
    while (color === undefined || usados.has(color)) color = colorAdicional(indiceAdicional++);
    colores.set(linea.nombre, color);
    usados.add(color);
  });
  return new Map(ordenadas.map(linea => [linea.nombre, colores.get(linea.nombre)]));
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

// Etiquetas de presentación: la API conserva la identidad original de la línea.
export function nombreVisibleLinea(color) {
  if (!Number.isInteger(color)) return 'Línea sin color';
  const nombres = ['azul', 'fucsia', 'amarilla', 'violeta', 'naranja', 'lima', 'roja', 'lavanda'];
  const indice = PALETA_RED.lineas.indexOf(color);
  if (indice >= 0) return `Línea ${nombres[indice]}`;
  const [rojo, verde, azul] = [color >> 16, (color >> 8) & 255, color & 255];
  const maximo = Math.max(rojo, verde, azul), minimo = Math.min(rojo, verde, azul);
  const diferencia = maximo - minimo;
  const tono = diferencia === 0 ? 0 : ((maximo === rojo ? (verde - azul) / diferencia
    : maximo === verde ? 2 + (azul - rojo) / diferencia : 4 + (rojo - verde) / diferencia) + 6) % 6;
  const nombre = ['roja', 'naranja', 'amarilla', 'verde', 'verde', 'turquesa', 'celeste', 'azul', 'azul', 'violeta', 'fucsia', 'rosa'][Math.round(tono * 2) % 12];
  // Los tonos generados pueden compartir familia; su código distingue cada uno.
  return `Línea ${nombre} · #${color.toString(16).padStart(6, '0')}`;
}
