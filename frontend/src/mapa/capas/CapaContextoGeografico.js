import { FUENTES_INTERFAZ_MAPA } from '../configuracion/ColoresMapa.js';

const COLOR_AGUA = 0x0d293e;
const COLOR_TIERRA = 0x142d36;
const COLORES_DEPARTAMENTOS = {
  'SAN JOSÉ': 0x263b3c,
  CANELONES: 0x303b4a,
};
const COLOR_LIMITE = 0x456571;
const COLOR_CONTORNO_MONTEVIDEO = 0x8fb9bb;
const ZOOM_MINIMO_LIBRE = 0.65;
const ETIQUETAS = [
  ['SAN JOSÉ', [-56.52, -34.68]],
  ['CANELONES', [-56.02, -34.68]],
  ['RÍO DE LA PLATA', [-56.30, -34.98]],
];

// Contexto visual: nunca integra las geometrías de validación de TerritorioMapa.
export default class CapaContextoGeografico {
  constructor(escena, capaBarrios) {
    this.escena = escena;
    this.capaBarrios = capaBarrios;
    this.disponible = false;
    this.activa = true;
    this.datos = null;
    this.solicitud = null;
    this.contenedor = escena.add.container(0, 0).setDepth(-2).setVisible(false);
    this.contornoMontevideo = escena.add.graphics().setDepth(1.5).setVisible(false);
    this.fondoOriginal = escena.cameras.main.backgroundColor.rgba;
    this.zoomOriginal = null;
    this.puntosMontevideo = [];
    this.alCambiarZoom = () => {
      if (this.disponible && this.zoomContorno !== Math.max(1, escena.cameras.main.zoom)) this.dibujarContorno();
    };
    escena.events.on('postupdate', this.alCambiarZoom);
  }

  establecerDisponible(disponible) {
    if (this.disponible === disponible) return;
    this.disponible = disponible;
    const control = this.escena.controlZoom;
    if (control) {
      this.zoomOriginal ??= control.zoomMinimo;
      control.zoomMinimo = disponible ? ZOOM_MINIMO_LIBRE : this.zoomOriginal;
      if (control.estadoVista === 'mapa') control.restaurar();
    }
    this.actualizarFondo();
    if (disponible && !this.datos) this.cargar();
  }

  async cargar() {
    if (this.solicitud) return;
    this.solicitud = new AbortController();
    try {
      const respuesta = await fetch(new URL('../datos/departamentos-contexto.geojson', import.meta.url),
        { signal: this.solicitud.signal });
      if (!respuesta.ok) throw new Error(`Cartografía: ${respuesta.status}`);
      const datos = await respuesta.json();
      if (!this.activa) return;
      this.datos = datos;
      this.redibujar();
    } catch (error) {
      if (error.name !== 'AbortError') console.warn('No se pudo cargar el contexto geográfico.', error);
    } finally {
      this.solicitud = null;
    }
  }

  actualizarFondo() {
    const visible = this.disponible && Boolean(this.datos);
    this.contenedor.setVisible(visible);
    this.contornoMontevideo.setVisible(visible);
    this.escena.capaMapaBase?.grafico?.setVisible(!visible);
    // El agua cubre el visor completo: no es un rectángulo que deja esquinas negras al girar.
    this.escena.cameras.main.setBackgroundColor(visible ? COLOR_AGUA : this.fondoOriginal);
  }

  redibujar() {
    if (!this.datos || !this.activa) return;
    const transformacion = this.capaBarrios.calcularEscalaMapa();
    if (!transformacion) return;
    this.contenedor.removeAll(true);
    this.puntosMontevideo = [];
    for (const departamento of this.datos.features) {
      const puntos = departamento.geometry.coordinates[0].map(coordenada =>
        this.capaBarrios.convertirCoordenada(coordenada, transformacion));
      const nombre = departamento.properties.DEPTO;
      const color = COLORES_DEPARTAMENTOS[nombre] ?? COLOR_TIERRA;
      const poligono = this.escena.add.polygon(0, 0, puntos, color).setOrigin(0);
      poligono.setStrokeStyle(1, COLOR_LIMITE);
      this.contenedor.add(poligono);
      if (nombre === 'MONTEVIDEO') this.puntosMontevideo = puntos;
    }
    for (const [nombre, coordenada] of ETIQUETAS) {
      const { x, y } = this.capaBarrios.convertirCoordenada(coordenada, transformacion);
      this.contenedor.add(this.escena.add.text(x, y, nombre, {
        fontFamily: FUENTES_INTERFAZ_MAPA.LECTURA, fontSize: '24px', color: '#a7c1ca',
      }).setOrigin(0.5));
    }
    this.dibujarContorno();
    this.actualizarFondo();
  }

  dibujarContorno() {
    this.zoomContorno = Math.max(1, this.escena.cameras.main.zoom);
    this.contornoMontevideo.clear();
    this.contornoMontevideo.lineStyle(2.5 / this.zoomContorno, COLOR_CONTORNO_MONTEVIDEO, 0.95);
    if (this.puntosMontevideo.length) this.contornoMontevideo.strokePoints(this.puntosMontevideo, true);
  }

  eliminar() {
    this.activa = false;
    this.solicitud?.abort();
    this.escena.events.off('postupdate', this.alCambiarZoom);
    this.contenedor.destroy();
    this.contornoMontevideo.destroy();
  }
}
