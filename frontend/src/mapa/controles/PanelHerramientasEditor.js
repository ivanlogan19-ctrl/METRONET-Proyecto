import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
const HERRAMIENTAS = [
  ['estaciones', 'Estación', 'Construcción', 'Hacé clic en el mapa para colocar estaciones. Arrastrá para moverlo; Escape termina la herramienta.'],
  ['lineas', 'Línea', 'Construcción', 'Elegí dos estaciones para crear una línea. El nombre se asigna automáticamente.'],
  ['conexiones', 'Conexión', 'Construcción', 'Elegí la línea activa y dos estaciones para conectar. Después podés seguir extendiendo el recorrido.'],
  ['seleccion', 'Seleccionar', 'Edición', 'Seleccioná un elemento del mapa para consultar sus acciones.'],
  ['transbordos', 'Transbordos', 'Edición', 'Elegí una estación compartida por dos líneas para habilitar su transbordo.'],
  ['metros', 'Metros', 'Unidades', 'Hacé clic sobre una vía para asignar un metro. Sus parámetros se editan después.'],
  ['escenarios', 'Actividad propia', 'Proyecto', 'Configurá el nombre y la dificultad de un escenario propio.'],
];

// Solo organiza controles y estados visuales. Las operaciones siguen en EditorRedMetro.
export default class PanelHerramientasEditor {
  constructor(contenedor, grupos, seleccion, alCambiar) {
    this.contenedor = contenedor;
    this.alCambiar = alCambiar;
    this.activa = 'seleccion';
    this.botones = new Map();
    this.paneles = new Map();
    const barra = document.createElement('div');
    barra.className = 'metronet-herramientas__barra';
    const categorias = new Map();
    for (const [clave, nombre, categoria] of HERRAMIENTAS) {
      if (!categorias.has(categoria)) {
        const grupo = document.createElement('fieldset');
        const leyenda = document.createElement('legend');
        leyenda.textContent = categoria;
        grupo.append(leyenda);
        categorias.set(categoria, grupo);
        barra.append(grupo);
      }
      const boton = document.createElement('button');
      boton.type = 'button';
      configurarBotonIcono(boton, clave, nombre);
      boton.dataset.elegirHerramienta = clave;
      boton.setAttribute('aria-controls', `opciones-editor-${clave}`);
      boton.addEventListener('click', () => this.seleccionar(clave));
      categorias.get(categoria).append(boton);
      this.botones.set(clave, boton);

      const panel = document.createElement('section');
      panel.id = `opciones-editor-${clave}`;
      panel.dataset.panelHerramienta = clave;
      panel.className = 'metronet-herramientas__opciones';
      panel.setAttribute('aria-label', `Opciones: ${nombre}`);
      if (clave === 'seleccion') panel.append(seleccion);
      else if (grupos.has(clave)) panel.append(grupos.get(clave));
      else if (clave === 'transbordos') {
        const ayuda = document.createElement('p');
        ayuda.className = 'metronet-editor-ayuda';
        ayuda.textContent = 'El transbordo permite intercambiar entre dos líneas que comparten una estación.';
        panel.append(ayuda);
      }
      this.paneles.set(clave, panel);
    }
    this.ayuda = document.createElement('p');
    this.ayuda.className = 'metronet-herramientas__ayuda';
    this.ayuda.setAttribute('role', 'status');
    this.cancelar = document.createElement('button');
    this.cancelar.type = 'button';
    configurarBotonIcono(this.cancelar, 'cancelar', 'Cancelar operación');
    this.cancelar.dataset.cancelarHerramienta = '';
    this.cancelar.addEventListener('click', () => this.seleccionar('seleccion'));
    contenedor.append(barra, this.ayuda, ...this.paneles.values(), this.cancelar);
    this.seleccionar('seleccion', false);
    this.actualizarOperacion('normal');
  }

  seleccionar(clave, notificar = true) {
    if (!this.botones.has(clave) || this.botones.get(clave).disabled) return;
    this.activa = clave;
    this.botones.forEach((boton, herramienta) => boton.setAttribute('aria-pressed', String(herramienta === clave)));
    this.paneles.forEach((panel, herramienta) => { panel.hidden = herramienta !== clave; });
    this.actualizarOperacion('normal');
    if (notificar) this.alCambiar(clave);
  }

  actualizarDisponibilidad(herramientas, esProgresivo) {
    this.botones.forEach((boton, clave) => {
      boton.disabled = herramientas[clave] === false || (clave === 'escenarios' && esProgresivo);
      boton.title = boton.disabled ? 'No disponible en este escenario.' : boton.getAttribute('aria-label');
      if (clave === 'escenarios') boton.closest('fieldset').hidden = boton.disabled;
    });
    if (this.botones.get(this.activa).disabled) this.seleccionar('seleccion');
  }

  actualizarOperacion(modo, estaciones = []) {
    const mensajes = {
      crearEstacion: 'Clic para colocar estaciones; arrastrá para mover el mapa. Teclado: enfocá el mapa, flechas y Enter.',
      reubicarEstacion: 'Seleccioná la nueva posición de la estación en el mapa.',
      crearLinea: `Nueva línea: ${estaciones.length ? `origen ${estaciones[0]}. Elegí el destino.` : 'elegí su primera estación.'}`,
      crearTramo: `Conexión: ${estaciones.length ? `desde ${estaciones[0]}. Elegí el destino.` : 'elegí una estación de origen.'}`,
    };
    this.ayuda.textContent = mensajes[modo] ?? HERRAMIENTAS.find(([clave]) => clave === this.activa)[3];
    this.cancelar.hidden = modo === 'normal';
    this.contenedor.classList.toggle('operacion-en-curso', modo !== 'normal');
  }
}
