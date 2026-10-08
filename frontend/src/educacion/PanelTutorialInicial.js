import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import { anclarPanelDesplegable } from '../interfaz/PanelDesplegable.js';
import { pasoPractico, leccionesDisponibles, herramientasIntroducidas } from './TutorialInicial.js';
import RecorridoInicial from './RecorridoInicial.js';
import { consumirInicioTutorial } from './InicioTutorial.js';
import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { cerrarDefinicion } from './glosario/GlosarioContextual.js';
import './tutorial-inicial.css';

let secuenciaTutorial = 0;
const PASOS_NOVEDAD = {
  estaciones: [
    ['[data-elegir-herramienta="estaciones"]', 'Estación', 'Elegí este icono para ubicar estaciones.'],
    ['#metronet-mapa', 'Ubicar estación', 'Después, elegí un lugar del mapa. Podés colocar varias estaciones seguidas; Escape termina la herramienta.'],
  ],
  lineas: [
    ['[data-elegir-herramienta="lineas"]', 'Línea', 'Elegí este icono para crear una línea.'],
    ['#metronet-mapa', 'Trazar línea', 'Seleccioná dos estaciones distintas del mapa. La línea se crea con su primer tramo.'],
  ],
  conexiones: [
    ['[data-elegir-herramienta="conexiones"]', 'Conexión', 'Elegí el icono de vía para extender una línea.'],
    ['#metronet-mapa', 'Extender recorrido', 'Elegí la línea activa, la estación de origen y otra de destino para agregar un tramo.'],
  ],
  metros: [
    ['[data-elegir-herramienta="metros"]', 'Unidad de metro', 'Elegí este icono para asignar una unidad.'],
    ['#metronet-mapa', 'Asignar metro', 'Tocá una vía del mapa. La unidad quedará asignada a esa línea.'],
  ],
  simulacion: [
    ['[data-ir-simulacion]', 'Simular', 'Este botón abre la pantalla de Simulación cuando la red está preparada. Allí podrás iniciar el recorrido con Play.'],
  ],
};
const HERRAMIENTAS_NUEVAS = {
  estaciones: ['Estación', 'Ubicá estaciones en el mapa. Escape termina la herramienta.'],
  lineas: ['Línea', 'Uní dos estaciones para iniciar un recorrido.'],
  conexiones: ['Conexión', 'Agregá tramos a una línea existente.'],
  metros: ['Unidad de metro', 'Asigná una unidad a una vía del mapa.'],
  simulacion: ['Simulación', 'Comprobá la red y abrí su recorrido simulado.'],
};

export default class PanelTutorialInicial {
  constructor(contenedor) {
    this.intentos = new Map();
    this.elemento = document.createElement('details');
    // Exclusión nativa inmediata: un toggle pendiente no debe cerrar el acceso más reciente.
    this.elemento.name = 'metronet-asistencia';
    this.elemento.className = 'metronet-tutorial';
    this.elemento.setAttribute('aria-label', 'Tutorial de herramientas');
    this.elemento.innerHTML = '<summary></summary><section class="metronet-tutorial__panel"><header><h2>Tutorial</h2></header><div data-tutorial-contenido aria-live="polite"></div></section>';
    this.acceso = this.elemento.querySelector('summary');
    configurarBotonIcono(this.acceso, 'tutorialPizarra', 'Tutorial');
    const panel = this.elemento.querySelector('section');
    panel.id = `metronet-tutorial-${++secuenciaTutorial}`;
    this.acceso.setAttribute('aria-controls', panel.id);
    this.contenido = this.elemento.querySelector('[data-tutorial-contenido]');
    contenedor.append(this.elemento);
    this.liberar = anclarPanelDesplegable(this.elemento, this.elemento.querySelector('section'));
    this.cerrarConEscape = evento => {
      if (evento.key !== 'Escape' || !this.elemento.open) return;
      evento.preventDefault();
      this.elemento.open = false;
      this.acceso.focus({ preventScroll:true });
    };
    document.addEventListener('keydown', this.cerrarConEscape);
    this.recorrido = new RecorridoInicial(() => this.comenzarPractica());
    this.recorridoNovedades = null;
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
    if (nuevo) { this.recorrido.terminar(false); this.recorridoNovedades?.terminar(false); this.elemento.open = false; this.id = id; }
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
    const nuevas = herramientasIntroducidas(contexto.escenario, contexto.catalogo);
    this.herramientasNuevas = nuevas;
    const claveNovedad = nuevas.length
      ? `metronet:tutorial-nueva-herramienta:v1:${obtenerSesionActiva()?.usuario?.idUsuario}:${contexto.escenario.numero}` : null;
    if (nuevo) {
      this.claveNovedad = claveNovedad;
      this.recorridoNovedades = nuevas.length ? new RecorridoInicial((completado, motivo) => {
        if (this.claveNovedad && (completado || motivo === 'omitido')) try {
          localStorage.setItem(this.claveNovedad, completado ? 'presentada' : 'omitida');
        } catch { /* La guía sigue disponible. */ }
        if (completado && this.contexto?.escenario?.numero === 1) this.comenzarPractica();
      }, {
        interactivo: true, senalarDeshabilitados: true, disparador: '.metronet-tutorial > summary',
        pasos: nuevas.flatMap(clave => PASOS_NOVEDAD[clave] ?? []),
        tituloFinal: '¡Listos para construir!',
        textoFinal: 'Ya conocés la herramienta. Podés comenzar a construir la red.',
      }) : null;
    }
    const identidad = JSON.stringify([id, this.estado.fase, this.leccion, contexto.error, leccionesDisponibles(contexto)]);
    if (identidad !== this.identidad) { this.identidad = identidad; this.renderizar(); }
    let novedadPendiente = false;
    if (claveNovedad) {
      try { novedadPendiente = localStorage.getItem(claveNovedad) == null; }
      catch { novedadPendiente = true; }
    }
    if (nuevo && !this.recorridosSuspendidos && (novedadPendiente || (this.estado.primeraPasada && this.estado.fase === 'oferta'))) {
      this.estado.primeraPasada = false;
      if (novedadPendiente) this.mostrarNovedades();
      else this.elemento.open = true;
    }
    return Boolean(this.leccion);
  }

  boton(texto, accion) {
    const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = texto;
    boton.addEventListener('click', accion); return boton;
  }

  mostrarNovedades() {
    this.recorridoNovedades?.terminar(false);
    this.iniciarRecorrido(this.recorridoNovedades);
  }

  iniciarRecorrido(recorrido) {
    this.elemento.open = false;
    this.acceso.focus({ preventScroll:true });
    recorrido?.iniciar();
  }

  renderizar() {
    const contenido = [];
    const texto = (contenidoTexto, etiqueta = 'p') => { const e = document.createElement(etiqueta); e.textContent = contenidoTexto; contenido.push(e); return e; };
    texto('Estas son las herramientas que utilizarás en este nivel.');
    const lista = document.createElement('div');
    lista.className = 'metronet-tutorial__herramientas';
    const temas = [['Nivel', 'Cumplí los objetivos del nivel para avanzar.'],
      ...this.herramientasNuevas.map(clave => HERRAMIENTAS_NUEVAS[clave])];
    for (const [nombre, descripcion] of temas) {
        const item = document.createElement('p');
        const titulo = document.createElement('strong');
        const explicacion = document.createElement('span');
        titulo.textContent = `${nombre} → `;
        explicacion.textContent = descripcion;
        item.append(titulo, explicacion);
        lista.append(item);
    }
    contenido.push(lista);
    if (!this.herramientasNuevas.length) texto('Seguí usando las herramientas que ya conocés.');
    if (this.estado.fase === 'oferta') {
      texto('¿Querés ver el tutorial de nuevo?');
      const acciones = texto('', 'div'); acciones.className = 'metronet-tutorial__acciones';
      acciones.append(this.boton('Mostrar tutorial', () => {
        this.estado.fase = 'recorrido'; this.iniciarRecorrido(this.recorrido);
      }), this.boton('Comenzar directamente', () => this.comenzarPractica()));
    } else {
      const error = this.contexto.error;
      if (error) texto(typeof error === 'string' ? error : error.message ?? error.mensaje ?? 'La operación no pudo completarse. Revisá la ubicación o selección e intentá nuevamente.').className = 'metronet-tutorial__error';
    }
    const repetir = this.boton('Recorrer la pantalla', () => {
      if (this.contexto.escenario?.numero !== 1 && this.herramientasNuevas.length) this.mostrarNovedades();
      else this.iniciarRecorrido(this.recorrido);
    });
    repetir.className = 'metronet-tutorial__repetir'; contenido.push(repetir);
    this.contenido.replaceChildren(...contenido);
  }

  comenzarPractica() {
    this.estado.fase = 'practica'; this.actualizar(this.contexto); this.elemento.open = false;
    this.acceso.focus({ preventScroll:true });
  }
  registrarUso(herramienta) { this.estado?.aprendidas.add(herramienta); }
  cerrarRecorridos(suspender = false) {
    if (suspender) this.recorridosSuspendidos = true;
    this.recorrido.terminar(false);
    this.recorridoNovedades?.terminar(false);
    this.elemento.open = false;
  }
  reactivarRecorridos() {
    this.recorridosSuspendidos = false;
    this.id = null;
    if (this.contexto?.diseno) this.actualizar(this.contexto);
  }
  eliminar() {
    this.cerrarRecorridos(); this.liberar(); document.removeEventListener('toggle', this.cerrarOtros, true);
    document.removeEventListener('keydown', this.cerrarConEscape);
    this.elemento.remove(); this.intentos.clear();
  }
}
