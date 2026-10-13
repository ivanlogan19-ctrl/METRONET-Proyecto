import { configurarBotonIcono, iconoRetro } from '../../interfaz/IconosRetro.js';
export default class PanelDesplazamientos {
  constructor(capa, panel) {
    this.capa = capa;
    this.boton = document.createElement('button'); this.boton.type = 'button'; this.boton.dataset.desplazamientosVisible = '';
    panel.querySelector('.metronet-calles__botones').append(this.boton);
    this.elemento = document.createElement('div'); this.elemento.className = 'metronet-desplazamientos';
    this.elemento.innerHTML = `<div class="metronet-desplazamientos__opacidad">
      <span aria-hidden="true">${iconoRetro('desplazamientos')}</span>
      <input type="range" min="10" max="100" step="5" value="70" aria-label="Opacidad de desplazamientos">
      <button type="button" data-desplazamientos-animar></button></div>
      <p class="metronet-trafico__error" role="status" hidden></p>`;
    panel.append(this.elemento);
    this.rango = this.elemento.querySelector('input'); this.play = this.elemento.querySelector('button');
    this.boton.addEventListener('click', () => capa.alternar());
    this.play.addEventListener('click', () => capa.alternarAnimacion());
    this.rango.addEventListener('input', () => capa.establecerOpacidad(Number(this.rango.value)/100));
    capa.alCambiar = () => this.actualizar(); this.actualizar();
  }
  actualizar() {
    const c = this.capa, lista = c.visible && c.estado === 'lista';
    configurarBotonIcono(this.boton, 'desplazamientos', c.estado === 'error' ? 'Reintentar carga de desplazamientos'
      : c.visible ? 'Ocultar desplazamientos históricos' : 'Mostrar desplazamientos históricos');
    this.boton.disabled = c.estado === 'cargando'; this.boton.setAttribute('aria-pressed', String(lista));
    this.rango.disabled = this.play.disabled = !lista;
    this.rango.value = c.opacidad*100; this.rango.setAttribute('aria-valuetext', `${Math.round(c.opacidad*100)} %`);
    configurarBotonIcono(this.play, c.animando ? 'pausa' : 'play', c.animando ? 'Pausar flechas' : 'Animar flechas');
    this.play.setAttribute('aria-pressed', String(lista && c.animando));
    const mensaje = this.elemento.querySelector('[role="status"]');
    mensaje.hidden = c.estado !== 'error' && !(lista && !c.flujos.length);
    mensaje.textContent = c.estado === 'error' ? 'No se pudieron cargar los desplazamientos. Podés construir y reintentar.'
      : 'Sin flujos representables para esta hora.';
  }
  eliminar() { this.capa.alCambiar = () => {}; this.boton.remove(); this.elemento.remove(); }
}
