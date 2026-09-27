// Una recarga del contenedor también es una recarga para la primera vista.
export function obtenerTipoNavegacion() {
  return window[Symbol.for('metronet:tipo-navegacion')] ?? performance.getEntriesByType('navigation')[0]?.type;
}
