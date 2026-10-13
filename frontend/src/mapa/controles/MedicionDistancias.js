import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
import './medicion-distancias.css';

const formatoKm = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const valido = valor => typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
const superpone = (a, b) => a.x < b.x + b.w + 4 && a.x + a.w + 4 > b.x && a.y < b.y + b.h + 4 && a.y + a.h + 4 > b.y;

/** Presenta las distancias geográficas de la API, sin recalcular ni alterar la red. */
export default class MedicionDistancias {
  constructor(capa) {
    this.capa = capa;
    this.activa = false;
    this.etiquetas = [];
    this.renderizar = () => this.posicionar();
    capa.escena.events.on('render', this.renderizar);
  }

  actualizar(diseno) {
    if (!['LIBRE', 'EDICION_LIBRE'].includes(diseno?.simulacion?.modo)) {
      this.desmontar();
      return;
    }
    const cabecera = document.querySelector('.simulacion-capas > h3, .metronet-panel-editor-cabecera');
    const lienzo = this.capa.escena.game.canvas;
    if (!cabecera || !lienzo?.parentElement) return;
    if (this.idDiseno !== diseno.simulacion.idDiseno) this.activa = false;
    this.idDiseno = diseno.simulacion.idDiseno;
    if (!this.boton?.isConnected) {
      this.boton = document.createElement('button');
      this.boton.type = 'button';
      this.boton.className = 'metronet-regla';
      this.boton.dataset.medicionDistancias = '';
      this.boton.addEventListener('click', () => { this.activa = !this.activa; this.actualizarVisibilidad(); });
      cabecera.classList.add('metronet-cabecera-medicion');
      cabecera.append(this.boton);
    }
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'metronet-mediciones';
      this.overlay.setAttribute('aria-label', 'Distancias de la red en kilómetros');
      lienzo.parentElement.append(this.overlay);
      this.total = document.createElement('output');
      this.total.className = 'metronet-mediciones__total';
    }
    const estaciones = new Map((diseno.estaciones ?? []).map(e => [e.nombre, e]));
    this.tramos = diseno.tramos ?? [];
    this.etiquetas = this.tramos.filter(t => valido(t.distanciaKm) && estaciones.has(t.estacionA) && estaciones.has(t.estacionB)).map(tramo => {
      const elemento = document.createElement('span');
      elemento.className = 'metronet-mediciones__tramo';
      elemento.textContent = `${formatoKm.format(tramo.distanciaKm)} km`;
      elemento.setAttribute('aria-label', `${tramo.nombreLinea}: ${tramo.estacionA} a ${tramo.estacionB}, ${elemento.textContent}`);
      elemento.dataset.distanciaKm = tramo.distanciaKm;
      return { elemento, tramo, origen: estaciones.get(tramo.estacionA), destino: estaciones.get(tramo.estacionB) };
    });
    this.overlay.replaceChildren(this.total, ...this.etiquetas.map(e => e.elemento));
    this.actualizarVisibilidad();
  }

  actualizarVisibilidad() {
    configurarBotonIcono(this.boton, 'regla', `${this.activa ? 'Ocultar' : 'Mostrar'} distancias en kilómetros`);
    this.boton.querySelector('svg').setAttribute('viewBox', '0 5 16 6');
    this.boton.setAttribute('aria-pressed', String(this.activa));
    this.overlay.hidden = !this.activa;
    this.posicionar();
  }

  posicionar() {
    if (!this.activa || !this.overlay?.isConnected) return;
    const capa = this.capa;
    const camara = capa.escena.cameras.main;
    const canvas = capa.escena.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const contenedor = this.overlay.getBoundingClientRect();
    const escalaX = rect.width / capa.escena.scale.gameSize.width;
    const escalaY = rect.height / capa.escena.scale.gameSize.height;
    const proyectar = punto => {
      const p = camara.matrix.transformPoint(punto.x - camara.scrollX, punto.y - camara.scrollY);
      return { x: p.x * escalaX + rect.left - contenedor.left, y: p.y * escalaY + rect.top - contenedor.top };
    };
    const seleccion = capa.elementoSeleccionado;
    const linea = seleccion?.tipo === 'linea' ? seleccion.valor.nombre : seleccion?.valor?.nombreLinea;
    const nombres = [...new Set(this.tramos.map(t => t.nombreLinea))];
    const nombre = linea || (nombres.length === 1 ? nombres[0] : null);
    const tramos = nombre ? this.tramos.filter(t => t.nombreLinea === nombre) : this.tramos;
    const completo = tramos.length && tramos.every(t => valido(t.distanciaKm));
    this.total.hidden = !completo;
    const texto = completo ? `${nombre || 'Red'} · ${formatoKm.format(tramos.reduce((s, t) => s + t.distanciaKm, 0))} km` : '';
    if (this.total.textContent !== texto) this.total.textContent = texto;
    const ocupados = [];
    if (completo) ocupados.push({ x: contenedor.width - this.total.offsetWidth - 10, y: 10, w: this.total.offsetWidth, h: this.total.offsetHeight });
    // Protege los marcadores y trenes; el texto conserva su tamaño al acercar o girar.
    for (const p of capa.puntosEstaciones) {
      const s = proyectar(p);
      ocupados.push({ x: s.x - 17, y: s.y - 35, w: 34, h: 48 });
    }
    for (const p of [...capa.unidadesEstaticas, ...capa.unidadesSimulacion.values()]) {
      const s = proyectar(p);
      ocupados.push({ x: s.x - 25, y: s.y - 25, w: 50, h: 50 });
    }
    for (const { elemento, origen, destino } of this.etiquetas) {
      const a = proyectar(capa.convertirPosicion(origen.posicionX, origen.posicionY));
      const b = proyectar(capa.convertirPosicion(destino.posicionX, destino.posicionY));
      elemento.hidden = false;
      const w = elemento.offsetWidth, h = elemento.offsetHeight;
      let sitio;
      for (const fraccion of [.5, .35, .65]) {
        const x = a.x + (b.x - a.x) * fraccion;
        const y = a.y + (b.y - a.y) * fraccion;
        // En tramos verticales o cortos, estaciones y metros pueden ocupar
        // todas las posiciones superiores/inferiores. Buscar también a los lados.
        const lateral = w / 2 + 36;
        const desplazamientos = [[0, -32], [0, 32], [0, -52], [0, 52],
          [-lateral, 0], [lateral, 0], [-lateral, -32], [lateral, 32]];
        sitio = desplazamientos.map(([dx, dy]) => ({ x: x + dx - w / 2, y: y + dy - h / 2, w, h }))
          .find(r => r.x >= 6 && r.y >= 6 && r.x + w <= contenedor.width - 6 && r.y + h <= contenedor.height - 6 && !ocupados.some(o => superpone(r, o)));
        if (sitio) break;
      }
      elemento.hidden = !sitio;
      if (sitio) { elemento.style.transform = `translate(${sitio.x}px, ${sitio.y}px)`; ocupados.push(sitio); }
    }
  }

  desmontar() {
    this.boton?.parentElement?.classList.remove('metronet-cabecera-medicion');
    this.boton?.remove(); this.overlay?.remove();
    this.boton = null; this.overlay = null; this.etiquetas = []; this.activa = false;
    this.idDiseno = null;
  }

  eliminar() {
    this.capa.escena.events.off('render', this.renderizar);
    this.desmontar();
  }
}
