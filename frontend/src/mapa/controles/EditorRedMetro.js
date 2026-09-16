export default class EditorRedMetro {
  constructor(escena, opciones = {}) {
    this.escena = escena;
    this.capaRedMetro = opciones.capaRedMetro;
    this.contenedorPadre = opciones.contenedorPadre;
    this.contenedor = null;
    this.sesion = this.obtenerSesion();
    this.disenoActual = null;
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.estacionASeleccionada = null;
    this.elementoSeleccionado = null;
    this.escenariosJuego = [];
    this.escenarioJuegoActual = null;
    this.alSeleccionar = (elemento) => this.seleccionarElemento(elemento);
    this.alUbicar = (posicion, modo) => this.ubicarEstacion(posicion, modo);
  }

  crear() {
    this.contenedor = document.createElement('section');
    this.contenedor.className = 'metronet-editor-red';
    this.contenedor.innerHTML = `
      <h2 class="metronet-panel-titulo">Red y simulación</h2>
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
          <select data-linea-unidad></select>
          <div class="metronet-editor-fila"><input data-capacidad type="number" min="1" value="300" aria-label="Capacidad" /><input data-velocidad-unidad type="number" min="1" value="40" aria-label="Velocidad" /></div>
          <button data-agregar-unidad type="button">Agregar metro</button>
        </div>
        <div class="metronet-editor-acciones"><button data-guardar type="button">Guardar</button><button data-validar type="button">Validar red</button></div>
        <div class="metronet-editor-grupo" data-herramienta="simulacion">
          <label class="metronet-editor-etiqueta">Simulación</label>
          <div class="metronet-editor-fila"><input data-velocidad-simulacion type="number" min="0.5" step="0.5" value="1" aria-label="Velocidad de simulación" /><input data-duracion-simulacion type="number" min="10" value="60" aria-label="Duración en segundos" /></div>
          <div class="metronet-editor-acciones"><button data-ejecutar type="button">Iniciar</button><button data-detener type="button">Detener</button></div>
        </div>
        <article data-elemento-seleccionado class="metronet-editor-seleccionado" hidden></article>
      </div>`;
    this.contenedorPadre.append(this.contenedor);
    this.agregarEventos();
    this.capaRedMetro.alSeleccionar = this.alSeleccionar;
    this.capaRedMetro.alUbicarEstacion = this.alUbicar;
    if (this.sesion) {
      this.cargarJuego().then(() => this.cargarDisenos());
    }
    else this.mostrarMensaje('Iniciá sesión para crear y simular una red.');
  }

  obtenerSesion() {
    try {
      const jugador = JSON.parse(window.localStorage.getItem('sesionUsuario'));
      const administrador = JSON.parse(window.localStorage.getItem('sesionAdministrador'));
      return jugador?.token ? jugador : administrador?.token ? administrador : null;
    } catch { return null; }
  }

  agregarEventos() {
    this.contenedor.addEventListener('click', (evento) => this.procesarAccion(evento));
    this.obtener('[data-selector-diseno]').addEventListener('change', (evento) => this.abrirDiseno(Number(evento.target.value)));
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
    if (boton.matches('[data-guardar]')) return this.guardarDiseno();
    if (boton.matches('[data-validar]')) return this.validarDiseno();
    if (boton.matches('[data-ejecutar]')) return this.ejecutarSimulacion();
    if (boton.matches('[data-detener]')) return this.detenerSimulacion();
    if (boton.matches('[data-editar-estacion]')) return this.editarEstacion();
    if (boton.matches('[data-reubicar-estacion]')) return this.reubicarEstacion();
    if (boton.matches('[data-eliminar-estacion]')) return this.eliminarEstacion();
    if (boton.matches('[data-editar-tramo]')) return this.editarTramo();
    if (boton.matches('[data-eliminar-tramo]')) return this.eliminarTramo();
    if (boton.matches('[data-editar-unidad]')) return this.editarUnidad();
    if (boton.matches('[data-eliminar-unidad]')) return this.eliminarUnidad();
    if (boton.matches('[data-editar-linea]')) return this.editarLinea();
    if (boton.matches('[data-eliminar-linea]')) return this.eliminarLinea();
  }

  urlApi(ruta = '') { return `${window.location.protocol}//${window.location.hostname}:8080/api/simulaciones${ruta}`; }
  urlJuego(ruta = '') { return `${window.location.protocol}//${window.location.hostname}:8080/api/juego${ruta}`; }

  opciones(opciones = {}) {
    return { ...opciones, headers: { Authorization: `Bearer ${this.sesion.token}`, ...(opciones.headers ?? {}) } };
  }

  async solicitar(ruta, opciones = {}) {
    const respuesta = await fetch(this.urlApi(ruta), this.opciones(opciones));
    if (respuesta.ok) return respuesta.status === 204 ? null : respuesta.json();
    let mensaje = 'No fue posible completar la acción.';
    try { mensaje = (await respuesta.json()).detail ?? mensaje; } catch { /* respuesta no JSON */ }
    throw new Error(mensaje);
  }

  async solicitarJuego(ruta, opciones = {}) {
    const respuesta = await fetch(this.urlJuego(ruta), this.opciones(opciones));
    if (respuesta.ok) return respuesta.status === 204 ? null : respuesta.json();
    let mensaje = 'No fue posible actualizar el progreso del juego.';
    try { mensaje = (await respuesta.json()).detail ?? mensaje; } catch { /* respuesta no JSON */ }
    throw new Error(mensaje);
  }

  async cargarJuego() {
    try {
      this.escenariosJuego = await this.solicitarJuego('/escenarios');
      this.actualizarEscenarioJuegoActual();
      this.renderizarEscenarios();
      this.aplicarHerramientas();
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  renderizarEscenarios() {
    const lista = this.obtener('[data-lista-escenarios]');
    lista.replaceChildren();
    this.escenariosJuego.forEach((escenario) => {
      const tarjeta = document.createElement('article');
      tarjeta.className = `metronet-escenario${escenario.idEscenario === this.escenarioJuegoActual?.idEscenario ? ' activo' : ''}${escenario.desbloqueado ? '' : ' bloqueado'}`;
      const titulo = document.createElement('strong');
      titulo.textContent = escenario.nombre;
      const estado = document.createElement('span');
      estado.textContent = escenario.desbloqueado ? `${escenario.estado.replace('_', ' ')} · ${escenario.progreso}%` : 'Bloqueado';
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.dataset.iniciarEscenario = String(escenario.idEscenario);
      boton.disabled = !escenario.desbloqueado;
      boton.textContent = escenario.idEscenario === this.escenarioJuegoActual?.idEscenario ? 'Activo' : escenario.estado === 'COMPLETADO' ? 'Ver nivel' : 'Iniciar';
      tarjeta.append(titulo, estado, boton);
      lista.append(tarjeta);
    });
  }

  async iniciarEscenario(idEscenario) {
    try {
      const inicio = await this.solicitarJuego(`/escenarios/${idEscenario}/iniciar`, { method: 'POST' });
      await this.cargarJuego();
      await this.cargarDisenos(inicio.idDiseno);
      this.mostrarMensaje('Escenario listo. Leé la consigna y resolvela en el mapa.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async cargarDisenos(idParaAbrir) {
    try {
      const disenos = (await this.solicitar()).filter((diseno) => this.escenariosJuego.some((escenario) => escenario.idEscenario === diseno.idEscenario));
      const selector = this.obtener('[data-selector-diseno]');
      selector.replaceChildren();
      if (!disenos.length) {
        selector.append(new Option('Todavía no hay redes', ''));
        this.cambiarVisibilidadEditor(false);
        return;
      }
      disenos.forEach((diseno) => selector.append(new Option(`${diseno.nombre} · ${this.formatearEstado(diseno.estado)}`, diseno.idDiseno)));
      const seleccionado = idParaAbrir;
      if (seleccionado && disenos.some((diseno) => diseno.idDiseno === seleccionado)) {
        selector.value = String(seleccionado);
        await this.abrirDiseno(Number(selector.value));
      } else this.cambiarVisibilidadEditor(false);
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async crearDiseno() {
    const campo = this.obtener('[data-nombre-diseno]');
    const nombre = campo.value.trim();
    if (!nombre) return this.mostrarMensaje('Ingresá un nombre para la nueva red.', 'error');
    try {
      const diseno = await this.solicitar('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) });
      campo.value = '';
      this.mostrarMensaje('Red creada. Ahora ubicá sus estaciones en el mapa.');
      await this.cargarDisenos(diseno.idDiseno);
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async abrirDiseno(idDiseno) {
    if (!idDiseno) return;
    try {
      this.disenoActual = await this.solicitar(`/${idDiseno}`);
      window.localStorage.setItem('simulacionActual', String(idDiseno));
      this.cambiarVisibilidadEditor(true);
      this.actualizarEscenarioJuegoActual();
      this.renderizarEscenarios();
      this.aplicarHerramientas();
      this.actualizarOpcionesLineas();
      this.capaRedMetro.establecerDiseno(this.disenoActual);
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
    try {
      if (modo === 'reubicarEstacion') {
        await this.solicitar(`/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...estacion, ...posicion }) });
      } else {
        await this.solicitar(`/${this.idDiseno()}/estaciones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, ...posicion }) });
        this.obtener('[data-nombre-estacion]').value = '';
      }
      this.restablecerModo();
      this.mostrarMensaje(`Estación «${nombre}» guardada.`);
      await this.abrirDiseno(this.idDiseno());
      await this.actualizarProgresoNivel();
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  crearLinea() {
    const nombre = this.obtener('[data-nombre-linea]').value.trim();
    if (!nombre) return this.mostrarMensaje('Ingresá el nombre de la línea.', 'error');
    if (this.modo !== 'crearLinea') {
      this.modo = 'crearLinea'; this.estacionesSeleccionadas = [];
      this.capaRedMetro.establecerModo(this.modo);
      this.capaRedMetro.establecerEstacionesSeleccionadas([]);
      return this.mostrarMensaje('Seleccioná en orden al menos dos estaciones sobre el mapa y luego elegí «Crear línea».');
    }
    if (this.estacionesSeleccionadas.length < 2) return this.mostrarMensaje('Seleccioná al menos dos estaciones.', 'error');
    this.guardarLinea(nombre);
  }

  async guardarLinea(nombre) {
    try {
      await this.solicitar(`/${this.idDiseno()}/lineas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, estaciones: this.estacionesSeleccionadas }) });
      this.obtener('[data-nombre-linea]').value = '';
      this.restablecerModo();
      this.mostrarMensaje(`Línea «${nombre}» creada.`);
      await this.abrirDiseno(this.idDiseno());
      await this.actualizarProgresoNivel();
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  crearTramo() {
    const linea = this.obtener('[data-linea-conexion]').value;
    if (!linea) return this.mostrarMensaje('Primero creá una línea.', 'error');
    if (this.modo !== 'crearTramo') {
      this.modo = 'crearTramo'; this.estacionesSeleccionadas = [];
      this.capaRedMetro.establecerModo(this.modo);
      this.capaRedMetro.establecerEstacionesSeleccionadas([]);
      return this.mostrarMensaje('Seleccioná dos estaciones para establecer la conexión.');
    }
    if (this.estacionesSeleccionadas.length !== 2) return this.mostrarMensaje('Seleccioná exactamente dos estaciones.', 'error');
    this.guardarTramo(linea, this.estacionesSeleccionadas[0], this.estacionesSeleccionadas[1]);
  }

  async guardarTramo(nombreLinea, estacionA, estacionB) {
    try {
      await this.solicitar(`/${this.idDiseno()}/tramos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombreLinea, estacionA, estacionB }) });
      this.restablecerModo();
      this.mostrarMensaje('Conexión creada.');
      await this.abrirDiseno(this.idDiseno());
      await this.actualizarProgresoNivel();
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async agregarUnidad() {
    const datos = { nombreLinea: this.obtener('[data-linea-unidad]').value, capacidad: Number(this.obtener('[data-capacidad]').value), velocidadPromedio: Number(this.obtener('[data-velocidad-unidad]').value) };
    if (!datos.nombreLinea) return this.mostrarMensaje('Elegí la línea para el metro.', 'error');
    try {
      await this.solicitar(`/${this.idDiseno()}/unidades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      this.mostrarMensaje('Unidad de metro agregada.');
      await this.abrirDiseno(this.idDiseno());
      await this.actualizarProgresoNivel();
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async guardarDiseno() { await this.ejecutarAccion(`/${this.idDiseno()}/guardar`, { method: 'POST' }, 'Diseño guardado correctamente.'); }

  async validarDiseno() {
    try {
      const validacion = await this.solicitar(`/${this.idDiseno()}/validacion`);
      this.mostrarMensaje(validacion.valido ? 'La red es consistente y está lista para simular.' : validacion.observaciones.join(' '), validacion.valido ? '' : 'error');
      await this.abrirDiseno(this.idDiseno());
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async ejecutarSimulacion() {
    const velocidad = Number(this.obtener('[data-velocidad-simulacion]').value);
    const duracion = Number(this.obtener('[data-duracion-simulacion]').value);
    try {
      const resultado = await this.solicitar(`/${this.idDiseno()}/ejecutar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ velocidad, duracion }) });
      await this.abrirDiseno(this.idDiseno());
      this.capaRedMetro.iniciarAnimacion(velocidad, duracion);
      this.mostrarMensaje(`Simulación iniciada: ${resultado.puntaje} puntos.`);
      await this.actualizarProgresoNivel();
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  detenerSimulacion() { this.capaRedMetro.detenerAnimacion(); this.mostrarMensaje('Animación detenida.'); }

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
    panel.hidden = false;
    const nombre = tipo === 'tramo' ? `${valor.estacionA} — ${valor.estacionB}` : tipo === 'unidad' ? `Metro #${valor.idTren}` : valor.nombre;
    const permitirEdicion = !this.escenarioJuegoActual || this.escenarioJuegoActual.numero === null;
    const acciones = !permitirEdicion ? '' : tipo === 'estacion'
      ? '<button data-editar-estacion type="button">Editar</button><button data-reubicar-estacion type="button">Reubicar</button><button data-eliminar-estacion type="button">Eliminar</button>'
      : tipo === 'tramo'
        ? '<button data-editar-tramo type="button">Editar</button><button data-eliminar-tramo type="button">Eliminar</button>'
        : tipo === 'linea'
          ? '<button data-editar-linea type="button">Editar</button><button data-eliminar-linea type="button">Eliminar</button>'
          : '<button data-editar-unidad type="button">Editar</button><button data-eliminar-unidad type="button">Eliminar</button>';
    panel.innerHTML = `<strong>${this.escapar(nombre)}</strong><span>${tipo === 'tramo' ? this.escapar(valor.nombreLinea) : tipo}</span><div>${acciones}</div>`;
  }

  async editarEstacion() {
    const estacion = this.elementoSeleccionado.valor;
    const nombre = window.prompt('Nombre de la estación:', estacion.nombre);
    if (nombre === null || !nombre.trim()) return;
    const transbordo = window.confirm('¿Esta estación permite transbordo entre líneas?');
    await this.ejecutarAccion(`/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...estacion, nombre: nombre.trim(), transbordo }) }, 'Estación actualizada.');
  }

  seleccionarLinea() {
    const nombre = this.obtener('[data-linea-gestion]').value;
    const linea = this.disenoActual.lineas.find((item) => item.nombre === nombre);
    if (linea) this.seleccionarElemento({ tipo: 'linea', valor: linea });
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

  reubicarEstacion() { this.modo = 'reubicarEstacion'; this.capaRedMetro.establecerModo(this.modo); this.mostrarMensaje('Hacé clic en la nueva ubicación de la estación.'); }

  async eliminarEstacion() {
    const estacion = this.elementoSeleccionado.valor;
    if (!window.confirm(`¿Eliminar «${estacion.nombre}» y sus conexiones?`)) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}`, { method: 'DELETE' }, 'Estación eliminada.');
  }

  async editarTramo() {
    const tramo = this.elementoSeleccionado.valor;
    const linea = window.prompt('Línea de la conexión:', tramo.nombreLinea);
    const estacionA = window.prompt('Estación de origen:', tramo.estacionA);
    const estacionB = window.prompt('Estación de destino:', tramo.estacionB);
    if (linea === null || estacionA === null || estacionB === null) return;
    const parametros = new URLSearchParams({ lineaActual: tramo.nombreLinea, estacionAActual: tramo.estacionA, estacionBActual: tramo.estacionB });
    await this.ejecutarAccion(`/${this.idDiseno()}/tramos?${parametros}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombreLinea: linea.trim(), estacionA: estacionA.trim(), estacionB: estacionB.trim() }) }, 'Conexión actualizada.');
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
    await this.ejecutarAccion(`/${this.idDiseno()}/unidades/${unidad.idTren}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...unidad, nombreLinea: nombreLinea.trim(), capacidad: Number(capacidad), velocidadPromedio: Number(velocidadPromedio) }) }, 'Unidad actualizada.');
  }

  async eliminarUnidad() {
    const unidad = this.elementoSeleccionado.valor;
    if (!window.confirm('¿Eliminar esta unidad de metro?')) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/unidades/${unidad.idTren}`, { method: 'DELETE' }, 'Unidad eliminada.');
  }

  async ejecutarAccion(ruta, opciones, mensaje) {
    try { await this.solicitar(ruta, opciones); this.restablecerModo(); this.mostrarMensaje(mensaje); await this.abrirDiseno(this.idDiseno()); await this.actualizarProgresoNivel(); }
    catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  actualizarOpcionesLineas() {
    const lineas = this.disenoActual.lineas ?? [];
    [this.obtener('[data-linea-conexion]'), this.obtener('[data-linea-unidad]'), this.obtener('[data-linea-gestion]')].forEach((selector) => {
      selector.replaceChildren();
      if (!lineas.length) selector.append(new Option('Sin líneas disponibles', ''));
      lineas.forEach((linea) => selector.append(new Option(linea.nombre, linea.nombre)));
    });
  }

  actualizarEscenarioJuegoActual() {
    const idEscenario = this.disenoActual?.simulacion?.idEscenario;
    this.escenarioJuegoActual = this.escenariosJuego.find((escenario) => escenario.idEscenario === idEscenario) ?? null;
    this.actualizarConsigna();
  }

  actualizarConsigna() {
    const contenedor = this.obtener('[data-consigna-escenario]');
    const escenario = this.escenarioJuegoActual;
    contenedor.hidden = !escenario;
    if (!escenario) return;
    contenedor.innerHTML = `<strong>${this.escapar(escenario.nombre)}</strong><span>${this.escapar(escenario.objetivo)}</span><small>${this.escapar(escenario.instrucciones)}</small><b>Progreso: ${escenario.progreso}%</b>`;
  }

  aplicarHerramientas() {
    const herramientas = this.escenarioJuegoActual?.herramientasHabilitadas ?? { estaciones: true, lineas: true, conexiones: true, metros: true, simulacion: true };
    this.contenedor.querySelectorAll('[data-herramienta]').forEach((elemento) => {
      elemento.hidden = !herramientas[elemento.dataset.herramienta];
    });
    const modoLibreDisponible = this.escenariosJuego.find((escenario) => escenario.numero === null)?.desbloqueado;
    this.obtener('[data-nueva-red]').hidden = !modoLibreDisponible;
    this.obtener('[data-selector-diseno]').hidden = !this.disenoActual;
    this.obtener('[data-etiqueta-red-activa]').hidden = !this.disenoActual;
    this.actualizarConsigna();
  }

  async actualizarProgresoNivel() {
    if (!this.escenarioJuegoActual || !this.disenoActual) return;
    try {
      const evaluacion = await this.solicitarJuego(`/disenos/${this.idDiseno()}/evaluar`, { method: 'POST' });
      await this.cargarJuego();
      if (evaluacion.completado) this.mostrarMensaje(evaluacion.mensaje);
    } catch (error) {
      if (!error.message.includes('no pertenece')) this.mostrarMensaje(error.message, 'error');
    }
  }

  estacionesDeLinea(nombreLinea) {
    const tramos = this.disenoActual.tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
    if (!tramos.length) return [];
    return [...new Set([tramos[0].estacionA, ...tramos.map((tramo) => tramo.estacionB)])];
  }

  restablecerModo() {
    this.modo = 'normal'; this.estacionesSeleccionadas = []; this.elementoSeleccionado = null;
    this.capaRedMetro.establecerModo('normal');
    this.capaRedMetro.establecerEstacionesSeleccionadas([]);
  }

  cambiarVisibilidadEditor(mostrar) { this.obtener('[data-editor-activo]').hidden = !mostrar; }
  idDiseno() { return this.disenoActual.simulacion.idDiseno; }
  obtener(selector) { return this.contenedor.querySelector(selector); }
  escapar(valor) { return String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]); }
  formatearEstado(estado) { return ({ EN_DISENO: 'En diseño', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADA: 'Completada' })[estado] ?? estado; }
  mostrarMensaje(texto, tipo = '') { const mensaje = this.obtener('.metronet-editor-mensaje'); mensaje.textContent = texto; mensaje.className = `metronet-editor-mensaje ${tipo}`; }
  eliminar() { this.capaRedMetro.detenerAnimacion(); this.contenedor?.remove(); this.contenedor = null; }
}
