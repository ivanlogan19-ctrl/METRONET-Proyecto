import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import { confirmarSistema } from '../componentes/DialogoSistema.js';
import Phaser from 'phaser';
import { observarTamanoMapa } from './ObservarTamanoMapa.js';

import CapaMapaBase from './capas/CapaMapaBase.js';
import CapaBarrios from './capas/CapaBarrios.js';
import CapaZonas from './capas/CapaZonas.js';
import CapaPuntosInteres from './capas/CapaPuntosInteres.js';
import CapaIconosBarrios from './capas/CapaIconosBarrios.js';
import CapaRedMetro from './capas/CapaRedMetro.js';
import CapaTerritorial from './capas/CapaTerritorial.js';
import TerritorioMapa from './utilidades/TerritorioMapa.js';


import ControlZoom from './controles/ControlZoom.js';
import ReferenciasGeograficas from './controles/ReferenciasGeograficas.js';
import PanelSeleccionGeografica from './controles/PanelSeleccionGeografica.js';
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
    this.panelPuntosInteres = null;
    this.panelSeleccionGeografica = null;
    this.editorRedMetro = null;
    this.controlSesion = null;
    this.contenedorInformacionJugador = null;
    this.contenedorMapa = null;

    this.contenedorControles = null;
    this.contenedorSelectoresMapa = null;
    this.contenedorControlesMapa = null;
    this.contenedorPuntosInteres = null;
    this.contenedorEditorRed = null;
    this.contenedorConsigna = null;
    this.contenedorPieEditor = null;
    this.manejadorResize = null;
    this.manejadorAlternarPanel = null;
    this.consultaPanelMovil = null;
    this.manejadorCambioPanelMovil = null;
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
    this.prepararContenedoresPanel();
    this.configurarPanelMovil();

    this.datosBarrios = this.cache.json.get('barriosMontevideo');

    this.datosPuntosInteres = this.cache.json.get('puntosInteres');

    this.crearCapaMapaBase();

    this.crearCapaBarrios();

    this.crearCapaZonas();

    this.crearCapaPuntosInteres();

    this.territorioMapa = new TerritorioMapa(this.capaBarrios);
    this.capaTerritorial = new CapaTerritorial(this, {
      territorio: this.territorioMapa, capaBarrios: this.capaBarrios,
    });
    this.crearCapaIconosBarrios();

    this.crearCapaRedMetro();

    this.crearPanelPuntosInteres();

    this.crearPanelSeleccionGeografica();

    this.crearControlZoom();

    this.crearControlSesion();

    this.crearEditorRedMetro();

    this.ajustarMapa();

    this.liberarTamano = observarTamanoMapa(this, this.contenedorMapa, () => this.actualizarTamano());
    this.contenedorMapa.querySelector('.metronet-mapa-cargando')?.remove();

    const liberar = () => {
      this.events.off('shutdown', liberar);
      this.events.off('destroy', liberar);
      this.limpiar();
    };
    this.events.once('shutdown', liberar);
    this.events.once('destroy', liberar);
  }

  update() {}

  prepararContenedoresPanel() {
    const areaMapa = this.contenedorMapa?.closest('.metronet-area-mapa');
    this.contenedorSelectoresMapa = areaMapa?.querySelector('[data-contenedor-selectores-mapa]') ?? null;
    this.contenedorControlesMapa = this.contenedorControles?.querySelector('[data-contenedor-controles-mapa]') ?? null;
    this.contenedorPuntosInteres = areaMapa?.querySelector('[data-contenedor-puntos-interes]') ?? null;
    this.contenedorEditorRed = this.contenedorControles?.querySelector('[data-contenedor-editor-red]') ?? null;
    this.contenedorConsigna = document.querySelector('[data-contenedor-consigna]') ?? null;
    this.contenedorPieEditor = this.contenedorControles?.querySelector('[data-panel-editor-pie]') ?? null;
  }

  configurarPanelMovil() {
    const boton = this.contenedorControles?.querySelector('[data-panel-edicion-toggle]');
    if (!boton || !this.contenedorControles) return;
    boton.classList.add('metronet-control-panel');
    this.consultaPanelMovil = window.matchMedia('(max-width: 620px)');
    const actualizar = (colapsado) => {
      const debeColapsar = this.consultaPanelMovil.matches && colapsado;
      boton.hidden = !this.consultaPanelMovil.matches;
      this.contenedorControles.classList.toggle('metronet-panel-colapsado', debeColapsar);
      boton.setAttribute('aria-expanded', String(!debeColapsar));
      configurarBotonIcono(boton, debeColapsar ? 'desplegar' : 'plegar', debeColapsar ? 'Mostrar panel' : 'Ocultar panel');
    };
    actualizar(true);
    this.manejadorAlternarPanel = () => actualizar(!this.contenedorControles.classList.contains('metronet-panel-colapsado'));
    this.manejadorCambioPanelMovil = (evento) => actualizar(evento.matches);
    boton.addEventListener('click', this.manejadorAlternarPanel);
    this.consultaPanelMovil.addEventListener('change', this.manejadorCambioPanelMovil);
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
      categoriasIniciales: [],
      mostrarObjetivosSiempre: false,
      // El gesto de construcción tiene prioridad; la búsqueda explícita sigue disponible.
      permitirSeleccion: puntero => {
        if (this.editorRedMetro?.modo && this.editorRedMetro.modo !== 'normal') return false;
        const capa = this.capaRedMetro, punto = capa?.convertirPuntero(puntero)?.punto;
        return !punto || !capa.diseno || !(capa.obtenerEstacionCercana(punto) || capa.obtenerUnidadCercana(punto) || capa.obtenerTramoCercano(punto));
      },
      datos: this.datosPuntosInteres,

      capaBarrios: this.capaBarrios,

      onCambioSeleccion: () => {},

      onActualizarPuntos: (resumen) => {
        this.panelReferencias?.actualizar(resumen.categoriasVisibles);
        this.panelPuntosInteres?.actualizar(resumen);
        this.editorRedMetro?.actualizarReferenciaAyuda(resumen.puntoSeleccionado);
        this.panelSeleccionGeografica?.actualizar(resumen);
      },

      onSeleccionarPunto: () => {
        this.panelSeleccionGeografica?.ocultar();
        this.panelPuntosInteres?.actualizar(this.capaPuntosInteres?.obtenerResumenPuntos());
      },
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

  crearPanelPuntosInteres() {
    this.referenciasGeograficas = new ReferenciasGeograficas(this, {
      contenedor: this.contenedorMapa.closest('.metronet-area-mapa').querySelector('[data-contenedor-referencias]'),
      mapa: this.contenedorMapa,
      alSeleccionarGeografia: (tipo, nombres) => this.actualizarInformacionSeleccionGeografica(tipo, nombres),
      alSeleccionarPunto: punto => this.localizarReferencia(punto, { desdeBusqueda: true }),
    });
    this.panelReferencias = this.referenciasGeograficas.panel;
    this.panelPuntosInteres = this.referenciasGeograficas.busqueda;
    this.selectorBarrios = this.referenciasGeograficas.barrios;
    this.selectorZonas = this.referenciasGeograficas.zonas;
  }

  localizarReferencia(referencia, opciones = {}) {
    this.panelSeleccionGeografica?.ocultar();
    return this.capaPuntosInteres?.seleccionarPunto(referencia, {
      ...opciones,
      enfocar: true,
      mostrarInformacion: true,
    }) ?? null;
  }

  crearPanelSeleccionGeografica() {
    if (!this.contenedorMapa) return;
    this.panelSeleccionGeografica = new PanelSeleccionGeografica({
      contenedorPadre: this.contenedorMapa,
    });
    this.panelSeleccionGeografica.crear();
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
      editable: true,
      capaBarrios: this.capaBarrios,
    });
    this.capaRedMetro.crear();
  }

  crearEditorRedMetro() {
    if (!this.contenedorEditorRed || !this.capaRedMetro) return;
    this.editorRedMetro = new EditorRedMetro(this, {
      contenedorPadre: this.contenedorEditorRed,
      contenedorConsigna: this.contenedorConsigna,
      capaRedMetro: this.capaRedMetro,
    });
    this.editorRedMetro.crear();
    const seleccionarElemento = this.capaRedMetro.alSeleccionar;
    this.capaRedMetro.alSeleccionar = (elemento) => {
      this.capaPuntosInteres?.ocultarInformacion();
      this.panelSeleccionGeografica?.ocultar();
      seleccionarElemento(elemento);
    };
  }

  crearControlZoom() {
    const contenedorHerramientas = this.panelReferencias?.herramientas;
    this.controlZoom = new ControlZoom(this, {
      capaBarrios: this.capaBarrios,

      factorZoom: 1.5,

      zoomMinimo: 1,

      zoomMaximo: 8,

      obtenerLimitesAjuste: () => this.obtenerLimitesRed(),

      permitirPan: () => true,

      permitirArrastre: () => true,

      permitirArrastrePrimario: () => true,

      etiquetaAjustar: 'Ajustar red',

      mostrarAyudaNavegacion: false,

      contenedorPadre: contenedorHerramientas ?? this.contenedorMapa,

      integrado: Boolean(contenedorHerramientas),

      ancladoAlMapa: !contenedorHerramientas,

      mostrarControles: true,
    });

    this.controlZoom.crear();
  }

  obtenerLimitesRed() {
    return this.capaRedMetro?.obtenerLimitesEstaciones?.() ?? null;
  }

  crearControlSesion() {
    const controlSesion = document.getElementById('metronet-control-sesion');
    const controlSimulacion = document.querySelector('.metronet-control-simulacion');
    const contenedorInformacionJugador = document.getElementById('metronet-informacion-jugador');

    if (!controlSesion || !this.contenedorPieEditor) {
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
      this.contenedorPieEditor.appendChild(this.contenedorInformacionJugador);
    }

    this.contenedorPieEditor.appendChild(this.controlSesion);
  }

  async cerrarSesion() {
    if (!await confirmarSistema('¿Querés cerrar la sesión actual?')) {
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

  actualizarInformacionSeleccionGeografica(tipo, nombres) {
    const seleccion = Array.isArray(nombres) ? nombres.filter(Boolean) : [];
    const zonasSeleccionadas = this.capaZonas?.obtenerZonasSeleccionadas?.() ?? [];
    if (!seleccion.length) {
      if (tipo === 'barrio' && zonasSeleccionadas.length) {
        this.actualizarInformacionSeleccionGeografica('zona', zonasSeleccionadas);
      } else {
        this.panelSeleccionGeografica?.ocultar();
      }
      return;
    }
    this.capaPuntosInteres?.ocultarInformacion();
    this.panelSeleccionGeografica?.mostrar({
      tipo,
      nombres: seleccion,
      resumen: this.capaPuntosInteres?.obtenerResumenPuntos(),
    });
  }

  ajustarMapa({ actualizarControlZoom = true } = {}) {
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

    this.capaTerritorial?.dibujar();
    this.capaRedMetro?.actualizarTamano();

    if (actualizarControlZoom && this.controlZoom) {
      this.controlZoom.actualizar();
    }
  }

  actualizarTamano() {
    const vistaAnterior = this.controlZoom?.capturarVista();

    if (this.capaMapaBase) {
      this.capaMapaBase.actualizar();
    }

    this.ajustarMapa({ actualizarControlZoom: false });

    this.controlZoom?.restaurarVistaTrasRedimension(vistaAnterior, this.obtenerLimitesRed());

  }

  limpiar() {
    this.liberarTamano?.();
    this.liberarTamano = null;
    const botonAlternarPanel = this.contenedorControles?.querySelector('[data-panel-edicion-toggle]');
    botonAlternarPanel?.removeEventListener('click', this.manejadorAlternarPanel);
    this.manejadorAlternarPanel = null;
    this.consultaPanelMovil?.removeEventListener('change', this.manejadorCambioPanelMovil);
    this.consultaPanelMovil = null;
    this.manejadorCambioPanelMovil = null;
    this.editorRedMetro?.eliminar();
    this.editorRedMetro = null;

    this.capaTerritorial?.eliminar();
    this.capaTerritorial = null;
    this.territorioMapa = null;
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

    this.panelPuntosInteres?.eliminar();
    this.panelReferencias?.eliminar();
    this.panelReferencias = null;
    this.panelPuntosInteres = null;

    this.panelSeleccionGeografica?.eliminar();
    this.panelSeleccionGeografica = null;

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
    this.contenedorSelectoresMapa = null;
    this.contenedorControlesMapa = null;
    this.contenedorPuntosInteres = null;
    this.contenedorEditorRed = null;
    this.contenedorConsigna = null;
    this.contenedorPieEditor = null;
  }
}
