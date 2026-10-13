import { gestorMusica } from './GestorMusica.js';

// La vista solicita atenuación al único reproductor, también dentro del
// contenedor persistente. No cambia pista, posición ni preferencia de volumen.
const selectores = 'dialog[open]:not(.metronet-viaje):not(.metronet-victoria), .metronet-guia-rapida:popover-open';
let liberar = null;
let programada = false;
function actualizar() {
  programada = false;
  const leyendo = [...document.querySelectorAll(selectores)].some(e => !e.hidden && e.getClientRects().length);
  if (leyendo && !liberar) liberar = gestorMusica.atenuarLectura();
  if (!leyendo && liberar) { liberar(); liberar = null; }
}
function programar() {
  if (!programada) { programada = true; queueMicrotask(actualizar); }
}
const observador = new MutationObserver(registros => {
  if (registros.some(r => r.type === 'attributes' && r.target.matches('dialog') ||
    r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && (n.matches('dialog, .metronet-guia-rapida') || n.querySelector('dialog, .metronet-guia-rapida'))))) programar();
});
function iniciar() {
  observador.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['open','hidden']});
  actualizar();
}
if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar, {once:true});
document.addEventListener('toggle', programar, true);
window.addEventListener('pagehide', () => { observador.disconnect(); liberar?.(); liberar = null; });
window.addEventListener('pageshow', e => { if (e.persisted) iniciar(); });
