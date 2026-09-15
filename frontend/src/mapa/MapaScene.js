import Phaser from 'phaser';

import CapaMapaBase from './capas/CapaMapaBase.js';
import CapaBarrios from './capas/CapaBarrios.js';
import CapaZonas from './capas/CapaZonas.js';
import CapaPuntosInteres from './capas/CapaPuntosInteres.js';
import CapaIconosBarrios from './capas/CapaIconosBarrios.js';

import SelectorZonas from './controles/SelectorZonas.js';
import SelectorBarrios from './controles/SelectorBarrios.js';

import ControlZoom from './controles/ControlZoom.js';

import { obtenerZona } from './utilidades/ClasificadorZonas.js';

export default class MapaScene extends Phaser.Scene {
  constructor() {
    super({
      key: 'MapaScene',
    });

    this.datosBarrios = null;
    this.datosPuntosInteres = null;

    this.capaMapaBase = null;
    this.capaBarrios = null;
    this.capaZonas = null;
    this.capaPuntosInteres = null;
    this.capaIconosBarrios = null;

    this.selectorZonas = null;
    this.selectorBarrios = null;

    this.controlZoom = null;

    this.logo = null;
  }

  preload() {
    this.load.json(
      'barriosMontevideo',
      new URL('./datos/barrios_wgs84.geojson', import.meta.url).href,
    );

    this.load.json('puntosInteres', new URL('./datos/puntos-interes.json', import.meta.url).href);
  }

  create() {
    this.datosBarrios = this.cache.json.get('barriosMontevideo');

    this.datosPuntosInteres = this.cache.json.get('puntosInteres');

    this.crearCapaMapaBase();

    this.crearCapaBarrios();

    this.crearCapaZonas();

    this.crearCapaPuntosInteres();

    this.crearCapaIconosBarrios();

    this.crearControles();

    this.crearControlZoom();

    this.crearLogo();

    this.ajustarMapa();

    this.scale.on('resize', () => {
      this.actualizarTamano();
    });

    this.events.once('shutdown', () => {
      this.limpiar();
    });
  }

  update() {}

  crearCapaMapaBase() {
    this.capaMapaBase = new CapaMapaBase(this, {
      colorFondo: 0x000000,

      colorAgua: 0x000000,
    });

    this.capaMapaBase.crear();
  }

  crearCapaBarrios() {
    this.capaBarrios = new CapaBarrios(this, {
      datos: this.datosBarrios,
    });

    this.capaBarrios.dibujar();
  }

  crearCapaZonas() {
    this.capaZonas = new CapaZonas(this, {
      capaBarrios: this.capaBarrios,
    });
  }

  crearCapaPuntosInteres() {
    this.capaPuntosInteres = new CapaPuntosInteres(this, {
      datos: this.datosPuntosInteres,

      capaBarrios: this.capaBarrios,
    });

    this.capaPuntosInteres.establecerDatos(this.datosPuntosInteres);

    /*
     * Al iniciar el mapa no hay
     * ninguna zona ni barrio seleccionado.
     *
     * Por seguridad, forzamos ambas
     * selecciones a estar vacías.
     */
    this.capaPuntosInteres.establecerZonasSeleccionadas([]);

    this.capaPuntosInteres.establecerBarriosSeleccionados([]);
  }

  crearCapaIconosBarrios() {
    this.capaIconosBarrios = new CapaIconosBarrios(this, {
      capaBarrios: this.capaBarrios,
    });

    this.capaIconosBarrios.establecerZonasSeleccionadas([]);

    this.capaIconosBarrios.establecerBarriosSeleccionados([]);

    this.capaIconosBarrios.dibujar();
  }

  crearControles() {
    this.crearSelectorZonas();

    this.crearSelectorBarrios();
  }

  crearControlZoom() {
    this.controlZoom = new ControlZoom(this, {
      capaBarrios: this.capaBarrios,

      factorZoom: 1.5,

      zoomMinimo: 1,

      zoomMaximo: 8,
    });

    this.controlZoom.crear();
  }

  crearSelectorZonas() {
    this.selectorZonas = new SelectorZonas({
      id: 'metronet-selector-zonas',

      titulo: 'Seleccionar zonas',

      ancho: 180,

      posicion: {
        top: 55,

        right: 196,
      },

      onCambio: (zonas) => {
        /*
         * Nos aseguramos de que
         * siempre trabajemos con
         * un arreglo.
         */
        const zonasSeleccionadas = Array.isArray(zonas) ? zonas : [];

        /*
         * Actualizamos el mapa
         * de zonas.
         */
        this.capaZonas.establecerZonasSeleccionadas(zonasSeleccionadas);

        /*
         * Actualizamos la lista
         * de barrios.
         */
        this.actualizarBarriosSegunZonas(zonasSeleccionadas);

        /*
         * IMPORTANTE:
         * actualizamos los puntos
         * de interés.
         */
        if (this.capaPuntosInteres) {
          this.capaPuntosInteres.establecerZonasSeleccionadas(zonasSeleccionadas);

          /*
           * Cuando seleccionamos
           * una zona, no queremos
           * conservar una selección
           * anterior de barrios.
           */
          this.capaPuntosInteres.establecerBarriosSeleccionados([]);
        }

        /*
         * Actualizamos los íconos
         * representativos de barrios.
         */
        if (this.capaIconosBarrios) {
          this.capaIconosBarrios.establecerZonasSeleccionadas(zonasSeleccionadas);

          this.capaIconosBarrios.establecerBarriosSeleccionados([]);
        }

        /*
         * Zoom automático de la zona.
         */
        if (this.controlZoom) {
          if (zonasSeleccionadas.length > 0) {
            this.controlZoom.enfocarZonas(zonasSeleccionadas);
          } else {
            this.controlZoom.restaurar();
          }
        }
      },
    });

    this.selectorZonas.crear();
  }

  crearSelectorBarrios() {
    const barrios = this.capaBarrios.obtenerNombres();

    this.selectorBarrios = new SelectorBarrios({
      id: 'metronet-selector-barrios',

      titulo: 'Seleccionar barrios',

      ancho: 180,

      posicion: {
        top: 55,

        right: 8,
      },

      onCambio: (barrios) => {
        const barriosSeleccionados = Array.isArray(barrios) ? barrios : [];

        /*
         * Actualizamos el
         * resaltado de barrios.
         */
        this.capaBarrios.establecerBarriosSeleccionados(barriosSeleccionados);

        /*
         * Actualizamos los
         * puntos de interés.
         */
        if (this.capaPuntosInteres) {
          this.capaPuntosInteres.establecerBarriosSeleccionados(barriosSeleccionados);
        }

        /*
         * Actualizamos los
         * íconos de barrios.
         */
        if (this.capaIconosBarrios) {
          this.capaIconosBarrios.establecerBarriosSeleccionados(barriosSeleccionados);
        }

        /*
         * Zoom automático.
         */
        if (this.controlZoom) {
          if (barriosSeleccionados.length > 0) {
            this.controlZoom.enfocarBarrios(barriosSeleccionados);
          } else {
            this.controlZoom.restaurar();
          }
        }
      },
    });

    this.selectorBarrios.crear(barrios);
  }

  actualizarBarriosSegunZonas(zonas) {
    if (!this.selectorBarrios || !this.capaBarrios) {
      return;
    }

    if (!Array.isArray(zonas) || zonas.length === 0) {
      const todosLosBarrios = this.capaBarrios.obtenerNombres();

      this.selectorBarrios.establecerBarrios(todosLosBarrios);

      return;
    }

    const barrios = this.capaBarrios.obtenerBarrios();

    const barriosFiltrados = barrios
      .filter((barrio) => {
        const zonaBarrio = obtenerZona(barrio.nombre);

        return zonas.includes(zonaBarrio);
      })
      .map((barrio) => barrio.nombre);

    this.selectorBarrios.establecerBarrios(barriosFiltrados);
  }

  crearLogo() {
    this.logo = document.createElement('div');

    const imagenLogo = document.createElement('img');

    imagenLogo.src = '/assets/logoMETRONET.png';

    imagenLogo.alt = 'METRONET';

    Object.assign(this.logo.style, {
      position: 'fixed',

      top: '10px',

      left: '50%',

      transform: 'translateX(-50%)',

      width: 'clamp(92px, 18vw, 170px)',

      aspectRatio: '1',

      padding: 'clamp(5px, 1vw, 10px)',

      boxSizing: 'border-box',

      background: '#061D32',

      border: '1px solid rgba(53, 183, 243, 0.55)',

      borderRadius: 'clamp(10px, 2vw, 18px)',

      boxShadow: '0 8px 22px rgba(6, 29, 50, 0.28)',

      zIndex: '2000',

      pointerEvents: 'none',

      userSelect: 'none',

      overflow: 'hidden',

      isolation: 'isolate',
    });

    Object.assign(imagenLogo.style, {
      width: '100%',

      height: '100%',

      objectFit: 'contain',

      display: 'block',

      mixBlendMode: 'screen',
    });

    this.logo.appendChild(imagenLogo);

    document.body.appendChild(this.logo);

    this.ajustarTamanoLogo();
  }

  ajustarTamanoLogo() {
    if (!this.logo) {
      return;
    }

    const pantallaAngosta = this.scale.width < 760;

    Object.assign(this.logo.style, {
      top: pantallaAngosta ? '8px' : '10px',

      left: pantallaAngosta ? '8px' : '50%',

      transform: pantallaAngosta ? 'none' : 'translateX(-50%)',

      width: pantallaAngosta ? '62px' : 'clamp(88px, 10vw, 130px)',
    });
  }

  actualizarVisibilidadLogo(mostrar) {
    if (!this.logo) {
      return;
    }

    this.logo.style.opacity = mostrar ? '1' : '0';

    this.logo.style.visibility = mostrar ? 'visible' : 'hidden';
  }

  ajustarMapa() {
    if (!this.capaBarrios) {
      return;
    }

    this.capaBarrios.ajustarMapa(this.scale.width, this.scale.height);

    if (this.capaPuntosInteres) {
      this.capaPuntosInteres.actualizar();
    }

    if (this.capaIconosBarrios) {
      this.capaIconosBarrios.dibujar();
    }

    if (this.controlZoom) {
      this.controlZoom.actualizar();
    }
  }

  actualizarTamano() {
    if (this.capaMapaBase) {
      this.capaMapaBase.actualizar();
    }

    this.ajustarMapa();

    this.ajustarTamanoLogo();
  }

  limpiar() {
    if (this.selectorZonas) {
      this.selectorZonas.eliminar();

      this.selectorZonas = null;
    }

    if (this.selectorBarrios) {
      this.selectorBarrios.eliminar();

      this.selectorBarrios = null;
    }

    if (this.controlZoom) {
      this.controlZoom.eliminar();

      this.controlZoom = null;
    }

    if (this.capaIconosBarrios) {
      this.capaIconosBarrios.eliminar();

      this.capaIconosBarrios = null;
    }

    if (this.capaPuntosInteres) {
      this.capaPuntosInteres.eliminar();

      this.capaPuntosInteres = null;
    }

    if (this.capaZonas) {
      this.capaZonas.eliminar();

      this.capaZonas = null;
    }

    if (this.capaBarrios) {
      this.capaBarrios.eliminar();

      this.capaBarrios = null;
    }

    if (this.capaMapaBase) {
      this.capaMapaBase.eliminar();

      this.capaMapaBase = null;
    }

    if (this.logo) {
      this.logo.remove();

      this.logo = null;
    }
  }
}
