import ClienteDisenos, { obtenerSesionActiva } from '../../red/ClienteDisenos.js';
import { actualizarRutaEdicion, establecerContextoEnRuta, establecerIdDisenoEnRuta, obtenerContextoRuta, obtenerIdDisenoDeRuta } from '../../red/ContextoDiseno.js';
import { navegarConCambiosPendientes, registrarControlCambios } from '../../navegacion/NavegacionAplicacion.js';
import { obtenerConfiguracionAplicacion } from '../../configuracion/ConfiguracionAplicacion.js';
import { mostrarNotificacion } from '../../componentes/NotificacionesMetronet.js';
import '../estilos/editor-red.css';

const MAXIMO_REFERENCIAS_VISIBLES_EN_CONSIGNA = 3;

export default class EditorRedMetro {
  constructor(escena, opciones = {}) {
    this.escena = escena;
    this.capaRedMetro = opciones.capaRedMetro;
    this.contenedorPadre = opciones.contenedorPadre;
    this.contenedorConsigna = opciones.contenedorConsigna ?? null;
    this.contenedor = null;
    this.sesion = obtenerSesionActiva();
    this.clienteDisenos = this.sesion ? new ClienteDisenos(this.sesion) : null;
    this.disenoActual = null;
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.escenariosJuego = [];
    this.disenosDisponibles = [];
    this.escenarioJuegoActual = null;
    this.cambiosPendientes = false;
    this.liberarControlCambios = null;
    this.capacidadUnidadPredeterminada = 300;
    this.dialogoEliminar = null;
    this.consignaCompacta = false;
    this.consignaActual = null;
    this.estadoConsigna = 'sinDatos';
    this.versionConsigna = 0;
  }

  crear() {
    this.contenedor = document.createElement('section');
    this.contenedor.className = 'metronet-editor-red';
    this.contenedor.innerHTML = `
      <h2 class="metronet-panel-titulo">Edición de red</h2>
      <section class="metronet-juego" aria-label="Progresión del juego">
        <h3 class="metronet-editor-etiqueta">Juego educativo</h3>
        <p class="metronet-juego-introduccion">Completá los niveles para desbloquear el Modo Libre.</p>
        <div data-lista-escenarios class="metronet-lista-escenarios"></div>
      </section>
      <div class="metronet-editor-nueva" data-nueva-red hidden>
        <input data-nombre-diseno type="text" maxlength="100" placeholder="Nombre de la nueva red" />
        <button data-crear-diseno type="button">Nueva red</button>
      </div>
      <input data-buscar-diseno type="search" placeholder="Buscar diseño" aria-label="Buscar diseños" hidden />
      <label class="metronet-editor-etiqueta" for="metronet-diseno-activo" data-etiqueta-red-activa hidden>Abrir diseño</label>
      <select id="metronet-diseno-activo" data-selector-diseno hidden></select>
      <p class="metronet-editor-contexto__ayuda" data-ayuda-diseno hidden>Seleccioná una red existente o creá una nueva para empezar.</p>
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
    this.organizarInterfaz();
    this.contenedor.addEventListener('click', (evento) => this.procesarAccion(evento));
    this.obtener('[data-selector-diseno]').addEventListener('change', (evento) => this.seleccionarDisenoDesdeLista(Number(evento.target.value)));
    this.obtener('[data-buscar-diseno]').addEventListener('input', (evento) => this.filtrarDisenos(evento.target.value));
    this.capaRedMetro.alSeleccionar = (elemento) => this.seleccionarElemento(elemento);
    this.capaRedMetro.alUbicarEstacion = (posicion, modo) => this.ubicarEstacion(posicion, modo);
    this.cargarConfiguracionAplicacion();
    if (!this.sesion) return this.mostrarMensaje('Iniciá sesión para editar una red.', 'error');
    this.liberarControlCambios = registrarControlCambios({
      hayCambios: () => this.cambiosPendientes,
      guardar: () => this.guardarDiseno(),
    });
    this.cargarJuego().then(() => this.cargarDisenos(obtenerIdDisenoDeRuta()));
  }

  async cargarConfiguracionAplicacion() {
    const configuracion = await obtenerConfiguracionAplicacion(this.sesion);
    this.capacidadUnidadPredeterminada = configuracion.capacidadUnidad;
    const campoCapacidad = this.obtener('[data-capacidad]');
    if (campoCapacidad && Number(campoCapacidad.value) === 300) {
      campoCapacidad.value = String(this.capacidadUnidadPredeterminada);
    }
  }

  organizarInterfaz() {
    const encabezadoAnterior = this.contenedor.querySelector('h2.metronet-panel-titulo');
    const juego = this.contenedor.querySelector('.metronet-juego');
    const nuevaRed = this.obtener('[data-nueva-red]');
    const buscarDiseno = this.obtener('[data-buscar-diseno]');
    const etiquetaRed = this.obtener('[data-etiqueta-red-activa]');
    const selectorRed = this.obtener('[data-selector-diseno]');
    const ayudaDiseno = this.obtener('[data-ayuda-diseno]');
    const editorActivo = this.obtener('[data-editor-activo]');
    const elementoSeleccionado = this.obtener('[data-elemento-seleccionado]');
    const accionesFinales = this.obtener('[data-guardar]')?.closest('.metronet-editor-acciones');
    const eliminarDiseno = this.obtener('[data-eliminar-diseno]');
    encabezadoAnterior.hidden = true;

    const contexto = document.createElement('div');
    contexto.className = 'metronet-editor-contexto';
    contexto.innerHTML = '<p class="metronet-editor-contexto__titulo">Mis diseños</p>';
    [nuevaRed, buscarDiseno, etiquetaRed, selectorRed, ayudaDiseno].filter(Boolean).forEach((elemento) => contexto.append(elemento));
    this.contenedor.insertBefore(contexto, juego);

    if (juego) {
      const acordeonJuego = document.createElement('details');
      acordeonJuego.className = 'metronet-editor-juego';
      acordeonJuego.innerHTML = '<summary>Juego educativo</summary>';
      juego.querySelector('.metronet-editor-etiqueta')?.setAttribute('hidden', '');
      acordeonJuego.append(juego);
      this.contenedor.insertBefore(acordeonJuego, editorActivo);
    }

    if (this.contenedorConsigna) this.contenedorConsigna.append(this.obtener('[data-consigna-escenario]'));
    if (!editorActivo) return;

    const acordeones = document.createElement('div');
    acordeones.className = 'metronet-editor-acordeones';
    const configuraciones = {
      estaciones: ['01', 'Estaciones', 'Ubicá primero los puntos base de la red.', true],
      lineas: ['02', 'Líneas', 'Uní estaciones en el orden del recorrido.', false],
      conexiones: ['03', 'Conexiones', 'Agregá tramos a una línea ya creada.', false],
      metros: ['05', 'Metros', 'Incorporá unidades después de la infraestructura.', false],
      escenarios: ['+', 'Escenario personalizado', 'Guardá este diseño como una actividad propia.', false],
    };
    [...editorActivo.querySelectorAll('.metronet-editor-grupo')].forEach((grupo) => {
      const configuracion = configuraciones[grupo.dataset.herramienta];
      if (!configuracion) return;
      const [numero, titulo, descripcion, abierto] = configuracion;
      const acordeon = document.createElement('details');
      acordeon.className = 'metronet-editor-acordeon';
      acordeon.dataset.seccionEditor = grupo.dataset.herramienta;
      acordeon.open = abierto;
      acordeon.innerHTML = `<summary><span class="metronet-editor-acordeon__numero">${numero}</span><span class="metronet-editor-acordeon__titulo"><strong>${titulo}</strong><span>${descripcion}</span></span><span class="metronet-editor-acordeon__indicador">⌄</span></summary>`;
      grupo.classList.add('metronet-editor-acordeon-contenido');
      acordeon.append(grupo);
      acordeones.append(acordeon);
    });
    const transbordos = document.createElement('details');
    transbordos.className = 'metronet-editor-acordeon';
    transbordos.dataset.seccionEditor = 'transbordos';
    transbordos.innerHTML = '<summary><span class="metronet-editor-acordeon__numero">04</span><span class="metronet-editor-acordeon__titulo"><strong>Transbordos</strong><span>Conectá líneas mediante una estación compartida.</span></span><span class="metronet-editor-acordeon__indicador">⌄</span></summary><div class="metronet-editor-acordeon-contenido"><p class="metronet-editor-ayuda">Seleccioná una estación en el mapa y usá <strong>Editar</strong> para habilitar o revisar su transbordo.</p></div>';
    const validacion = document.createElement('details');
    validacion.className = 'metronet-editor-acordeon';
    validacion.dataset.seccionEditor = 'validacion';
    validacion.open = true;
    validacion.innerHTML = '<summary><span class="metronet-editor-acordeon__numero">06</span><span class="metronet-editor-acordeon__titulo"><strong>Validación</strong><span>Revisá la consistencia antes de simular.</span></span><span class="metronet-editor-acordeon__indicador">⌄</span></summary><div class="metronet-editor-acordeon-contenido"><p class="metronet-editor-ayuda" data-estado-validacion>Guardá la red, validala y luego iniciá la simulación.</p></div>';
    const seccionMetros = acordeones.querySelector('[data-seccion-editor="metros"]');
    acordeones.insertBefore(transbordos, seccionMetros);
    acordeones.append(validacion);

    if (elementoSeleccionado) editorActivo.prepend(elementoSeleccionado);
    editorActivo.append(acordeones);
    this.agregarListaContextual('lineas', 'data-lista-lineas', 'Líneas existentes');
    this.agregarListaContextual('metros', 'data-lista-metros', 'Unidades de metro');
    this.obtener('[data-linea-gestion]')?.closest('.metronet-editor-fila')?.setAttribute('hidden', '');
    const botonEstacion = this.obtener('[data-agregar-estacion]');
    const botonLinea = this.obtener('[data-crear-linea]');
    const botonConexion = this.obtener('[data-crear-tramo]');
    const botonMetro = this.obtener('[data-agregar-unidad]');
    const botonCrearEscenario = this.obtener('[data-crear-escenario]');
    const botonActualizarEscenario = this.obtener('[data-actualizar-escenario]');
    botonEstacion?.classList.add('metronet-accion-primaria');
    botonLinea?.classList.add('metronet-accion-primaria');
    botonConexion?.classList.add('metronet-accion-neutra');
    botonMetro?.classList.add('metronet-accion-primaria');
    botonCrearEscenario?.classList.add('metronet-accion-neutra');
    botonActualizarEscenario?.classList.add('metronet-accion-advertencia');
    if (botonEstacion) botonEstacion.textContent = '+ Crear estación';
    if (botonLinea) botonLinea.textContent = '+ Crear línea';
    if (botonConexion) botonConexion.textContent = 'Conectar estaciones';
    if (botonMetro) botonMetro.textContent = '+ Agregar metro';
    const finalizacion = document.createElement('section');
    finalizacion.className = 'metronet-editor-finalizar';
    finalizacion.innerHTML = '<h3>Finalizar diseño</h3>';
    if (accionesFinales) {
      accionesFinales.classList.add('metronet-editor-finalizar__acciones');
      this.obtener('[data-guardar]')?.classList.add('metronet-accion-advertencia');
      this.obtener('[data-validar]')?.classList.add('metronet-accion-primaria');
      this.obtener('[data-ir-simulacion]')?.classList.add('metronet-accion-simulacion');
      const botonSimular = this.obtener('[data-ir-simulacion]');
      if (botonSimular) botonSimular.textContent = 'Simular →';
      finalizacion.append(accionesFinales);
    }
    const ayudaSimulacion = document.createElement('p');
    ayudaSimulacion.className = 'metronet-editor-finalizar__ayuda';
    ayudaSimulacion.dataset.ayudaSimulacion = '';
    ayudaSimulacion.textContent = 'Validá la red antes de simular.';
    finalizacion.append(ayudaSimulacion);
    if (eliminarDiseno) {
      const peligro = document.createElement('section');
      peligro.className = 'metronet-editor-zona-peligro';
      peligro.innerHTML = '<p class="metronet-editor-zona-peligro__etiqueta">Zona de peligro</p><h4>Eliminar diseño</h4><p>Esta acción elimina la red seleccionada. Los datos protegidos por el progreso no se modifican.</p>';
      eliminarDiseno.classList.add('metronet-accion-peligrosa');
      eliminarDiseno.textContent = 'Eliminar diseño';
      peligro.append(eliminarDiseno);
      finalizacion.append(peligro);
    }
    editorActivo.append(finalizacion);
  }

  async procesarAccion(evento) {
    const boton = evento.target.closest('button');
    if (!boton || !this.sesion) return;
    if (boton.matches('[data-crear-diseno]')) return this.crearDiseno();
    if (boton.matches('[data-iniciar-escenario]')) return this.iniciarEscenario(Number(boton.dataset.iniciarEscenario));
    if (boton.matches('[data-volver-a-jugar]')) return this.volverAJugar(Number(boton.dataset.volverAJugar));
    if (!this.disenoActual) return this.mostrarMensaje('Elegí o creá una red primero.', 'error');
    if (boton.matches('[data-agregar-estacion]')) return this.activarEstacion();
    if (boton.matches('[data-crear-linea]')) return this.crearLinea();
    if (boton.matches('[data-seleccionar-linea-directa]')) return this.seleccionarLineaDesdeLista(boton.dataset.seleccionarLineaDirecta);
    if (boton.matches('[data-seleccionar-unidad]')) return this.seleccionarUnidadDesdeLista(boton.dataset.seleccionarUnidad);
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
      const escenarioCompletado = escenario.estado === 'COMPLETADO';
      if (escenarioCompletado) boton.dataset.volverAJugar = String(escenario.idEscenario);
      else boton.dataset.iniciarEscenario = String(escenario.idEscenario);
      boton.disabled = !escenario.desbloqueado;
      boton.textContent = escenario.idEscenario === this.escenarioJuegoActual?.idEscenario ? 'Activo' : escenarioCompletado ? 'Volver a jugar' : 'Iniciar';
      tarjeta.append(boton);
      return tarjeta;
    }));
  }

  async iniciarEscenario(idEscenario) {
    return this.abrirEscenario(`/escenarios/${idEscenario}/iniciar`);
  }

  async volverAJugar(idEscenario) {
    return this.abrirEscenario(`/escenarios/${idEscenario}/volver-a-jugar`);
  }

  async abrirEscenario(ruta) {
    try {
      const inicio = await this.solicitarJuego(ruta, { method: 'POST' });
      window.history.replaceState({}, '', establecerContextoEnRuta('/', inicio));
      this.cambiosPendientes = false;
      await this.cargarJuego();
      await this.cargarDisenos(inicio.idDiseno);
      this.mostrarMensaje('Escenario listo. Leé la consigna y resolvela en el mapa.');
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  async cargarDisenos(idParaAbrir) {
    try {
      this.disenosDisponibles = await this.clienteDisenos.listar();
      if (!this.disenosDisponibles.length) {
        this.renderizarOpcionesDisenos();
        this.disenoActual = null;
        this.prepararConsigna();
        this.capaRedMetro.establecerDiseno(null);
        this.actualizarPuntosInteresObjetivo();
        this.aplicarHerramientas();
        return this.cambiarVisibilidadEditor(false);
      }
      const idDisponible = this.disenosDisponibles.some((diseno) => diseno.idDiseno === idParaAbrir) ? idParaAbrir : null;
      this.renderizarOpcionesDisenos(idDisponible);
      if (idDisponible) return this.abrirDiseno(idDisponible);
      this.disenoActual = null;
      this.prepararConsigna();
      this.capaRedMetro.establecerDiseno(null);
      this.actualizarPuntosInteresObjetivo();
      this.aplicarHerramientas();
      this.cambiarVisibilidadEditor(false);
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  filtrarDisenos(termino) {
    const selector = this.obtener('[data-selector-diseno]');
    const idActual = Number(selector?.value) || this.disenoActual?.simulacion?.idDiseno || null;
    this.renderizarOpcionesDisenos(idActual, termino);
  }

  renderizarOpcionesDisenos(idPreferido = null, termino = this.obtener('[data-buscar-diseno]')?.value) {
    const selector = this.obtener('[data-selector-diseno]');
    if (!selector) return;
    const textoBuscado = this.normalizarTexto(termino);
    const disenos = this.disenosDisponibles.filter((diseno) => {
      return this.normalizarTexto(`${diseno.nombre} ${this.formatearEstado(diseno.estado)}`).includes(textoBuscado);
    });
    selector.replaceChildren();
    if (!this.disenosDisponibles.length) {
      selector.append(new Option('Todavía no hay redes', ''));
      return;
    }
    if (!disenos.length) {
      selector.append(new Option('No hay diseños que coincidan', ''));
      return;
    }
    selector.append(new Option('Seleccioná un diseño', ''));
    disenos.forEach((diseno) => {
      selector.append(new Option(`${diseno.nombre} · ${this.formatearEstado(diseno.estado)}`, String(diseno.idDiseno)));
    });
    const idDisponible = disenos.some((diseno) => diseno.idDiseno === idPreferido)
      ? idPreferido
      : null;
    selector.value = idDisponible ? String(idDisponible) : '';
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
      this.prepararConsigna();
      this.renderizarEscenarios();
      this.aplicarHerramientas();
      this.actualizarOpcionesLineas();
      this.actualizarAccesoSimulacion();
      this.capaRedMetro.establecerDiseno(this.disenoActual);
      this.actualizarPuntosInteresObjetivo();
      this.escena.controlZoom?.ajustarRed();
      this.cambiarVisibilidadEditor(true);
      await this.actualizarConsigna();
      this.mostrarMensaje(`Red «${this.disenoActual.simulacion.nombre}» cargada.`);
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
  }

  actualizarPuntosInteresObjetivo() {
    const objetivos = this.disenoActual?.simulacion?.puntosInteresObjetivo;
    const capaPuntosInteres = this.escena.capaPuntosInteres;
    capaPuntosInteres?.establecerPuntosObjetivo(Array.isArray(objetivos) ? objetivos : []);
    capaPuntosInteres?.establecerEstacionesReferencia(this.disenoActual?.estaciones ?? []);
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
    const nombre = this.disenoActual?.simulacion?.nombre ?? 'este diseño';
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar diseño', mensaje: `¿Querés eliminar «${nombre}»?`, detalle: 'Esta acción no se puede deshacer. La información protegida por el progreso permanecerá disponible.' })) return;
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

  obtenerDialogoEliminar() {
    if (this.dialogoEliminar?.isConnected) return this.dialogoEliminar;
    const dialogo = document.createElement('dialog');
    dialogo.className = 'metronet-dialogo-eliminar';
    dialogo.innerHTML = '<form method="dialog" class="metronet-dialogo-eliminar__contenido"><p class="metronet-dialogo-eliminar__etiqueta">Zona de peligro</p><h2 data-titulo-eliminar></h2><p data-mensaje-eliminar></p><p data-detalle-eliminar></p><div class="metronet-dialogo-eliminar__acciones"><button value="cancelar" type="submit">Cancelar</button><button value="eliminar" type="submit" data-confirmar-eliminar>Eliminar</button></div></form>';
    document.body.append(dialogo);
    this.dialogoEliminar = dialogo;
    return dialogo;
  }

  confirmarEliminacion({ titulo = 'Eliminar elemento', mensaje, detalle = 'Esta acción no se puede deshacer.' }) {
    const dialogo = this.obtenerDialogoEliminar();
    if (dialogo.open) return Promise.resolve(false);
    dialogo.querySelector('[data-titulo-eliminar]').textContent = titulo;
    dialogo.querySelector('[data-mensaje-eliminar]').textContent = mensaje;
    dialogo.querySelector('[data-detalle-eliminar]').textContent = detalle;
    dialogo.querySelector('[data-confirmar-eliminar]').textContent = titulo;
    return new Promise((resolver) => {
      dialogo.addEventListener('close', () => resolver(dialogo.returnValue === 'eliminar'), { once: true });
      dialogo.showModal();
    });
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
    const etiqueta = ({ estacion: 'Estación seleccionada', linea: 'Línea seleccionada', tramo: 'Conexión seleccionada', unidad: 'Metro seleccionado' })[tipo] ?? 'Elemento seleccionado';
    const seccion = ({ estacion: 'estaciones', linea: 'lineas', tramo: 'conexiones', unidad: 'metros' })[tipo];
    this.abrirSeccionEditor(seccion);
    this.renderizarListaLineas(this.disenoActual?.lineas ?? []);
    this.renderizarListaUnidades(this.disenoActual?.unidadesMetro ?? []);
    panel.hidden = false;
    panel.innerHTML = `<span class="metronet-editor-seleccionado__tipo">${etiqueta}</span><strong>${this.escapar(nombre)}</strong><span>${tipo === 'tramo' ? this.escapar(valor.nombreLinea) : ''}</span><div>${acciones}</div>`;
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

  seleccionarLineaDesdeLista(nombreLinea) {
    const linea = this.disenoActual?.lineas?.find((item) => item.nombre === nombreLinea);
    if (!linea) return;
    const selector = this.obtener('[data-linea-gestion]');
    if (selector) selector.value = linea.nombre;
    this.seleccionarElemento({ tipo: 'linea', valor: linea });
    this.renderizarListaLineas(this.disenoActual.lineas);
  }

  seleccionarUnidadDesdeLista(idTren) {
    const unidad = this.disenoActual?.unidadesMetro?.find((item) => String(item.idTren) === String(idTren));
    if (!unidad) return;
    this.seleccionarElemento({ tipo: 'unidad', valor: unidad });
    this.renderizarListaUnidades(this.disenoActual.unidadesMetro);
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
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar estación', mensaje: `¿Querés eliminar «${estacion.nombre}» y sus conexiones?` })) return;
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
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar línea', mensaje: `¿Querés eliminar la línea «${linea.nombre}» y sus conexiones?` })) return;
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
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar conexión', mensaje: '¿Querés eliminar esta conexión?' })) return;
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
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar unidad de metro', mensaje: '¿Querés eliminar esta unidad de metro?' })) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/unidades/${unidad.idTren}`, { method: 'DELETE' }, 'Unidad eliminada.');
  }

  async ejecutarAccion(ruta, opciones, mensaje) {
    try {
      await this.clienteDisenos.solicitar(ruta, opciones);
      this.restablecerModo();
      await this.abrirDiseno(this.idDiseno());
      this.cambiosPendientes = true;
      this.mostrarMensaje(mensaje, 'exito');
      return true;
    } catch (error) { this.mostrarMensaje(error.message, 'error'); }
    return false;
  }

  renderizarListaLineas(lineas = []) {
    const lista = this.obtener('[data-lista-lineas]');
    if (!lista) return;
    lista.replaceChildren();
    if (!lineas.length) {
      const vacio = document.createElement('p');
      vacio.className = 'metronet-editor-lista-vacia';
      vacio.textContent = 'Todavía no hay líneas creadas.';
      lista.append(vacio);
      return;
    }
    lineas.forEach((linea) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'metronet-editor-item-lista';
      boton.dataset.seleccionarLineaDirecta = linea.nombre;
      if (this.elementoSeleccionado?.tipo === 'linea' && this.elementoSeleccionado.valor.nombre === linea.nombre) boton.classList.add('es-seleccionado');
      const identidad = document.createElement('span');
      identidad.className = 'metronet-editor-item-lista__identidad';
      const color = document.createElement('span');
      color.className = 'metronet-editor-item-lista__color';
      color.style.background = this.obtenerColorLinea(linea.nombre);
      const nombre = document.createElement('span');
      nombre.className = 'metronet-editor-item-lista__nombre';
      nombre.textContent = linea.nombre;
      const meta = document.createElement('span');
      meta.className = 'metronet-editor-item-lista__meta';
      meta.textContent = `${this.estacionesDeLinea(linea.nombre).length} est.`;
      identidad.append(color, nombre);
      boton.append(identidad, meta);
      lista.append(boton);
    });
  }

  renderizarListaUnidades(unidades = []) {
    const lista = this.obtener('[data-lista-metros]');
    if (!lista) return;
    lista.replaceChildren();
    if (!unidades.length) {
      const vacio = document.createElement('p');
      vacio.className = 'metronet-editor-lista-vacia';
      vacio.textContent = 'Agregá una unidad cuando la red esté construida.';
      lista.append(vacio);
      return;
    }
    unidades.forEach((unidad) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'metronet-editor-item-lista';
      boton.dataset.seleccionarUnidad = String(unidad.idTren);
      if (this.elementoSeleccionado?.tipo === 'unidad' && String(this.elementoSeleccionado.valor.idTren) === String(unidad.idTren)) boton.classList.add('es-seleccionado');
      const identidad = document.createElement('span');
      identidad.className = 'metronet-editor-item-lista__identidad';
      const color = document.createElement('span');
      color.className = 'metronet-editor-item-lista__color';
      color.style.background = this.obtenerColorLinea(unidad.nombreLinea);
      const nombre = document.createElement('span');
      nombre.className = 'metronet-editor-item-lista__nombre';
      nombre.textContent = `Metro #${unidad.idTren}`;
      const meta = document.createElement('span');
      meta.className = 'metronet-editor-item-lista__meta';
      meta.textContent = unidad.nombreLinea;
      identidad.append(color, nombre);
      boton.append(identidad, meta);
      lista.append(boton);
    });
  }

  obtenerColorLinea(nombreLinea) {
    const color = this.capaRedMetro?.colorLinea?.(nombreLinea) ?? 0;
    return `#${Number(color).toString(16).padStart(6, '0')}`;
  }

  actualizarOpcionesLineas() {
    const lineas = this.disenoActual.lineas ?? [];
    ['[data-linea-conexion]', '[data-linea-unidad]', '[data-linea-gestion]'].map((selector) => this.obtener(selector)).forEach((selector) => {
      selector.replaceChildren();
      if (!lineas.length) selector.append(new Option('Sin líneas disponibles', ''));
      lineas.forEach((linea) => selector.append(new Option(linea.nombre, linea.nombre)));
    });
    this.renderizarListaLineas(lineas);
    this.renderizarListaUnidades(this.disenoActual?.unidadesMetro ?? []);
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
      const contenedorHerramienta = elemento.closest('.metronet-editor-acordeon') ?? elemento;
      contenedorHerramienta.hidden = herramientas[elemento.dataset.herramienta] === false || (elemento.dataset.herramienta === 'escenarios' && esEscenarioProgresivo);
    });
    this.obtener('[data-eliminar-diseno]').hidden = esEscenarioProgresivo;
    const modoLibreDisponible = this.escenariosJuego.find((escenario) => escenario.numero === null)?.desbloqueado;
    this.obtener('[data-nueva-red]').hidden = !modoLibreDisponible;
    const hayDisenos = this.disenosDisponibles.length > 0;
    this.obtener('[data-buscar-diseno]').hidden = !hayDisenos;
    this.obtener('[data-selector-diseno]').hidden = !hayDisenos;
    this.obtener('[data-etiqueta-red-activa]').hidden = !hayDisenos;
    this.obtener('[data-ayuda-diseno]').hidden = !hayDisenos || Boolean(this.disenoActual);
    const consigna = this.obtenerContenedorConsigna();
    consigna.hidden = !this.escenarioJuegoActual;
    if (this.escenarioJuegoActual) this.renderizarConsigna();
  }

  prepararConsigna() {
    this.versionConsigna += 1;
    this.consignaActual = null;
    this.estadoConsigna = this.escenarioJuegoActual ? 'cargando' : 'sinDatos';
  }

  async actualizarConsigna() {
    const idDiseno = this.disenoActual?.simulacion?.idDiseno;
    if (!this.escenarioJuegoActual || !idDiseno) {
      this.consignaActual = null;
      this.estadoConsigna = 'sinDatos';
      return;
    }
    const version = ++this.versionConsigna;
    this.estadoConsigna = 'cargando';
    this.renderizarConsigna();
    try {
      const consigna = await this.solicitarJuego(`/disenos/${idDiseno}/consigna`);
      if (!this.esConsignaVigente(version, idDiseno)) return;
      this.consignaActual = this.normalizarConsigna(consigna);
      this.estadoConsigna = 'disponible';
    } catch {
      if (!this.esConsignaVigente(version, idDiseno)) return;
      this.consignaActual = null;
      this.estadoConsigna = 'noDisponible';
    }
    this.renderizarConsigna();
  }

  esConsignaVigente(version, idDiseno) {
    return this.versionConsigna === version && this.disenoActual?.simulacion?.idDiseno === idDiseno;
  }

  normalizarConsigna(consigna) {
    const condiciones = Array.isArray(consigna?.condiciones) ? consigna.condiciones.map((condicion) => ({
      clave: String(condicion?.clave ?? ''),
      texto: String(condicion?.texto ?? '').trim(),
      actual: Number(condicion?.actual ?? 0),
      requerido: Number(condicion?.requerido ?? 0),
      completado: Boolean(condicion?.completado),
    })).filter((condicion) => condicion.texto) : [];
    const referenciasObjetivo = Array.isArray(consigna?.referenciasObjetivo) ? consigna.referenciasObjetivo.map((referencia) => ({
      idPunto: referencia?.idPunto ?? null,
      nombrePunto: String(referencia?.nombrePunto ?? '').trim(),
      cubierto: Boolean(referencia?.cubierto),
    })).filter((referencia) => referencia.idPunto !== null || referencia.nombrePunto) : [];
    return {
      estadoGlobal: String(consigna?.estadoGlobal ?? '').trim(),
      progreso: this.normalizarProgresoConsigna(consigna?.progreso),
      condiciones,
      referenciasObjetivo,
    };
  }

  alternarConsigna() {
    this.consignaCompacta = !this.consignaCompacta;
    this.renderizarConsigna();
  }

  renderizarConsigna() {
    const consigna = this.obtenerContenedorConsigna();
    const escenario = this.escenarioJuegoActual;
    if (!consigna || !escenario) return;
    const consignaActual = this.consignaActual;
    const detalleDisponible = this.estadoConsigna === 'disponible' && Boolean(consignaActual);
    const condiciones = detalleDisponible ? consignaActual.condiciones : [];
    const porcentaje = this.normalizarProgresoConsigna(detalleDisponible ? consignaActual.progreso : escenario.progreso);
    const objetivo = String(escenario.objetivo ?? '').trim();
    const instrucciones = String(escenario.instrucciones ?? '').trim();
    const descripcion = objetivo || instrucciones || 'Sin objetivo definido para este escenario.';
    const hayInformacionComplementaria = Boolean(instrucciones) && this.normalizarTexto(instrucciones) !== this.normalizarTexto(descripcion);

    consigna.hidden = false;
    consigna.classList.toggle('es-compacta', this.consignaCompacta);
    consigna.replaceChildren();

    const cabecera = document.createElement('header');
    cabecera.className = 'metronet-consigna__cabecera';
    const contextoGrupo = document.createElement('div');
    contextoGrupo.className = 'metronet-consigna__contexto-grupo';
    const contexto = document.createElement('p');
    contexto.className = 'metronet-consigna__contexto';
    contexto.textContent = this.obtenerContextoConsigna(escenario);
    const estado = document.createElement('span');
    estado.className = 'metronet-consigna__estado';
    estado.textContent = this.obtenerEstadoConsigna(escenario, consignaActual);
    estado.classList.toggle('es-cargando', this.estadoConsigna === 'cargando');
    contextoGrupo.append(contexto, estado);
    const botonAlternar = document.createElement('button');
    botonAlternar.type = 'button';
    botonAlternar.className = 'metronet-consigna__alternar';
    botonAlternar.dataset.alternarConsigna = '';
    botonAlternar.setAttribute('aria-expanded', String(!this.consignaCompacta));
    botonAlternar.setAttribute('aria-label', this.consignaCompacta ? 'Expandir consigna' : 'Compactar consigna');
    botonAlternar.textContent = this.consignaCompacta ? 'Expandir' : 'Compactar';
    botonAlternar.addEventListener('click', () => this.alternarConsigna());
    cabecera.append(contextoGrupo, botonAlternar);

    const resumen = document.createElement('div');
    resumen.className = 'metronet-consigna__resumen';
    const titulo = document.createElement('h2');
    titulo.className = 'metronet-consigna__titulo';
    titulo.textContent = this.obtenerTituloConsigna(escenario);
    resumen.append(titulo);

    const contenido = document.createElement('div');
    contenido.className = 'metronet-consigna__contenido';
    contenido.id = this.obtenerIdContenidoConsigna(escenario);
    contenido.setAttribute('aria-hidden', String(this.consignaCompacta));
    contenido.hidden = this.consignaCompacta;
    contenido.toggleAttribute('inert', this.consignaCompacta);
    botonAlternar.setAttribute('aria-controls', contenido.id);
    const contenidoInterno = document.createElement('div');
    contenidoInterno.className = 'metronet-consigna__contenido-interno';
    const textoObjetivo = document.createElement('p');
    textoObjetivo.className = 'metronet-consigna__objetivo-principal';
    textoObjetivo.textContent = descripcion;
    contenidoInterno.append(textoObjetivo);

    if (hayInformacionComplementaria) {
      const informacion = document.createElement('details');
      informacion.className = 'metronet-consigna__informacion';
      const resumenInformacion = document.createElement('summary');
      resumenInformacion.textContent = 'Más información';
      const textoInformacion = document.createElement('p');
      textoInformacion.textContent = instrucciones;
      informacion.append(resumenInformacion, textoInformacion);
      contenidoInterno.append(informacion);
    }

    if (this.estadoConsigna === 'cargando') {
      const disponibilidad = document.createElement('p');
      disponibilidad.className = 'metronet-consigna__disponibilidad es-cargando';
      disponibilidad.textContent = 'Actualizando las condiciones del escenario…';
      contenidoInterno.append(disponibilidad);
    } else if (this.estadoConsigna === 'noDisponible') {
      const disponibilidad = document.createElement('p');
      disponibilidad.className = 'metronet-consigna__disponibilidad';
      disponibilidad.textContent = 'No se pudo consultar el detalle de condiciones. El progreso mostrado es el último estado registrado.';
      contenidoInterno.append(disponibilidad);
    }

    if (condiciones.length) {
      const bloqueObjetivos = document.createElement('section');
      bloqueObjetivos.className = 'metronet-consigna__objetivos';
      const tituloObjetivos = document.createElement('h3');
      tituloObjetivos.textContent = 'Objetivos';
      const listaObjetivos = document.createElement('ul');
      listaObjetivos.className = 'metronet-consigna__lista-objetivos';
      listaObjetivos.dataset.consignaObjetivos = '';
      condiciones.forEach((condicion) => listaObjetivos.append(this.crearElementoCondicionConsigna(condicion)));
      bloqueObjetivos.append(tituloObjetivos, listaObjetivos);
      contenidoInterno.append(bloqueObjetivos);
    }

    const referencias = detalleDisponible ? this.obtenerReferenciasObjetivoConsigna() : [];
    if (referencias.length) {
      const bloqueReferencias = document.createElement('section');
      bloqueReferencias.className = 'metronet-consigna__referencias';
      const tituloReferencias = document.createElement('h3');
      tituloReferencias.textContent = 'Referencias objetivo';
      const listaReferencias = document.createElement('div');
      listaReferencias.className = 'metronet-consigna__lista-referencias';
      referencias
        .slice(0, MAXIMO_REFERENCIAS_VISIBLES_EN_CONSIGNA)
        .forEach((referencia, indice) => listaReferencias.append(
          this.crearBotonReferenciaConsigna(referencia, indice),
        ));
      bloqueReferencias.append(tituloReferencias, listaReferencias);

      if (referencias.length > MAXIMO_REFERENCIAS_VISIBLES_EN_CONSIGNA) {
        const referenciasAdicionales = document.createElement('details');
        referenciasAdicionales.className = 'metronet-consigna__referencias-adicionales';
        const resumenReferenciasAdicionales = document.createElement('summary');
        const cantidadAdicional = referencias.length - MAXIMO_REFERENCIAS_VISIBLES_EN_CONSIGNA;
        resumenReferenciasAdicionales.textContent = `Ver ${cantidadAdicional} referencia${cantidadAdicional === 1 ? '' : 's'} más`;
        const listaAdicional = document.createElement('div');
        listaAdicional.className = 'metronet-consigna__lista-referencias';
        referencias
          .slice(MAXIMO_REFERENCIAS_VISIBLES_EN_CONSIGNA)
          .forEach((referencia, indice) => listaAdicional.append(
            this.crearBotonReferenciaConsigna(
              referencia,
              indice + MAXIMO_REFERENCIAS_VISIBLES_EN_CONSIGNA,
            ),
          ));
        referenciasAdicionales.append(resumenReferenciasAdicionales, listaAdicional);
        bloqueReferencias.append(referenciasAdicionales);
      }

      contenidoInterno.append(bloqueReferencias);
    }

    contenido.append(contenidoInterno);

    const progreso = document.createElement('div');
    progreso.className = 'metronet-consigna__progreso';
    const encabezadoProgreso = document.createElement('div');
    encabezadoProgreso.className = 'metronet-consigna__progreso-encabezado';
    const etiquetaProgreso = document.createElement('span');
    etiquetaProgreso.textContent = detalleDisponible ? 'Progreso actual' : 'Progreso registrado';
    const valorProgreso = document.createElement('strong');
    const completadas = condiciones.filter((condicion) => condicion.completado).length;
    valorProgreso.textContent = condiciones.length ? `${completadas}/${condiciones.length} · ${porcentaje}%` : `${porcentaje}%`;
    encabezadoProgreso.append(etiquetaProgreso, valorProgreso);
    const barraProgreso = document.createElement('div');
    barraProgreso.className = 'metronet-consigna__barra-progreso';
    barraProgreso.setAttribute('role', 'progressbar');
    barraProgreso.setAttribute('aria-label', `Progreso de ${this.obtenerTituloConsigna(escenario)}`);
    barraProgreso.setAttribute('aria-valuemin', '0');
    barraProgreso.setAttribute('aria-valuemax', '100');
    barraProgreso.setAttribute('aria-valuenow', String(porcentaje));
    barraProgreso.setAttribute('aria-valuetext', detalleDisponible
      ? `${porcentaje}% según las condiciones actuales del escenario`
      : `${porcentaje}% registrado para el escenario`);
    const rellenoProgreso = document.createElement('span');
    rellenoProgreso.style.setProperty('--progreso-consigna', `${porcentaje}%`);
    barraProgreso.append(rellenoProgreso);
    progreso.append(encabezadoProgreso, barraProgreso);

    consigna.append(cabecera, resumen, contenido, progreso);
  }

  obtenerContextoConsigna(escenario) {
    if (Number.isInteger(escenario?.numero)) return `Escenario ${escenario.numero}`;
    if (escenario?.modo === 'EDICION_LIBRE') return 'Modo Libre';
    return 'Escenario';
  }

  obtenerTituloConsigna(escenario) {
    const nombre = String(escenario?.nombre ?? '').trim();
    const titulo = nombre.replace(/^nivel\s+\d+\s*[·:—-]\s*/i, '').trim();
    return titulo || nombre || 'Objetivo del escenario';
  }

  obtenerEstadoConsigna(escenario, consigna) {
    if (this.estadoConsigna === 'cargando') return 'Actualizando';
    if (this.estadoConsigna === 'disponible' && consigna?.estadoGlobal) return this.formatearEstado(consigna.estadoGlobal);
    return this.formatearEstado(escenario.estado ?? 'EN_DISENO');
  }

  crearElementoCondicionConsigna(condicion) {
    const actual = this.normalizarCantidadConsigna(condicion.actual);
    const requerido = this.normalizarCantidadConsigna(condicion.requerido);
    const item = document.createElement('li');
    item.classList.toggle('es-completo', condicion.completado);
    item.setAttribute('aria-label', `${condicion.texto}: ${actual} de ${requerido}. ${condicion.completado ? 'Completado' : 'Pendiente'}.`);
    const indicador = document.createElement('span');
    indicador.className = 'metronet-consigna__indicador-objetivo';
    indicador.setAttribute('aria-hidden', 'true');
    indicador.textContent = condicion.completado ? '✓' : '○';
    const texto = document.createElement('span');
    texto.className = 'metronet-consigna__texto-objetivo';
    texto.textContent = condicion.texto;
    const avance = document.createElement('span');
    avance.className = 'metronet-consigna__avance-objetivo';
    avance.textContent = `${actual}/${requerido}`;
    item.append(indicador, texto, avance);
    return item;
  }

  obtenerReferenciasObjetivoConsigna() {
    const referencias = this.consignaActual?.referenciasObjetivo;
    return (Array.isArray(referencias) ? referencias : []).map((referencia, indice) => {
      const id = referencia?.idPunto ?? null;
      const nombre = String(referencia?.nombrePunto ?? '').trim();
      if (id === null && !nombre) return null;
      return {
        nombre: nombre || `Punto ${id ?? indice + 1}`,
        cubierto: Boolean(referencia?.cubierto),
        objetivo: { idPunto: id, nombrePunto: nombre },
      };
    }).filter(Boolean);
  }

  crearBotonReferenciaConsigna(referencia, indice) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = `metronet-consigna__referencia${referencia.cubierto ? ' es-cubierta' : ' es-pendiente'}`;
    boton.dataset.localizarReferencia = String(indice);
    boton.setAttribute('aria-label', `Localizar ${referencia.nombre} en el mapa. ${referencia.cubierto ? 'Cubierto' : 'Pendiente'}.`);
    boton.addEventListener('click', () => this.localizarReferenciaObjetivo(indice));
    const nombre = document.createElement('span');
    nombre.className = 'metronet-consigna__referencia-nombre';
    nombre.textContent = referencia.nombre;
    const detalle = document.createElement('span');
    detalle.className = 'metronet-consigna__referencia-detalle';
    const estado = document.createElement('span');
    estado.className = 'metronet-consigna__referencia-estado';
    estado.textContent = referencia.cubierto ? 'Cubierto' : 'Pendiente';
    const accion = document.createElement('span');
    accion.className = 'metronet-consigna__referencia-accion';
    accion.textContent = 'Ubicar';
    detalle.append(estado, accion);
    boton.append(nombre, detalle);
    return boton;
  }

  localizarReferenciaObjetivo(indice) {
    const referencia = this.obtenerReferenciasObjetivoConsigna()[Number(indice)];
    if (!referencia) return;
    const punto = this.escena?.localizarReferencia?.(referencia.objetivo)
      ?? this.escena?.capaPuntosInteres?.seleccionarPunto(referencia.objetivo, {
        enfocar: true,
        mostrarInformacion: true,
      });
    if (!punto) this.mostrarMensaje('La referencia objetivo no está disponible en el mapa.', 'advertencia');
  }

  obtenerIdContenidoConsigna(escenario) {
    const identificador = String(escenario?.idEscenario ?? 'actual').replace(/[^a-zA-Z0-9_-]/g, '');
    return `metronet-consigna-contenido-${identificador || 'actual'}`;
  }

  normalizarProgresoConsigna(progreso) {
    return Math.max(0, Math.min(100, Number(progreso) || 0));
  }

  normalizarCantidadConsigna(cantidad) {
    return Math.max(0, Number.isFinite(Number(cantidad)) ? Number(cantidad) : 0);
  }

  actualizarAccesoSimulacion() {
    const boton = this.obtener('[data-ir-simulacion]');
    boton.disabled = !this.disenoActual?.preparadoParaSimular;
    const mensaje = boton.disabled ? this.obtenerMensajePreparacionSimulacion() : 'La red está lista para simular.';
    boton.title = boton.disabled ? mensaje : '';
    this.obtener('[data-ayuda-simulacion]')?.replaceChildren(document.createTextNode(mensaje));
    this.obtener('[data-estado-validacion]')?.replaceChildren(document.createTextNode(boton.disabled ? 'Completá la infraestructura y validá la red antes de pasar a Simulación.' : 'Red validada. Ya podés continuar a Simulación.'));
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

  estacionesDeLinea(nombreLinea) {
    const tramos = this.disenoActual.tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
    return [...new Set(tramos.flatMap((tramo) => [tramo.estacionA, tramo.estacionB]))];
  }

  async actualizarDiseno(mensaje) {
    await this.abrirDiseno(this.idDiseno());
    this.cambiosPendientes = true;
    this.mostrarMensaje(mensaje, 'exito');
  }

  seleccionarDisenoDesdeLista(idDiseno) {
    if (!idDiseno || idDiseno === this.disenoActual?.simulacion?.idDiseno) return;
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
    this.renderizarElementoSeleccionado();
  }

  obtenerContenedorConsigna() { return this.contenedorConsigna ?? this.obtener('[data-consigna-escenario]'); }
  normalizarTexto(texto) {
    return String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  }
  abrirSeccionEditor(seccion) {
    if (!seccion) return;
    const acordeon = this.contenedor.querySelector(`[data-seccion-editor="${seccion}"]`);
    if (acordeon) acordeon.open = true;
  }
  agregarListaContextual(herramienta, atributo, etiqueta) {
    const grupo = this.contenedor.querySelector(`[data-herramienta="${herramienta}"]`);
    if (!grupo || grupo.querySelector(`[${atributo}]`)) return;
    const lista = document.createElement('div');
    lista.className = 'metronet-editor-lista';
    lista.setAttribute(atributo, '');
    lista.setAttribute('aria-label', etiqueta);
    grupo.querySelector('.metronet-editor-etiqueta')?.insertAdjacentElement('afterend', lista);
  }
  cambiarVisibilidadEditor(mostrar) {
    this.obtener('[data-editor-activo]').hidden = !mostrar;
    if (!mostrar) this.obtenerContenedorConsigna().hidden = true;
  }
  esEscenarioProgresivo() { return Number.isInteger(this.escenarioJuegoActual?.numero); }
  idDiseno() { return this.disenoActual.simulacion.idDiseno; }
  obtener(selector) { return this.contenedor.querySelector(selector); }
  escapar(valor) { return String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]); }
  formatearEstado(estado) { return ({ INICIADO: 'Iniciado', PARCIAL: 'En curso', LISTO: 'Listo', EN_DESARROLLO: 'En diseño', EN_DISENO: 'En diseño', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADA: 'Completada', COMPLETADO: 'Completado' })[estado] ?? estado; }
  mostrarMensaje(texto, tipo = 'info') { mostrarNotificacion(texto, tipo || 'info'); }
  eliminar() { this.liberarControlCambios?.(); this.capaRedMetro.detenerAnimacion(); this.dialogoEliminar?.remove(); this.contenedor?.remove(); this.contenedor = null; }
}

function establecerRutaSimulacion(idDiseno, contexto) { return establecerIdDisenoEnRuta('/simulacion.html', idDiseno, contexto); }
