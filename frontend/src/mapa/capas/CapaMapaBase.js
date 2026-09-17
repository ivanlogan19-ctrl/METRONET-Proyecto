import { COLORES_INTERFAZ_MAPA } from '../configuracion/ColoresMapa.js';

export default class CapaMapaBase {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    /*
     * Fondo exclusivo del área del mapa.
     *
     * El resto de la interfaz permanece
     * con el fondo negro definido en index.html.
     */
    this.colorFondo = opciones.colorFondo ?? COLORES_INTERFAZ_MAPA.FONDO;

    this.grafico = null;
  }

  crear() {
    this.eliminar();

    this.grafico = this.escena.add.graphics();

    /*
     * El fondo pertenece al visor, no al mapa.
     * Así permanece fijo al mover la cámara.
     */
    this.grafico.setScrollFactor(0);

    this.dibujar();

    return this;
  }

  dibujar() {
    if (!this.grafico) {
      return;
    }

    const ancho = this.escena.scale.width;

    const alto = this.escena.scale.height;

    this.grafico.clear();

    this.grafico.fillStyle(this.colorFondo, 1);

    this.grafico.fillRect(0, 0, ancho, alto);
  }

  actualizar() {
    this.dibujar();
  }

  redibujar() {
    this.dibujar();
  }

  eliminar() {
    if (this.grafico) {
      this.grafico.destroy();

      this.grafico = null;
    }
  }
}
