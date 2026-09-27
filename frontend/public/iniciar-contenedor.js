(() => {
  // Los documentos siguen disponibles por separado como respaldo y para file://.
  // Dentro del contenedor cada HTML conserva sus propios módulos y su ciclo de vida.
  if (window !== window.top || !/^https?:$/.test(location.protocol)) return;
  const destino = new URL(location.href);
  if (destino.searchParams.has('documento')) return;
  const tipo = performance.getEntriesByType('navigation')[0]?.type || 'navigate';
  const entrada = new URLSearchParams({ destino: destino.pathname + destino.search + destino.hash, tipo });
  let posicion = history.state?.metronetDesplazamiento;
  try {
    const salida = JSON.parse(sessionStorage.getItem('metronet:salida-contenedor'));
    sessionStorage.removeItem('metronet:salida-contenedor');
    const edad = Date.now() - salida?.instante;
    if (['reload', 'back_forward'].includes(tipo) && salida?.ruta === destino.pathname + destino.search + destino.hash
      && edad >= 0 && edad < 30000) posicion = salida.posicion;
  } catch { /* Sin almacenamiento, conservar el respaldo del historial nativo. */ }
  if (Number.isFinite(posicion?.y)) entrada.set('y', String(posicion.y));
  if (Number.isFinite(posicion?.x)) entrada.set('x', String(posicion.x));
  window.stop();
  location.replace(`/aplicacion.html?${entrada}`);
})();
