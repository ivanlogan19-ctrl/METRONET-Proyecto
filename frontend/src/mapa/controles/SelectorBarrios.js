import PanelDinamico from './PanelDinamico.js';

import { normalizarBarrio } from '../utilidades/ClasificadorZonas.js';

export default class SelectorBarrios {
  constructor(opciones = {}) {
    this.panel = new PanelDinamico({
      id: opciones.id ?? 'metronet-selector-barrios',

      titulo: opciones.titulo ?? 'Seleccionar barrios',

      ancho: opciones.ancho ?? 155,

      posicion: opciones.posicion ?? {
        top: 125,
        right: 8,
      },

      contenedorPadre: opciones.contenedorPadre,

      integrado: opciones.integrado,
    });

    this.barrios = [];

    this.barriosSeleccionados = new Set();

    this.onCambio = opciones.onCambio ?? null;

    this.elemento = null;

    this.menu = null;
  }

  crear(barrios = []) {
    this.barrios = [...barrios];

    this.panel.crear();

    this.elemento = this.panel.elemento;

    this.menu = document.createElement('div');

    this.menu.className = 'metronet-selector-barrios-lista';

    this.panel.agregarElemento(this.menu);

    this.crearEstilos();

    this.actualizarLista();

    return this;
  }

  corregirCodificacion(texto = '') {
    let resultado = String(texto);

    /*
     * Corregimos los caracteres
     * UTF-8 que llegan mal
     * interpretados desde el GeoJSON.
     */

    resultado = resultado
      .replace(/Ã‘/g, 'Ñ')
      .replace(/Ã/g, 'Ñ')
      .replace(/Ã±/g, 'ñ')
      .replace(/Ã‘/g, 'Ñ')
      .replace(/Ã/g, 'Á')
      .replace(/Ã‰/g, 'É')
      .replace(/Ã“/g, 'Ó')
      .replace(/Ãš/g, 'Ú')
      .replace(/Ã/g, 'Í')
      .replace(/Ã¤/g, 'ä')
      .replace(/Ã¶/g, 'ö');

    return resultado;
  }

  crearOpcionBarrio(barrio, texto) {
    const label = document.createElement('label');

    label.className = 'metronet-selector-barrio-opcion';

    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';

    checkbox.value = barrio;

    checkbox.addEventListener('change', () => {
      if (!barrio) {
        this.limpiarSeleccion();

        return;
      }

      this.cambiarSeleccionBarrio(barrio, checkbox.checked);
    });

    const span = document.createElement('span');

    /*
     * Mostramos el nombre corregido.
     */

    span.textContent = this.formatearNombre(this.corregirCodificacion(texto));

    label.appendChild(checkbox);

    label.appendChild(span);

    return label;
  }

  formatearNombre(texto = '') {
    const nombresCompuestos = {
      'CAPURRO BELLA VISTA': 'Capurro, Bella Vista',

      'CASABO PAJAS BLANCAS': 'Casabó, Pajas Blancas',

      'COLON SURESTE ABAYUBA': 'Colón Sureste, Abayubá',

      'LA PALOMA TOMKINSON': 'La Paloma, Tomkinson',

      'MANGA TOLEDO CHICO': 'Manga, Toledo Chico',

      'MAROÑAS PARQUE GUARANI': 'Maroñas, Parque Guaraní',

      'PUNTA RIELES BELLA ITALIA': 'Punta Rieles, Bella Italia',

      'TRES OMBUES PBLO VICTORIA': 'Tres Ombúes, Pueblo Victoria',

      'VILLA GARCIA MANGA RURAL': 'Villa García, Manga Rural',

      'VILLA MUÑOZ RETIRO': 'Villa Muñoz, Retiro',
    };

    const nombreOriginal = String(texto).trim();

    const nombreCompuesto = nombresCompuestos[nombreOriginal.toLocaleUpperCase('es-UY')];

    if (nombreCompuesto) {
      return nombreCompuesto;
    }

    const conectores = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y']);

    const palabras = nombreOriginal.toLocaleLowerCase('es-UY').split(' ');

    return palabras
      .map((palabra, indicePalabra) =>
        palabra
          .split('-')
          .map((segmento, indiceSegmento) => {
            const esPrimeraPalabra = indicePalabra === 0 && indiceSegmento === 0;

            if (!esPrimeraPalabra && conectores.has(segmento)) {
              return segmento;
            }

            return segmento.charAt(0).toLocaleUpperCase('es-UY') + segmento.slice(1);
          })
          .join('-'),
      )
      .join(' ');
  }

  cambiarSeleccionBarrio(barrio, seleccionado) {
    if (seleccionado) {
      this.barriosSeleccionados.add(barrio);
    } else {
      this.barriosSeleccionados.delete(barrio);
    }

    this.actualizarOpcionNinguno();

    this.notificarCambio();

    this.panel.cerrarContenido();
  }

  actualizarOpcionNinguno() {
    if (!this.menu) {
      return;
    }

    const ninguno = this.menu.querySelector('input[value=""]');

    if (!ninguno) {
      return;
    }

    ninguno.checked = this.barriosSeleccionados.size === 0;
  }

  notificarCambio() {
    if (typeof this.onCambio === 'function') {
      this.onCambio(this.obtenerSeleccion());
    }
  }

  obtenerSeleccion() {
    return [...this.barriosSeleccionados];
  }

  seleccionarBarrio(barrio) {
    const encontrado = this.barrios.find(
      (nombre) => normalizarBarrio(nombre) === normalizarBarrio(barrio),
    );

    if (!encontrado) {
      return;
    }

    this.barriosSeleccionados.add(encontrado);

    const checkbox = this.obtenerCheckbox(encontrado);

    if (checkbox) {
      checkbox.checked = true;
    }

    this.actualizarOpcionNinguno();

    this.notificarCambio();

    this.panel.cerrarContenido();
  }

  deseleccionarBarrio(barrio) {
    const encontrado = this.barrios.find(
      (nombre) => normalizarBarrio(nombre) === normalizarBarrio(barrio),
    );

    if (!encontrado) {
      return;
    }

    this.barriosSeleccionados.delete(encontrado);

    const checkbox = this.obtenerCheckbox(encontrado);

    if (checkbox) {
      checkbox.checked = false;
    }

    this.actualizarOpcionNinguno();

    this.notificarCambio();
  }

  obtenerCheckbox(barrio) {
    if (!this.menu) {
      return null;
    }

    const checkboxes = this.menu.querySelectorAll('input[type="checkbox"]');

    return (
      [...checkboxes].find(
        (checkbox) => normalizarBarrio(checkbox.value) === normalizarBarrio(barrio),
      ) ?? null
    );
  }

  limpiarSeleccion() {
    this.barriosSeleccionados.clear();

    if (this.menu) {
      const checkboxes = this.menu.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    }

    this.actualizarOpcionNinguno();

    this.notificarCambio();

    this.panel.cerrarContenido();
  }

  establecerBarrios(barrios = []) {
    this.barrios = [...barrios];

    const barriosDisponibles = new Set(this.barrios.map((barrio) => normalizarBarrio(barrio)));

    const seleccionActual = [...this.barriosSeleccionados];

    this.barriosSeleccionados = new Set(
      seleccionActual.filter((barrio) => barriosDisponibles.has(normalizarBarrio(barrio))),
    );

    this.actualizarLista();
  }

  actualizarLista() {
    if (!this.menu) {
      return;
    }

    this.menu.innerHTML = '';

    const opcionNinguno = this.crearOpcionBarrio('', 'Ninguno');

    this.menu.appendChild(opcionNinguno);

    const barriosOrdenados = [...this.barrios].sort((a, b) =>
      normalizarBarrio(a).localeCompare(normalizarBarrio(b)),
    );

    for (const barrio of barriosOrdenados) {
      const opcion = this.crearOpcionBarrio(barrio, barrio);

      const checkbox = opcion.querySelector('input');

      if (this.barriosSeleccionados.has(barrio)) {
        checkbox.checked = true;
      }

      this.menu.appendChild(opcion);
    }

    this.actualizarOpcionNinguno();
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

  mover(top, right) {
    this.panel.mover(top, right);
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
    if (document.getElementById('metronet-selector-barrios-styles')) {
      return;
    }

    const style = document.createElement('style');

    style.id = 'metronet-selector-barrios-styles';

    style.textContent = `

            .metronet-selector-barrios-lista {

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

                overflow-x:
                    hidden;
            }

            .metronet-selector-barrio-opcion {

                display:
                    flex;

                align-items:
                    center;

                gap:
                    8px;

                padding:
                    8px;

                color:
                    #F8FBFF;

                font-family:
                    Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

                font-size:
                    13px;

                line-height:
                    18px;

                font-weight:
                    500;

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

            .metronet-selector-barrio-opcion:hover {

                background:
                    rgba(
                        53,
                        183,
                        243,
                        0.18
                    );
            }

            .metronet-selector-barrio-opcion:has(input:checked) {

                background:
                    rgba(
                        60,
                        186,
                        239,
                        0.24
                    );

                color:
                    #F8FBFF;
            }

            .metronet-selector-barrio-opcion input {

                width:
                    13px;

                height:
                    13px;

                margin:
                    0;

                flex-shrink:
                    0;

                cursor:
                    pointer;

                accent-color:
                    #49C3F2;
            }

            .metronet-selector-barrios-lista::-webkit-scrollbar {

                width:
                    6px;
            }

            .metronet-selector-barrios-lista::-webkit-scrollbar-thumb {

                background:
                    rgba(155, 200, 255, 0.42);

                border-radius:
                    99px;
            }
        `;

    document.head.appendChild(style);
  }
}
