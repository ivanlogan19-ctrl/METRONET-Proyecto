import { coloresDeLineas, nombreVisibleLinea } from './PaletaRed.js';

export const claveConexion = conexion => `@conexion:${conexion.idConexion}`;
export const conexionDeRecorrido = (diseno, clave) => (diseno?.conexionesLineas ?? []).find(c => claveConexion(c) === clave);
// Proyección para circulación/medición; nunca agrega tramos a las líneas guardadas.
export function tramosDeRecorridos(diseno) {
  return [...(diseno?.tramos ?? []), ...(diseno?.conexionesLineas ?? []).map(c => ({
    nombreLinea: claveConexion(c), estacionA: c.estacionA, estacionB: c.estacionB, distanciaKm: c.distanciaKm,
  }))];
}
export function coloresRecorrido(diseno, clave) {
  const colores = coloresDeLineas(diseno?.lineas ?? []), c = conexionDeRecorrido(diseno, clave);
  return (c ? [c.lineaA, c.lineaB] : [clave]).map(nombre => colores.get(nombre) ?? 0x3983ff);
}
export function nombreRecorrido(diseno, clave) {
  const colores = coloresRecorrido(diseno, clave);
  if (!conexionDeRecorrido(diseno, clave)) return nombreVisibleLinea(colores[0]);
  const abreviar = color => nombreVisibleLinea(color).replace(/^Línea /, '').slice(0, 3).toUpperCase();
  return `Conexión ${colores.map(abreviar).join('–')}`;
}
export function fondoRecorrido(diseno, clave) {
  const tonos = coloresRecorrido(diseno, clave).map(c => `#${c.toString(16).padStart(6, '0')}`);
  return tonos.length === 1 ? tonos[0] : `linear-gradient(90deg, ${tonos[0]} 0% 50%, ${tonos[1]} 50% 100%)`;
}
