import { prepararMenuLineas } from './MenuLineasConfiguracion.js';

// Selecciona la línea existente; la edición continúa en los controles habituales.
export default class SelectorLineasEditor {
  constructor(contenedor, alSeleccionar) {
    this.elemento = document.createElement('div');
    this.elemento.className = 'metronet-selector-lineas-editor';
    this.acceso = document.createElement('button');
    this.acceso.type = 'button'; this.acceso.textContent = 'Línea a configurar';
    this.acceso.setAttribute('aria-expanded', 'false');
    this.panel = document.createElement('div'); this.panel.setAttribute('popover', 'auto');
    this.panel.setAttribute('role', 'group'); this.panel.setAttribute('aria-label', 'Líneas a configurar');
    this.elemento.append(this.acceso, this.panel); contenedor.append(this.elemento);
    this.alSeleccionar = alSeleccionar;
    this.acceso.addEventListener('click', () => {
      this.panel.togglePopover();
      this.acceso.setAttribute('aria-expanded', String(this.panel.matches(':popover-open')));
      if (this.panel.matches(':popover-open')) this.menu.posicionar();
    });
    this.panel.addEventListener('toggle', () => this.acceso.setAttribute('aria-expanded', String(this.panel.matches(':popover-open'))));
    this.panel.addEventListener('keydown', evento => {
      if (evento.key === 'Escape') { this.panel.hidePopover(); this.acceso.focus(); evento.stopPropagation(); }
    });
    this.observador = new ResizeObserver(() => {
      if (!this.elemento.isConnected) { this.observador.disconnect(); return; }
      if (this.panel.matches(':popover-open')) this.menu.posicionar();
    });
    this.observador.observe(document.documentElement);
  }
  actualizar(diseno, seleccion) {
    this.acceso.disabled = !diseno?.lineas?.length;
    this.panel.replaceChildren();
    const botones = (diseno?.lineas ?? []).map(linea => {
      const boton = document.createElement('button'); boton.type = 'button';
      boton.dataset.nombreLinea = linea.nombre; boton.textContent = linea.nombre;
      boton.setAttribute('aria-pressed', String(linea.nombre === seleccion));
      boton.addEventListener('click', () => {
        this.panel.hidePopover(); this.acceso.setAttribute('aria-expanded', 'false');
        this.alSeleccionar(linea.nombre); this.acceso.focus({ preventScroll:true });
      });
      this.panel.append(boton); return boton;
    });
    this.menu = prepararMenuLineas(this.panel, botones, diseno ?? {}, this.acceso);
  }
  eliminar() { this.observador.disconnect(); this.elemento.remove(); }
}
