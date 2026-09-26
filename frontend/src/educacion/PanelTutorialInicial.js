import { siguienteLeccion } from './TutorialInicial.js';
import './tutorial-inicial.css';

export default class PanelTutorialInicial {
  constructor(mapa) {
    this.intentos = new Map();
    this.elemento = document.createElement('aside');
    this.elemento.className = 'metronet-tutorial';
    this.elemento.hidden = true;
    this.elemento.setAttribute('aria-label', 'Tutorial de herramientas');
    // Mantener las acciones del panel fuera de los eventos globales de Phaser.
    for (const tipo of ['pointerdown', 'mousedown', 'touchstart']) {
      this.elemento.addEventListener(tipo, evento => evento.stopPropagation());
    }
    this.elemento.innerHTML = '<header><h2 class="metronet-titulo metronet-titulo--panel">Tutorial</h2><button type="button" data-tutorial-alternar aria-expanded="true">Minimizar</button></header><div data-tutorial-contenido aria-live="polite" aria-atomic="true"></div>';
    this.contenido = this.elemento.querySelector('[data-tutorial-contenido]');
    this.boton = this.elemento.querySelector('button');
    this.boton.addEventListener('click', () => {
      this.estado.minimizado = !this.estado.minimizado;
      this.renderizar();
    });
    mapa?.append(this.elemento);
  }

  actualizar(contexto) {
    const id = JSON.stringify([contexto.diseno?.simulacion?.idDiseno, contexto.escenario?.idEscenario]);
    if (!this.intentos.has(id)) this.intentos.set(id, { aprendidas: new Set(), minimizado: false });
    this.estado = this.intentos.get(id);
    this.leccion = siguienteLeccion(contexto, this.estado.aprendidas);
    this.elemento.hidden = !this.leccion;
    if (this.leccion) this.renderizar();
    return Boolean(this.leccion);
  }

  renderizar() {
    const { clave, titulo, texto } = this.leccion;
    this.elemento.dataset.paso = clave;
    if (this.contenido.dataset.paso !== clave) {
      const encabezado = document.createElement('strong'); encabezado.textContent = titulo;
      const parrafo = document.createElement('p'); parrafo.textContent = texto;
      this.contenido.replaceChildren(encabezado, parrafo);
      this.contenido.dataset.paso = clave;
    }
    this.contenido.hidden = this.estado.minimizado;
    this.boton.textContent = this.estado.minimizado ? 'Abrir' : 'Minimizar';
    this.boton.setAttribute('aria-label', `${this.estado.minimizado ? 'Abrir' : 'Minimizar'} tutorial`);
    this.boton.setAttribute('aria-expanded', String(!this.estado.minimizado));
  }

  registrarUso(herramienta) { this.estado?.aprendidas.add(herramienta); }
  eliminar() { this.elemento.remove(); this.intentos.clear(); }
}
