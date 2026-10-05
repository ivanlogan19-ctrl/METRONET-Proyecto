import { iconosTrofeos } from './IconosTrofeos.js';
import './celebracion-trofeos.css';

function texto(tag, contenido, clase) {
  const nodo = document.createElement(tag);
  nodo.textContent = contenido;
  if (clase) nodo.className = clase;
  return nodo;
}

export async function celebrarTrofeosNuevos(trofeos, { signal } = {}) {
  if (!Array.isArray(trofeos) || signal?.aborted) return;
  for (const trofeo of trofeos) {
    if (signal?.aborted) break;
    if (!trofeo?.obtenido || !Object.hasOwn(iconosTrofeos, trofeo.id)) continue;
    await mostrarTrofeo(trofeo, signal);
  }
}

function mostrarTrofeo(trofeo, signal) {
  return new Promise(resolve => {
    const focoAnterior = document.activeElement;
    const dialogo = document.createElement('dialog');
    dialogo.className = 'metronet-dialogo-cambios metronet-premio';
    dialogo.setAttribute('aria-labelledby', 'tituloPremioNuevo');
    dialogo.setAttribute('aria-describedby', 'motivoPremioNuevo');
    const contenido = texto('section', '', 'metronet-premio__contenido');
    const emblema = texto('div', '', 'metronet-premio__emblema');
    emblema.setAttribute('aria-hidden', 'true');
    emblema.innerHTML = `<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconosTrofeos[trofeo.id]}</svg>`;
    const titulo = texto('h2', '¡Felicitaciones!');
    titulo.id = 'tituloPremioNuevo';
    titulo.tabIndex = -1;
    const nombre = texto('h3', trofeo.nombre);
    const motivo = texto('p', trofeo.motivo);
    motivo.id = 'motivoPremioNuevo';
    const continuar = texto('button', 'Continuar', 'metronet-boton--exito metronet-boton--destacado');
    continuar.type = 'button';
    contenido.append(texto('p', 'NUEVO TROFEO', 'metronet-premio__etiqueta'), emblema, titulo, nombre, motivo, continuar);
    dialogo.append(contenido);
    let cerrado = false;
    function cerrar() {
      if (cerrado) return;
      cerrado = true;
      signal?.removeEventListener('abort', cerrar);
      window.removeEventListener('pagehide', cerrar);
      dialogo.remove();
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
      resolve();
    }
    continuar.addEventListener('click', cerrar, { once: true });
    dialogo.addEventListener('cancel', e => { e.preventDefault(); cerrar(); });
    signal?.addEventListener('abort', cerrar, { once: true });
    window.addEventListener('pagehide', cerrar, { once: true });
    document.body.append(dialogo);
    dialogo.showModal();
    titulo.focus({ preventScroll: true });
  });
}
