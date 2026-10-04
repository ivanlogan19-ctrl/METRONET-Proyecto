import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
const HERRAMIENTAS = [
  ['estaciones', 'Estación', 'Construcción'],
  ['lineas', 'Línea', 'Construcción'],
  ['conexiones', 'Conexión', 'Construcción'],
  ['seleccion', 'Seleccionar', 'Edición'],
  ['metros', 'Metros', 'Unidades'],
  ['escenarios', 'Actividad propia', 'Proyecto'],
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
      this.paneles.set(clave, panel);
    }
    this.cancelar = document.createElement('button');
    this.cancelar.type = 'button';
    configurarBotonIcono(this.cancelar, 'cancelar', 'Cancelar operación');
    this.cancelar.dataset.cancelarHerramienta = '';
    this.cancelar.addEventListener('click', () => this.seleccionar('seleccion'));
    categorias.get('Edición').append(this.cancelar);
    contenedor.append(barra, ...this.paneles.values());
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
      boton.title = boton.disabled ? 'No disponible aquí.' : boton.getAttribute('aria-label');
      if (clave === 'escenarios') boton.closest('fieldset').hidden = boton.disabled;
    });
    if (this.botones.get(this.activa).disabled) this.seleccionar('seleccion');
  }

  actualizarOperacion(modo) {
    this.cancelar.hidden = modo === 'normal';
    this.contenedor.classList.toggle('operacion-en-curso', modo !== 'normal');
  }
}
