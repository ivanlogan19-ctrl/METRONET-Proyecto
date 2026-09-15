import PanelDinamico from './PanelDinamico.js';

import { ZONAS, quitarTildes } from '../utilidades/ClasificadorZonas.js';

export default class SelectorZonas {
  constructor(opciones = {}) {
    this.panel = new PanelDinamico({
      id: opciones.id ?? 'metronet-selector-zonas',

      titulo: opciones.titulo ?? 'ZONAS',

      ancho: opciones.ancho ?? 230,

      posicion: opciones.posicion ?? {
        top: 24,
        left: 24,
      },
    });

    this.zonasSeleccionadas = new Set();

    this.onCambio = opciones.onCambio ?? null;

    this.elemento = null;

    this.menu = null;
  }

  crear() {
    this.panel.crear();

    this.elemento = this.panel.elemento;

    this.menu = document.createElement('div');

    this.menu.className = 'metronet-selector-zonas-lista';

    for (const zona of ZONAS) {
      const opcion = this.crearOpcionZona(zona);

      this.menu.appendChild(opcion);
    }

    this.panel.agregarElemento(this.menu);

    this.crearEstilos();

    return this;
  }

  crearOpcionZona(zona) {
    const label = document.createElement('label');

    label.className = 'metronet-selector-zona-opcion';

    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';

    checkbox.value = zona;

    checkbox.addEventListener('change', () => {
      this.cambiarSeleccionZona(zona, checkbox.checked);
    });

    const texto = document.createElement('span');

    texto.textContent = this.formatearNombre(quitarTildes(zona));

    label.appendChild(checkbox);

    label.appendChild(texto);

    return label;
  }

  formatearNombre(texto = '') {
    return String(texto)
      .toLocaleLowerCase('es-UY')
      .replace(
        /(^|[\s-])([a-záéíóúüñ])/giu,
        (coincidencia, prefijo, letra) => `${prefijo}${letra.toLocaleUpperCase('es-UY')}`,
      );
  }

  cambiarSeleccionZona(zona, seleccionada) {
    if (seleccionada) {
      this.zonasSeleccionadas.add(zona);
    } else {
      this.zonasSeleccionadas.delete(zona);
    }

    this.notificarCambio();

    this.panel.cerrarContenido();
  }

  notificarCambio() {
    if (typeof this.onCambio === 'function') {
      this.onCambio(this.obtenerSeleccion());
    }
  }

  obtenerSeleccion() {
    return [...this.zonasSeleccionadas];
  }

  seleccionarZona(zona) {
    const checkbox = this.obtenerCheckbox(zona);

    if (!checkbox) {
      return;
    }

    checkbox.checked = true;

    this.zonasSeleccionadas.add(zona);

    this.notificarCambio();
  }

  deseleccionarZona(zona) {
    const checkbox = this.obtenerCheckbox(zona);

    if (!checkbox) {
      return;
    }

    checkbox.checked = false;

    this.zonasSeleccionadas.delete(zona);

    this.notificarCambio();
  }

  obtenerCheckbox(zona) {
    if (!this.menu) {
      return null;
    }

    const checkboxes = this.menu.querySelectorAll('input[type="checkbox"]');

    return [...checkboxes].find((checkbox) => checkbox.value === zona) ?? null;
  }

  limpiarSeleccion() {
    this.zonasSeleccionadas.clear();

    if (this.menu) {
      const checkboxes = this.menu.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    }

    this.notificarCambio();
  }

  mostrar() {
    this.panel.mostrar();
  }

  ocultar() {
    this.panel.ocultar();
  }

  alternar() {
    this.panel.alternar();
  }

  mover(top, left) {
    this.panel.mover(top, left);
  }

  cambiarAncho(ancho) {
    this.panel.cambiarAncho(ancho);
  }

  eliminar() {
    this.panel.eliminar();

    this.elemento = null;

    this.menu = null;
  }

  crearEstilos() {
    if (document.getElementById('metronet-selector-zonas-styles')) {
      return;
    }

    const style = document.createElement('style');

    style.id = 'metronet-selector-zonas-styles';

    style.textContent = `

            .metronet-selector-zonas-lista {

                display:
                    flex;

                flex-direction:
                    column;

                gap:
                    2px;

                max-height:
                    250px;

                overflow-y:
                    auto;
            }

            .metronet-selector-zona-opcion {

                display:
                    flex;

                align-items:
                    center;

                gap:
                    8px;

                padding:
                    8px;

                color:
                    #FFFFFF;

                font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;

                font-size:
                    13px;

                font-weight:
                    500;

                line-height:
                    18px;

                border-radius:
                    8px;

                transition:
                    background 0.14s ease,
                    color 0.14s ease;

                cursor:
                    pointer;

                user-select:
                    none;
            }

            .metronet-selector-zona-opcion:hover {

                background:
                    rgba(
                        53,
                        183,
                        243,
                        0.18
                    );
            }

            .metronet-selector-zona-opcion:has(input:checked) {

                background:
                    rgba(
                        60,
                        186,
                        239,
                        0.24
                    );
            }

            .metronet-selector-zona-opcion input {

                width:
                    16px;

                height:
                    16px;

                margin:
                    0;

                cursor:
                    pointer;

                accent-color:
                    #49C3F2;
            }

            .metronet-selector-zonas-lista::-webkit-scrollbar {

                width:
                    6px;
            }

            .metronet-selector-zonas-lista::-webkit-scrollbar-thumb {

                background:
                    rgba(141, 215, 247, 0.42);

                border-radius:
                    99px;
            }
        `;

    document.head.appendChild(style);
  }
}
