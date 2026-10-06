import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
const HERRAMIENTAS = [
  ['estaciones', 'Estación', 'Construcción'],
  ['lineas', 'Línea', 'Construcción'],
  ['conexiones', 'Conexión', 'Construcción'],
  ['seleccion', 'Seleccionar', 'Edición'],
  ['metros', 'Metros', 'Unidades'],
];

// Solo organiza controles y estados visuales. Las operaciones siguen en EditorRedMetro.
export default class PanelHerramientasEditor {
  constructor(contenedor, grupos, seleccion, alCambiar, alAccionEdicion) {
    this.contenedor = contenedor;
    this.alCambiar = alCambiar;
    this.alAccionEdicion = alAccionEdicion;
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
    this.grupoEdicion = categorias.get('Edición');
    this.mover = document.createElement('button');
    this.mover.type = 'button';
    configurarBotonIcono(this.mover, 'mover', 'Mover estación seleccionada');
    this.mover.disabled = true;
    this.mover.addEventListener('click', () => this.alAccionEdicion('mover'));
    this.eliminar = document.createElement('button');
    this.eliminar.type = 'button';
    configurarBotonIcono(this.eliminar, 'eliminar', 'Eliminar elemento seleccionado');
    this.eliminar.disabled = true;
    this.eliminar.addEventListener('click', () => this.alAccionEdicion('eliminar'));
    this.cancelar = document.createElement('button');
    this.cancelar.type = 'button';
    configurarBotonIcono(this.cancelar, 'cancelar', 'Cancelar operación');
    this.cancelar.dataset.cancelarHerramienta = '';
    this.cancelar.disabled = true;
    this.cancelar.addEventListener('click', () => this.seleccionar('seleccion'));
    this.grupoEdicion.append(this.mover, this.eliminar, this.cancelar);
    contenedor.append(barra, ...this.paneles.values());
    this.seleccionar('seleccion', false);
    this.actualizarOperacion('normal');
  }

  seleccionar(clave, notificar = true) {
    if (!this.botones.has(clave) || this.botones.get(clave).disabled) return;
    this.activa = clave;
    this.botones.forEach((boton, herramienta) => boton.setAttribute('aria-pressed', String(herramienta === clave)));
    this.paneles.forEach((panel, herramienta) => {
      panel.hidden = herramienta !== clave || ['seleccion', 'lineas', 'conexiones'].includes(herramienta);
    });
    this.actualizarOperacion('normal');
    if (notificar) this.alCambiar(clave);
  }

  actualizarDisponibilidad(herramientas, esProgresivo) {
    this.botones.forEach((boton, clave) => {
      boton.disabled = herramientas[clave] === false;
      boton.title = boton.disabled ? 'No disponible aquí.' : boton.getAttribute('aria-label');
    });
    if (this.botones.get(this.activa).disabled) this.seleccionar('seleccion');
  }

  actualizarOperacion(modo) {
    this.cancelar.disabled = modo === 'normal';
    this.contenedor.classList.toggle('operacion-en-curso', modo !== 'normal');
  }

  actualizarAccionesSeleccion(puedeMover, puedeEliminar) {
    this.mover.disabled = !puedeMover;
    this.eliminar.disabled = !puedeEliminar;
  }
}
