import { obtenerConcepto, segmentarConceptos, tituloConcepto } from './Conceptos.js';
import './glosario.css';

let cerrarActual = null;
const texto = (tag, contenido, clase) => {
  const elemento = document.createElement(tag);
  elemento.textContent = contenido;
  if (clase) elemento.className = clase;
  return elemento;
};

export function cerrarDefinicion() { cerrarActual?.(); }

function mostrarDefinicion(id, origen) {
  const entrada = obtenerConcepto(id);
  if (!entrada?.definicion) return;
  cerrarDefinicion();
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-glosario-ventana';
  dialogo.setAttribute('aria-labelledby', 'tituloConceptoMetronet');
  dialogo.setAttribute('aria-describedby', 'definicionConceptoMetronet');
  const titulo = texto('h2', tituloConcepto(entrada)); titulo.id = 'tituloConceptoMetronet';
  const definicion = texto('p', entrada.definicion); definicion.id = 'definicionConceptoMetronet';
  const cerrar = texto('button', 'Cerrar explicación'); cerrar.type = 'button';
  dialogo.append(texto('p', `GLOSARIO / ${entrada.categoria}`, 'metronet-glosario-categoria'), titulo, definicion, cerrar);
  // Un diálogo anidado permanece sobre la introducción y Escape solo cierra la definición.
  const padre = origen.closest('dialog') ?? document.body;
  let observador;
  const limpiar = () => {
    observador?.disconnect();
    window.removeEventListener('pagehide', limpiar);
    dialogo.remove();
    if (cerrarActual === limpiar) cerrarActual = null;
    if (origen.isConnected) origen.focus({ preventScroll: true });
  };
  cerrarActual = limpiar;
  cerrar.addEventListener('click', limpiar);
  dialogo.addEventListener('cancel', e => { e.preventDefault(); e.stopPropagation(); limpiar(); });
  dialogo.addEventListener('close', e => { e.stopPropagation(); limpiar(); });
  dialogo.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Tab') { e.preventDefault(); cerrar.focus(); }
  });
  dialogo.addEventListener('click', e => { if (e.target === dialogo && (e.clientX < dialogo.getBoundingClientRect().left || e.clientX > dialogo.getBoundingClientRect().right || e.clientY < dialogo.getBoundingClientRect().top || e.clientY > dialogo.getBoundingClientRect().bottom)) limpiar(); });
  try {
    padre.append(dialogo); dialogo.showModal(); cerrar.focus();
    observador = new MutationObserver(() => { if (!origen.isConnected || !dialogo.isConnected) limpiar(); });
    observador.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', limpiar);
  } catch { limpiar(); } // Una explicación nunca bloquea el nivel.
}

// Conserva exactamente los nodos de texto. Evita botones anidados y formularios.
// La primera aparición de cada concepto por bloque es interactiva; las repeticiones
// siguen legibles y no agregan pasos redundantes de teclado.
export function destacarConceptos(contenedor, ids, { alConsultar } = {}) {
  if (!contenedor) return;
  contenedor.querySelectorAll('button[data-concepto]').forEach(boton => boton.replaceWith(document.createTextNode(boton.textContent)));
  contenedor.normalize();
  const vistos = new Set();
  const nodos = [];
  const cursor = document.createTreeWalker(contenedor, NodeFilter.SHOW_TEXT);
  while (cursor.nextNode()) {
    const nodo = cursor.currentNode;
    if (!nodo.parentElement.closest('button, a, label, input, textarea, select, summary, [contenteditable], .metronet-glosario-ventana')) nodos.push(nodo);
  }
  for (const nodo of nodos) {
    const fragmento = document.createDocumentFragment();
    for (const segmento of segmentarConceptos(nodo.textContent, ids)) {
      if (!segmento.id || vistos.has(segmento.id)) { fragmento.append(document.createTextNode(segmento.texto)); continue; }
      vistos.add(segmento.id);
      const boton = texto('button', segmento.texto, 'metronet-glosario-termino');
      boton.type = 'button'; boton.dataset.concepto = segmento.id;
      boton.setAttribute('aria-haspopup', 'dialog');
      boton.setAttribute('aria-label', `${segmento.texto}: consultar ${tituloConcepto(obtenerConcepto(segmento.id))}`);
      boton.addEventListener('click', e => { e.stopPropagation(); alConsultar?.(); mostrarDefinicion(segmento.id, boton); });
      fragmento.append(boton);
    }
    nodo.replaceWith(fragmento);
  }
}
