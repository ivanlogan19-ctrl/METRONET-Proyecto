import { validarDesplazamientos, flujosPorHora, puntoCurva } from '../desplazamientos/ModeloDesplazamientos.mjs';
const URL_DATOS = new URL('../datos/desplazamientos-historicos.json', import.meta.url).href;
export default class CapaDesplazamientos {
  constructor(escena, barrios, reloj) {
    Object.assign(this, { escena, barrios, reloj, disponible: false, visible: false, estado: 'pendiente',
      activa: true, animando: true, fase: 0, opacidad: .7, flujos: [], alCambiar: () => {} });
    this.grafico = escena.add.graphics().setDepth(4).setVisible(false);
    this.desuscribir = reloj.suscribir(() => { if (this.hora !== reloj.hora) this.redibujar(); });
    this.alOcultar = () => { if (document.hidden) { this.animando = false; this.actualizar(); } };
    document.addEventListener('visibilitychange', this.alOcultar);
    this.movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.animando = !this.movimientoReducido.matches;
    this.alReducir = () => { if (this.movimientoReducido.matches) { this.animando = false; this.actualizar(); } };
    this.movimientoReducido.addEventListener('change', this.alReducir);
    this.alActualizar = (_tiempo, delta) => this.avanzar(delta);
    escena.events.on('update', this.alActualizar);
  }
  establecerDisponible(valor) { this.disponible = valor; this.actualizar(); }
  async alternar() {
    if (!this.disponible) return;
    if (this.estado !== 'error') this.visible = !this.visible;
    if (this.visible && this.estado !== 'lista') await this.cargar();
    this.actualizar();
  }
  async cargar() {
    if (!this.activa || this.estado === 'cargando') return;
    this.estado = 'cargando'; this.actualizar(); this.peticion = new AbortController();
    try {
      const respuesta = await fetch(URL_DATOS, { signal: this.peticion.signal });
      if (!respuesta.ok) throw new Error('Sin desplazamientos');
      const datos = await respuesta.json();
      if (!validarDesplazamientos(datos)) throw new Error('Desplazamientos inválidos');
      if (!this.activa) return;
      this.datos = datos; this.estado = 'lista'; this.redibujar();
    } catch (error) { if (!this.activa || error.name === 'AbortError') return; this.estado = 'error'; }
    this.actualizar();
  }
  establecerOpacidad(valor) { if (Number.isFinite(valor)) this.opacidad = Math.min(1, Math.max(.1, valor)); this.actualizar(); }
  alternarAnimacion() { this.animando = !this.animando; this.actualizar(); }
  actualizar() {
    const mostrar = this.disponible && this.visible && this.estado === 'lista';
    this.grafico.setVisible(mostrar).setAlpha(this.opacidad);
    this.reloj.habilitar(this, mostrar); this.alCambiar();
  }
  redibujar() {
    this.hora = this.reloj.hora;
    const escala = this.barrios.calcularEscalaMapa();
    if (!escala || !this.datos) return;
    this.flujos = flujosPorHora(this.datos, this.hora).map(f => {
      const a = this.barrios.convertirCoordenada(this.datos.zonas[f.origen], escala);
      const b = this.barrios.convertirCoordenada(this.datos.zonas[f.destino], escala);
      // La curva cambia con la hora o el tamaño del mapa, no con cada
      // cuadro de la animación. Solo la punta de la flecha debe avanzar.
      return { ...f, a, b, puntos: Array.from({ length: 49 }, (_, i) => puntoCurva(a, b, i/48)) };
    });
    this.dibujar(); this.alCambiar();
  }
  avanzar(delta) {
    if (!this.grafico.visible || document.hidden) return;
    if (this.animando) this.fase = (this.fase + Math.min(100, delta || 0)/5000) % 1;
    const zoom = this.escena.cameras.main.zoom;
    if (this.animando || this.zoom !== zoom) this.dibujar();
  }
  dibujar() {
    const g = this.grafico; g.clear();
    this.zoom = Math.max(.1, this.escena.cameras.main.zoom);
    const maximo = Math.max(1, ...this.flujos.map(f => f.viajes));
    for (const [indice, f] of this.flujos.entries()) {
      const peso = f.viajes/maximo;
      // Borde oscuro para distinguir la dirección sobre población y tráfico.
      g.lineStyle((4 + 2*peso)/this.zoom, 0x071323, .9);
      g.strokePoints(f.puntos, false);
      g.lineStyle((2 + 2*peso)/this.zoom, 0x60e0c3, 1);
      g.strokePoints(f.puntos, false);
      const t = .06 + ((this.fase + indice*.137) % 1)*.88;
      const p = puntoCurva(f.a, f.b, t), anterior = puntoCurva(f.a, f.b, t-.01);
      const angulo = Math.atan2(p.y-anterior.y, p.x-anterior.x), largo = 10/this.zoom;
      g.fillStyle(0x83ffe0, 1);
      g.fillTriangle(p.x, p.y, p.x-largo*Math.cos(angulo-.55), p.y-largo*Math.sin(angulo-.55),
        p.x-largo*Math.cos(angulo+.55), p.y-largo*Math.sin(angulo+.55));
    }
  }
  eliminar() {
    this.activa = false; this.alCambiar = () => {}; this.peticion?.abort(); this.desuscribir();
    this.reloj.habilitar(this, false);
    document.removeEventListener('visibilitychange', this.alOcultar);
    this.movimientoReducido.removeEventListener('change', this.alReducir);
    this.escena.events.off('update', this.alActualizar); this.grafico.destroy(); this.datos = null; this.flujos = [];
  }
}
