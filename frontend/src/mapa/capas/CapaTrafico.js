import { COLORES_TRAFICO, nivelIntensidad, normalizarHora, validarDatosTrafico } from '../trafico/ModeloTrafico.mjs';

// Capa histórica pasiva. Su reloj nunca modifica UV, UT ni el motor de metros.
export default class CapaTrafico {
  constructor(escena, calles) {
    this.escena = escena;
    this.calles = calles;
    this.disponible = false;
    this.visible = false;
    this.activa = true;
    this.estado = 'pendiente';
    this.hora = 8;
    this.tramos = [];
    this.alCambiar = () => {};
    this.grafico = escena.add.graphics().setDepth(2.5).setVisible(false);
    this.actualizarZoom = () => {
      if (this.visible && this.disponible && this.estado === 'lista'
        && this.zoomDibujado !== Math.round(escena.cameras.main.zoom * 4)/4) this.dibujar();
    };
    this.alOcultarDocumento = () => { if (document.hidden) this.pausar(); };
    escena.events.on('postupdate', this.actualizarZoom);
    document.addEventListener('visibilitychange', this.alOcultarDocumento);
  }

  establecerDisponible(valor) {
    this.disponible = valor;
    if (!valor) this.pausar();
    this.actualizar();
  }

  async alternar() {
    if (!this.disponible) return;
    if (this.estado !== 'error') this.visible = !this.visible;
    if (!this.visible) this.pausar();
    this.actualizar();
    if (this.visible) await this.cargar();
  }

  async cargar() {
    if (!this.activa || this.estado === 'cargando') return;
    this.estado = 'cargando'; this.actualizar();
    this.peticion = new AbortController();
    try {
      const r = await fetch(`${location.protocol}//${location.hostname}:8080/api/trafico/historico`, { signal: this.peticion.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('Tráfico no disponible');
      const datos = await r.json();
      if (!validarDatosTrafico(datos)) throw new Error('Datos horarios no válidos');
      if (!this.activa) return;
      this.datos = datos; this.estado = 'lista'; this.redibujar();
    } catch (e) {
      if (!this.activa || e.name === 'AbortError') return;
      this.estado = 'error'; this.pausar();
    }
    this.actualizar();
  }

  cambiarHora(valor) {
    const hora = normalizarHora(valor);
    if (hora === null) return;
    this.hora = hora; this.dibujar(); this.alCambiar();
  }

  reproducir() {
    if (this.temporizador) return this.pausar();
    if (!this.disponible || !this.visible || this.estado !== 'lista') return;
    this.temporizador = setInterval(() => this.cambiarHora(this.hora + 1), 1200);
    this.alCambiar();
  }

  pausar() {
    clearInterval(this.temporizador); this.temporizador = null; this.alCambiar();
  }

  actualizar() {
    const mostrar = this.disponible && this.visible && this.estado === 'lista';
    this.grafico.setVisible(mostrar);
    this.grafico.setAlpha(this.calles.opacidad);
    this.calles.establecerTraficoActivo(mostrar);
    this.alCambiar();
  }

  redibujar() {
    const transformacion = this.calles.capaBarrios.calcularEscalaMapa();
    if (!transformacion || !this.datos) return;
    this.tramos = this.datos.tramos.map(t => ({ intensidades: t.intensidades,
      puntos: t.coordenadas.map(p => this.calles.capaBarrios.convertirCoordenada(p, transformacion)) }));
    this.dibujar();
  }

  dibujar() {
    const zoom = Math.max(.25, Math.round(this.escena.cameras.main.zoom * 4)/4);
    this.zoomDibujado = zoom; this.grafico.clear();
    for (const tramo of this.tramos) {
      this.grafico.lineStyle(2/zoom, COLORES_TRAFICO[nivelIntensidad(tramo.intensidades[this.hora])], 1);
      this.grafico.strokePoints(tramo.puntos, false);
    }
  }

  eliminar() {
    this.activa = false; this.alCambiar = () => {}; this.pausar(); this.peticion?.abort();
    this.escena.events.off('postupdate', this.actualizarZoom);
    document.removeEventListener('visibilitychange', this.alOcultarDocumento);
    this.grafico.destroy(); this.tramos = []; this.datos = null;
  }
}
