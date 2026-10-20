import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
import './medicion-distancias.css';

const formatoKm = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const valido = valor => typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
// Compara los recuadros girados, no sus cajas envolventes: estas últimas
// reservan espacio vacío y alejan innecesariamente las medidas de la vía.
const superpone = (a, b) => {
  if (a.x >= b.x + b.w + 4 || b.x >= a.x + a.w + 4 || a.y >= b.y + b.h + 4 || b.y >= a.y + a.h + 4) return false;
  const rectangulo = r => ({
    x: r.x + r.w / 2, y: r.y + r.h / 2,
    w: (r.ancho ?? r.w) / 2, h: (r.alto ?? r.h) / 2,
    c: r.coseno ?? 1, s: r.seno ?? 0,
  });
  const p = rectangulo(a), q = rectangulo(b);
  const radio = (r, x, y) => r.w * Math.abs(r.c * x + r.s * y) + r.h * Math.abs(-r.s * x + r.c * y);
  return [[p.c, p.s], [-p.s, p.c], [q.c, q.s], [-q.s, q.c]].every(([x, y]) =>
    Math.abs((p.x - q.x) * x + (p.y - q.y) * y) < radio(p, x, y) + radio(q, x, y) + 4);
};

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
      // Phaser 4 incorpora el desplazamiento y el origen de la cámara en esta
      // matriz. Restar scroll otra vez separaría las etiquetas de la vía.
      const p = camara.matrixCombined.transformPoint(punto.x, punto.y);
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
      // La orientación se calcula después de proyectar la cámara: sigue al tramo
      // también al girar el mapa, sin invertir la lectura al cambiar sus extremos.
      let angulo = Math.atan2(b.y - a.y, b.x - a.x);
      if (angulo > Math.PI / 2) angulo -= Math.PI;
      if (angulo < -Math.PI / 2) angulo += Math.PI;
      const coseno = Math.cos(angulo), seno = Math.sin(angulo);
      const anchoGirado = Math.abs(coseno) * w + Math.abs(seno) * h;
      const altoGirado = Math.abs(seno) * w + Math.abs(coseno) * h;
      let sitio;
      // Busca primero cerca de la vía en todo el tramo. Solo aumenta la
      // separación cuando ambas caras están ocupadas por otros elementos.
      for (const margen of [8, 12, 18, 24, 30, 36, 42]) {
        for (const fraccion of [.5, .35, .65, .2, .8]) {
          const x = a.x + (b.x - a.x) * fraccion;
          const y = a.y + (b.y - a.y) * fraccion;
          sitio = [h / 2 + margen, -h / 2 - margen].map(distancia => {
            const centroX = x + seno * distancia, centroY = y - coseno * distancia;
            return { centroX, centroY, ancho: w, alto: h, coseno, seno, x: centroX - anchoGirado / 2, y: centroY - altoGirado / 2, w: anchoGirado, h: altoGirado };
          }).find(r => r.x >= 6 && r.y >= 6 && r.x + r.w <= contenedor.width - 6 && r.y + r.h <= contenedor.height - 6 && !ocupados.some(o => superpone(r, o)));
          if (sitio) break;
        }
        if (sitio) break;
      }
      elemento.hidden = !sitio;
      if (sitio) {
        elemento.style.transform = `translate(${sitio.centroX - w / 2}px, ${sitio.centroY - h / 2}px) rotate(${angulo}rad)`;
        ocupados.push(sitio);
      }
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
