(() => {
  // Los documentos siguen disponibles por separado como respaldo y para file://.
  // Dentro del contenedor cada HTML conserva sus propios módulos y su ciclo de vida.
  if (window !== window.top || !/^https?:$/.test(location.protocol)) return;
  const destino = new URL(location.href);
  // Una carga completa inicia una visita nueva, aunque el navegador restaure la
  // última URL del juego o conserve una sesión local. La navegación entre vistas
  // ocurre dentro del contenedor y no vuelve a pasar por este punto de entrada.
  const rutasProtegidas = new Set(['/', '/index.html', '/inicio.html', '/escenarios.html',
    '/aprendizaje.html', '/ranking.html', '/disenos.html', '/perfil.html', '/admin.html', '/simulacion.html']);
  const tipo = performance.getEntriesByType('navigation')[0]?.type || 'navigate';
  // El respaldo HTML solo continúa una salida explícita de esta misma pestaña.
  // El marcador se consume y una URL abierta, restaurada o recargada inicia login.
  let documentoInterno = false;
  try {
    const salida = JSON.parse(sessionStorage.getItem('metronet:continuacion-documento'));
    sessionStorage.removeItem('metronet:continuacion-documento');
    documentoInterno = window.name === 'metronet:respaldo' && tipo === 'navigate'
      && salida?.origen === destino.origin && (!salida.destino || salida.destino === destino.pathname + destino.search + destino.hash)
      && Date.now() - salida.instante >= 0 && Date.now() - salida.instante < 3000;
  } catch { /* Sin salida válida: arranque nuevo. */ }
  if (documentoInterno && rutasProtegidas.has(destino.pathname)) {
    window[Symbol.for('metronet:documento-respaldo')] = true;
    return;
  }
  if (destino.searchParams.has('documento') && !rutasProtegidas.has(destino.pathname)) return;
  if (rutasProtegidas.has(destino.pathname)) {
    window.name = '';
    window.stop();
    location.replace('/login.html');
    return;
  }
  window.name = '';
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
