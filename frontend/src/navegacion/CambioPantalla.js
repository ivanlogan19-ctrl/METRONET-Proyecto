// Cubrir la salida solo después de aceptar la navegación (y guardar, si corresponde).
export function cambiarPantalla(ruta, { reemplazar = false } = {}) {
  const destino = new URL(ruta, location.href);
  const cambiaDocumento = destino.pathname + destino.search !== location.pathname + location.search;
  const restaurar = cambiaDocumento ? window[Symbol.for('metronet:carga-pantalla')]?.cubrir() : null;
  try { window.location[reemplazar ? 'replace' : 'assign'](destino.href); }
  catch (error) { restaurar?.(); throw error; }
}
