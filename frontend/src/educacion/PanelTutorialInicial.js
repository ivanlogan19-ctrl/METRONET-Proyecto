import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import { anclarPanelDesplegable } from '../interfaz/PanelDesplegable.js';
import { pasoPractico, leccionesDisponibles, herramientasIntroducidas } from './TutorialInicial.js';
import RecorridoInicial from './RecorridoInicial.js';
import { consumirInicioTutorial } from './InicioTutorial.js';
import { destacarConceptos, cerrarDefinicion } from './glosario/GlosarioContextual.js';
import { conceptosDelNivel } from './glosario/ContextoConceptos.js';
import './tutorial-inicial.css';

let secuenciaTutorial = 0;

export default class PanelTutorialInicial {
  constructor(contenedor) {
    this.intentos = new Map();
    this.elemento = document.createElement('details');
    // Exclusión nativa inmediata: un toggle pendiente no debe cerrar el acceso más reciente.
    this.elemento.name = 'metronet-asistencia';
    this.elemento.className = 'metronet-tutorial';
    this.elemento.setAttribute('aria-label', 'Tutorial de herramientas');
    this.elemento.innerHTML = '<summary></summary><section class="metronet-tutorial__panel"><header><h2>Tutorial</h2><button type="button" data-tutorial-cerrar></button></header><div data-tutorial-contenido aria-live="polite"></div></section>';
    this.acceso = this.elemento.querySelector('summary');
    configurarBotonIcono(this.acceso, 'tutorial', 'Tutorial');
    const panel = this.elemento.querySelector('section');
    panel.id = `metronet-tutorial-${++secuenciaTutorial}`;
    this.acceso.setAttribute('aria-controls', panel.id);
    const cerrar = this.elemento.querySelector('[data-tutorial-cerrar]');
    configurarBotonIcono(cerrar, 'cancelar', 'Cerrar tutorial');
    cerrar.addEventListener('click', () => { this.elemento.open = false; this.acceso.focus({ preventScroll:true }); });
    this.contenido = this.elemento.querySelector('[data-tutorial-contenido]');
    contenedor.append(this.elemento);
    this.liberar = anclarPanelDesplegable(this.elemento, this.elemento.querySelector('section'), { cerrarAlSalir:false });
    this.recorrido = new RecorridoInicial(() => this.comenzarPractica());
    this.cerrarOtros = evento => {
      if (evento.target.open && evento.target.matches?.('.metronet-hud, .metronet-poi')) this.elemento.open = false;
    };
    document.addEventListener('toggle', this.cerrarOtros, true);
    this.elemento.addEventListener('toggle', () => {
      if (!this.elemento.open) cerrarDefinicion();
      else document.querySelectorAll('.metronet-hud[open], .metronet-poi[open]').forEach(e => { e.open = false; });
    });
  }

  actualizar(contexto) {
    if (contexto.identificando) return false;
    this.contexto = contexto;
    const id = JSON.stringify([contexto.diseno?.simulacion?.idDiseno, contexto.escenario?.idEscenario]);
    const nuevo = this.id !== id;
    if (nuevo) { this.recorrido.terminar(false); this.elemento.open = false; this.id = id; }
    const disponible = Boolean(contexto.diseno);
    this.elemento.hidden = !disponible;
    if (!disponible) return false;
    if (!this.intentos.has(id)) {
      const primeraPasada = consumirInicioTutorial(contexto.diseno, contexto.escenario);
      this.intentos.set(id, { aprendidas:new Set(), primeraPasada, fase:primeraPasada && contexto.escenario?.numero === 1 ? 'oferta' : 'practica' });
    }
    this.estado = this.intentos.get(id);
    this.leccion = pasoPractico(contexto, this.estado);
    this.elemento.dataset.paso = this.leccion?.clave ?? 'manual';
    this.elemento.dataset.fase = this.estado.fase;
    const identidad = JSON.stringify([id, this.estado.fase, this.leccion, contexto.error, leccionesDisponibles(contexto)]);
    if (identidad !== this.identidad) { this.identidad = identidad; this.renderizar(); }
    if (nuevo && this.estado.primeraPasada && (this.estado.fase === 'oferta' || (this.leccion && herramientasIntroducidas(contexto.escenario, contexto.catalogo).length))) { this.estado.primeraPasada = false; this.elemento.open = true; }
    return Boolean(this.leccion);
  }

  boton(texto, accion) {
    const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = texto;
    boton.addEventListener('click', accion); return boton;
  }

  renderizar() {
    const contenido = [];
    const texto = (contenidoTexto, etiqueta = 'p') => { const e = document.createElement(etiqueta); e.textContent = contenidoTexto; contenido.push(e); return e; };
    if (this.estado.fase === 'oferta') {
      texto('¿Querés conocer los controles de la pantalla antes de comenzar?');
      const acciones = texto('', 'div'); acciones.className = 'metronet-tutorial__acciones';
      acciones.append(this.boton('Mostrar tutorial', () => {
        this.estado.fase = 'recorrido'; this.elemento.open = false; this.recorrido.iniciar();
      }), this.boton('Comenzar directamente', () => this.comenzarPractica()));
    } else if (this.leccion) {
      texto(this.leccion.titulo, 'strong');
      texto(this.leccion.texto);
      const error = this.contexto.error;
      if (error) texto(typeof error === 'string' ? error : error.message ?? error.mensaje ?? 'La operación no pudo completarse. Revisá la ubicación o selección e intentá nuevamente.').className = 'metronet-tutorial__error';
    } else {
      for (const leccion of leccionesDisponibles(this.contexto)) {
        const bloque = document.createElement('details'), titulo = document.createElement('summary'), parrafo = document.createElement('p');
        titulo.textContent = leccion.titulo; parrafo.textContent = leccion.texto; bloque.append(titulo, parrafo); contenido.push(bloque);
      }
    }
    if (this.estado.fase === 'practica' && this.contexto.escenario?.numero === 1) {
      const repetir = this.boton('Recorrer la pantalla', () => { this.elemento.open = false; this.recorrido.iniciar(); });
      repetir.className = 'metronet-tutorial__repetir'; contenido.push(repetir);
    }
    this.contenido.replaceChildren(...contenido);
    destacarConceptos(this.contenido, conceptosDelNivel(this.contexto.escenario), { contextual:true });
  }

  comenzarPractica() {
    this.estado.fase = 'practica'; this.actualizar(this.contexto); this.elemento.open = true;
    this.acceso.focus({ preventScroll:true });
  }
  registrarUso(herramienta) { this.estado?.aprendidas.add(herramienta); }
  eliminar() {
    this.recorrido.terminar(false); this.liberar(); document.removeEventListener('toggle', this.cerrarOtros, true);
    this.elemento.remove(); this.intentos.clear();
  }
}
