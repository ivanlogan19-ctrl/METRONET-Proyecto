import ClienteDisenos, { obtenerSesionActiva } from '../../red/ClienteDisenos.js';
import { actualizarRutaEdicion, establecerContextoEnRuta, establecerIdDisenoEnRuta, obtenerContextoRuta, obtenerIdDisenoDeRuta } from '../../red/ContextoDiseno.js';
import { navegarConCambiosPendientes, registrarControlCambios } from '../../navegacion/NavegacionAplicacion.js';

export default class EditorRedMetro {
  constructor(escena, opciones = {}) {
    this.escena = escena;
    this.capaRedMetro = opciones.capaRedMetro;
    this.contenedorPadre = opciones.contenedorPadre;
    this.contenedor = null;
    this.sesion = obtenerSesionActiva();
    this.clienteDisenos = this.sesion ? new ClienteDisenos(this.sesion) : null;
    this.disenoActual = null;
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.escenariosJuego = [];
    this.escenarioJuegoActual = null;
    this.cambiosPendientes = false;
    this.liberarControlCambios = null;
  }

  crear() {
    this.contenedor = document.createElement('section');
    this.contenedor.className = 'metronet-editor-red';
    this.contenedor.innerHTML = `
      <h2 class="metronet-panel-titulo">Edición de red</h2>
      <p class="metronet-editor-mensaje" role="status" aria-live="polite"></p>
      <section class="metronet-juego" aria-label="Progresión del juego">
        <h3 class="metronet-editor-etiqueta">Juego educativo</h3>
        <p class="metronet-juego-introduccion">Completá los niveles para desbloquear el Modo Libre.</p>
        <div data-lista-escenarios class="metronet-lista-escenarios"></div>
      </section>
      <div class="metronet-editor-nueva" data-nueva-red hidden>
        <input data-nombre-diseno type="text" maxlength="100" placeholder="Nombre de la nueva red" />
        <button data-crear-diseno type="button">Nueva red</button>
      </div>
      <label class="metronet-editor-etiqueta" for="metronet-diseno-activo" data-etiqueta-red-activa hidden>Red activa</label>
      <select id="metronet-diseno-activo" data-selector-diseno hidden></select>
      <div data-editor-activo hidden>
        <section class="metronet-consigna" data-consigna-escenario hidden></section>
        <div class="metronet-editor-grupo" data-herramienta="estaciones">
          <label class="metronet-editor-etiqueta">Estaciones</label>
          <div class="metronet-editor-fila"><input data-nombre-estacion type="text" maxlength="100" placeholder="Nombre de estación" /><button data-agregar-estacion type="button">Ubicar</button></div>
        </div>
        <div class="metronet-editor-grupo" data-herramienta="lineas">
          <label class="metronet-editor-etiqueta">Líneas de metro</label>
          <div class="metronet-editor-fila"><input data-nombre-linea type="text" maxlength="100" placeholder="Nombre de línea" /><button data-crear-linea type="button">Crear línea</button></div>
          <div class="metronet-editor-fila"><select data-linea-gestion aria-label="Línea existente"></select><button data-seleccionar-linea type="button">Ver</button></div>
        </div>
        <div class="metronet-editor-grupo" data-herramienta="conexiones">
          <label class="metronet-editor-etiqueta" for="metronet-linea-conexion">Conexiones</label>
          <div class="metronet-editor-fila"><select id="metronet-linea-conexion" data-linea-conexion></select><button data-crear-tramo type="button">Crear conexión</button></div>
        </div>
        <div class="metronet-editor-grupo" data-herramienta="metros">
          <label class="metronet-editor-etiqueta">Unidad de metro</label>
          <select data-linea-unidad aria-label="Línea asignada"></select>
          <div class="metronet-editor-fila"><input data-capacidad type="number" min="1" value="300" aria-label="Capacidad" /><input data-velocidad-unidad type="number" min="1" value="40" aria-label="Velocidad promedio" /></div>
          <button data-agregar-unidad type="button">Agregar metro</button>
        </div>
        <div class="metronet-editor-grupo" data-herramienta="escenarios">
          <label class="metronet-editor-etiqueta">Escenario de aprendizaje</label>
          <input data-nombre-escenario type="text" maxlength="100" placeholder="Nombre del escenario" />
          <div class="metronet-editor-fila"><select data-modo-escenario aria-label="Tipo de escenario"><option value="NIVEL">Nivel</option><option value="EDICION_LIBRE">Edición libre</option></select><select data-dificultad-escenario aria-label="Dificultad"><option value="Inicial">Inicial</option><option value="Intermedio">Intermedio</option><option value="Avanzado">Avanzado</option></select></div>
          <div class="metronet-editor-acciones"><button data-crear-escenario type="button">Crear escenario</button><button data-actualizar-escenario type="button">Actualizar escenario</button></div>
        </div>
        <div class="metronet-editor-acciones"><button data-guardar type="button">Guardar</button><button data-validar type="button">Validar red</button><button data-ir-simulacion type="button" disabled>Simular diseño</button></div>
        <button data-eliminar-diseno type="button">Eliminar diseño actual</button>
        <article data-elemento-seleccionado class="metronet-editor-seleccionado" hidden></article>
      </div>`;
    this.contenedorPadre.append(this.contenedor);
    this.contenedor.addEventListener('click', (evento) => this.procesarAccion(evento));
    this.obtener('[data-selector-diseno]').addEventListener('change', (evento) => this.seleccionarDisenoDesdeLista(Number(evento.target.value)));
    this.capaRedMetro.alSeleccionar = (elemento) => this.seleccionarElemento(elemento);
    this.capaRedMetro.alUbicarEstacion = (posicion, modo) => this.ubicarEstacion(posicion, modo);
    if (!this.sesion) return this.mostrarMensaje('Iniciá sesión para editar una red.', 'error');
    this.liberarControlCambios = registrarControlCambios({
      hayCambios: () => this.cambiosPendientes,
      guardar: () => this.guardarDiseno(),
    });
    this.cargarJuego().then(() => this.cargarDisenos(obtenerIdDisenoDeRuta()));
  }

  async procesarAccion(evento) {
    const boton = evento.target.closest('button');
    if (!boton || !this.sesion) return;
    if (boton.matches('[data-crear-diseno]')) return this.crearDiseno();
    if (boton.matches('[data-iniciar-escenario]')) return this.iniciarEscenario(Number(boton.dataset.iniciarEscenario));
    if (!this.disenoActual) return this.mostrarMensaje('Elegí o creá una red primero.', 'error');
    if (boton.matches('[data-agregar-estacion]')) return this.activarEstacion();
    if (boton.matches('[data-crear-linea]')) return this.crearLinea();
    if (boton.matches('[data-seleccionar-linea]')) return this.seleccionarLinea();
    if (boton.matches('[data-crear-tramo]')) return this.crearTramo();
    if (boton.matches('[data-agregar-unidad]')) return this.agregarUnidad();
    if (boton.matches('[data-crear-escenario]')) return this.crearEscenario();
    if (boton.matches('[data-actualizar-escenario]')) return this.actualizarEscenario();
    if (boton.matches('[data-guardar]')) return this.guardarDiseno();
    if (boton.matches('[data-validar]')) return this.validarDiseno();
    if (boton.matches('[data-ir-simulacion]')) return this.irASimulacion();
    if (boton.matches('[data-eliminar-diseno]')) return this.eliminarDiseno();
    if (boton.matches('[data-editar-estacion]')) return this.editarEstacion();
    if (boton.matches('[data-reubicar-estacion]')) return this.reubicarEstacion();
    if (boton.matches('[data-eliminar-estacion]')) return this.eliminarEstacion();
    if (boton.matches('[data-editar-linea]')) return this.editarLinea();
    if (boton.matches('[data-eliminar-linea]')) return this.eliminarLinea();
    if (boton.matches('[data-editar-tramo]')) return this.editarTramo();
    if (boton.matches('[data-eliminar-tramo]')) return this.eliminarTramo();
    if (boton.matches('[data-editar-unidad]')) return this.editarUnidad();
    if (boton.matches('[data-eliminar-unidad]')) return this.eliminarUnidad();
  }

  opcionesJuego(opciones = {}) {
    return { ...opciones, headers: { Authorization: `Bearer ${this.sesion.token}`, ...(opciones.headers ?? {}) } };
  }

  async solicitarJuego(ruta, opciones = {}) {
    const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego${ruta}`, this.opcionesJuego(opciones));
    if (respuesta.ok) return respuesta.status === 204 ? null : respuesta.json();
    let mensaje = 'No fue posible actualizar el progreso del juego.';
    try { mensaje = (await respuesta.json()).detail ?? mensaje; } catch { /* La respuesta no incluye detalle. */ }
    throw new Error(mensaje);
  }

  async cargarJuego() {
    try {
      this.escenariosJuego = await this.solicitarJuego('/escenarios');
      this.renderizarEscenarios();
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  renderizarEscenarios() {
    const lista = this.obtener('[data-lista-escenarios]');
    lista.replaceChildren(...this.escenariosJuego.map((escenario) => {
      const tarjeta = document.createElement('article');
      tarjeta.className = `metronet-escenario${escenario.idEscenario === this.escenarioJuegoActual?.idEscenario ? ' activo' : ''}${escenario.desbloqueado ? '' : ' bloqueado'}`;
      tarjeta.innerHTML = `<strong>${this.escapar(escenario.nombre)}</strong><span>${escenario.desbloqueado ? `${escenario.estado.replace('_', ' ')} · ${escenario.progreso}%` : 'Bloqueado'}</span>`;
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.dataset.iniciarEscenario = String(escenario.idEscenario);
      boton.disabled = !escenario.desbloqueado;
      boton.textContent = escenario.idEscenario === this.escenarioJuegoActual?.idEscenario ? 'Activo' : escenario.estado === 'COMPLETADO' ? 'Ver nivel' : 'Iniciar';
      tarjeta.append(boton);
      return tarjeta;
    }));
  }

  async iniciarEscenario(idEscenario) {
    try {
      const inicio = await this.solicitarJuego(`/escenarios/${idEscenario}/iniciar`, { method: 'POST' });
      window.history.replaceState({}, '', establecerContextoEnRuta('/', inicio));
      this.cambiosPendientes = false;
      await this.cargarJuego();
      await this.cargarDisenos(inicio.idDiseno);
      this.mostrarMensaje('Escenario listo. Leé la consigna y resolvela en el mapa.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async cargarDisenos(idParaAbrir) {
    try {
      const disenos = await this.clienteDisenos.listar();
      const selector = this.obtener('[data-selector-diseno]');
      selector.replaceChildren();
      if (!disenos.length) {
        selector.append(new Option('Todavía no hay redes', ''));
        return this.cambiarVisibilidadEditor(false);
      }
      disenos.forEach((diseno) => selector.append(new Option(`${diseno.nombre} · ${this.formatearEstado(diseno.estado)}`, String(diseno.idDiseno))));
      const idDisponible = disenos.some((diseno) => diseno.idDiseno === idParaAbrir) ? idParaAbrir : disenos[0].idDiseno;
      selector.value = String(idDisponible);
      await this.abrirDiseno(idDisponible);
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async crearDiseno() {
    const campo = this.obtener('[data-nombre-diseno]');
    const nombre = campo.value.trim();
    if (!nombre) return this.mostrarMensaje('Ingresá un nombre para la nueva red.', 'error');
    try {
      const diseno = await this.clienteDisenos.solicitar('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) });
      campo.value = '';
      await this.cargarDisenos(diseno.idDiseno);
      this.mostrarMensaje('Red creada. Ahora ubicá sus estaciones en el mapa.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async abrirDiseno(idDiseno) {
    if (!idDiseno) return;
    try {
      this.disenoActual = await this.clienteDisenos.obtener(idDiseno);
      actualizarRutaEdicion(idDiseno, this.obtenerContextoDiseno(idDiseno));
      this.actualizarEscenarioJuegoActual();
      this.renderizarEscenarios();
      this.aplicarHerramientas();
      this.actualizarOpcionesLineas();
      this.actualizarAccesoSimulacion();
      this.capaRedMetro.establecerDiseno(this.disenoActual);
      this.cambiarVisibilidadEditor(true);
      this.mostrarMensaje(`Red «${this.disenoActual.simulacion.nombre}» cargada.`);
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  activarEstacion() {
    const nombre = this.obtener('[data-nombre-estacion]').value.trim();
    if (!nombre) return this.mostrarMensaje('Ingresá el nombre antes de ubicar la estación.', 'error');
    this.modo = 'crearEstacion';
    this.capaRedMetro.establecerModo(this.modo);
    this.mostrarMensaje('Hacé clic dentro de Montevideo para ubicar la estación.');
  }

  async ubicarEstacion(posicion, modo) {
    const estacion = modo === 'reubicarEstacion' ? this.elementoSeleccionado?.valor : null;
    const nombre = estacion?.nombre ?? this.obtener('[data-nombre-estacion]').value.trim();
    if (!nombre) return;
    const ruta = estacion ? `/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}` : `/${this.idDiseno()}/estaciones`;
    const datos = estacion ? { ...estacion, ...posicion } : { nombre, ...posicion };
    try {
      await this.clienteDisenos.solicitar(ruta, { method: estacion ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      this.obtener('[data-nombre-estacion]').value = '';
      this.restablecerModo();
      await this.actualizarDiseno('Estación guardada.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  crearLinea() {
    const nombre = this.obtener('[data-nombre-linea]').value.trim();
    if (!nombre) return this.mostrarMensaje('Ingresá el nombre de la línea.', 'error');
    if (this.modo !== 'crearLinea') {
      this.modo = 'crearLinea';
      this.estacionesSeleccionadas = [];
      this.capaRedMetro.establecerModo(this.modo);
      this.capaRedMetro.establecerEstacionesSeleccionadas([]);
      return this.mostrarMensaje('Seleccioná en orden al menos dos estaciones y elegí «Crear línea».');
    }
    if (this.estacionesSeleccionadas.length < 2) return this.mostrarMensaje('Seleccioná al menos dos estaciones.', 'error');
    this.guardarLinea(nombre);
  }

  async guardarLinea(nombre) {
    try {
      await this.clienteDisenos.solicitar(`/${this.idDiseno()}/lineas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, estaciones: this.estacionesSeleccionadas }) });
      this.obtener('[data-nombre-linea]').value = '';
      this.restablecerModo();
      await this.actualizarDiseno(`Línea «${nombre}» creada.`);
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  crearTramo() {
    const nombreLinea = this.obtener('[data-linea-conexion]').value;
    if (!nombreLinea) return this.mostrarMensaje('Primero creá una línea.', 'error');
    if (this.modo !== 'crearTramo') {
      this.modo = 'crearTramo';
      this.estacionesSeleccionadas = [];
      this.capaRedMetro.establecerModo(this.modo);
      this.capaRedMetro.establecerEstacionesSeleccionadas([]);
      return this.mostrarMensaje('Seleccioná dos estaciones para crear la conexión.');
    }
    if (this.estacionesSeleccionadas.length !== 2) return this.mostrarMensaje('Seleccioná exactamente dos estaciones.', 'error');
    this.guardarTramo(nombreLinea, this.estacionesSeleccionadas[0], this.estacionesSeleccionadas[1]);
  }

  async guardarTramo(nombreLinea, estacionA, estacionB) {
    try {
      await this.clienteDisenos.solicitar(`/${this.idDiseno()}/tramos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombreLinea, estacionA, estacionB }) });
      this.restablecerModo();
      await this.actualizarDiseno('Conexión creada.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async agregarUnidad() {
    const datos = { nombreLinea: this.obtener('[data-linea-unidad]').value, capacidad: Number(this.obtener('[data-capacidad]').value), velocidadPromedio: Number(this.obtener('[data-velocidad-unidad]').value) };
    if (!datos.nombreLinea) return this.mostrarMensaje('Elegí la línea para el metro.', 'error');
    try {
      await this.clienteDisenos.solicitar(`/${this.idDiseno()}/unidades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      await this.actualizarDiseno('Unidad de metro agregada.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async guardarDiseno() {
    const guardado = await this.ejecutarAccion(`/${this.idDiseno()}/guardar`, { method: 'POST' }, 'Diseño guardado correctamente.');
    if (guardado) this.cambiosPendientes = false;
    return guardado;
  }

  async validarDiseno() {
    try {
      const validacion = await this.clienteDisenos.validar(this.idDiseno());
      await this.abrirDiseno(this.idDiseno());
      await this.actualizarProgresoNivel();
      if (!validacion.valido) return this.mostrarMensaje(validacion.observaciones.join(' '), 'error');
      if (validacion.preparadoParaSimular) return this.mostrarMensaje('La red es consistente y está lista para simular.', 'exito');
      this.mostrarMensaje(this.obtenerMensajePreparacionSimulacion(validacion.observacionesSimulacion), 'advertencia');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async crearEscenario() {
    const nombre = this.obtener('[data-nombre-escenario]').value.trim();
    if (!nombre) return this.mostrarMensaje('Ingresá un nombre para el escenario.', 'error');
    const datos = { nombre, modo: this.obtener('[data-modo-escenario]').value, dificultad: this.obtener('[data-dificultad-escenario]').value };
    try {
      const escenario = await this.clienteDisenos.solicitar(`/${this.idDiseno()}/escenarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      this.obtener('[data-nombre-escenario]').value = '';
      await this.cargarDisenos(escenario.idDiseno);
      this.mostrarMensaje('Escenario creado desde el diseño validado.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async actualizarEscenario() {
    const nombre = this.obtener('[data-nombre-escenario]').value.trim() || this.disenoActual.simulacion.nombre;
    const datos = { nombre, dificultad: this.obtener('[data-dificultad-escenario]').value, objetivo: this.disenoActual.simulacion.objetivo, instrucciones: this.disenoActual.simulacion.instrucciones };
    await this.ejecutarAccion(`/${this.idDiseno()}/escenario`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }, 'Escenario actualizado.');
  }

  irASimulacion() {
    if (!this.disenoActual?.preparadoParaSimular) return this.mostrarMensaje(this.obtenerMensajePreparacionSimulacion(), 'advertencia');
    navegarConCambiosPendientes(establecerRutaSimulacion(this.idDiseno(), this.obtenerContextoDiseno(this.idDiseno())));
  }

  async eliminarDiseno() {
    if (this.esEscenarioProgresivo()) return this.mostrarMensaje('Los diseños de los niveles se conservan para proteger el progreso.', 'error');
    if (!window.confirm(`¿Eliminar definitivamente «${this.disenoActual.simulacion.nombre}»?`)) return;
    try {
      await this.clienteDisenos.solicitar(`/${this.idDiseno()}`, { method: 'DELETE' });
      this.capaRedMetro.establecerDiseno(null);
      this.disenoActual = null;
      this.cambiosPendientes = false;
      window.history.replaceState({}, '', '/');
      await this.cargarDisenos();
      this.mostrarMensaje('Diseño eliminado.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  seleccionarElemento(elemento) {
    if (this.modo === 'crearLinea' || this.modo === 'crearTramo') {
      if (elemento.tipo !== 'estacion') return;
      const nombre = elemento.valor.nombre;
      this.estacionesSeleccionadas = this.estacionesSeleccionadas.includes(nombre) ? this.estacionesSeleccionadas.filter((item) => item !== nombre) : [...this.estacionesSeleccionadas, nombre];
      if (this.modo === 'crearTramo' && this.estacionesSeleccionadas.length > 2) this.estacionesSeleccionadas.shift();
      this.capaRedMetro.establecerEstacionesSeleccionadas(this.estacionesSeleccionadas);
      return this.mostrarMensaje(`${this.estacionesSeleccionadas.length} estación(es) seleccionada(s).`);
    }
    this.elementoSeleccionado = elemento;
    this.capaRedMetro.establecerElementoSeleccionado(elemento);
    this.renderizarElementoSeleccionado();
  }

  renderizarElementoSeleccionado() {
    const panel = this.obtener('[data-elemento-seleccionado]');
    if (!this.elementoSeleccionado) { panel.hidden = true; return; }
    const { tipo, valor } = this.elementoSeleccionado;
    const nombre = tipo === 'tramo' ? `${valor.estacionA} — ${valor.estacionB}` : tipo === 'unidad' ? `Metro #${valor.idTren}` : valor.nombre;
    const esNivel = this.escenarioJuegoActual?.numero !== null && this.escenarioJuegoActual?.numero !== undefined;
    const acciones = esNivel ? '' : this.obtenerAccionesElemento(tipo);
    panel.hidden = false;
    panel.innerHTML = `<strong>${this.escapar(nombre)}</strong><span>${tipo === 'tramo' ? this.escapar(valor.nombreLinea) : tipo}</span><div>${acciones}</div>`;
  }

  obtenerAccionesElemento(tipo) {
    if (tipo === 'estacion') return '<button data-editar-estacion type="button">Editar</button><button data-reubicar-estacion type="button">Reubicar</button><button data-eliminar-estacion type="button">Eliminar</button>';
    if (tipo === 'linea') return '<button data-editar-linea type="button">Editar</button><button data-eliminar-linea type="button">Eliminar</button>';
    if (tipo === 'tramo') return '<button data-editar-tramo type="button">Editar</button><button data-eliminar-tramo type="button">Eliminar</button>';
    return '<button data-editar-unidad type="button">Editar</button><button data-eliminar-unidad type="button">Eliminar</button>';
  }

  seleccionarLinea() {
    const linea = this.disenoActual.lineas.find((item) => item.nombre === this.obtener('[data-linea-gestion]').value);
    if (linea) this.seleccionarElemento({ tipo: 'linea', valor: linea });
  }

  reubicarEstacion() {
    this.modo = 'reubicarEstacion';
    this.capaRedMetro.establecerModo(this.modo);
    this.mostrarMensaje('Hacé clic en la nueva ubicación de la estación.');
  }

  async editarEstacion() {
    const estacion = this.elementoSeleccionado.valor;
    const nombre = window.prompt('Nombre de la estación:', estacion.nombre);
    if (nombre === null || !nombre.trim()) return;
    const transbordo = window.confirm('¿Esta estación permite transbordo entre líneas?');
    await this.ejecutarAccion(`/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...estacion, nombre: nombre.trim(), transbordo }) }, 'Estación actualizada.');
  }

  async eliminarEstacion() {
    const estacion = this.elementoSeleccionado.valor;
    if (!window.confirm(`¿Eliminar «${estacion.nombre}» y sus conexiones?`)) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}`, { method: 'DELETE' }, 'Estación eliminada.');
  }

  async editarLinea() {
    const linea = this.elementoSeleccionado.valor;
    const nombre = window.prompt('Nombre de la línea:', linea.nombre);
    if (nombre === null || !nombre.trim()) return;
    const estaciones = this.estacionesDeLinea(linea.nombre);
    await this.ejecutarAccion(`/${this.idDiseno()}/lineas/${encodeURIComponent(linea.nombre)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), estaciones }) }, 'Línea actualizada.');
  }

  async eliminarLinea() {
    const linea = this.elementoSeleccionado.valor;
    if (!window.confirm(`¿Eliminar la línea «${linea.nombre}» y sus conexiones?`)) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/lineas/${encodeURIComponent(linea.nombre)}`, { method: 'DELETE' }, 'Línea eliminada.');
  }

  async editarTramo() {
    const tramo = this.elementoSeleccionado.valor;
    const nombreLinea = window.prompt('Línea de la conexión:', tramo.nombreLinea);
    const estacionA = window.prompt('Estación de origen:', tramo.estacionA);
    const estacionB = window.prompt('Estación de destino:', tramo.estacionB);
    if (nombreLinea === null || estacionA === null || estacionB === null) return;
    const parametros = new URLSearchParams({ lineaActual: tramo.nombreLinea, estacionAActual: tramo.estacionA, estacionBActual: tramo.estacionB });
    await this.ejecutarAccion(`/${this.idDiseno()}/tramos?${parametros}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombreLinea: nombreLinea.trim(), estacionA: estacionA.trim(), estacionB: estacionB.trim() }) }, 'Conexión actualizada.');
  }

  async eliminarTramo() {
    const tramo = this.elementoSeleccionado.valor;
    if (!window.confirm('¿Eliminar esta conexión?')) return;
    const parametros = new URLSearchParams({ linea: tramo.nombreLinea, estacionA: tramo.estacionA, estacionB: tramo.estacionB });
    await this.ejecutarAccion(`/${this.idDiseno()}/tramos?${parametros}`, { method: 'DELETE' }, 'Conexión eliminada.');
  }

  async editarUnidad() {
    const unidad = this.elementoSeleccionado.valor;
    const nombreLinea = window.prompt('Línea asignada:', unidad.nombreLinea);
    const capacidad = window.prompt('Capacidad:', unidad.capacidad);
    const velocidadPromedio = window.prompt('Velocidad promedio:', unidad.velocidadPromedio);
    if (nombreLinea === null || capacidad === null || velocidadPromedio === null) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/unidades/${unidad.idTren}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombreLinea: nombreLinea.trim(), capacidad: Number(capacidad), velocidadPromedio: Number(velocidadPromedio) }) }, 'Unidad actualizada.');
  }

  async eliminarUnidad() {
    const unidad = this.elementoSeleccionado.valor;
    if (!window.confirm('¿Eliminar esta unidad de metro?')) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/unidades/${unidad.idTren}`, { method: 'DELETE' }, 'Unidad eliminada.');
  }

  async ejecutarAccion(ruta, opciones, mensaje) {
    try {
      await this.clienteDisenos.solicitar(ruta, opciones);
      this.restablecerModo();
      await this.abrirDiseno(this.idDiseno());
      await this.actualizarProgresoNivel();
      this.cambiosPendientes = true;
      this.mostrarMensaje(mensaje, 'exito');
      return true;
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
    return false;
  }

  actualizarOpcionesLineas() {
    const lineas = this.disenoActual.lineas ?? [];
    ['[data-linea-conexion]', '[data-linea-unidad]', '[data-linea-gestion]'].map((selector) => this.obtener(selector)).forEach((selector) => {
      selector.replaceChildren();
      if (!lineas.length) selector.append(new Option('Sin líneas disponibles', ''));
      lineas.forEach((linea) => selector.append(new Option(linea.nombre, linea.nombre)));
    });
  }

  actualizarEscenarioJuegoActual() {
    const idEscenario = this.disenoActual?.simulacion?.idEscenario;
    this.escenarioJuegoActual = this.escenariosJuego.find((escenario) => escenario.idEscenario === idEscenario) ?? null;
    const nombre = this.obtener('[data-nombre-escenario]');
    if (this.disenoActual?.simulacion) nombre.value = this.disenoActual.simulacion.nombre;
  }

  aplicarHerramientas() {
    const herramientas = this.escenarioJuegoActual?.herramientasHabilitadas ?? { estaciones: true, lineas: true, conexiones: true, metros: true, escenarios: true };
    const esEscenarioProgresivo = this.esEscenarioProgresivo();
    this.contenedor.querySelectorAll('[data-herramienta]').forEach((elemento) => {
      elemento.hidden = herramientas[elemento.dataset.herramienta] === false || (elemento.dataset.herramienta === 'escenarios' && esEscenarioProgresivo);
    });
    this.obtener('[data-eliminar-diseno]').hidden = esEscenarioProgresivo;
    const modoLibreDisponible = this.escenariosJuego.find((escenario) => escenario.numero === null)?.desbloqueado;
    this.obtener('[data-nueva-red]').hidden = !modoLibreDisponible;
    this.obtener('[data-selector-diseno]').hidden = !this.disenoActual;
    this.obtener('[data-etiqueta-red-activa]').hidden = !this.disenoActual;
    const consigna = this.obtener('[data-consigna-escenario]');
    consigna.hidden = !this.escenarioJuegoActual;
    if (this.escenarioJuegoActual) consigna.innerHTML = `<strong>${this.escapar(this.escenarioJuegoActual.nombre)}</strong><span>${this.escapar(this.escenarioJuegoActual.objetivo)}</span><small>${this.escapar(this.escenarioJuegoActual.instrucciones)}</small><b>Progreso: ${this.escenarioJuegoActual.progreso}%</b>`;
  }

  actualizarAccesoSimulacion() {
    const boton = this.obtener('[data-ir-simulacion]');
    boton.disabled = !this.disenoActual?.preparadoParaSimular;
    boton.title = boton.disabled ? this.obtenerMensajePreparacionSimulacion() : '';
  }

  obtenerMensajePreparacionSimulacion(observaciones = this.disenoActual?.observacionesSimulacion) {
    const estado = this.disenoActual?.simulacion?.estado;
    const redValidada = ['VALIDADO', 'COMPLETADA', 'COMPLETADO'].includes(estado);
    if (redValidada && this.escenarioJuegoActual?.herramientasHabilitadas?.metros === false) {
      return 'La red es consistente. Este nivel no requiere una simulación; continuá con el siguiente escenario.';
    }
    if (observaciones?.length) return observaciones.join(' ');
    return 'Validá la red y agregá al menos una unidad de metro para iniciar una simulación.';
  }

  async actualizarProgresoNivel() {
    if (!this.escenarioJuegoActual || !this.disenoActual) return;
    try {
      const evaluacion = await this.solicitarJuego(`/disenos/${this.idDiseno()}/evaluar`, { method: 'POST' });
      await this.cargarJuego();
      this.actualizarEscenarioJuegoActual();
      this.renderizarEscenarios();
      this.aplicarHerramientas();
      if (evaluacion.completado) this.mostrarMensaje(evaluacion.mensaje, 'exito');
    } catch (error) {
      if (!error.message.includes('no pertenece')) this.mostrarMensaje(error.message, 'error');
    }
  }

  estacionesDeLinea(nombreLinea) {
    const tramos = this.disenoActual.tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
    return [...new Set(tramos.flatMap((tramo) => [tramo.estacionA, tramo.estacionB]))];
  }

  async actualizarDiseno(mensaje) {
    await this.abrirDiseno(this.idDiseno());
    await this.actualizarProgresoNivel();
    this.cambiosPendientes = true;
    this.mostrarMensaje(mensaje, 'exito');
  }

  seleccionarDisenoDesdeLista(idDiseno) {
    if (!idDiseno || idDiseno === this.idDiseno()) return;
    const contexto = this.obtenerContextoDiseno(idDiseno);
    navegarConCambiosPendientes(establecerIdDisenoEnRuta('/', idDiseno, contexto));
  }

  obtenerContextoDiseno(idDiseno) {
    const contextoActual = obtenerContextoRuta();
    const idEscenario = this.disenoActual?.simulacion?.idEscenario ?? contextoActual.idEscenario;
    const mismoEscenario = idEscenario && idEscenario === contextoActual.idEscenario;
    return {
      idDiseno,
      idEscenario: idEscenario ?? null,
      idIntento: mismoEscenario ? contextoActual.idIntento : null,
    };
  }

  restablecerModo() {
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.capaRedMetro.establecerModo('normal');
    this.capaRedMetro.establecerEstacionesSeleccionadas([]);
    this.capaRedMetro.establecerElementoSeleccionado(null);
  }

  cambiarVisibilidadEditor(mostrar) { this.obtener('[data-editor-activo]').hidden = !mostrar; }
  esEscenarioProgresivo() { return Number.isInteger(this.escenarioJuegoActual?.numero); }
  idDiseno() { return this.disenoActual.simulacion.idDiseno; }
  obtener(selector) { return this.contenedor.querySelector(selector); }
  escapar(valor) { return String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]); }
  formatearEstado(estado) { return ({ EN_DISENO: 'En diseño', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADA: 'Completada' })[estado] ?? estado; }
  mostrarMensaje(texto, tipo = '') { const mensaje = this.obtener('.metronet-editor-mensaje'); mensaje.textContent = texto; mensaje.className = `metronet-editor-mensaje ${tipo}`; }
  eliminar() { this.liberarControlCambios?.(); this.capaRedMetro.detenerAnimacion(); this.contenedor?.remove(); this.contenedor = null; }
}

function establecerRutaSimulacion(idDiseno, contexto) { return establecerIdDisenoEnRuta('/simulacion.html', idDiseno, contexto); }
