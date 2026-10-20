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
  // El HTML independiente conserva su ruta de respaldo y continuidad musical.
  if (window === window.top) {
    document.documentElement.dataset.navegacionDocumento = '';
    if (window[Symbol.for('metronet:documento-respaldo')]) window.addEventListener('pagehide', () => {
      try { sessionStorage.setItem('metronet:continuacion-documento', JSON.stringify({
        origen: location.origin, instante: Date.now(),
      })); } catch { /* El respaldo sigue disponible sin almacenamiento. */ }
    });
  }

  // Presentar cada documento completo, sin desvanecer controles ni conservar
  // píxeles de la vista anterior. Solo se espera la carga inicial declarada.
  const raiz = document.documentElement;
  raiz.dataset.pantallaPreparando = '';
  let saliendo = false, lista = false, fuentesListas = false, cuadro = 0;
  const contenedor = window.parent !== window ? window.parent[Symbol.for('metronet:contenedor')] : null;
  contenedor?.preparar(window, document);
  function cubrirSalida() {
    raiz.dataset.pantallaPreparando = '';
    contenedor?.preparar(window, document);
    return () => { delete raiz.dataset.pantallaPreparando; contenedor?.presentar(window, document); };
  }
  window[Symbol.for('metronet:carga-pantalla')] = Object.freeze({cubrir: cubrirSalida});
  document.addEventListener('click', evento => {
    const enlace = evento.target.closest?.('a[href]');
    if (!enlace || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey
      || enlace.hasAttribute('download') || (enlace.target && enlace.target !== '_self')
      || ['/', '/index.html', '/simulacion.html'].includes(location.pathname)) return;
    const destino = new URL(enlace.href, location.href);
    if (destino.origin !== location.origin || destino.pathname + destino.search === location.pathname + location.search) return;
    queueMicrotask(() => { if (!evento.defaultPrevented) cubrirSalida(); });
  });
  const observadorCarga = new MutationObserver(comprobarPantalla);
  function comprobarPantalla() {
    if (lista || saliendo || cuadro || !fuentesListas || raiz.querySelector('[data-carga-inicial][aria-busy="true"]')) return;
    cuadro = requestAnimationFrame(() => {
      cuadro = 0;
      if (saliendo || raiz.querySelector('[data-carga-inicial][aria-busy="true"]')) return;
      lista = true;
      observadorCarga.disconnect();
      delete raiz.dataset.pantallaPreparando;
      contenedor?.presentar(window, document);
    });
  }
  window.addEventListener('DOMContentLoaded', () => {
    observadorCarga.observe(raiz, {subtree:true, attributes:true, attributeFilter:['aria-busy'], childList:true});
    document.fonts.ready.finally(() => { fuentesListas = true; comprobarPantalla(); });
  }, {once:true});
  window.addEventListener('pagehide', () => {
    saliendo = true;
    cancelAnimationFrame(cuadro);
    cuadro = 0;
    contenedor?.preparar(window, document);
  });
  window.addEventListener('pageshow', evento => {
    if (!evento.persisted) return;
    saliendo = false;
    if (lista) { delete raiz.dataset.pantallaPreparando; contenedor?.preparar(window, document); contenedor?.presentar(window, document); }
    else comprobarPantalla();
  });
  // Un fallo de un módulo no debe dejar la navegación atrapada tras la cobertura.
  window.addEventListener('error', () => {
    raiz.querySelectorAll('[data-carga-inicial]').forEach(e => e.setAttribute('aria-busy', 'false'));
    comprobarPantalla();
  });

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
