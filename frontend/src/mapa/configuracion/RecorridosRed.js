import { coloresDeLineas, nombreVisibleLinea } from './PaletaRed.js';

// Sólo las líneas tienen recorrido, distancia y unidades propias.
export function tramosDeRecorridos(diseno) { return diseno?.tramos ?? []; }
export function coloresRecorrido(diseno, clave) {
  return [coloresDeLineas(diseno?.lineas ?? []).get(clave) ?? 0x3983ff];
}
export function nombreRecorrido(diseno, clave) { return nombreVisibleLinea(coloresRecorrido(diseno, clave)[0]); }
export function fondoRecorrido(diseno, clave) {
  return `#${coloresRecorrido(diseno, clave)[0].toString(16).padStart(6, '0')}`;
}
