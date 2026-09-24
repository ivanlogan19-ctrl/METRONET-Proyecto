import { mostrarNotificacion } from './NotificacionesMetronet.js';

let inicializado = false;

export function inicializarAyudasSistema() {
  if (inicializado) return;
  inicializado = true;
  const ayuda = document.createElement('div');
  ayuda.id = 'metronet-ayuda-sistema'; ayuda.className = 'metronet-tooltip';
  ayuda.setAttribute('role', 'tooltip'); ayuda.setAttribute('popover', 'manual'); ayuda.hidden = true;
  document.body.append(ayuda);
  let origen = null;
  const cerrar = () => {
    if (origen) {
      const ids = (origen.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== ayuda.id);
      if (ids.length) origen.setAttribute('aria-describedby', ids.join(' ')); else origen.removeAttribute('aria-describedby');
    }
    if (ayuda.matches(':popover-open')) ayuda.hidePopover();
    ayuda.hidden = true; origen = null;
  };
  const mostrar = evento => {
    const elemento = evento.target.closest?.('[data-ayuda-sistema]');
    if (!elemento?.dataset.ayudaSistema || elemento === origen) return;
    cerrar(); origen = elemento; ayuda.textContent = elemento.dataset.ayudaSistema;
    ayuda.hidden = false; ayuda.showPopover?.();
    const r = elemento.getBoundingClientRect(), a = ayuda.getBoundingClientRect();
    ayuda.style.left = `${Math.max(12, Math.min(r.left, innerWidth - a.width - 12))}px`;
    ayuda.style.top = `${r.bottom + a.height + 12 < innerHeight ? r.bottom + 6 : Math.max(12, r.top - a.height - 6)}px`;
    elemento.setAttribute('aria-describedby', [elemento.getAttribute('aria-describedby'), ayuda.id].filter(Boolean).join(' '));
  };
  const migrar = nodo => {
    if (!(nodo instanceof Element)) return;
    const elementos = nodo.matches('[title]') ? [nodo] : [];
    elementos.push(...nodo.querySelectorAll('[title]'));
    elementos.forEach(e => { e.dataset.ayudaSistema = e.title; e.removeAttribute('title'); });
  };
  migrar(document.body);
  new MutationObserver(cambios => {
    cambios.forEach(cambio => {
      if (cambio.type === 'attributes') migrar(cambio.target);
      else cambio.addedNodes.forEach(migrar);
    });
    if (origen && (!origen.isConnected || !origen.dataset.ayudaSistema)) cerrar();
    else if (origen && ayuda.textContent !== origen.dataset.ayudaSistema) ayuda.textContent = origen.dataset.ayudaSistema;
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
  document.addEventListener('pointerover', mostrar);
  document.addEventListener('focusin', mostrar);
  document.addEventListener('pointerout', e => { if (origen?.contains(e.target) && !origen.contains(e.relatedTarget)) cerrar(); });
  document.addEventListener('focusout', cerrar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
  document.addEventListener('scroll', cerrar, true);
  // Conserva la validación HTML y su bloqueo de submit; solo cambia el aviso.
  // Los formularios noValidate ya presentan sus propios mensajes de sistema.
  let campoInvalido = null;
  document.addEventListener('invalid', evento => {
    const campo = evento.target;
    if (campo.form?.noValidate) return;
    evento.preventDefault();
    if (campoInvalido) return;
    campoInvalido = campo;
    queueMicrotask(() => {
      campo.focus(); mostrarNotificacion(campo.validationMessage, 'error'); campoInvalido = null;
    });
  }, true);
}
