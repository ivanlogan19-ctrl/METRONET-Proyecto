(() => {
  const mostrar = () => {
    const panel = document.querySelector('#error-pantalla');
    if (!panel) return;
    panel.hidden = false;
    try {
      const ruta = new URL(new URLSearchParams(location.search).get('destino'), location.origin);
      if (ruta.origin === location.origin && (ruta.pathname === '/' || /^\/[a-z-]+\.html$/.test(ruta.pathname)) && ruta.pathname !== '/aplicacion.html') {
        ruta.searchParams.set('documento', '1');
        document.querySelector('#abrir-documento').href = ruta.href;
      }
    } catch { /* El enlace de respaldo predeterminado siempre permite volver al acceso. */ }
  };
  window.addEventListener('error', evento => {
    if ((evento.target?.tagName === 'SCRIPT' && evento.target.type === 'module')
      || (evento.error && !window[Symbol.for('metronet:contenedor')])) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrar, { once:true });
      else mostrar();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#reintentar-pantalla')?.addEventListener('click', () => location.reload());
    document.querySelector('#abrir-documento')?.addEventListener('click', evento => {
      try {
        const destino = new URL(evento.currentTarget.href);
        if (destino.origin !== location.origin) return;
        window.name = 'metronet:respaldo';
        sessionStorage.setItem('metronet:continuacion-documento', JSON.stringify({
          origen: location.origin, destino: destino.pathname + destino.search + destino.hash, instante: Date.now(),
        }));
      } catch { /* Un fallo del marcador vuelve al acceso normal. */ }
    });
  }, { once:true });
})();
