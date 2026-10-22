import { mostrarNotificacion } from './NotificacionesMetronet.js';

let inicializado = false;

export function inicializarAyudasSistema() {
  if (inicializado) return;
  inicializado = true;
  // Conservar la descripción accesible sin carteles al pasar el mouse o enfocar.
  const retirarTitulo = elemento => {
    if (!elemento.hasAttribute('title')) return;
    elemento.dataset.ayudaSistema = elemento.title;
    elemento.setAttribute('aria-description', elemento.title);
    elemento.removeAttribute('title');
  };
  const revisar = nodo => {
    if (!(nodo instanceof Element)) return;
    retirarTitulo(nodo);
    nodo.querySelectorAll('[title]').forEach(retirarTitulo);
  };
  revisar(document.body);
  new MutationObserver(cambios => {
    for (const cambio of cambios) {
      if (cambio.type === 'attributes') retirarTitulo(cambio.target);
      else cambio.addedNodes.forEach(revisar);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
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
