import Phaser from 'phaser';

import CapaMapaBase from './capas/CapaMapaBase.js';
import CapaBarrios from './capas/CapaBarrios.js';
import CapaZonas from './capas/CapaZonas.js';
import { COLORES_PUNTOS_INTERES } from './capas/CapaPuntosInteres.js';
import CapaPuntosInteres from './capas/CapaPuntosInteres.js';
import CapaIconosBarrios from './capas/CapaIconosBarrios.js';
import CapaRedMetro from './capas/CapaRedMetro.js';

import SelectorZonas from './controles/SelectorZonas.js';
import SelectorBarrios from './controles/SelectorBarrios.js';

import ControlZoom from './controles/ControlZoom.js';
import LeyendaPuntosInteres from './controles/LeyendaPuntosInteres.js';
import EditorRedMetro from './controles/EditorRedMetro.js';
import { eliminarSesiones, obtenerSesionActiva } from '../autenticacion/sesion.js';
import { COLORES_INTERFAZ_MAPA } from './configuracion/ColoresMapa.js';

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
    this.capaRedMetro = null;

    this.selectorZonas = null;
    this.selectorBarrios = null;

    this.controlZoom = null;
    this.leyendaPuntosInteres = null;
    this.editorRedMetro = null;
    this.controlSesion = null;
    this.contenedorInformacionJugador = null;
    this.mensajePuntosInteres = null;
    this.estadoPuntosInteres = { haySeleccion: false, cantidadPuntos: 0 };

    this.contenedorMapa = null;

    this.contenedorControles = null;
    this.manejadorResize = null;
  }

  preload() {
    this.load.json(
      'barriosMontevideo',
      new URL('./datos/barrios_wgs84.geojson', import.meta.url).href,
    );

    this.load.json('puntosInteres', new URL('./datos/puntos-interes.json', import.meta.url).href);
  }

  create() {
    this.contenedorMapa = document.getElementById('metronet-mapa');

    this.contenedorControles = document.getElementById('metronet-panel-controles');

    this.datosBarrios = this.cache.json.get('barriosMontevideo');

    this.datosPuntosInteres = this.cache.json.get('puntosInteres');

    this.crearCapaMapaBase();

    this.crearCapaBarrios();

    this.crearCapaZonas();

    this.crearCapaPuntosInteres();

    this.crearCapaIconosBarrios();

    this.crearCapaRedMetro();

    this.crearControles();

    this.crearLeyendaPuntosInteres();

    this.crearEstadoPuntosInteres();

    this.crearControlZoom();

    this.crearControlSesion();

    this.crearEditorRedMetro();

    this.crearEstilosPanelSobrio();

    this.ajustarMapa();

    this.manejadorResize = () => this.actualizarTamano();
    this.scale.on('resize', this.manejadorResize);

    this.events.once('shutdown', () => {
      this.limpiar();
    });
  }

  update() {}

  crearEstilosPanelSobrio() {
    const id = 'metronet-estilos-panel-sobrio';

    document.getElementById(id)?.remove();

    const estilos = document.createElement('style');
    estilos.id = id;
    estilos.textContent = `
      #metronet-panel-controles .metronet-panel-dinamico,
      #metronet-panel-controles .metronet-leyenda-puntos-interes,
      #metronet-panel-controles .metronet-control-zoom,
      .metronet-punto-interes-panel {
        border: 1px solid var(--border) !important;
        background: var(--panel) !important;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28) !important;
        color: var(--text-primary) !important;
      }
      #metronet-panel-controles .metronet-leyenda-puntos-interes {
        display: block !important;
        flex: 0 0 auto;
        width: 100% !important;
        min-height: 42px;
      }
      #metronet-panel-controles .metronet-leyenda-puntos-interes.metronet-leyenda-abierta {
        min-height: var(--alto-leyenda-abierta);
      }
      #metronet-panel-controles .metronet-panel-encabezado,
      #metronet-panel-controles .metronet-leyenda-encabezado {
        display: flex !important;
        background: var(--panel-elevated) !important;
        color: var(--text-primary) !important;
        font-size: 14px !important;
      }
      #metronet-panel-controles .metronet-panel-encabezado:hover,
      #metronet-panel-controles .metronet-leyenda-encabezado:hover {
        background: var(--info-active) !important;
        color: var(--text-primary) !important;
      }
      #metronet-panel-controles .metronet-panel-contenido,
      #metronet-panel-controles .metronet-leyenda-contenido {
        background: var(--panel) !important;
        border-color: var(--border) !important;
      }
      #metronet-panel-controles .metronet-selector-zona-opcion,
      #metronet-panel-controles .metronet-selector-barrio-opcion,
      #metronet-panel-controles .metronet-leyenda-referencia,
      #metronet-panel-controles .metronet-control-zoom-boton {
        color: var(--text-primary) !important;
        font-size: 14px !important;
      }
      #metronet-panel-controles .metronet-selector-zona-opcion:hover,
      #metronet-panel-controles .metronet-selector-barrio-opcion:hover,
      #metronet-panel-controles .metronet-leyenda-referencia:hover,
      #metronet-panel-controles .metronet-control-zoom-boton:hover {
        background: var(--panel-elevated) !important;
      }
      #metronet-panel-controles input[type="checkbox"] { accent-color: var(--info-active); }
      #metronet-panel-controles .metronet-leyenda-titulo-seccion,
      #metronet-panel-controles .metronet-leyenda-indicador,
      .metronet-punto-interes-titulo,
      .metronet-punto-interes-tipo,
      .metronet-punto-interes-descripcion,
      .metronet-punto-interes-barrio { color: var(--text-primary) !important; }
      #metronet-panel-controles .metronet-leyenda-marcador {
        border-color: var(--border-active) !important;
        background: var(--panel) !important;
      }
      @media (max-width: 900px) {
        #metronet-panel-controles .metronet-leyenda-puntos-interes {
          grid-column: 1 / -1;
        }
      }
    `;
    document.head.appendChild(estilos);
  }

  crearCapaMapaBase() {
    this.capaMapaBase = new CapaMapaBase(this, {
      colorFondo: COLORES_INTERFAZ_MAPA.FONDO,
      colorAgua: COLORES_INTERFAZ_MAPA.FONDO,
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

      onCambioSeleccion: (estado) => this.actualizarEstadoPuntosInteres(estado),
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

  crearCapaRedMetro() {
    this.capaRedMetro = new CapaRedMetro(this, {
      capaBarrios: this.capaBarrios,
    });
    this.capaRedMetro.crear();
  }

  crearEditorRedMetro() {
    if (!this.contenedorControles || !this.capaRedMetro) return;
    this.editorRedMetro = new EditorRedMetro(this, {
      contenedorPadre: this.contenedorControles,
      capaRedMetro: this.capaRedMetro,
    });
    this.editorRedMetro.crear();
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

      contenedorPadre: this.contenedorControles,

      integrado: true,
    });

    this.controlZoom.crear();
  }

  crearControlSesion() {
    const controlSesion = document.getElementById('metronet-control-sesion');
    const controlSimulacion = document.querySelector('.metronet-control-simulacion');
    const contenedorInformacionJugador = document.getElementById('metronet-informacion-jugador');

    if (!controlSesion || !this.contenedorControles) {
      return;
    }

    this.controlSesion = controlSesion;
    this.contenedorInformacionJugador = contenedorInformacionJugador;

    if (controlSimulacion) {
      controlSimulacion.href = obtenerSesionActiva()
        ? '/simulacion.html'
        : '/login.html?destino=%2Fsimulacion.html';
    }

    this.controlSesion.addEventListener('click', async () => {
      await this.cerrarSesion();
    });

    if (this.contenedorInformacionJugador) {
      this.contenedorControles.appendChild(this.contenedorInformacionJugador);
    }

    this.contenedorControles.appendChild(this.controlSesion);
  }

  async cerrarSesion() {
    if (!window.confirm('¿Querés cerrar la sesión actual?')) {
      return;
    }

    const sesion = obtenerSesionActiva();

    if (sesion) {
      try {
        const ruta = sesion.usuario.rol === 'ADMIN' ? '/auth/logout/admin' : '/auth/logout';
        await fetch(`${window.location.protocol}//${window.location.hostname}:8080${ruta}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sesion.token}` },
        });
      } catch {
        // La sesión local se elimina aunque el servicio ya no esté disponible.
      }
    }

    eliminarSesiones();
    window.location.assign('/login.html');
  }

  crearLeyendaPuntosInteres() {
    const convertirColor = (color) => `#${color.toString(16).padStart(6, '0')}`;

    this.leyendaPuntosInteres = new LeyendaPuntosInteres({
      contenedorPadre: this.contenedorControles,

      integrado: true,

      referencias: [
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.PATRIMONIO),
          titulo: 'Patrimonio e historia',
          descripcion: 'Museos, monumentos, edificios históricos y miradores.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.NATURALEZA),
          titulo: 'Espacios verdes',
          descripcion: 'Plazas, parques, jardines y áreas verdes.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.CULTURA),
          titulo: 'Cultura y recreación',
          descripcion: 'Teatros, centros culturales y bodegas.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.MOVILIDAD),
          titulo: 'Movilidad y deporte',
          descripcion: 'Terminales, estaciones, estadios e hipódromos.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.SALUD),
          titulo: 'Salud',
          descripcion: 'Hospitales y centros de atención.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.EDUCACION),
          titulo: 'Educación',
          descripcion: 'Universidades, facultades y bibliotecas.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.COMERCIO),
          titulo: 'Comercio y gastronomía',
          descripcion: 'Mercados, ferias y áreas comerciales.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.COSTA),
          titulo: 'Costa y agua',
          descripcion: 'Playas, ramblas, puertos y lagos.',
        },
        {
          color: convertirColor(COLORES_PUNTOS_INTERES.OTROS),
          titulo: 'Otros puntos de interés',
          descripcion: 'Lugares sin una categoría específica.',
        },
      ],
    });

    this.leyendaPuntosInteres.crear();
  }

  crearEstadoPuntosInteres() {
    if (!this.contenedorControles) {
      return;
    }

    this.mensajePuntosInteres = document.createElement('p');
    this.mensajePuntosInteres.className = 'metronet-estado-puntos';
    this.mensajePuntosInteres.setAttribute('role', 'status');
    this.mensajePuntosInteres.setAttribute('aria-live', 'polite');
    this.contenedorControles.appendChild(this.mensajePuntosInteres);
    this.actualizarEstadoPuntosInteres(this.estadoPuntosInteres);
  }

  actualizarEstadoPuntosInteres(estado) {
    this.estadoPuntosInteres = estado ?? { haySeleccion: false, cantidadPuntos: 0 };

    if (!this.mensajePuntosInteres) {
      return;
    }

    const sinPuntos = this.estadoPuntosInteres.haySeleccion && this.estadoPuntosInteres.cantidadPuntos === 0;
    this.mensajePuntosInteres.hidden = !sinPuntos;
    this.mensajePuntosInteres.textContent = sinPuntos
      ? 'La selección no tiene puntos de interés registrados.'
      : '';
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

      contenedorPadre: this.contenedorControles,

      integrado: true,

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

      contenedorPadre: this.contenedorControles,

      integrado: true,

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

  ajustarMapa() {
    if (!this.capaBarrios) {
      return;
    }

    this.capaBarrios.ajustarMapa(this.scale.width, this.scale.height);

    if (this.capaPuntosInteres) {
      this.capaPuntosInteres.dibujar();
    }

    if (this.capaIconosBarrios) {
      this.capaIconosBarrios.dibujar();
    }

    this.capaRedMetro?.actualizarTamano();

    if (this.controlZoom) {
      this.controlZoom.actualizar();
    }
  }

  actualizarTamano() {
    if (this.capaMapaBase) {
      this.capaMapaBase.actualizar();
    }

    this.ajustarMapa();

  }

  limpiar() {
    this.scale.off('resize', this.manejadorResize);
    this.manejadorResize = null;
    document.getElementById('metronet-estilos-panel-sobrio')?.remove();
    this.editorRedMetro?.eliminar();
    this.editorRedMetro = null;

    this.capaRedMetro?.eliminar();
    this.capaRedMetro = null;

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

    if (this.leyendaPuntosInteres) {
      this.leyendaPuntosInteres.eliminar();

      this.leyendaPuntosInteres = null;
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

    this.contenedorMapa = null;

    this.contenedorControles = null;
  }
}
