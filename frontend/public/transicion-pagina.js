(() => {
  // El contenedor refleja la dirección del documento, sin duplicar el historial.
  try {
    const contenedor = window.parent !== window && window.parent[Symbol.for('metronet:contenedor')];
    if (contenedor) {
      document.documentElement.dataset.navegacionContenida = '';
      const entrada = contenedor.recibirEntrada(window);
      if (entrada && ['reload', 'back_forward'].includes(entrada.tipo)) {
        window[Symbol.for('metronet:tipo-navegacion')] = entrada.tipo;
        history.replaceState({ ...history.state, metronetDesplazamiento: entrada.posicion }, '');
      }
      const sincronizar = () => contenedor.sincronizar(window);
      for (const evento of ['DOMContentLoaded', 'pageshow', 'popstate', 'hashchange']) window.addEventListener(evento, sincronizar);
      const reemplazar = history.replaceState.bind(history);
      history.replaceState = (...args) => { reemplazar(...args); sincronizar(); };
    }
  } catch { /* El documento independiente conserva su navegación normal. */ }
  // Las transiciones entre documentos no son fiables dentro de un iframe:
  // un redirect de permisos puede abortarlas antes de exponer su promesa.
  // Mantenerlas en HTML independientes; las vistas contenidas usan CSS breve.
  if (window === window.top) {
    const enlace = document.createElement('link');
    enlace.rel = 'stylesheet';
    enlace.href = '/transiciones-documento.css';
    document.head.append(enlace);
  }
  // Se registra antes del primer render. Cada vista mantiene su propio documento.
  // El navegador puede omitir una transición: su promesa visual no bloquea el acceso.
  for (const evento of ['pageswap', 'pagereveal']) {
    window.addEventListener(evento, ({ viewTransition }) => {
      viewTransition?.ready.catch(() => {});
    });
  }

  // La restauración nativa puede ocurrir antes de recibir una tabla asíncrona y
  // quedar limitada por su altura vacía. Guardar por entrada del historial y
  // restaurar cuando el contenido realmente alcanza esa posición, sin esperas.
  if (!('scrollRestoration' in history)) return;
  history.scrollRestoration = 'manual';
  let observador = null;
  let intervinoUsuario = false;
  const detener = () => {
    observador?.disconnect(); observador = null;
    for (const evento of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(evento, cancelar);
  };
  const cancelar = () => { intervinoUsuario = true; detener(); };
  const restaurar = evento => {
    if (intervinoUsuario || !document.body) return;
    const tipo = window[Symbol.for('metronet:tipo-navegacion')] ?? performance.getEntriesByType('navigation')[0]?.type;
    if (!evento.persisted && tipo !== 'back_forward' && tipo !== 'reload') return;
    const posicion = history.state?.metronetDesplazamiento;
    if (!posicion || !Number.isFinite(posicion.x) || !Number.isFinite(posicion.y)) return;
    detener();
    const aplicar = () => {
      const raiz = document.documentElement;
      if (raiz.scrollHeight - innerHeight < posicion.y || raiz.scrollWidth - innerWidth < posicion.x) return;
      scrollTo({ left: posicion.x, top: posicion.y, behavior: 'instant' });
      detener();
    };
    observador = new ResizeObserver(aplicar);
    observador.observe(document.body);
    for (const evento of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(evento, cancelar, { passive: true });
    aplicar();
  };
  window.addEventListener('pageshow', restaurar);
  window.addEventListener('pagehide', () => {
    detener();
    try { history.replaceState({ ...history.state, metronetDesplazamiento: { x: scrollX, y: scrollY } }, ''); }
    catch { /* Un historial no escribible no debe impedir navegar. */ }
  });
})();
