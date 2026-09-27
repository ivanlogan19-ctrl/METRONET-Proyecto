import { VELOCIDAD_INICIAL } from '../../simulacion/EscalaSimulacion.js';
import { siguienteNombre } from './NombresRed.js';
import { estaMantenimientoActivo, MENSAJE_MANTENIMIENTO } from '../../configuracion/ConfiguracionAplicacion.js';

const MODOS = { estaciones: 'crearEstacion', lineas: 'crearLinea', conexiones: 'crearTramo', metros: 'crearMetro' };

// Estado e interacción del editor; la capa gráfica solo comunica gestos/selecciones.
export default class CreacionDirecta {
  constructor(editor) { this.editor = editor; this.lineaActiva = ''; this.version = 0; this.pendiente = null; }
  cancelar() {
    this.version += 1;
    const opciones = this.editor.obtener('[data-lineas-superpuestas]');
    if (opciones) { opciones.replaceChildren(); opciones.hidden = true; }
  }
  disponible({ permitirEspera = false } = {}) {
    const e = this.editor;
    if (!e.activo || !e.disenoActual || e.finalizacionEnCurso || (!permitirEspera && this.pendiente) || e.aperturaEscenarioEnCurso) return false;
    if (estaMantenimientoActivo(e.sesion)) { e.mostrarMensaje(MENSAJE_MANTENIMIENTO, 'advertencia'); return false; }
    if (e.esEscenarioProgresivo() && e.disenoActual.simulacion.estado === 'COMPLETADO') {
      e.mostrarMensaje('Este logro está protegido. Usá Volver a jugar para construir un nuevo intento.', 'advertencia'); return false;
    }
    return true;
  }
  activar(clave) {
    const e = this.editor;
    e.restablecerModo();
    if (!MODOS[clave]) return;
    if (!this.disponible({ permitirEspera:true })) {
      e.panelHerramientas.seleccionar('seleccion', false);
      return;
    }
    e.escena.capaPuntosInteres?.ocultarInformacion({ conservarSeleccion: true });
    e.modo = MODOS[clave];
    e.capaRedMetro.establecerModo(e.modo);
    e.actualizarOperacionAyuda();
  }
  elegirLinea(nombre) {
    if (nombre && !this.editor.disenoActual?.lineas.some(l => l.nombre === nombre)) return;
    if (this.lineaActiva !== nombre) {
      this.editor.estacionesSeleccionadas = [];
      this.editor.capaRedMetro.establecerEstacionesSeleccionadas([]);
    }
    this.lineaActiva = nombre;
    this.editor.capaRedMetro.lineaActiva = nombre;
    this.editor.obtener('[data-linea-conexion]').value = nombre;
    this.editor.actualizarOperacionAyuda();
  }
  async enviar(crearSolicitud, mensaje, alCompletar = () => {}) {
    if (!this.disponible()) return false;
    const e = this.editor, id = e.idDiseno(), version = this.version, contexto = e.versionContexto;
    const mismoDiseno = () => e.activo && contexto === e.versionContexto && e.disenoActual?.simulacion.idDiseno === id;
    const vigente = () => mismoDiseno() && this.version === version;
    this.pendiente = (async () => {
      try {
        for (let intento = 0; intento < 2; intento += 1) {
          const solicitud = crearSolicitud();
          try {
            await e.clienteDisenos.solicitar(`/${id}${solicitud.ruta}`, { method: solicitud.metodo ?? 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(solicitud.datos) });
            break;
          } catch (error) {
            // Solo un conflicto de nombre conocido admite recálculo; nunca reintentar una escritura incierta.
            if (intento || !solicitud.nombreAutomatico || error.estadoHttp !== 409 || !/ese nombre/i.test(error.message) || !vigente()) throw error;
            if (!await e.abrirDiseno(id)) return false;
          }
        }
        if (!mismoDiseno()) return false;
        e.cambiosPendientes = true;
        if (!await e.abrirDiseno(id)) return false;
        if (!vigente()) return true;
        alCompletar();
        e.capaRedMetro.establecerEstacionesSeleccionadas(e.estacionesSeleccionadas);
        e.actualizarOperacionAyuda();
        e.mostrarMensaje(mensaje, 'exito');
        return true;
      } catch (error) { if (vigente()) e.mostrarError(error); return false; }
      finally { e.contenedor?.removeAttribute('aria-busy'); }
    })();
    e.contenedor.setAttribute('aria-busy', 'true');
    try { return await this.pendiente; } finally { this.pendiente = null; }
  }
  async ubicar(posicion, modo) {
    const e = this.editor;
    if (!posicion || !this.disponible()) return;
    const estacion = modo === 'reubicarEstacion' ? e.elementoSeleccionado?.valor : null;
    const error = e.escena.territorioMapa?.errorMovimiento(posicion, estacion?.nombre, e.disenoActual);
    if (error) { e.capaRedMetro.indicarPosicionInvalida(posicion); return e.mostrarMensaje(error, 'advertencia'); }
    await this.enviar(() => ({
      ruta: estacion ? `/estaciones/${encodeURIComponent(estacion.nombre)}` : '/estaciones',
      metodo: estacion ? 'PATCH' : 'POST', nombreAutomatico: !estacion,
      datos: { ...(estacion ?? { nombre: siguienteNombre('Estación', e.disenoActual.estaciones) }), posicionX: posicion.posicionX, posicionY: posicion.posicionY },
    }), 'Estación guardada.', () => { if (estacion) e.panelHerramientas.seleccionar('seleccion'); });
  }
  seleccionar(elemento) {
    const e = this.editor;
    if (!Object.values(MODOS).includes(e.modo)) return false;
    if (!this.disponible()) return true;
    if (e.modo === 'crearMetro') {
      const lineas = elemento?.tipo === 'tramos' ? [...new Set(elemento.valor.map(t => t.nombreLinea))] : elemento?.tipo === 'tramo' ? [elemento.valor.nombreLinea] : [];
      if (lineas.length === 1) this.metro(lineas[0]);
      else if (lineas.length > 1) {
        const opciones = e.obtener('[data-lineas-superpuestas]');
        opciones.replaceChildren(...lineas.map(nombre => {
          const boton = document.createElement('button');
          boton.type = 'button'; boton.dataset.lineaSuperpuesta = nombre;
          boton.textContent = nombre;
          boton.setAttribute('aria-label', `Crear metro en ${nombre}`);
          return boton;
        }));
        opciones.hidden = false;
        opciones.querySelector('button').focus();
        e.mostrarMensaje('Aquí coinciden varias líneas. Elegí a cuál asignar el metro.', 'info');
      } else e.mostrarMensaje('Elegí una vía existente para asignarle el metro.', 'info');
      return true;
    }
    if (elemento?.tipo !== 'estacion') return true;
    if (!['crearLinea', 'crearTramo'].includes(e.modo)) return true;
    if (e.modo === 'crearTramo' && !this.lineaActiva) { e.mostrarMensaje('Elegí la línea activa antes de conectar sus estaciones.', 'info'); e.obtener('[data-linea-conexion]').focus(); return true; }
    const nombre = elemento.valor.nombre;
    if (e.estacionesSeleccionadas[0] === nombre) { e.estacionesSeleccionadas = []; }
    else e.estacionesSeleccionadas.push(nombre);
    e.capaRedMetro.establecerEstacionesSeleccionadas(e.estacionesSeleccionadas);
    e.actualizarOperacionAyuda();
    if (e.estacionesSeleccionadas.length === 2) this.conectar();
    return true;
  }
  async conectar() {
    const e = this.editor, estaciones = [...e.estacionesSeleccionadas], nueva = e.modo === 'crearLinea';
    const error = e.escena.territorioMapa?.errorRecorrido(estaciones, e.disenoActual);
    if (error) { e.estacionesSeleccionadas = estaciones.slice(0,1); e.capaRedMetro.establecerEstacionesSeleccionadas(e.estacionesSeleccionadas); e.actualizarOperacionAyuda(); return e.mostrarMensaje(error, 'advertencia'); }
    let nombre = this.lineaActiva;
    const guardada = await this.enviar(() => {
      if (nueva) nombre = siguienteNombre('Línea', e.disenoActual.lineas);
      return { ruta: nueva ? '/lineas' : '/tramos', nombreAutomatico: nueva,
        datos: nueva ? { nombre, estaciones } : { nombreLinea: nombre, estacionA: estaciones[0], estacionB: estaciones[1] } };
    }, nueva ? 'Línea creada. Ya podés extenderla con la herramienta Conexión.' : 'Conexión creada.', () => {
      this.elegirLinea(nombre);
      e.estacionesSeleccionadas = nueva ? [] : [estaciones[1]];
      if (!nueva) e.panelTutorial?.registrarUso('conexiones');
    });
    if (!guardada && e.estacionesSeleccionadas.length === 2) {
      e.estacionesSeleccionadas = estaciones.slice(0,1);
      e.capaRedMetro.establecerEstacionesSeleccionadas(e.estacionesSeleccionadas);
      e.actualizarOperacionAyuda(false);
    }
  }
  async metro(nombreLinea) {
    const e = this.editor;
    if (!nombreLinea) return e.mostrarMensaje('Elegí una línea para asignarle el metro.', 'info');
    const id = e.disenoActual?.simulacion.idDiseno, version = this.version;
    await e.configuracionLista;
    if (!e.activo || e.disenoActual?.simulacion.idDiseno !== id || version !== this.version) return;
    await this.enviar(() => ({ ruta: '/unidades', datos: { nombreLinea, capacidad: e.capacidadUnidadPredeterminada, velocidadPromedio: VELOCIDAD_INICIAL } }), 'Metro asignado. Sus parámetros están disponibles al seleccionarlo.');
    if (!e.activo || e.disenoActual?.simulacion.idDiseno !== id || version !== this.version) return;
    const opciones = e.obtener('[data-lineas-superpuestas]');
    opciones.replaceChildren(); opciones.hidden = true;
  }
}
