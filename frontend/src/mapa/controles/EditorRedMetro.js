import CreacionDirecta from './CreacionDirecta.js';
import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
import { prepararDiseno, solicitarInicioSimulacion } from '../../red/PreparacionDiseno.js';
import ClienteDisenos, { obtenerSesionActiva } from '../../red/ClienteDisenos.js';
import { gestorMusica } from '../../audio/GestorMusica.js';
import { actualizarRutaEdicion, establecerContextoEnRuta, establecerIdDisenoEnRuta, obtenerContextoRuta, obtenerIdDisenoDeRuta } from '../../red/ContextoDiseno.js';
import { navegarConCambiosPendientes, registrarControlCambios } from '../../navegacion/NavegacionAplicacion.js';
import { obtenerConfiguracionAplicacion } from '../../configuracion/ConfiguracionAplicacion.js';
import BarraEstadoEditor from './BarraEstadoEditor.js';
import { mostrarFormularioElemento } from './FormularioElemento.js';
import { iniciarNivelConTransicion } from '../../educacion/PreparacionNivel.js';
import { consultarEstadoAnterior, presentarResultadoNivel } from '../../educacion/TransicionNivel.js';
import { celebrarTrofeosNuevos } from '../../educacion/CelebracionTrofeos.js';
import { crearIdentificacionNivel, registrarEntradaRecorrido } from '../../educacion/IdentificacionNivel.js';
import PanelHerramientasEditor from './PanelHerramientasEditor.js';
import { destacarConceptos } from '../../educacion/glosario/GlosarioContextual.js';
import { conceptosDelNivel } from '../../educacion/glosario/ContextoConceptos.js';
import '../estilos/editor-red.css';
import { consumirVistaParaNavegacion, guardarVistaParaNavegacion } from '../VistaGeografica.js';
import { leerCategoriasPoi } from '../EstadoCategoriasPoi.mjs';
import { objetivosCompactos } from '../ObjetivosCompactos.mjs';

export default class EditorRedMetro {
  constructor(escena, opciones = {}) {
    this.escena = escena;
    this.capaRedMetro = opciones.capaRedMetro;
    this.contenedorPadre = opciones.contenedorPadre;
    this.contenedorObjetivos = document.querySelector('[data-panel-objetivos]');
    this.contenedorConsigna = opciones.contenedorConsigna ?? null;
    this.contenedorReferenciasObjetivo = document.querySelector('[data-referencias-objetivo]');
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
    this.capacidadUnidadPredeterminada = 300;
    this.dialogoEliminar = null;
    this.dialogoSimulacion = null;
    this.avisoGuardado = null;
    this.temporizadorAvisoGuardado = null;
    this.panelHerramientas = null;
    this.manejadorCancelarHerramienta = null;
    this.consignaActual = null;
    this.estadoConsigna = 'sinDatos';
    this.versionConsigna = 0;
    this.aperturaEscenarioEnCurso = false;
    this.creacionDirecta = new CreacionDirecta(this);
    this.finalizacionEnCurso = false;
    this.versionApertura = 0;
    this.versionContexto = 0;
    this.activo = true;
  }

  crear() {
    this.contenedor = document.createElement('section');
    this.contenedor.className = 'metronet-editor-red';
    this.contenedor.innerHTML = `
      <h2 class="metronet-panel-titulo">Herramientas</h2>
      <p data-editor-vacio>Elegí una red desde <a href="/disenos.html" data-navegacion>Mis diseños</a> para editarla.</p>
      <div data-editor-activo hidden>
        <section class="metronet-consigna" data-consigna-escenario hidden></section>
        <div class="metronet-editor-grupo" data-herramienta="estaciones"></div>
        <div class="metronet-editor-grupo" data-herramienta="lineas">
          <p class="metronet-editor-etiqueta">Líneas existentes</p>
          <div class="metronet-editor-fila" hidden><select data-linea-gestion aria-label="Línea existente"></select></div>
        </div>
        <div class="metronet-editor-grupo" data-herramienta="conexiones">
          <label for="metronet-linea-conexion">Línea activa</label>
          <select id="metronet-linea-conexion" data-linea-conexion></select>
        </div>
        <div class="metronet-editor-grupo" data-herramienta="metros">
          <div class="metronet-editor-fila" data-lineas-superpuestas hidden role="group" aria-label="Elegir línea del metro"></div>
        </div>
        <div class="metronet-editor-acciones"><button data-guardar type="button">Guardar</button><button data-ir-simulacion type="button" disabled>Simular diseño</button></div>
        <article data-elemento-seleccionado class="metronet-editor-seleccionado" hidden></article>
      </div>`;
    this.contenedorPadre.append(this.contenedor);
    this.organizarInterfaz();
    this.barraEstado = new BarraEstadoEditor(document.querySelector('[data-estado-editor]'));
    this.panelAyuda = this.barraEstado.panelAyuda;
    this.panelTutorial = this.panelAyuda.tutorial;
    this.contenedor.addEventListener('change', () => {
      if (this.errorAyuda) this.actualizarAyuda(true);
    });
    this.contenedor.addEventListener('click', (evento) => this.procesarAccion(evento));
    this.manejadorAccionesPie = (evento) => this.procesarAccion(evento);
    this.contenedorPieEditor?.addEventListener('click', this.manejadorAccionesPie);
    this.manejadorCancelarHerramienta = (evento) => {
      if (evento.key !== 'Escape' || evento.defaultPrevented || this.modo === 'normal' || document.querySelector('dialog[open]')) return;
      this.panelHerramientas.seleccionar('seleccion');
      this.panelHerramientas.botones.get('seleccion').focus();
    };
    document.addEventListener('keydown', this.manejadorCancelarHerramienta);
    this.capaRedMetro.alSeleccionar = (elemento) => this.seleccionarElemento(elemento);
    this.capaRedMetro.alUbicarEstacion = (posicion, modo) => this.ubicarEstacion(posicion, modo);
    this.configuracionLista = this.cargarConfiguracionAplicacion();
    if (!this.sesion) return this.mostrarMensaje('Iniciá sesión para editar una red.', 'error');
    this.liberarControlCambios = registrarControlCambios({
      hayCambios: () => this.cambiosPendientes,
      guardar: () => this.guardarDiseno({ evaluar: false }),
    });
    if (obtenerIdDisenoDeRuta()) this.identificacion = crearIdentificacionNivel(document.querySelector('#metronet-aplicacion'));
    this.cargarJuego().then(() => this.cargarDisenos(obtenerIdDisenoDeRuta()));
  }

  async cargarConfiguracionAplicacion() {
    const configuracion = await obtenerConfiguracionAplicacion(this.sesion);
    this.capacidadUnidadPredeterminada = configuracion.capacidadUnidad;
  }

  organizarInterfaz() {
    const encabezadoAnterior = this.contenedor.querySelector('h2.metronet-panel-titulo');
    const editorActivo = this.obtener('[data-editor-activo]');
    const elementoSeleccionado = this.obtener('[data-elemento-seleccionado]');
    const accionesFinales = this.obtener('[data-guardar]')?.closest('.metronet-editor-acciones');
    encabezadoAnterior.hidden = true;

    if (this.contenedorConsigna) this.contenedorConsigna.append(this.obtener('[data-consigna-escenario]'));
    if (!editorActivo) return;

    const herramientas = document.createElement('div');
    herramientas.className = 'metronet-herramientas';
    const grupos = new Map([...editorActivo.querySelectorAll('[data-herramienta]')]
      .map((grupo) => [grupo.dataset.herramienta, grupo]));
    this.panelHerramientas = new PanelHerramientasEditor(
      herramientas, grupos, elementoSeleccionado, clave => this.creacionDirecta.activar(clave),
      accion => this.accionEdicion(accion),
    );
    editorActivo.append(herramientas);
    this.agregarListaContextual('lineas', 'data-lista-lineas', 'Líneas existentes');
    this.obtener('[data-linea-gestion]')?.closest('.metronet-editor-fila')?.setAttribute('hidden', '');
    const finalizacion = document.createElement('section');
    finalizacion.className = 'metronet-editor-finalizar';
    finalizacion.innerHTML = '<header class="metronet-editor-finalizar__cabecera"><h3>Acciones</h3></header>';
    if (accionesFinales) {
      accionesFinales.classList.add('metronet-editor-finalizar__acciones');
      this.obtener('[data-guardar]')?.classList.add('metronet-accion-advertencia');
      this.obtener('[data-ir-simulacion]')?.classList.add('metronet-accion-simulacion');
      const botonSimular = this.obtener('[data-ir-simulacion]');
      if (botonSimular) botonSimular.textContent = 'Simular →';
      finalizacion.append(accionesFinales);
    }
    const ayudaSimulacion = document.createElement('p');
    ayudaSimulacion.className = 'metronet-editor-finalizar__ayuda';
    ayudaSimulacion.dataset.ayudaSimulacion = '';
    ayudaSimulacion.textContent = 'Guardar y Simular comprueban la red automáticamente.';
    finalizacion.append(ayudaSimulacion);
    this.contenedorPieEditor = document.querySelector('[data-panel-editor-pie]');
    (this.contenedorPieEditor ?? editorActivo).append(finalizacion);
    [['[data-guardar]', 'guardar', 'Guardar diseño'], ['[data-ir-simulacion]', 'play', 'Simular diseño']]
      .forEach(([selector, icono, texto]) => configurarBotonIcono(this.obtener(selector), icono, texto));
    this.obtener('[data-linea-conexion]').addEventListener('change', evento => this.creacionDirecta.elegirLinea(evento.target.value));

  }

  async procesarAccion(evento) {
    const boton = evento.target.closest('button');
    if (!boton || !this.sesion) return;
    if (boton.matches('[data-iniciar-escenario]')) return this.iniciarEscenario(Number(boton.dataset.iniciarEscenario));
    if (boton.matches('[data-volver-a-jugar]')) return this.volverAJugar(Number(boton.dataset.volverAJugar));
    if (boton.matches('[data-quitar-seleccion]')) return this.restablecerModo();
    if (!this.disenoActual) return this.mostrarMensaje('Elegí o creá una red primero.', 'advertencia');
    if (boton.matches('[data-seleccionar-linea-directa]')) return this.seleccionarLineaDesdeLista(boton.dataset.seleccionarLineaDirecta);
    if (boton.matches('[data-seleccionar-linea]')) return this.seleccionarLinea();
    if (boton.matches('[data-linea-superpuesta]')) return this.creacionDirecta.metro(boton.dataset.lineaSuperpuesta);
    if (boton.matches('[data-guardar]')) return this.guardarDiseno();
    if (boton.matches('[data-ir-simulacion]')) return this.irASimulacion();
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
    } catch (error) { this.mostrarError(error); }
  }

  obtenerSiguienteEscenarioDesbloqueado(escenario) {
    if (!Number.isInteger(escenario?.numero)) return null;
    return this.escenariosJuego.find((candidato) => candidato.numero === escenario.numero + 1 && candidato.desbloqueado && candidato.estado !== 'COMPLETADO') ?? null;
  }

  async iniciarEscenario(idEscenario) {
    return this.abrirEscenario(`/escenarios/${idEscenario}/iniciar`, idEscenario);
  }

  async volverAJugar(idEscenario) {
    return this.abrirEscenario(`/escenarios/${idEscenario}/volver-a-jugar`, idEscenario);
  }

  async abrirEscenario(ruta, idEscenario, preparado = false, celebrarRecorrido = false) {
    if (this.aperturaEscenarioEnCurso) return;
    this.aperturaEscenarioEnCurso = true;
    const idDisenoOrigen = this.disenoActual?.simulacion?.idDiseno;
    try {
      const escenario = this.escenariosJuego.find((candidato) => candidato.idEscenario === idEscenario);
      const inicio = await iniciarNivelConTransicion(escenario,
        signal => this.solicitarJuego(ruta, { method: 'POST', signal }),
        { preparado });
      if (!inicio || (preparado && this.disenoActual?.simulacion?.idDiseno !== idDisenoOrigen)) return;
      if (celebrarRecorrido) registrarEntradaRecorrido(inicio);
      window.history.replaceState({}, '', establecerContextoEnRuta('/', inicio));
      this.cambiosPendientes = false;
      await this.cargarJuego();
      await this.cargarDisenos(inicio.idDiseno, { identificar: true });
      return true;
    } catch (error) { this.mostrarError(error); }
    finally { this.aperturaEscenarioEnCurso = false; }
  }

  async cargarDisenos(idParaAbrir, opciones = {}) {
    if (idParaAbrir) return this.abrirDiseno(idParaAbrir, opciones);
    this.identificacion?.cancelar();
    this.identificacion = null;
    this.disenoActual = null;
    this.escenarioJuegoActual = null;
    this.prepararConsigna();
    this.capaRedMetro.establecerDiseno(null);
    this.actualizarPuntosInteresObjetivo();
    this.cambiarVisibilidadEditor(false);
  }

  async abrirDiseno(idDiseno, { identificar = false } = {}) {
    if (!idDiseno || !this.activo) return false;
    const apertura = ++this.versionApertura;
    const presentarEntrada = identificar || this.disenoActual?.simulacion?.idDiseno !== idDiseno;
    this.identificacion?.cancelar();
    const entrada = presentarEntrada ? crearIdentificacionNivel(document.querySelector('#metronet-aplicacion')) : null;
    this.identificacion = entrada;
    if (entrada) this.panelTutorial?.actualizar({});
    if (this.disenoActual?.simulacion?.idDiseno !== idDiseno) this.versionContexto += 1;
    try {
      const cambioDeDiseno = this.disenoActual?.simulacion?.idDiseno !== idDiseno;
      const diseno = await this.clienteDisenos.obtener(idDiseno);
      if (apertura !== this.versionApertura || !this.activo) return false;
      this.disenoActual = diseno;
      if (cambioDeDiseno) this.escena.capaPuntosInteres?.establecerCategoriasVisibles(leerCategoriasPoi(idDiseno));
      this.errorAyuda = null;
      if (cambioDeDiseno) {
        this.creacionDirecta.lineaActiva = '';
        this.escena.panelPuntosInteres?.limpiarBusqueda();
        this.escena.capaPuntosInteres?.limpiarPuntoSeleccionado();
        this.restablecerModo();
        this.panelHerramientas?.seleccionar('seleccion', false);
      }
      actualizarRutaEdicion(idDiseno, this.obtenerContextoDiseno(idDiseno));
      this.actualizarEscenarioJuegoActual();
      this.prepararConsigna();
      this.aplicarHerramientas();
      this.capaRedMetro.establecerDiseno(this.disenoActual);
      this.actualizarOpcionesLineas();
      this.actualizarAccesoSimulacion();
      this.actualizarPuntosInteresObjetivo();
      if (cambioDeDiseno) this.escena.controlZoom?.restaurar();
      this.cambiarVisibilidadEditor(true);
      if (cambioDeDiseno) {
        const vista = consumirVistaParaNavegacion(idDiseno, obtenerSesionActiva(), 'edicion');
        if (vista) this.escena.controlZoom?.aplicarVistaGeografica(vista);
      }
      await this.actualizarConsigna();
      if (apertura !== this.versionApertura || !this.activo) return false;
      // El cartel identifica la entrada; no agregar un aviso que desplace el
      // mapa y vuelva a cambiar su tamaño al desaparecer unos segundos después.
      if (entrada) {
        const continuar = await entrada.mostrar(this.escenarioJuegoActual, idDiseno, this.disenoActual.simulacion);
        if (!continuar || apertura !== this.versionApertura || !this.activo) return false;
        this.identificacion = null;
        this.actualizarAyuda();
      }
      return true;
    } catch (error) { this.mostrarError(error); return false; }
    finally {
      entrada?.cancelar();
      if (this.identificacion === entrada) this.identificacion = null;
    }
  }

  actualizarPuntosInteresObjetivo() {
    this.escena.territorioMapa?.configurar(this.disenoActual?.territorio);
    this.escena.capaTerritorial?.dibujar();
    const objetivos = this.disenoActual?.simulacion?.puntosInteresObjetivo;
    const capaPuntosInteres = this.escena.capaPuntosInteres;
    if (capaPuntosInteres) capaPuntosInteres.mostrarTodosLosMarcadores = true;
    capaPuntosInteres?.establecerPuntosObjetivo(Array.isArray(objetivos) ? objetivos : []);
    capaPuntosInteres?.establecerEstacionesReferencia(this.disenoActual?.estaciones ?? []);
  }

  activarEstacion() { this.panelHerramientas.seleccionar('estaciones'); }
  ubicarEstacion(posicion, modo) { return this.creacionDirecta.ubicar(posicion, modo); }
  crearLinea() { this.panelHerramientas.seleccionar('lineas'); }
  crearTramo() { this.panelHerramientas.seleccionar('conexiones'); }

  async guardarDiseno({ evaluar = true } = {}) {
    if (this.finalizacionEnCurso) return false;
    this.finalizacionEnCurso = true;
    this.ocultarAvisoGuardado();
    const id = this.idDiseno(), contexto = this.versionContexto;
    const vigente = () => this.activo && contexto === this.versionContexto && this.disenoActual?.simulacion.idDiseno === id;
    try {
      if (this.creacionDirecta.pendiente && !await this.creacionDirecta.pendiente) return false;
      const { validacion, protegido } = await prepararDiseno(this.clienteDisenos, id, { guardar:true, vigente });
      if (!await this.abrirDiseno(id)) return false;
      this.cambiosPendientes = false;
      if (validacion.valido) this.panelTutorial?.registrarUso('guardar');
      this.actualizarAyuda(true);
      if (!protegido) this.mostrarAvisoGuardado();
      if (evaluar && !protegido && validacion.valido && this.esEscenarioProgresivo()) await this.evaluarEscenarioGuardado(id);
      else {
        const pendientes = (this.consignaActual?.condiciones ?? []).filter(c => !c.completado).map(c => c.texto);
        const detalle = !validacion.valido ? ` La red todavía está en construcción: ${(validacion.observaciones ?? []).join(' ')}`
          : pendientes.length ? ` Todavía falta cumplir: ${pendientes.join(' ')}` : '';
        if (protegido || detalle) this.mostrarMensaje(`${protegido ? 'Logro conservado.' : ''}${detalle}`.trim(), detalle ? 'info' : 'exito', { orientarError:false });
      }
      return true;
    } catch (error) { if (vigente()) this.mostrarError(error); return false; }
    finally { this.finalizacionEnCurso = false; }
  }

  async evaluarEscenarioGuardado(idDiseno) {
    if (this.evaluacionEnCurso) return;
    this.evaluacionEnCurso = true;
    const controlador = new AbortController();
    const cancelar = () => controlador.abort();
    let premiosPendientes = [];
    const celebrar = async () => {
      const premios = premiosPendientes;
      premiosPendientes = [];
      await celebrarTrofeosNuevos(premios, { signal: controlador.signal });
    };
    window.addEventListener('pagehide', cancelar);
    window.addEventListener('popstate', cancelar);
    try {
      const idEscenario = this.disenoActual?.simulacion?.idEscenario;
      const estadoAnterior = await consultarEstadoAnterior(idEscenario);
      if (controlador.signal.aborted || this.idDiseno() !== idDiseno) return;
      const evaluacion = await this.solicitarJuego(`/disenos/${idDiseno}/evaluar`, { method: 'POST' });
      premiosPendientes = evaluacion.completado ? evaluacion.trofeosNuevos ?? [] : [];
      if (controlador.signal.aborted || this.idDiseno() !== idDiseno) return;
      if (evaluacion.completado) this.cambiosPendientes = false;
      await this.cargarJuego();
      await this.abrirDiseno(idDiseno);
      this.mostrarMensaje(evaluacion.mensaje, evaluacion.completado ? 'exito' : 'advertencia', { orientarError: false });
      if (evaluacion.completado) {
        this.panelTutorial?.cerrarRecorridos(true);
        const progreso = await this.solicitarJuego('/progreso');
        if (controlador.signal.aborted || this.idDiseno() !== idDiseno) return;
        const accion = await presentarResultadoNivel(progreso, idEscenario, evaluacion, { ...estadoAnterior, signal: controlador.signal });
        await celebrar();
        if (controlador.signal.aborted || this.idDiseno() !== idDiseno) return;
        if (accion?.siguiente) {
          const operacion = accion.siguiente.estado === 'COMPLETADO' ? 'volver-a-jugar' : 'iniciar';
          const abierto = await this.abrirEscenario(`/escenarios/${accion.siguiente.idEscenario}/${operacion}`, accion.siguiente.idEscenario, true, accion.celebrarRecorrido);
          if (abierto)
            this.panelTutorial?.reactivarRecorridos();
        } else if (accion?.destino) window.location.assign(accion.destino);
      }
    } finally {
      await celebrar();
      this.evaluacionEnCurso = false;
      window.removeEventListener('pagehide', cancelar);
      window.removeEventListener('popstate', cancelar);
    }
  }

  async irASimulacion() {
    if (this.finalizacionEnCurso || this.esEscenarioSinSimulacion()) return;
    this.finalizacionEnCurso = true;
    const id = this.idDiseno(), contexto = this.versionContexto;
    const vigente = () => this.activo && contexto === this.versionContexto && this.disenoActual?.simulacion.idDiseno === id;
    const boton = this.obtener('[data-ir-simulacion]');
    boton.setAttribute('aria-busy','true');
    try {
      if (this.creacionDirecta.pendiente && !await this.creacionDirecta.pendiente) return false;
      await prepararDiseno(this.clienteDisenos, id, { guardar:true, paraSimular:true, vigente });
      this.cambiosPendientes = false;
      this.restablecerModo();
      guardarVistaParaNavegacion(id,
        this.escena.controlZoom?.capturarVistaParaNavegacion(),
        obtenerSesionActiva(), 'simulacion');
      solicitarInicioSimulacion(id);
      await navegarConCambiosPendientes(establecerRutaSimulacion(id, this.obtenerContextoDiseno(id)));
    } catch (error) {
      if (vigente()) {
        if (error.codigo === 'RED_NO_PREPARADA') this.mostrarAvisoSimulacion();
        else this.mostrarError(error);
      }
    }
    finally { this.finalizacionEnCurso = false; boton.removeAttribute('aria-busy'); }
  }

  mostrarAvisoSimulacion() {
    if (!this.dialogoSimulacion?.isConnected) {
      const dialogo = document.createElement('dialog');
      dialogo.className = 'metronet-dialogo-simulacion';
      dialogo.innerHTML = '<form method="dialog" class="metronet-dialogo-simulacion__contenido"><h2>Prepará la red para simular</h2><p data-aviso-simulacion></p><button type="submit">Entendido</button></form>';
      document.body.append(dialogo);
      this.dialogoSimulacion = dialogo;
    }
    this.dialogoSimulacion.querySelector('[data-aviso-simulacion]').textContent = this.esEscenarioProgresivo()
      ? 'Revisá los objetivos del nivel, completá la red y asigná un metro para continuar.'
      : 'Completá la red y asigná un metro para continuar.';
    if (!this.dialogoSimulacion.open) this.dialogoSimulacion.showModal();
  }

  mostrarAvisoGuardado() {
    if (!this.avisoGuardado?.isConnected) {
      this.avisoGuardado = document.createElement('div');
      this.avisoGuardado.className = 'metronet-aviso-guardado';
      this.avisoGuardado.setAttribute('role', 'status');
      this.avisoGuardado.setAttribute('aria-live', 'polite');
      this.avisoGuardado.textContent = 'Diseño guardado';
      document.body.append(this.avisoGuardado);
    }
    window.clearTimeout(this.temporizadorAvisoGuardado);
    this.temporizadorAvisoGuardado = window.setTimeout(() => this.ocultarAvisoGuardado(), 2000);
  }

  ocultarAvisoGuardado() {
    window.clearTimeout(this.temporizadorAvisoGuardado);
    this.temporizadorAvisoGuardado = null;
    this.avisoGuardado?.remove();
    this.avisoGuardado = null;
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
    if (this.creacionDirecta.seleccionar(elemento) || !elemento) return;
    this.actualizarAyuda(true);
    if (elemento.tipo === 'linea' || elemento.tipo === 'tramo') this.creacionDirecta.elegirLinea(elemento.tipo === 'linea' ? elemento.valor.nombre : elemento.valor.nombreLinea);
    this.elementoSeleccionado = elemento;
    this.capaRedMetro.establecerElementoSeleccionado(elemento);
    this.renderizarElementoSeleccionado();
  }

  renderizarElementoSeleccionado() {
    const panel = this.obtener('[data-elemento-seleccionado]');
    panel.hidden = true;
    panel.replaceChildren();
    if (!this.elementoSeleccionado) {
      this.panelHerramientas?.actualizarAccionesSeleccion(false, false);
      return;
    }
    const { tipo } = this.elementoSeleccionado;
    const esNivel = this.escenarioJuegoActual?.numero !== null && this.escenarioJuegoActual?.numero !== undefined;
    const herramienta = ({estacion:'estaciones',linea:'lineas',tramo:'conexiones',unidad:'metros'})[tipo];
    const bloqueado = esNivel && this.disenoActual?.simulacion.estado === 'COMPLETADO';
    const puedeModificar = !bloqueado && this.escenarioJuegoActual?.herramientasHabilitadas?.[herramienta] !== false;
    this.panelHerramientas?.seleccionar('seleccion', false);
    this.renderizarListaLineas(this.disenoActual?.lineas ?? []);
    this.panelHerramientas?.actualizarAccionesSeleccion(puedeModificar && tipo === 'estacion', puedeModificar);
    this.panelHerramientas?.actualizarOperacion(this.modo);
  }

  accionEdicion(accion) {
    if (!this.elementoSeleccionado) return;
    if (accion === 'mover' && this.elementoSeleccionado.tipo === 'estacion') return this.reubicarEstacion();
    if (accion !== 'eliminar') return;
    return ({ estacion: () => this.eliminarEstacion(), linea: () => this.eliminarLinea(),
      tramo: () => this.eliminarTramo(), unidad: () => this.eliminarUnidad() })[this.elementoSeleccionado.tipo]?.();
  }

  seleccionarLinea() {
    const linea = this.disenoActual.lineas.find((item) => item.nombre === this.obtener('[data-linea-gestion]').value);
    if (linea) this.seleccionarElemento({ tipo: 'linea', valor: linea });
  }

  seleccionarLineaDesdeLista(nombreLinea) {
    const linea = this.disenoActual?.lineas?.find((item) => item.nombre === nombreLinea);
    if (!linea) return;
    this.restablecerModo();
    this.creacionDirecta.elegirLinea(linea.nombre);
    const selector = this.obtener('[data-linea-gestion]');
    if (selector) selector.value = linea.nombre;
    this.seleccionarElemento({ tipo: 'linea', valor: linea });
    this.renderizarListaLineas(this.disenoActual.lineas);
  }

  reubicarEstacion() {
    this.modo = 'reubicarEstacion';
    this.capaRedMetro.establecerModo(this.modo);
    this.actualizarOperacionAyuda();
  }

  editarEstacion() {
    const estacion = this.elementoSeleccionado.valor;
    this.editarEnPanel([
      { nombre: 'nombre', etiqueta: 'Nombre de la estación', valor: estacion.nombre },
      { nombre: 'transbordo', etiqueta: 'Permite transbordo', valor: estacion.transbordo, tipo: 'checkbox' },
    ], datos => {
      if (!datos.nombre) return this.mostrarMensaje('Ingresá el nombre de la estación.', 'advertencia');
      return this.ejecutarAccion(`/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...estacion, ...datos }) }, 'Estación actualizada.');
    });
  }

  async eliminarEstacion() {
    const estacion = this.elementoSeleccionado.valor;
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar estación', mensaje: `¿Querés eliminar «${estacion.nombre}» y sus conexiones?` })) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/estaciones/${encodeURIComponent(estacion.nombre)}`, { method: 'DELETE' }, 'Estación eliminada.');
  }

  editarLinea() {
    const linea = this.elementoSeleccionado.valor;
    this.editarEnPanel([{ nombre: 'nombre', etiqueta: 'Nombre de la línea', valor: linea.nombre }], datos => {
      if (!datos.nombre) return this.mostrarMensaje('Ingresá el nombre de la línea.', 'advertencia');
      return this.ejecutarAccion(`/${this.idDiseno()}/lineas/${encodeURIComponent(linea.nombre)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }, 'Línea actualizada.');
    });
  }

  async eliminarLinea() {
    const linea = this.elementoSeleccionado.valor;
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar línea', mensaje: `¿Querés eliminar la línea «${linea.nombre}» y sus conexiones?` })) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/lineas/${encodeURIComponent(linea.nombre)}`, { method: 'DELETE' }, 'Línea eliminada.');
  }

  editarTramo() {
    const tramo = this.elementoSeleccionado.valor;
    const parametros = new URLSearchParams({ lineaActual: tramo.nombreLinea, estacionAActual: tramo.estacionA, estacionBActual: tramo.estacionB });
    this.editarEnPanel([
      { nombre: 'nombreLinea', etiqueta: 'Línea de la conexión', valor: tramo.nombreLinea, opciones: this.disenoActual.lineas.map(l => l.nombre) },
      { nombre: 'estacionA', etiqueta: 'Estación de origen', valor: tramo.estacionA, opciones: this.disenoActual.estaciones.map(e => e.nombre) },
      { nombre: 'estacionB', etiqueta: 'Estación de destino', valor: tramo.estacionB, opciones: this.disenoActual.estaciones.map(e => e.nombre) },
    ], datos => this.ejecutarAccion(`/${this.idDiseno()}/tramos?${parametros}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }, 'Conexión actualizada.'));
  }

  async eliminarTramo() {
    const tramo = this.elementoSeleccionado.valor;
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar conexión', mensaje: '¿Querés eliminar esta conexión?' })) return;
    const parametros = new URLSearchParams({ linea: tramo.nombreLinea, estacionA: tramo.estacionA, estacionB: tramo.estacionB });
    await this.ejecutarAccion(`/${this.idDiseno()}/tramos?${parametros}`, { method: 'DELETE' }, 'Conexión eliminada.');
  }

  editarUnidad() {
    const unidad = this.elementoSeleccionado.valor;
    this.editarEnPanel([
      { nombre: 'nombreLinea', etiqueta: 'Línea asignada', valor: unidad.nombreLinea, opciones: this.disenoActual.lineas.map(l => l.nombre) },
      { nombre: 'velocidadPromedio', etiqueta: 'Velocidad promedio (UV)', valor: unidad.velocidadPromedio, tipo: 'number' },
    ], datos => this.ejecutarAccion(`/${this.idDiseno()}/unidades/${unidad.idTren}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...datos, capacidad: unidad.capacidad, velocidadPromedio: Number(datos.velocidadPromedio) }) }, 'Unidad actualizada.'));
  }

  editarEnPanel(campos, guardar) {
    const panel = this.obtener('[data-elemento-seleccionado]');
    const cancelar = () => {
      this.renderizarElementoSeleccionado();
      panel.querySelector('button')?.focus();
    };
    mostrarFormularioElemento(panel, campos, guardar, cancelar);
  }

  async eliminarUnidad() {
    const unidad = this.elementoSeleccionado.valor;
    if (!await this.confirmarEliminacion({ titulo: 'Eliminar unidad de metro', mensaje: '¿Querés eliminar esta unidad de metro?' })) return;
    await this.ejecutarAccion(`/${this.idDiseno()}/unidades/${unidad.idTren}`, { method: 'DELETE' }, 'Unidad eliminada.');
  }

  async ejecutarAccion(ruta, opciones, mensaje) {
    const prefijo = `/${this.idDiseno()}`;
    return this.creacionDirecta.enviar(() => ({
      ruta: ruta.slice(prefijo.length), metodo: opciones.method,
      datos: opciones.body ? JSON.parse(opciones.body) : undefined,
    }), mensaje, () => this.restablecerModo());
  }

  renderizarListaLineas(lineas = []) {
    const lista = this.obtener('[data-lista-lineas]');
    if (!lista) return;
    lista.replaceChildren();
    if (!lineas.length) return;
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

  obtenerColorLinea(nombreLinea) {
    const color = this.capaRedMetro?.colorLinea?.(nombreLinea) ?? 0;
    return `#${Number(color).toString(16).padStart(6, '0')}`;
  }

  actualizarOpcionesLineas() {
    const lineas = this.disenoActual.lineas ?? [];
    if (this.creacionDirecta.lineaActiva && !lineas.some(l => l.nombre === this.creacionDirecta.lineaActiva)) this.creacionDirecta.elegirLinea('');
    ['[data-linea-conexion]', '[data-linea-gestion]'].map((selector) => this.obtener(selector)).forEach((selector) => {
      selector.replaceChildren();
      selector.append(new Option(lineas.length ? 'Elegí una línea' : 'Sin líneas disponibles', ''));
      lineas.forEach((linea) => selector.append(new Option(linea.nombre, linea.nombre)));
      selector.value = this.creacionDirecta.lineaActiva;
    });
    this.renderizarListaLineas(lineas);
  }

  actualizarEscenarioJuegoActual() {
    const idEscenario = this.disenoActual?.simulacion?.idEscenario;
    this.escenarioJuegoActual = this.escenariosJuego.find((escenario) => escenario.idEscenario === idEscenario) ?? null;
  }

  aplicarHerramientas() {
    const herramientas = this.escenarioJuegoActual?.herramientasHabilitadas ?? { estaciones: true, lineas: true, conexiones: true, metros: true };
    const esEscenarioProgresivo = this.esEscenarioProgresivo();
    const tituloHerramientas = esEscenarioProgresivo ? 'Herramientas del nivel' : 'Herramientas';
    const tituloEditor = document.querySelector('[data-titulo-editor]');
    if (tituloEditor) tituloEditor.textContent = tituloHerramientas;
    const tituloMapa = document.querySelector('[data-titulo-mapa]');
    if (tituloMapa) {
      tituloMapa.textContent = esEscenarioProgresivo
        ? this.escenarioJuegoActual.nombre ?? `Nivel ${this.escenarioJuegoActual.numero}`
        : 'Modo libre';
      tituloMapa.hidden = false;
    }
    const panelEditor = document.querySelector('#metronet-panel-controles');
    panelEditor?.setAttribute('aria-label', tituloHerramientas);
    panelEditor?.classList.toggle('metronet-panel-nivel', esEscenarioProgresivo);
    const tituloAcciones = this.contenedorPieEditor?.querySelector('.metronet-editor-finalizar h3');
    if (tituloAcciones) tituloAcciones.textContent = 'Acciones de nivel';
    this.panelHerramientas?.actualizarDisponibilidad(herramientas, esEscenarioProgresivo);
    const consigna = this.obtenerContenedorConsigna();
    consigna.hidden = !this.escenarioJuegoActual;
    if (this.contenedorObjetivos) this.contenedorObjetivos.hidden = !this.escenarioJuegoActual;
    if (!this.escenarioJuegoActual && this.contenedorReferenciasObjetivo) this.contenedorReferenciasObjetivo.hidden = true;
    if (this.escenarioJuegoActual) this.renderizarConsigna();
    const conceptos = conceptosDelNivel(this.escenarioJuegoActual ?? this.disenoActual?.simulacion);
    this.contenedor.querySelectorAll('[data-herramienta] > p.metronet-editor-etiqueta').forEach(texto => destacarConceptos(texto, conceptos, { contextual: true }));
  }

  prepararConsigna() {
    this.versionConsigna += 1;
    this.consignaActual = null;
    this.estadoConsigna = this.escenarioJuegoActual ? 'cargando' : 'sinDatos';
    this.actualizarAyuda(true);
  }

  async actualizarConsigna() {
    const idDiseno = this.disenoActual?.simulacion?.idDiseno;
    if (!this.escenarioJuegoActual || !idDiseno) {
      this.consignaActual = null;
      this.estadoConsigna = 'sinDatos';
      this.actualizarAyuda(true);
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

  renderizarConsigna() {
    this.actualizarAyuda();
    const consigna = this.obtenerContenedorConsigna();
    const contenedorReferencias = this.contenedorReferenciasObjetivo;
    const escenario = this.escenarioJuegoActual;
    if (!consigna || !escenario) {
      if (this.contenedorObjetivos) this.contenedorObjetivos.hidden = true;
      if (contenedorReferencias) contenedorReferencias.hidden = true;
      return;
    }
    const consignaActual = this.consignaActual;
    const detalleDisponible = this.estadoConsigna === 'disponible' && Boolean(consignaActual);
    const condiciones = detalleDisponible
      ? objetivosCompactos(consignaActual.condiciones, escenario?.numero) : [];
    const referencias = detalleDisponible ? this.obtenerReferenciasObjetivoConsigna() : [];
    const esNivel = Number.isInteger(escenario?.numero);
    this.contenedorObjetivos?.classList.toggle('metronet-objetivos-panel--extendido',
      esNivel && escenario.numero >= 5 && escenario.numero <= 10);

    consigna.hidden = false;
    if (this.contenedorObjetivos) this.contenedorObjetivos.hidden = false;
    consigna.replaceChildren();
    if (contenedorReferencias) {
      contenedorReferencias.replaceChildren();
      contenedorReferencias.hidden = !referencias.length;
    }

    const cabecera = document.createElement('header');
    cabecera.className = 'metronet-consigna__cabecera';
    const contextoGrupo = document.createElement('div');
    contextoGrupo.className = 'metronet-consigna__contexto-grupo';
    const contexto = document.createElement('p');
    contexto.className = 'metronet-consigna__contexto';
    contexto.textContent = esNivel ? '' : this.obtenerContextoConsigna(escenario);
    contexto.hidden = !contexto.textContent;
    const estado = document.createElement('span');
    estado.className = 'metronet-consigna__estado';
    estado.textContent = this.obtenerEstadoConsigna(escenario, consignaActual);
    estado.classList.toggle('es-cargando', this.estadoConsigna === 'cargando');
    if (!esNivel) contextoGrupo.append(contexto, estado);
    if (!esNivel) cabecera.append(contextoGrupo);

    const resumen = document.createElement('div');
    resumen.className = 'metronet-consigna__resumen';
    const titulo = document.createElement('h2');
    titulo.className = 'metronet-consigna__titulo';
    titulo.textContent = esNivel ? 'Objetivos' : this.obtenerTituloConsigna(escenario);
    cabecera.prepend(titulo);
    const resumenActivo = document.createElement('div');
    resumenActivo.className = 'metronet-consigna__resumen-activo';
    if (condiciones.length) {
      const listaBreve = document.createElement('ul');
      listaBreve.className = 'metronet-consigna__lista-objetivos metronet-consigna__lista-breve';
      listaBreve.style.setProperty('--cantidad-objetivos', String(condiciones.length));
      listaBreve.tabIndex = 0;
      listaBreve.setAttribute('aria-label', 'Objetivos del nivel');
      condiciones
        .forEach(condicion => listaBreve.append(this.crearElementoCondicionConsigna(condicion)));
      resumenActivo.append(listaBreve);
    } else if (esNivel && escenario.objetivo) {
      const listaBreve = document.createElement('ul');
      listaBreve.className = 'metronet-consigna__lista-objetivos metronet-consigna__lista-breve';
      listaBreve.style.setProperty('--cantidad-objetivos', '1');
      listaBreve.setAttribute('aria-label', 'Objetivos del nivel');
      const objetivo = document.createElement('li');
      objetivo.className = 'es-objetivo-general';
      const indicador = document.createElement('span');
      indicador.className = 'metronet-consigna__indicador-objetivo';
      indicador.setAttribute('aria-hidden', 'true');
      const texto = document.createElement('span');
      texto.className = 'metronet-consigna__texto-objetivo';
      texto.textContent = escenario.objetivo;
      objetivo.append(indicador, texto);
      listaBreve.append(objetivo);
      resumenActivo.append(listaBreve);
    } else {
      const objetivoBreve = document.createElement('p');
      objetivoBreve.className = 'metronet-consigna__objetivo-breve';
      objetivoBreve.textContent = !esNivel
        ? String(escenario.objetivo || escenario.instrucciones || 'Sin objetivo definido para esta actividad.')
        : this.estadoConsigna === 'cargando'
          ? 'Cargando objetivos…'
          : 'Todavía no hay objetivos definidos para este nivel.';
      resumenActivo.append(objetivoBreve);
    }
    resumen.append(resumenActivo);

    if (referencias.length && contenedorReferencias) {
      const bloqueReferencias = document.createElement('section');
      bloqueReferencias.className = 'metronet-consigna__referencias';
      const cabeceraReferencias = document.createElement('header');
      cabeceraReferencias.className = 'metronet-consigna__cabecera';
      const tituloReferencias = document.createElement('h3');
      tituloReferencias.className = 'metronet-consigna__titulo';
      tituloReferencias.textContent = 'Objetivos de POI';
      cabeceraReferencias.append(tituloReferencias);
      const listaReferencias = document.createElement('ul');
      listaReferencias.className = 'metronet-consigna__lista-objetivos metronet-consigna__lista-referencias';
      referencias.forEach((referencia) => listaReferencias.append(this.crearElementoReferenciaConsigna(referencia)));
      bloqueReferencias.append(cabeceraReferencias, listaReferencias);

      contenedorReferencias.append(bloqueReferencias);
    }

    const siguienteEscenario = escenario.estado === 'COMPLETADO'
      ? this.obtenerSiguienteEscenarioDesbloqueado(escenario)
      : null;
    const accionContinuar = siguienteEscenario ? this.crearAccionContinuarEscenario(siguienteEscenario) : null;
    consigna.append(cabecera, resumen);
    if (accionContinuar) consigna.append(accionContinuar);
  }

  crearAccionContinuarEscenario(escenario) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'metronet-consigna__continuar';
    boton.textContent = `Continuar con Nivel ${escenario.numero}`;
    boton.addEventListener('click', () => this.iniciarEscenario(escenario.idEscenario));
    return boton;
  }

  obtenerContextoConsigna(escenario) {
    if (Number.isInteger(escenario?.numero)) return `Nivel ${escenario.numero}`;
    if (escenario?.modo === 'EDICION_LIBRE') return 'Modo Libre';
    return 'Actividad';
  }

  obtenerTituloConsigna(escenario) {
    const nombre = String(escenario?.nombre ?? '').trim();
    const titulo = nombre.replace(/^nivel\s+\d+\s*[·:—-]\s*/i, '').trim();
    return titulo || nombre || 'Objetivo del nivel';
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
    if (condicion.detalle) item.title = condicion.detalle;
    item.classList.toggle('es-completo', condicion.completado);
    item.setAttribute('aria-label', `${condicion.texto}: ${actual} de ${requerido}. ${condicion.completado ? 'Completado' : 'Pendiente'}.`);
    const indicador = document.createElement('span');
    indicador.className = 'metronet-consigna__indicador-objetivo';
    indicador.classList.toggle('es-estrella', condicion.completado);
    indicador.setAttribute('aria-hidden', 'true');
    indicador.textContent = condicion.completado ? '★' : '';
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

  crearElementoReferenciaConsigna(referencia) {
    const item = document.createElement('li');
    item.classList.toggle('es-completo', referencia.cubierto);
    item.setAttribute('aria-label', `${referencia.nombre}. ${referencia.cubierto ? 'Cubierto' : 'Pendiente'}.`);
    const indicador = document.createElement('span');
    indicador.className = 'metronet-consigna__indicador-objetivo';
    indicador.classList.toggle('es-estrella', referencia.cubierto);
    indicador.setAttribute('aria-hidden', 'true');
    indicador.textContent = referencia.cubierto ? '★' : '';
    const nombre = document.createElement('span');
    nombre.className = 'metronet-consigna__texto-objetivo';
    nombre.textContent = referencia.nombre;
    item.append(indicador, nombre);
    return item;
  }

  normalizarProgresoConsigna(progreso) {
    return Math.max(0, Math.min(100, Number(progreso) || 0));
  }

  normalizarCantidadConsigna(cantidad) {
    return Math.max(0, Number.isFinite(Number(cantidad)) ? Number(cantidad) : 0);
  }

  actualizarAccesoSimulacion() {
    const boton = this.obtener('[data-ir-simulacion]');
    boton.disabled = !this.disenoActual || this.esEscenarioSinSimulacion();
    const mensaje = this.esEscenarioSinSimulacion() ? 'Este nivel se completa con Guardar.' : 'Simular comprueba y guarda la red antes de iniciar.';
    boton.title = mensaje;
    this.obtener('[data-ayuda-simulacion]')?.replaceChildren(document.createTextNode(mensaje));
  }

  obtenerMensajePreparacionSimulacion(observaciones = this.disenoActual?.observacionesSimulacion) {
    const estado = this.disenoActual?.simulacion?.estado;
    const redValidada = ['VALIDADO', 'COMPLETADA', 'COMPLETADO'].includes(estado);
    if (redValidada && this.esEscenarioSinSimulacion()) {
      return 'La red es consistente. La consigna se completa al guardar.';
    }
    if (observaciones?.length) return observaciones.join(' ');
    return 'Asigná un metro a un recorrido continuo. Simular comprobará la red automáticamente.';
  }

  estacionesDeLinea(nombreLinea) {
    const tramos = this.disenoActual.tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
    return [...new Set(tramos.flatMap((tramo) => [tramo.estacionA, tramo.estacionB]))];
  }

  async actualizarDiseno(mensaje) {
    this.cambiosPendientes = true;
    if (!await this.abrirDiseno(this.idDiseno())) return;
    this.mostrarMensaje(mensaje, 'exito');
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
    this.creacionDirecta.cancelar();
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.capaRedMetro.establecerModo('normal');
    this.capaRedMetro.establecerEstacionesSeleccionadas([]);
    this.capaRedMetro.establecerElementoSeleccionado(null);
    this.renderizarElementoSeleccionado();
    this.actualizarOperacionAyuda();
    this.renderizarListaLineas(this.disenoActual?.lineas ?? []);
  }

  obtenerContenedorConsigna() { return this.contenedorConsigna ?? this.obtener('[data-consigna-escenario]'); }
  normalizarTexto(texto) {
    return String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
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
    gestorMusica.establecerContexto(mostrar ? 'gameplay' : 'menu');
    this.obtener('[data-editor-activo]').hidden = !mostrar;
    if (this.contenedorPieEditor) this.contenedorPieEditor.hidden = !mostrar;
    this.obtener('[data-editor-vacio]').hidden = mostrar;
    const tituloMapa = document.querySelector('[data-titulo-mapa]');
    if (tituloMapa && !mostrar) tituloMapa.hidden = true;
    this.actualizarResumenDiseno();
    if (!mostrar) {
      this.obtenerContenedorConsigna().hidden = true;
      if (this.contenedorObjetivos) this.contenedorObjetivos.hidden = true;
      if (this.contenedorReferenciasObjetivo) this.contenedorReferenciasObjetivo.hidden = true;
      this.panelAyuda?.actualizar({});
      this.panelTutorial?.actualizar({});
    }
  }
  actualizarResumenDiseno() {
    if (!this.activo || !this.contenedor) return;
    const resumen = this.obtener('[data-resumen-diseno]');
    if (!resumen) return;
    resumen.hidden = !this.disenoActual;
    const datos = this.disenoActual?.simulacion;
    resumen.textContent = datos ? `${datos.nombre} · ${this.cambiosPendientes ? 'Revisión pendiente' : this.formatearEstado(datos.estado)}` : '';
  }
  esEscenarioProgresivo() { return Number.isInteger(this.escenarioJuegoActual?.numero); }
  esEscenarioSinSimulacion() { return this.esEscenarioProgresivo() && this.escenarioJuegoActual?.herramientasHabilitadas?.simulacion === false; }
  idDiseno() { return this.disenoActual.simulacion.idDiseno; }
  obtener(selector) { return this.contenedor.querySelector(selector) ?? this.contenedorPieEditor?.querySelector(selector); }
  escapar(valor) { return String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]); }
  formatearEstado(estado) { return ({ INICIADO: 'Iniciado', PARCIAL: 'En curso', LISTO: 'Listo', EN_DESARROLLO: 'En diseño', EN_DISENO: 'En diseño', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADA: 'Completada', COMPLETADO: 'Completado' })[estado] ?? estado; }
  mostrarError(error) {
    const tipo = [400, 409, 422].includes(error.estadoHttp) ? 'advertencia' : 'error';
    this.mostrarMensaje(error.message, tipo);
  }
  actualizarOperacionAyuda(limpiarError = true) {
    this.panelHerramientas?.actualizarOperacion(this.modo, this.estacionesSeleccionadas);
    this.actualizarAyuda(limpiarError);
  }
  actualizarReferenciaAyuda(referencia) {
    if (this.referenciaAyuda?.id === referencia?.id) return;
    this.referenciaAyuda = referencia;
    this.actualizarAyuda(true);
  }
  actualizarAyuda(limpiarError = false) {
    if (limpiarError) this.errorAyuda = null;
    const contexto = {
      diseno: this.disenoActual, escenario: this.escenarioJuegoActual,
      consigna: this.consignaActual, estadoConsigna: this.estadoConsigna,
      modo: this.modo, seleccionadas: this.estacionesSeleccionadas,
      referencia: this.referenciaAyuda, error: this.errorAyuda,
    };
    this.panelAyuda?.actualizar({ ...contexto, catalogo: this.escenariosJuego, identificando: Boolean(this.identificacion) });
    this.actualizarResumenDiseno();
  }
  mostrarMensaje(texto, tipo = 'info', { orientarError = true } = {}) {
    this.barraEstado?.mostrar(texto, tipo || 'info');
    if (orientarError && ['advertencia', 'error'].includes(tipo)) this.errorAyuda = texto;
    else if (tipo === 'exito' || !orientarError) this.errorAyuda = null;
    this.actualizarAyuda();
  }
  eliminar() { this.activo = false; this.versionApertura += 1; this.identificacion?.cancelar(); this.creacionDirecta.cancelar(); document.removeEventListener('keydown', this.manejadorCancelarHerramienta); this.contenedorPieEditor?.removeEventListener('click', this.manejadorAccionesPie); this.contenedorPieEditor?.replaceChildren(); this.liberarControlCambios?.(); this.capaRedMetro.detenerAnimacion(false); this.dialogoEliminar?.remove(); this.dialogoSimulacion?.remove(); this.ocultarAvisoGuardado(); this.barraEstado?.eliminar(); this.contenedor?.remove(); this.contenedor = null; }
}

function establecerRutaSimulacion(idDiseno, contexto) { return establecerIdDisenoEnRuta('/simulacion.html', idDiseno, contexto); }
