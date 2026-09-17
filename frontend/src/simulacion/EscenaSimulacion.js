import Phaser from 'phaser';
import CapaBarrios from '../mapa/capas/CapaBarrios.js';
import CapaMapaBase from '../mapa/capas/CapaMapaBase.js';
import CapaRedMetro from '../mapa/capas/CapaRedMetro.js';
import { COLORES_INTERFAZ_MAPA } from '../mapa/configuracion/ColoresMapa.js';

class EscenaSimulacion extends Phaser.Scene {
  constructor() {
    super({ key: 'EscenaSimulacion' });
    this.capaMapaBase = null;
    this.capaBarrios = null;
    this.capaRedMetro = null;
    this.disenoActual = null;
  }

  preload() {
    this.load.json('barriosMontevideoSimulacion', new URL('../mapa/datos/barrios_wgs84.geojson', import.meta.url).href);
  }

  create() {
    this.capaMapaBase = new CapaMapaBase(this, { colorFondo: COLORES_INTERFAZ_MAPA.FONDO });
    this.capaMapaBase.crear();
    this.capaBarrios = new CapaBarrios(this, { datos: this.cache.json.get('barriosMontevideoSimulacion') });
    this.capaBarrios.dibujar();
    this.capaRedMetro = new CapaRedMetro(this, { capaBarrios: this.capaBarrios });
    this.capaRedMetro.crear();
    this.scale.on('resize', this.actualizarTamano, this);
    this.events.once('shutdown', this.eliminar, this);
  }

  establecerDiseno(diseno) {
    this.disenoActual = diseno;
    this.capaRedMetro.establecerDiseno(diseno);
    this.enfocarDiseno();
  }

  enfocarDiseno() {
    const estaciones = this.disenoActual?.estaciones ?? [];
    const camara = this.cameras.main;
    if (!estaciones.length || !this.capaRedMetro) {
      camara.setZoom(1);
      camara.centerOn(this.scale.width / 2, this.scale.height / 2);
      return;
    }
    const posiciones = estaciones.map((estacion) => this.capaRedMetro.convertirPosicion(estacion.posicionX, estacion.posicionY));
    const minimoX = Math.min(...posiciones.map((posicion) => posicion.x));
    const maximoX = Math.max(...posiciones.map((posicion) => posicion.x));
    const minimoY = Math.min(...posiciones.map((posicion) => posicion.y));
    const maximoY = Math.max(...posiciones.map((posicion) => posicion.y));
    const ancho = Math.max(180, maximoX - minimoX + 150);
    const alto = Math.max(160, maximoY - minimoY + 130);
    const zoom = Phaser.Math.Clamp(Math.min(this.scale.width / ancho, this.scale.height / alto), 1, 3);
    camara.setZoom(zoom);
    camara.centerOn((minimoX + maximoX) / 2, (minimoY + maximoY) / 2);
  }

  iniciarAnimacion(velocidad, duracion) { this.capaRedMetro.iniciarAnimacion(velocidad, duracion); }
  pausarAnimacion() { this.capaRedMetro.pausarAnimacion(); }
  reanudarAnimacion() { this.capaRedMetro.reanudarAnimacion(); }
  detenerAnimacion() { this.capaRedMetro.detenerAnimacion(); }

  actualizarTamano() {
    this.capaMapaBase?.actualizar();
    this.capaBarrios?.ajustarMapa(this.scale.width, this.scale.height);
    this.capaRedMetro?.actualizarTamano();
    this.enfocarDiseno();
  }

  eliminar() {
    this.scale.off('resize', this.actualizarTamano, this);
    this.capaRedMetro?.eliminar();
    this.capaBarrios?.eliminar();
    this.capaMapaBase?.eliminar();
  }
}

export function crearVisorSimulacion(contenedor) {
  return new Promise((resolver) => {
    let juego = null;
    const destruir = () => {
      if (!juego) return;
      juego.destroy(true);
      juego = null;
    };
    class EscenaLista extends EscenaSimulacion {
      create() {
        super.create();
        resolver({ escena: this, destruir });
      }
    }
    juego = new Phaser.Game({
      type: Phaser.AUTO,
      parent: contenedor.id,
      backgroundColor: '#0B0D0E',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: [EscenaLista],
    });
  });
}
