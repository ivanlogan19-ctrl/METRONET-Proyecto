import niveles from './niveles.json';
import { contenidoPublicadoEnCache } from './ContenidoPublicadoNivel.js';

// Identidad educativa por número; los IDs persistidos los proporciona el servidor.
export function obtenerContenidoNivel(numero) {
  return Number.isInteger(numero) ? niveles.find(nivel => nivel.numero === numero) ?? null : null;
}

export function obtenerContenidoPreparacion(escenario) {
  return contenidoPublicadoEnCache(escenario?.numero, escenario?.idIntento)?.desafio?.preparacion
    ?? obtenerContenidoNivel(escenario?.numero)?.preparacion ?? null;
}
