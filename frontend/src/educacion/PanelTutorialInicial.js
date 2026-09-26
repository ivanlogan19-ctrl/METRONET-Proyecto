import { iconoRetro } from '../interfaz/IconosRetro.js';
import { siguienteLeccion, leccionesDisponibles } from './TutorialInicial.js';
import { destacarConceptos } from './glosario/GlosarioContextual.js';
import { conceptosDelNivel } from './glosario/ContextoConceptos.js';
import './tutorial-inicial.css';

// Contenido del manual dentro del HUD; nunca reserva una zona propia sobre el mapa.
export default class PanelTutorialInicial {
  constructor(contenedor) {
    this.intentos = new Map();
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-tutorial';
    this.elemento.setAttribute('aria-label', 'Tutorial de herramientas');
    this.contenido = document.createElement('div');
    this.contenido.dataset.tutorialContenido = '';
    this.contenido.setAttribute('aria-live', 'polite');
    this.elemento.append(this.contenido);
    contenedor.append(this.elemento);
  }

  actualizar(contexto) {
    const id = JSON.stringify([contexto.diseno?.simulacion?.idDiseno, contexto.escenario?.idEscenario]);
    if (!this.intentos.has(id)) this.intentos.set(id, { aprendidas: new Set() });
    this.estado = this.intentos.get(id);
    this.leccion = siguienteLeccion(contexto, this.estado.aprendidas);
    this.elemento.dataset.paso = this.leccion?.clave ?? 'manual';
    const lecciones = this.leccion ? [this.leccion] : leccionesDisponibles(contexto);
    const identidad = JSON.stringify([id, lecciones]);
    if (identidad !== this.identidad) {
      this.identidad = identidad;
      const contenido = lecciones.map(({clave, titulo, texto}) => {
        const bloque = document.createElement(this.leccion ? 'section' : 'details');
        const encabezado = document.createElement(this.leccion ? 'strong' : 'summary');
        encabezado.innerHTML = iconoRetro(clave === 'simulacion' ? 'play' : clave);
        encabezado.append(document.createTextNode(titulo));
        const parrafo = document.createElement('p'); parrafo.textContent = texto;
        bloque.append(encabezado, parrafo);
        return bloque;
      });
      if (!contenido.length) {
        const vacio = document.createElement('p');
        vacio.textContent = 'El manual presenta las herramientas disponibles al abrir un diseño o escenario.';
        contenido.push(vacio);
      }
      this.contenido.replaceChildren(...contenido);
      destacarConceptos(this.contenido, conceptosDelNivel(contexto.escenario ?? contexto.diseno?.simulacion), { contextual:true });
    }
    return Boolean(this.leccion);
  }

  registrarUso(herramienta) { this.estado?.aprendidas.add(herramienta); }
  eliminar() { this.elemento.remove(); this.intentos.clear(); }
}
