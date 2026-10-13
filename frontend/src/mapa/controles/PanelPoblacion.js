import { configurarBotonIcono, iconoRetro } from '../../interfaz/IconosRetro.js';
import { BANDAS_POBLACION, COLOR_SIN_DATOS } from '../poblacion/ModeloPoblacion.mjs';

export default class PanelPoblacion {
  constructor(capa, panel) {
    this.capa = capa;
    this.boton = document.createElement('button'); this.boton.type = 'button'; this.boton.dataset.poblacionVisible = '';
    panel.querySelector('.metronet-calles__botones').append(this.boton);
    this.elemento = document.createElement('div'); this.elemento.className = 'metronet-poblacion';
    const bandas = [...BANDAS_POBLACION, { color: COLOR_SIN_DATOS, etiqueta: 'Sin datos válidos de población o superficie' }];
    this.elemento.innerHTML = `<div class="metronet-poblacion__opacidad">
      <span aria-hidden="true">${iconoRetro('poblacion')}</span>
      <input type="range" min="10" max="100" step="5" value="65" aria-label="Opacidad de densidad de población">

      </div><div class="metronet-poblacion__leyenda" aria-label="Densidad de población en habitantes por kilómetro cuadrado">
      ${bandas.map(b => `<span role="img" style="background:#${b.color.toString(16)}" title="${b.etiqueta}" aria-label="${b.etiqueta}"></span>`).join('')}
      </div><p role="status" class="metronet-trafico__error" hidden></p>`;
    panel.append(this.elemento);
    this.rango = this.elemento.querySelector('input');
    this.boton.addEventListener('click', () => capa.alternar());
    this.rango.addEventListener('input', () => { const valor = this.rango.value; capa.establecerOpacidad(Number(valor) / 100); });
    capa.alCambiar = () => this.actualizar(); this.actualizar();
  }
  actualizar() {
    const { estado, visible, opacidad } = this.capa;
    configurarBotonIcono(this.boton, 'poblacion', estado === 'error' ? 'Reintentar carga de población' : visible ? 'Ocultar densidad de población' : 'Mostrar densidad de población');
    this.boton.disabled = estado === 'cargando'; this.boton.setAttribute('aria-pressed', String(visible && estado === 'lista'));
    this.elemento.setAttribute('aria-busy', String(estado === 'cargando'));
    this.rango.disabled = estado !== 'lista' || !visible; this.rango.value = opacidad * 100; this.rango.setAttribute('aria-valuetext', `${Math.round(opacidad * 100)} %`);
    const error = this.elemento.querySelector('[role="status"]'); error.hidden = estado !== 'error';
    error.textContent = 'No se pudo cargar el censo. Podés seguir construyendo y reintentar con el icono.';
  }
  eliminar() { this.capa.alCambiar = () => {}; this.boton.remove(); this.elemento.remove(); }
}
