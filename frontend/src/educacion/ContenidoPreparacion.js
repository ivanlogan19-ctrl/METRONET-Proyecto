import niveles from './niveles.json';

// Identidad educativa por número; los IDs persistidos los proporciona el servidor.
export function obtenerContenidoNivel(numero) {
  return Number.isInteger(numero) ? niveles.find(nivel => nivel.numero === numero) ?? null : null;
}

export function obtenerContenidoPreparacion(escenario) {
  return obtenerContenidoNivel(escenario?.numero)?.preparacion ?? null;
}
