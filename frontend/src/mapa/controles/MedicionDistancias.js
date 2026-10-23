import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
import './medicion-distancias.css';
import { tramosDeRecorridos, nombreRecorrido, fondoRecorrido } from '../configuracion/RecorridosRed.js';

const formatoKm = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const valido = valor => typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
/** Presenta las distancias geográficas de la API, sin recalcular ni alterar la red. */
export default class MedicionDistancias {
  constructor(capa) {
    this.capa = capa;
    this.activa = false;
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
    this.tramos = tramosDeRecorridos(diseno);
    this.diseno = diseno;
    const grupos = new Map();
    for (const tramo of this.tramos) {
      if (!grupos.has(tramo.nombreLinea)) grupos.set(tramo.nombreLinea, []);
      grupos.get(tramo.nombreLinea).push(tramo);
    }
    this.recorridos = [...grupos].filter(([, tramos]) => tramos.every(t => valido(t.distanciaKm))).map(([nombre, tramos]) => ({
      nombre, distanciaKm: tramos.reduce((s, t) => s + t.distanciaKm, 0),
    }));
    this.pagina = 0;
    this.renderizarResumen();
    this.overlay.replaceChildren(this.total);
    this.actualizarVisibilidad();
  }

  renderizarResumen() {
    this.total.replaceChildren();
    this.total.hidden = !this.recorridos.length;
    const titulo = document.createElement('strong');
    titulo.className = 'metronet-mediciones__titulo';
    titulo.textContent = 'Distancia total';
    this.total.append(titulo);
    for (const recorrido of this.recorridos.slice(this.pagina * 5, this.pagina * 5 + 5)) {
      const fila = document.createElement('div'); fila.className = 'metronet-mediciones__fila';
      fila.dataset.recorrido = recorrido.nombre;
      const color = document.createElement('i'); color.style.background = fondoRecorrido(this.diseno, recorrido.nombre);
      const nombre = document.createElement('span'); nombre.textContent = nombreRecorrido(this.diseno, recorrido.nombre);
      const valor = document.createElement('b'); valor.textContent = `${formatoKm.format(recorrido.distanciaKm)} km`;
      fila.append(color, nombre, valor); this.total.append(fila);
    }
    if (this.recorridos.length > 5) {
      const paginas = Math.ceil(this.recorridos.length / 5);
      const navegacion = document.createElement('div'); navegacion.className = 'metronet-mediciones__paginas';
      for (const [texto, paso] of [['Anterior', -1], ['Siguiente', 1]]) {
        const boton = document.createElement('button'); boton.type = 'button';
        boton.textContent = paso < 0 ? '◀' : '▶';
        boton.setAttribute('aria-label', texto);
        boton.disabled = this.pagina + paso < 0 || this.pagina + paso >= paginas;
        boton.addEventListener('click', () => { this.pagina += paso; this.renderizarResumen(); });
        navegacion.append(boton);
      }
      this.total.append(navegacion);
    }
  }

  actualizarVisibilidad() {
    configurarBotonIcono(this.boton, 'regla', `${this.activa ? 'Ocultar' : 'Mostrar'} distancias en kilómetros`);
    this.boton.querySelector('svg').setAttribute('viewBox', '0 5 16 6');
    this.boton.setAttribute('aria-pressed', String(this.activa));
    this.overlay.hidden = !this.activa;
  }

  desmontar() {
    this.boton?.parentElement?.classList.remove('metronet-cabecera-medicion');
    this.boton?.remove(); this.overlay?.remove();
    this.boton = null; this.overlay = null; this.activa = false;
    this.idDiseno = null;
  }

  eliminar() {
    this.desmontar();
  }
}
