import { configurarAccion } from './AccionesInterfaz.js';
import { trazadoPixel } from './PictogramasMapa.js';
import './iconos-retro.css';
import { inicializarAyudasSistema } from '../componentes/AyudasSistema.js';


export function iconoRetro(nombre) {
  return `<svg class="metronet-icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${trazadoPixel(nombre)}"/></svg>`;
}

// El nombre accesible identifica el control sin cubrir el mapa con carteles.
export function configurarBotonIcono(boton, nombre, etiqueta) {
  if (!boton) return;
  inicializarAyudasSistema();
  boton.classList.add('metronet-boton-icono');
  boton.setAttribute('aria-label', etiqueta);
  boton.removeAttribute('title');
  boton.innerHTML = iconoRetro(nombre);
  const acciones = { Cerrar:'cerrar', Anterior:'anterior', Siguiente:'siguiente', Guardar:'guardar', Cancelar:'cancelar' };
  const accion=acciones[etiqueta] || (etiqueta.startsWith('Cerrar ')?'cerrar':null);
  if(accion)configurarAccion(boton,accion,{icono:true});
}
