// Referencia cartográfica pasiva: comparte coordenadas/cámara con barrios y red.
// No registra entradas ni altera estaciones, conexiones o reglas territoriales.
export default class CapaCalles {
  constructor(escena, capaBarrios) {
    this.escena = escena;
    this.capaBarrios = capaBarrios;
    this.disponible = false;
    this.visible = true;
    this.opacidad = 0.65;
    this.estado = 'pendiente';
    this.activa = true;
    this.datos = null;
    this.tramos = [];
    this.grafico = escena.add.graphics().setDepth(2).setVisible(false);
    this.alCambiar = () => {};
    this.actualizarZoom = () => {
      if (!this.disponible || !this.visible || this.estado !== 'lista') return;
      const zoom = Math.round(this.escena.cameras.main.zoom * 4) / 4;
      if (zoom !== this.zoomDibujado) this.dibujar();
    };
    escena.events.on('postupdate', this.actualizarZoom);
  }

  establecerDisponible(disponible) {
    this.disponible = disponible;
    this.actualizarVisibilidad();
    if (disponible && this.estado === 'pendiente') this.cargar();
  }

  async cargar() {
    if (this.estado === 'cargando' || !this.activa) return;
    this.estado = 'cargando';
    this.alCambiar();
    this.peticion = new AbortController();
    try {
      const respuesta = await fetch(new URL('../datos/calles-montevideo.geojson', import.meta.url), { signal: this.peticion.signal });
      if (!respuesta.ok) throw new Error('Cartografía no disponible');
      const datos = await respuesta.json();
      if (!Array.isArray(datos.features) || !datos.features.length) throw new Error('Cartografía vacía');
      if (!this.activa) return;
      this.datos = datos;
      this.estado = 'lista';
      this.redibujar();
    } catch (error) {
      if (!this.activa || error.name === 'AbortError') return;
      this.estado = 'error';
    }
    this.actualizarVisibilidad();
    this.alCambiar();
  }

  alternar() {
    if (this.estado === 'error') return this.cargar();
    this.visible = !this.visible;
    this.actualizarVisibilidad();
    if (this.visible) this.dibujar();
    this.alCambiar();
  }

  establecerOpacidad(valor) {
    if (!Number.isFinite(Number(valor))) return;
    this.opacidad = Math.max(0.1, Math.min(1, Number(valor)));
    this.grafico.setAlpha(this.opacidad);
  }

  establecerTraficoActivo(activo) {
    if (this.traficoActivo === activo) return;
    this.traficoActivo = activo;
    this.dibujar();
  }

  actualizarVisibilidad() {
    this.grafico.setVisible(this.disponible && this.visible && this.estado === 'lista');
    this.grafico.setAlpha(this.opacidad);
  }

  redibujar() {
    const transformacion = this.capaBarrios.calcularEscalaMapa();
    if (!transformacion || !this.datos) return;
    this.tramos = this.datos.features.flatMap(f => f.geometry.coordinates.filter(p => p.length >= 2).map(coordenadas => ({
      principal: f.properties.principal,
      puntos: coordenadas.map(p => this.capaBarrios.convertirCoordenada(p, transformacion)),
    })));
    this.dibujar();
  }

  dibujar() {
    const zoom = Math.max(0.25, Math.round(this.escena.cameras.main.zoom * 4) / 4);
    this.zoomDibujado = zoom;
    this.detalleVisible = zoom >= 2;
    this.grafico.clear();
    // Ancho en píxeles de pantalla: las calles nunca tapan las vías del metro.
    for (const principal of [false, true]) {
      if (!principal && !this.detalleVisible) continue;
      this.grafico.lineStyle((principal ? 1.15 : 0.7) / zoom,
        this.traficoActivo ? 0x62758c : principal ? 0xd9b75e : 0x9c8957, principal ? 1 : 0.7);
      for (const tramo of this.tramos) {
        if (tramo.principal === principal) this.grafico.strokePoints(tramo.puntos, false);
      }
    }
  }

  eliminar() {
    this.activa = false;
    this.peticion?.abort();
    this.escena.events.off('postupdate', this.actualizarZoom);
    this.alCambiar = () => {};
    this.grafico.destroy();
    this.tramos = [];
    this.datos = null;
  }
}
