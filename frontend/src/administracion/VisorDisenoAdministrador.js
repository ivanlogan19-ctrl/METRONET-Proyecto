import Phaser from 'phaser';
import CapaBarrios from '../mapa/capas/CapaBarrios.js';
import CapaContextoGeografico from '../mapa/capas/CapaContextoGeografico.js';
import CapaRedMetro from '../mapa/capas/CapaRedMetro.js';
import ControlZoom from '../mapa/controles/ControlZoom.js';
import { observarTamanoMapa } from '../mapa/ObservarTamanoMapa.js';
import { liberarJuegoPhaser } from '../mapa/LiberarJuegoPhaser.js';
import { configurarAccion } from '../interfaz/AccionesInterfaz.js';
import './visor-diseno.css';

// Consulta administrativa: utiliza el mismo dibujo del juego, sin editor ni escrituras.
export function abrirVisorDiseno(detalle, etiqueta = 'Diseño') {
  const focoAnterior = document.activeElement;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'admin-visor-diseno';
  dialogo.setAttribute('aria-label', etiqueta);
  dialogo.dataset.diseno = detalle.diseno.idDiseno;
  const cabecera = document.createElement('header');
  const titulo = document.createElement('h2');
  titulo.textContent = `${etiqueta} · ${detalle.diseno.propietario || 'Jugador'}`;
  const cerrar = document.createElement('button');
  cerrar.type = 'button'; cerrar.className = 'admin-eliminar';
  configurarAccion(cerrar, 'cerrar');
  cerrar.addEventListener('click', () => dialogo.close());
  cabecera.append(titulo, cerrar);
  const mapa = document.createElement('div'); mapa.className = 'admin-visor-diseno__mapa';
  const estado = document.createElement('p'); estado.setAttribute('role', 'status');
  estado.hidden = true;
  dialogo.append(cabecera, mapa, estado);
  document.body.append(dialogo); dialogo.showModal();

  class VisorDiseno extends Phaser.Scene {
    constructor() { super({ key: 'VisorDiseno' }); }
    preload() {
      this.load.json('barrios', new URL('../mapa/datos/barrios_wgs84.geojson', import.meta.url).href);
      this.load.on('loaderror', () => {
        estado.textContent = 'No fue posible cargar el mapa. Cerrá y volvé a abrir el diseño.';
        estado.hidden = false;
      });
    }
    create() {
      if (!this.cache.json.has('barrios')) return;
      this.capaBarrios = new CapaBarrios(this, { datos: this.cache.json.get('barrios') });
      this.capaBarrios.dibujar();
      this.capaContextoGeografico = new CapaContextoGeografico(this, this.capaBarrios);
      this.capaRedMetro = new CapaRedMetro(this, { capaBarrios: this.capaBarrios, editable: false });
      this.capaRedMetro.crear();
      this.capaRedMetro.establecerDiseno(detalle);
      this.controlZoom = new ControlZoom(this, {
        capaBarrios: this.capaBarrios, contenedorPadre: mapa, ancladoAlMapa: true,
        permitirArrastrePrimario: () => true, mostrarAyudaNavegacion: false,
        obtenerLimitesAjuste: () => this.capaRedMetro.obtenerLimitesEstaciones(),
      });
      this.controlZoom.crear();
      this.capaContextoGeografico.establecerDisponible(detalle.diseno.modoEscenario === 'EDICION_LIBRE');
      const ajustar = () => {
        this.capaBarrios.ajustarMapa(this.scale.width, this.scale.height);
        this.capaContextoGeografico.redibujar();
        this.capaRedMetro.actualizarTamano();
        this.controlZoom.actualizar();
      };
      ajustar();
      const liberarTamano = observarTamanoMapa(this, mapa, ajustar);
      this.events.once('shutdown', () => {
        liberarTamano(); this.controlZoom.eliminar(); this.capaRedMetro.eliminar();
        this.capaContextoGeografico.eliminar(); this.capaBarrios.eliminar();
      });
      mapa.dataset.cargado = 'true';
    }
  }
  const juego = new Phaser.Game({ type: Phaser.AUTO, parent: mapa, backgroundColor: '#0a1425',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, scene: [VisorDiseno] });
  const liberar = () => {
    window.removeEventListener('pagehide', alSalir);
    liberarJuegoPhaser(juego, { sinSiguienteFrame: true });
    dialogo.remove();
    if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
  };
  const alSalir = evento => { if (!evento.persisted) dialogo.close(); };
  dialogo.addEventListener('close', liberar, { once: true });
  window.addEventListener('pagehide', alSalir);
}
