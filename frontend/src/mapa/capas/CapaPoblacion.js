import Phaser from 'phaser';
import { validarPoblacion, colorPoblacion } from '../poblacion/ModeloPoblacion.mjs';

// Capa censal pasiva, debajo de límites, calles, POI y red; nunca captura clics.
export default class CapaPoblacion {
  constructor(escena, capaBarrios) {
    this.escena = escena; this.capaBarrios = capaBarrios;
    this.disponible = false; this.visible = false; this.opacidad = 0.65;
    this.estado = 'pendiente'; this.activa = true; this.alCambiar = () => {};
    this.grafico = escena.add.graphics().setDepth(0.5).setVisible(false);
  }
  establecerDisponible(disponible) { this.disponible = disponible; this.actualizar(); }
  async cargar() {
    if (this.estado === 'cargando' || !this.activa || !this.disponible) return;
    this.estado = 'cargando'; this.actualizar(); this.peticion = new AbortController();
    try {
      const respuesta = await fetch(new URL('../datos/poblacion-montevideo.geojson', import.meta.url), { signal: this.peticion.signal });
      if (!respuesta.ok) throw new Error('Censo no disponible');
      const contenido = await respuesta.json();
      const datos = validarPoblacion(contenido);
      if (!this.activa) return;
      this.datos = datos;
      // Triangulación única, incluidos huecos. Reutilizada al redimensionar.
      this.poligonos = datos.features.flatMap(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map(anillos => {
        const puntos = [], huecos = [];
        anillos.forEach((anillo, i) => { if (i) huecos.push(puntos.length / 2); anillo.slice(0, -1).forEach(p => puntos.push(p[0], p[1])); });
        return { puntos, indices: Phaser.Geom.Polygon.Earcut(puntos, huecos), color: colorPoblacion(f.properties) };
      }));
      this.estado = 'lista'; this.redibujar();
    } catch (e) { if (!this.activa || e.name === 'AbortError') return; this.estado = 'error'; }
    this.actualizar();
  }
  alternar() {
    if (!this.disponible) return;
    if (this.estado === 'pendiente' || this.estado === 'error') { this.visible = true; return this.cargar(); }
    this.visible = !this.visible; this.actualizar();
  }
  establecerOpacidad(valor) {
    if (!Number.isFinite(Number(valor))) return;
    this.opacidad = Math.max(0.1, Math.min(1, Number(valor))); this.actualizar();
  }
  actualizar() {
    this.grafico.setVisible(this.disponible && this.visible && this.estado === 'lista').setAlpha(this.opacidad);
    this.alCambiar();
  }
  redibujar() {
    const transformacion = this.capaBarrios.calcularEscalaMapa();
    if (!transformacion || !this.poligonos) return;
    this.grafico.clear();
    for (const poligono of this.poligonos) {
      const puntos = [];
      for (let i = 0; i < poligono.puntos.length; i += 2) puntos.push(this.capaBarrios.convertirCoordenada(poligono.puntos.slice(i, i + 2), transformacion));
      this.grafico.fillStyle(poligono.color, 1);
      for (let i = 0; i < poligono.indices.length; i += 3) {
        const [a, b, c] = poligono.indices.slice(i, i + 3).map(n => puntos[n]);
        this.grafico.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
      }
    }
  }
  eliminar() { this.activa = false; this.peticion?.abort(); this.alCambiar = () => {}; this.grafico.destroy(); this.datos = null; this.poligonos = null; }
}
