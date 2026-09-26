import { trazadoPixel } from './PictogramasMapa.js';
import './iconos-retro.css';
import { inicializarAyudasSistema } from '../componentes/AyudasSistema.js';


export function iconoRetro(nombre) {
  return `<svg class="metronet-icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${trazadoPixel(nombre)}"/></svg>`;
}

// Reutiliza el tooltip global (teclado, Escape y bordes del viewport).
export function configurarBotonIcono(boton, nombre, etiqueta) {
  if (!boton) return;
  inicializarAyudasSistema();
  boton.classList.add('metronet-boton-icono');
  boton.setAttribute('aria-label', etiqueta);
  boton.title = etiqueta;
  boton.innerHTML = iconoRetro(nombre);
}
