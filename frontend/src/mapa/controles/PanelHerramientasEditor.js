const HERRAMIENTAS = [
  ['estaciones', 'Estación', 'Construcción', 'Ingresá un nombre y elegí Crear estación para ubicarla en el mapa.'],
  ['lineas', 'Línea', 'Construcción', 'Ingresá un nombre, activá Crear línea y seleccioná las estaciones en orden.'],
  ['conexiones', 'Conexión', 'Construcción', 'Elegí una línea y activá Conectar estaciones para seleccionar sus extremos.'],
  ['seleccion', 'Seleccionar', 'Edición', 'Seleccioná un elemento del mapa para consultar sus acciones.'],
  ['transbordos', 'Transbordos', 'Edición', 'Seleccioná una estación del mapa para consultar sus opciones de transbordo.'],
  ['metros', 'Metros', 'Unidades', 'Elegí una línea y configurá la unidad de metro.'],
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
      boton.textContent = nombre;
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
        ayuda.textContent = 'Cuando la edición de la estación esté disponible, usá Editar para habilitar o revisar el transbordo entre líneas.';
        panel.append(ayuda);
      }
      this.paneles.set(clave, panel);
    }
    this.ayuda = document.createElement('p');
    this.ayuda.className = 'metronet-herramientas__ayuda';
    this.ayuda.setAttribute('role', 'status');
    this.cancelar = document.createElement('button');
    this.cancelar.type = 'button';
    this.cancelar.textContent = 'Cancelar operación';
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
    if (notificar) this.alCambiar();
  }

  actualizarDisponibilidad(herramientas, esProgresivo) {
    this.botones.forEach((boton, clave) => {
      boton.disabled = herramientas[clave] === false || (clave === 'escenarios' && esProgresivo);
      boton.title = boton.disabled ? 'No disponible en este escenario.' : '';
      if (clave === 'escenarios') boton.closest('fieldset').hidden = boton.disabled;
    });
    if (this.botones.get(this.activa).disabled) this.seleccionar('seleccion');
  }

  actualizarOperacion(modo, estaciones = []) {
    const mensajes = {
      crearEstacion: 'Seleccioná una posición del mapa para ubicar la estación.',
      reubicarEstacion: 'Seleccioná la nueva posición de la estación en el mapa.',
      crearLinea: `Seleccioná al menos dos estaciones en orden (${estaciones.length} seleccionadas) y confirmá con Crear línea.`,
      crearTramo: `Seleccioná dos estaciones (${estaciones.length} seleccionadas) y confirmá con Conectar estaciones.`,
    };
    this.ayuda.textContent = mensajes[modo] ?? HERRAMIENTAS.find(([clave]) => clave === this.activa)[3];
    this.cancelar.hidden = modo === 'normal';
    this.contenedor.classList.toggle('operacion-en-curso', modo !== 'normal');
  }
}
