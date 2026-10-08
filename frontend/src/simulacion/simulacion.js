import { abrirTutorialSimulacion, crearPanelTutorialSimulacion, presentarTutorialSimulacion } from '../educacion/TutorialSimulacion.js';
import { RITMOS, formatearVelocidad, formatearDuracion, formatearRitmo } from './EscalaSimulacion.js';
import { numeroMetroEnRed } from '../mapa/controles/NombresRed.js';
import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';
import { prepararDiseno, consumirInicioSimulacion } from '../red/PreparacionDiseno.js';
import PanelAyudaContextual from '../educacion/PanelAyudaContextual.js';
import { gestorMusica } from '../audio/GestorMusica.js';
import { consultarJuego } from '../educacion/ClientePuntuacion.js';
import { renderizarDesempeno } from './PanelDesempeno.js';
import { inicializarOrganizacionSimulacion } from './OrganizacionSimulacion.js';
import ClienteDisenos, { obtenerSesionActiva } from '../red/ClienteDisenos.js';
import { establecerIdDisenoEnRuta, obtenerContextoRuta, obtenerIdDisenoDeRuta } from '../red/ContextoDiseno.js';
import { crearVisorSimulacion } from './EscenaSimulacion.js';
import { crearFlujoNavegacion, inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { obtenerConfiguracionAplicacion, estaMantenimientoActivo, EVENTO_CONFIGURACION, MENSAJE_MANTENIMIENTO } from '../configuracion/ConfiguracionAplicacion.js';
import { destacarConceptos, cerrarDefinicion } from '../educacion/glosario/GlosarioContextual.js';
import { CONCEPTOS_SIMULACION } from '../educacion/glosario/ContextoConceptos.js';
import { consumirVistaParaNavegacion, guardarVistaParaNavegacion } from '../mapa/VistaGeografica.js';

const sesion = obtenerSesionActiva();
const idDisenoInicial = obtenerIdDisenoDeRuta();
let cliente = null;
let tutorialSimulacion = null;
let panelTutorialSimulacion = null;
let progresoSimulacion = null;
let visor = null;
let organizacion = null;
let panelAyuda = null;
let errorAyuda = null;
let disenoActual = null;
let parametrosUltimaEjecucion = null;
let estadoMotor = null;
let ejecucionPendiente = null;
let resultadoEnCurso = false;
let preparacionEnCurso = false;
let versionDiseno = 0;
let paginaActiva = true;
let reanudarAlVolver = false;
let consignaActual = null;
let idDisenoConsigna = null;
let mensajeConsigna = '';
let numeroSolicitudConsigna = 0;
let escenariosGlosario = [];
let controlUnidades = null;
let unidadSeleccionada = 'todas';
let guardandoVelocidad = false;
let catalogoProgresoDisponible = false;
let configuracionUvUt = null;
let duracionAplicada = null;
const VELOCIDADES_SIMULACION = new Set(RITMOS);

if (!sesion) {
  const destino = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login.html?destino=${encodeURIComponent(destino)}`);
} else {
  inicializar();
}

function ubicarPanelAyuda(selector) {
  const destino = document.querySelector(selector);
  // Reinsertar el mismo nodo durante pointerdown/pointerup cancela el clic.
  if (panelAyuda.contenedor.parentElement !== destino) destino.append(panelAyuda.contenedor);
}

async function inicializar() {
  // El acceso desde Edición abre esta pantalla sin iniciar la ejecución.
  if (idDisenoInicial) consumirInicioSimulacion(idDisenoInicial);
  document.getElementById('volverEdicion').addEventListener('click', guardarVistaAlVolverEdicion);
  [['#formularioEjecucion button[type="submit"]','play','Iniciar simulación'],['#pausarSimulacion','pausa','Pausar simulación'],
    ['#reanudarSimulacion','play','Reanudar simulación'],['#detenerSimulacion','detener','Detener simulación'],['#reiniciarSimulacion','reiniciar','Reiniciar recorrido'],
    ['#seguirMetro','metros','Seguir metro'],['#ampliarMapa','ampliar','Ampliar mapa'],['#aplicarUnidadTiempo','guardar','Aplicar UT'],
    ['#tutorialPantallaSimulacion','tutorialPizarra','Ver tutorial de Simulación']]
    .forEach(([selector,icono,nombre]) => configurarBotonIcono(document.querySelector(selector),icono,nombre));
  panelAyuda = new PanelAyudaContextual(document.querySelector('[data-ayuda-contextual]'), { controles: true, incluirTutorial: false });
  ubicarPanelAyuda('[data-hud-mapa]');
  inicializarNavegacion({ actual: 'simulacion', etapa: 'simulacion' });
  // Consulta educativa independiente: una falla nunca demora la simulación.
  const consultaProgreso = consultarJuego('/progreso').then(progreso => {
    progresoSimulacion = progreso;
    escenariosGlosario = Array.isArray(progreso?.escenarios) ? progreso.escenarios : [];
    catalogoProgresoDisponible = Array.isArray(progreso?.escenarios);
    if (disenoActual) { actualizarAyuda(); controlUnidades?.actualizarNivel(obtenerRotuloNivel()); }
  }).catch(() => {});
  destacarConceptos(document.querySelector('.simulacion-etiqueta-control'), CONCEPTOS_SIMULACION);
  document.querySelector('[data-icono-duracion]').innerHTML = iconoRetro('reloj');
  organizacion = inicializarOrganizacionSimulacion();
  aplicarConfiguracionPredeterminada(await obtenerConfiguracionAplicacion(sesion));
  cliente = new ClienteDisenos(sesion);
  document.getElementById('formularioEjecucion').addEventListener('submit', ejecutarSimulacion);
  document.getElementById('pausarSimulacion').addEventListener('click', pausarSimulacion);
  document.getElementById('reanudarSimulacion').addEventListener('click', reanudarSimulacion);
  document.getElementById('detenerSimulacion').addEventListener('click', detenerSimulacion);
  document.getElementById('reiniciarSimulacion').addEventListener('click', reiniciarSimulacion);
  document.getElementById('seguirMetro').addEventListener('click', alternarSeguimientoMetro);
  document.querySelector('.simulacion-selector-velocidad').addEventListener('click', cambiarVelocidad);
  document.querySelectorAll('[data-paso-horas]').forEach(boton => boton.addEventListener('click', () => {
    const input = document.getElementById('duracionSimulacion');
    if (input.disabled) return;
    input.value = String(Math.max(1, Number(input.value) + Number(boton.dataset.pasoHoras)));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  document.getElementById('aplicarUnidadTiempo').addEventListener('click', () => {
    const input = document.getElementById('duracionSimulacion');
    if (!input.reportValidity()) return;
    const modificada = duracionAplicada !== Number(input.value);
    duracionAplicada = Number(input.value);
    if (modificada) tutorialSimulacion?.notificar('duracion');
    controlUnidades?.actualizarTiempo(duracionAplicada, configuracionUvUt ? 'UT' : 'h');
    mostrarMensaje(`Se usarán ${input.value} ${configuracionUvUt ? 'UT' : 'h'} en el próximo recorrido.`);
  });
  panelTutorialSimulacion = crearPanelTutorialSimulacion(document.getElementById('tutorialPantallaSimulacion'), () => {
    tutorialSimulacion?.terminar(false);
    const alFinalizar = () => { tutorialSimulacion = null; };
    tutorialSimulacion = abrirTutorialSimulacion(alFinalizar, escenariosGlosario.find(e => e.idEscenario === disenoActual?.simulacion.idEscenario)?.numero);
  }, () => { tutorialSimulacion?.terminar(false); tutorialSimulacion = null; });
  window.addEventListener('pagehide', limpiarVisor);
  window.addEventListener('pageshow', evento => {
    if (!evento.persisted || !reanudarAlVolver) return;
    reanudarAlVolver = false;
    actualizarPanelTiempoReal(visor?.escena.reanudarAnimacion(performance.now()));
  });
  window.addEventListener(EVENTO_CONFIGURACION, actualizarMantenimiento);
  visor = await crearVisorSimulacion(document.getElementById('visorSimulacion'), { alActualizarEstado: actualizarPanelTiempoReal, alSeleccionarUnidad: id => seleccionarUnidad(String(id)) });
  if (idDisenoInicial) await abrirDiseno(idDisenoInicial);
  else mostrarEstadoVacio();
  await consultaProgreso;
  if (!paginaActiva) return;
  if (disenoActual) tutorialSimulacion = presentarTutorialSimulacion({
    idUsuario: sesion.usuario?.idUsuario,
    numeroNivel: escenariosGlosario.find(e => e.idEscenario === disenoActual.simulacion.idEscenario)?.numero
      ?? disenoActual.simulacion.idEscenario,
    numeroCampana: progresoSimulacion?.numeroCampanaActual,
    repetido: (progresoSimulacion?.escenarios?.find(e => e.idEscenario === disenoActual.simulacion.idEscenario)?.cantidadIntentosCampana ?? 0) > 1,
    alFinalizar: () => { tutorialSimulacion = null; },
  });
}

function aplicarConfiguracionPredeterminada(configuracion) {
  const velocidad = configuracion.velocidadSimulacion;
  document.getElementById('velocidadSimulacion').value = String(velocidad);
  document.getElementById('ritmoVisible').textContent = formatearRitmo(velocidad);
}

async function abrirDiseno(idDiseno) {
  const version = ++versionDiseno;
  try {
    if (String(disenoActual?.simulacion?.idDiseno) !== String(idDiseno)) duracionAplicada = null;
    cerrarDefinicion();
    errorAyuda = null;
    panelAyuda?.actualizar({});
    numeroSolicitudConsigna += 1;
    consignaActual = null;
    idDisenoConsigna = null;
    mensajeConsigna = '';
    detenerAnimacion();
    parametrosUltimaEjecucion = null;
    estadoMotor = null;
    restablecerSeguimientoMetro();
    const diseno = await cliente.obtener(idDiseno);
    if (version !== versionDiseno || !paginaActiva) return;
    disenoActual = diseno;
    configuracionUvUt = null;
    const contexto = obtenerContextoDiseno(idDiseno);
    window.history.replaceState({}, '', establecerIdDisenoEnRuta('/simulacion.html', idDiseno, contexto));
    visor.escena.establecerDiseno(disenoActual);
    const vista = consumirVistaParaNavegacion(idDiseno, sesion, 'simulacion');
    actualizarPantalla();
    if (vista) visor.escena.solicitarVistaGeografica(vista);
    await cargarConsignaReal(idDiseno);
    if (version !== versionDiseno || !paginaActiva) return false;
    await actualizarDesempeno(idDiseno);
    if (version !== versionDiseno || !paginaActiva) return false;
    gestorMusica.establecerContexto('simulacion');
    return true;
  } catch (error) {
    if (version === versionDiseno && paginaActiva) { mostrarMensaje(error.message, 'error'); mostrarEstadoVacio(); }
    return false;
  }
}

function actualizarPantalla() {
  const resumen = disenoActual.simulacion;
  document.getElementById('estadoVacio').hidden = true;
  document.getElementById('panelSimulacion').hidden = false;
  ubicarPanelAyuda('[data-hud-mapa]');
  organizacion.mostrarDiseno(resumen.idDiseno);
  document.getElementById('tituloSimulacion').textContent = resumen.nombre;
  document.getElementById('volverEdicion').href = establecerIdDisenoEnRuta('/', resumen.idDiseno, obtenerContextoDiseno(resumen.idDiseno));
  actualizarConsignaSimulacion(resumen);
  document.getElementById('estadoEjecucion').textContent = obtenerEstadoEjecucion();
  actualizarPanelTiempoReal(estadoMotor ?? crearEstadoInicial());
  actualizarDisponibilidadEjecucion();
}

function actualizarConsignaSimulacion() { actualizarAyuda(); }

async function cargarConsignaReal(idDiseno) {
  const solicitud = ++numeroSolicitudConsigna;
  errorAyuda = null;
  consignaActual = null;
  idDisenoConsigna = null;
  if (!esSolicitudConsignaVigente(solicitud, idDiseno)) return;
  if (catalogoProgresoDisponible && !escenariosGlosario.some(e => e.idEscenario === disenoActual.simulacion.idEscenario)) {
    mensajeConsigna = 'Diseño propio: las instrucciones y la validación de la red siguen disponibles.';
    actualizarConsignaSimulacion(disenoActual.simulacion);
    return;
  }
  mensajeConsigna = 'Consultando el estado real de los objetivos del nivel…';
  if (disenoActual?.simulacion?.idDiseno === idDiseno) actualizarConsignaSimulacion(disenoActual.simulacion);
  try {
    const consigna = await obtenerConsignaReal(idDiseno);
    if (!esSolicitudConsignaVigente(solicitud, idDiseno)) return;
    consignaActual = consigna;
    idDisenoConsigna = idDiseno;
    mensajeConsigna = '';
  } catch (error) {
    if (!esSolicitudConsignaVigente(solicitud, idDiseno)) return;
    mensajeConsigna = obtenerMensajeConsignaNoDisponible(error);
  }
  actualizarConsignaSimulacion(disenoActual.simulacion);
}

async function obtenerConsignaReal(idDiseno) {
  const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego/disenos/${idDiseno}/consigna`, {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });
  if (respuesta.ok) return respuesta.json();
  let detalle = '';
  try {
    detalle = (await respuesta.json()).detail ?? '';
  } catch {
    // La respuesta no incluyó un detalle legible.
  }
  const error = new Error(detalle);
  error.estado = respuesta.status;
  throw error;
}

function esSolicitudConsignaVigente(solicitud, idDiseno) {
  return solicitud === numeroSolicitudConsigna && disenoActual?.simulacion?.idDiseno === idDiseno;
}

function obtenerMensajeConsignaNoDisponible(error) {
  if (error?.estado === 404) return 'Este diseño no tiene una consigna de objetivos disponible.';
  return 'No fue posible actualizar los objetivos reales del nivel. La consigna general continúa disponible.';
}

function actualizarProgresoEjecucion(estado) {
  const porcentaje = Math.round(Math.min(1, Math.max(0, Number(estado?.progreso) || 0)) * 100);
  const estadoEjecucion = estado?.estado ?? 'DETENIDA';
  const barra = document.getElementById('progresoEjecucion');
  barra.dataset.estado = estadoEjecucion;
  barra.setAttribute('aria-valuenow', String(porcentaje));
  barra.setAttribute('aria-valuetext', `${formatearEstadoMotor(estadoEjecucion)} · ${porcentaje}%`);
  document.getElementById('rellenoProgresoEjecucion').style.width = `${porcentaje}%`;
  document.getElementById('valorProgresoEjecucion').textContent = `${porcentaje}%`;
}

async function actualizarDesempeno(idDiseno, actualizarMotor = true) {
  const version = versionDiseno;
  let desempeno = null;
  try { desempeno = await consultarJuego(`/disenos/${idDiseno}/desempeno`); } catch { /* Mantener disponible la simulación habitual. */ }
  if (!paginaActiva || version !== versionDiseno || disenoActual?.simulacion?.idDiseno !== idDiseno) return;
  if (!Number.isFinite(desempeno?.puntajeMaximo)) desempeno = null;
  configuracionUvUt = desempeno?.configuracionUvUt ?? null;
  const esUvUt = Boolean(configuracionUvUt);
  if (esUvUt && duracionAplicada === null && !parametrosUltimaEjecucion && !ejecucionPendiente) {
    document.getElementById('duracionSimulacion').value = String(configuracionUvUt.limiteUt);
  }
  duracionAplicada ??= Number(document.getElementById('duracionSimulacion').value);
  document.getElementById('duracionSimulacion').setAttribute('aria-label', esUvUt ? 'Duración simulada en UT' : 'Duración simulada en horas');
  document.getElementById('unidadDuracionSimulacion').textContent = esUvUt ? 'UT' : 'h';
  configurarBotonIcono(document.getElementById('aplicarUnidadTiempo'), 'guardar', esUvUt ? 'Aplicar UT' : 'Aplicar duración');
  const resumenCriterio = document.getElementById('resumenCriterioUvUt');
  resumenCriterio.hidden = !esUvUt;
  if (esUvUt) {
    const ultimo = desempeno.resultadoUvUt;
    resumenCriterio.textContent = `Objetivo: completar todos los recorridos en hasta ${configuracionUvUt.limiteUt} UT con ${configuracionUvUt.presupuestoUv} UV como máximo. ${ultimo ? `Última ejecución: ${ultimo.sumaUv} UV, ${ultimo.completo ? 'recorridos completos' : 'objetivo pendiente'}.` : ''} ${ultimo?.mejorUv != null ? `Mejor UV para esta red: ${ultimo.mejorUv}.` : ''}`;
  }
  actualizarPanelTiempoReal(estadoMotor ?? crearEstadoInicial());
  disenoActual.metricasUnidades = desempeno?.unidades ?? [];
  if (actualizarMotor) visor?.escena.establecerDiseno(disenoActual);
  if (!disenoActual.unidadesMetro?.some(u => String(u.idTren) === unidadSeleccionada)) unidadSeleccionada = 'todas';
  controlUnidades = renderizarDesempeno(document.getElementById('desempenoNivel'), disenoActual, desempeno, guardarVelocidades, {
    seleccion: unidadSeleccionada, alSeleccionar: seleccionarUnidad,
    nivel: obtenerRotuloNivel(),
    duracionGlobal: duracionAplicada, unidadTiempo: esUvUt ? 'UT' : 'h',
    bloqueado: guardandoVelocidad || ['EN_CURSO', 'PAUSADA'].includes(estadoMotor?.estado),
  });
  visor?.escena.establecerUnidadSeleccionada(unidadSeleccionada);
  actualizarFichaUnidad();
}

function obtenerRotuloNivel() {
  const resumen = disenoActual?.simulacion;
  if (!resumen) return 'Red actual';
  if (['LIBRE', 'EDICION_LIBRE'].includes(resumen.modo)) return 'Modo libre';
  const numero = escenariosGlosario.find(e => e.idEscenario === resumen.idEscenario)?.numero;
  return Number.isInteger(numero) ? `Nivel ${numero}` : resumen.nombre || 'Nivel actual';
}

function seleccionarUnidad(id) {
  unidadSeleccionada = id;
  controlUnidades?.seleccionar(id);
  if (id && id !== 'todas') tutorialSimulacion?.notificar('unidad-individual');
  visor?.escena.establecerUnidadSeleccionada(id);
  actualizarFichaUnidad();
}

function actualizarFichaUnidad() {
  const unidad = disenoActual?.unidadesMetro?.find(u => String(u.idTren) === unidadSeleccionada);
  const ficha = document.getElementById('seccionMetricas');
  ficha.hidden = !unidad;
  if (!unidad) return;
  const enMovimiento = estadoMotor?.unidades?.find(u => String(u.idTren) === unidadSeleccionada);
  document.getElementById('metroSimulacion').textContent = `M-${numeroMetroEnRed(unidad.idTren, disenoActual.unidadesMetro) ?? '—'}`;
  document.getElementById('lineaSimulacion').textContent = unidad.nombreLinea;
  document.getElementById('proximaEstacionSimulacion').textContent = enMovimiento?.proximaEstacion
    ?? (enMovimiento?.estacionActual ? `En ${enMovimiento.estacionActual}` : 'Lista para circular');
}

async function guardarVelocidades(unidades, velocidadPromedio) {
  if (guardandoVelocidad || preparacionEnCurso || resultadoEnCurso || ['EN_CURSO', 'PAUSADA'].includes(estadoMotor?.estado) || estaMantenimientoActivo(sesion)) return;
  const id = disenoActual.simulacion.idDiseno, version = versionDiseno;
  const vigente = () => paginaActiva && versionDiseno === version && disenoActual?.simulacion.idDiseno === id;
  guardandoVelocidad = true;
  actualizarControlesSimulacion(estadoMotor);
  const cambioReal = unidades.some(u => Number(u.velocidadPromedio) !== velocidadPromedio);
  let actualizadas = 0, fallo = null;
  try {
    for (const unidad of unidades) {
      if (!vigente()) return;
      await cliente.solicitar(`/${id}/unidades/${unidad.idTren}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreLinea: unidad.nombreLinea, capacidad: unidad.capacidad, velocidadPromedio }) });
      actualizadas++;
    }
  } catch (error) { fallo = error; }
  finally {
    if (vigente()) {
      // Las operaciones existentes son individuales. Ante un fallo parcial se
      // vuelve a leer lo realmente persistido, sin fingir una escritura atómica.
      const recargado = await abrirDiseno(id);
      if (recargado && paginaActiva && disenoActual?.simulacion.idDiseno === id) mostrarMensaje(fallo ? `Se actualizaron ${actualizadas} de ${unidades.length} unidades. ${fallo.message}`
        : `Velocidad guardada: ${formatearVelocidad(velocidadPromedio)} en ${actualizadas} unidad(es).`, fallo ? 'error' : 'exito');
    }
    guardandoVelocidad = false;
    if (!fallo && cambioReal && actualizadas) {
      tutorialSimulacion?.notificar(unidades.length > 1 ? 'velocidad-global' : 'velocidad-individual');
      tutorialSimulacion?.notificar('velocidad');
    }
    if (paginaActiva) actualizarPanelTiempoReal(estadoMotor ?? crearEstadoInicial());
  }
}

function obtenerEstadoEjecucion() {
  if (estaMantenimientoActivo(sesion)) return 'La red puede consultarse. La ejecución se habilitará al finalizar el mantenimiento.';
  if (!disenoActual) return '';
  if (!disenoActual.preparadoParaSimular) return obtenerMensajePreparacionSimulacion();
  if (disenoActual.simulacion.estado === 'COMPLETADO') return 'Nivel completado.';
  return 'Red lista.';
}

async function ejecutarSimulacion(evento) {
  evento.preventDefault();
  if (!disenoActual || resultadoEnCurso || preparacionEnCurso || guardandoVelocidad || ['EN_CURSO', 'PAUSADA'].includes(estadoMotor?.estado) || estaMantenimientoActivo(sesion)) return;
  const velocidad = Number(document.getElementById('velocidadSimulacion').value);
  const duracion = Number(document.getElementById('duracionSimulacion').value);
  if (!VELOCIDADES_SIMULACION.has(velocidad) || !Number.isInteger(duracion) || duracion <= 0) {
    mostrarMensaje(`Elegí un ritmo de reproducción disponible (×) y una cantidad entera de ${configuracionUvUt ? 'UT' : 'horas simuladas'} mayor que cero.`, 'error');
    return;
  }
  preparacionEnCurso = true;
  actualizarControlesSimulacion(estadoMotor);
  const id = disenoActual.simulacion.idDiseno, version = versionDiseno;
  const vigente = () => paginaActiva && version === versionDiseno && disenoActual?.simulacion.idDiseno === id;
  try {
    await prepararDiseno(cliente, id, { paraSimular:true, guardar:true, vigente });
    if (!vigente()) return;
    const resultado = await cliente.ejecutar(id, { velocidad, duracion });
    if (!vigente()) return;
    if (!await abrirDiseno(id) || !paginaActiva) return;
    duracionAplicada = duracion;
    document.getElementById('duracionSimulacion').value = String(duracion);
    controlUnidades?.actualizarTiempo(duracion, configuracionUvUt ? 'UT' : 'h');
    parametrosUltimaEjecucion = { velocidad, duracion };
    ejecucionPendiente = { idDiseno: disenoActual.simulacion.idDiseno, resultado };
    if (estaMantenimientoActivo(sesion)) return;
    const estado = visor.escena.iniciarAnimacion(velocidad, duracion);
    actualizarPanelTiempoReal(estado);
    tutorialSimulacion?.notificar('inicio');
    crearFlujoNavegacion('resultados');
    document.getElementById('continuarEscenarios').hidden = true;
    mostrarMensaje('Recorrido iniciado. Observá el metro antes de consultar el resultado.', 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally { preparacionEnCurso = false; actualizarControlesSimulacion(estadoMotor); }
}

function pausarSimulacion() {
  const estado = visor?.escena.pausarAnimacion();
  actualizarPanelTiempoReal(estado);
  mostrarMensaje('Animación pausada. El resultado permanece guardado.');
}

function reanudarSimulacion() {
  if (estaMantenimientoActivo(sesion)) return;
  const estado = visor?.escena.reanudarAnimacion();
  actualizarPanelTiempoReal(estado);
  mostrarMensaje('Animación reanudada.');
}

function detenerSimulacion() {
  const estado = visor?.escena.detenerAnimacion();
  actualizarPanelTiempoReal(estado);
  mostrarMensaje('Simulación detenida. La red permanece visible para su revisión.');
}

async function reiniciarSimulacion() {
  if (estaMantenimientoActivo(sesion)) return;
  if (!parametrosUltimaEjecucion || !visor || resultadoEnCurso) return;
  if (Number(document.getElementById('duracionSimulacion').value) !== parametrosUltimaEjecucion.duracion) {
    await ejecutarSimulacion({ preventDefault() {} });
    return;
  }
  const estado = visor.escena.reiniciarAnimacion();
  actualizarPanelTiempoReal(estado);
  mostrarMensaje('Simulación reiniciada con los últimos parámetros.');
}

function cambiarVelocidad(evento) {
  const boton = evento.target.closest('[data-paso-ritmo]');
  if (!boton) return;
  const input = document.getElementById('velocidadSimulacion');
  const indice = RITMOS.indexOf(Number(input.value));
  const velocidad = RITMOS[Math.max(0, Math.min(RITMOS.length - 1, indice + Number(boton.dataset.pasoRitmo)))];
  input.value = String(velocidad);
  document.getElementById('ritmoVisible').textContent = formatearRitmo(velocidad);
  if (parametrosUltimaEjecucion) parametrosUltimaEjecucion = { ...parametrosUltimaEjecucion, velocidad };
  actualizarPanelTiempoReal(visor?.escena.establecerVelocidadAnimacion(velocidad));
}

function alternarSeguimientoMetro() {
  const boton = document.getElementById('seguirMetro');
  const activo = visor?.escena.establecerSeguimientoMetro(boton.getAttribute('aria-pressed') !== 'true');
  boton.setAttribute('aria-pressed', String(Boolean(activo)));
  configurarBotonIcono(boton, 'metros', activo ? 'Seguir metro: activado' : 'Seguir metro: desactivado');
  mostrarMensaje(activo ? 'La cámara acompaña al metro de forma suave.' : 'Seguimiento desactivado. Podés mover el mapa libremente.');
}

function restablecerSeguimientoMetro() {
  const boton = document.getElementById('seguirMetro');
  boton.setAttribute('aria-pressed', 'false');
  configurarBotonIcono(boton, 'metros', 'Seguir metro: desactivado');
}

function detenerAnimacion() {
  const estado = visor?.escena.detenerAnimacion();
  actualizarPanelTiempoReal(estado);
}

function limpiarVisor(evento) {
  panelTutorialSimulacion?.cerrar();
  if (evento?.persisted) {
    reanudarAlVolver = visor?.escena.motorSimulacion?.estado === 'EN_CURSO';
    if (reanudarAlVolver) actualizarPanelTiempoReal(visor.escena.pausarAnimacion());
    return;
  }
  tutorialSimulacion?.terminar(false);
  panelTutorialSimulacion?.eliminar();
  panelTutorialSimulacion = null;
  document.getElementById('volverEdicion').removeEventListener('click', guardarVistaAlVolverEdicion);
  paginaActiva = false;
  versionDiseno += 1;
  panelAyuda?.eliminar();
  visor?.destruir();
  visor = null;
}

function guardarVistaAlVolverEdicion(evento) {
  if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey ||
      evento.shiftKey || evento.altKey) return;
  const idDiseno = disenoActual?.simulacion?.idDiseno;
  guardarVistaParaNavegacion(idDiseno,
    visor?.escena.controlZoom?.capturarVistaParaNavegacion(), sesion, 'edicion');
}

function actualizarPanelTiempoReal(estado) {
  if (!estado) return;
  const cambioEstado = estadoMotor?.estado !== estado.estado;
  estadoMotor = estado;
  if (cambioEstado) { errorAyuda = null; actualizarAyuda(); }
  actualizarProgresoEjecucion(estado);
  document.getElementById('tiempoSimulacion').textContent = formatearTiempo(estado.tiempoTranscurrido);
  actualizarFichaUnidad();
  document.getElementById('estadoTiempoReal').textContent = formatearEstadoMotor(estado.estado);
  document.getElementById('estadoEjecucion').textContent = obtenerMensajeEstadoMotor(estado);
  actualizarControlesSimulacion(estado);
  if (estado.estado === 'FINALIZADA') finalizarEjecucionVisible();
}

async function finalizarEjecucionVisible() {
  const pendiente = ejecucionPendiente;
  if (!pendiente) return;
  ejecucionPendiente = null;
  resultadoEnCurso = true;
  actualizarControlesSimulacion(estadoMotor);
  const controlador = new AbortController();
  const cancelar = () => controlador.abort();
  const vigente = () => !controlador.signal.aborted && paginaActiva && disenoActual?.simulacion?.idDiseno === pendiente.idDiseno;
  window.addEventListener('pagehide', cancelar);
  window.addEventListener('popstate', cancelar);
  try {
    // La ejecución ya registró sus objetivos y descuentos en el servidor.
    // Consultar resultados no aprueba el nivel: esa decisión pertenece a Finalizar red.
    await cargarConsignaReal(pendiente.idDiseno);
    if (!vigente()) return;
    await actualizarDesempeno(pendiente.idDiseno, false);
    if (!vigente()) return;
    tutorialSimulacion?.notificar('ejecucion');
    document.getElementById('continuarEscenarios').hidden = false;
    const esNivel = Number.isInteger(escenariosGlosario.find(e => e.idEscenario === disenoActual.simulacion.idEscenario)?.numero);
    const lista = consignaActual?.estadoGlobal === 'LISTO';
    const aprobada = disenoActual.simulacion.estado === 'COMPLETADO' || consignaActual?.estadoGlobal === 'COMPLETADO';
    let mensaje = 'Simulación terminada. Podés ajustar la red y volver a probar.';
    if (esNivel) mensaje = aprobada
      ? 'Simulación terminada. Este nivel ya está aprobado; podés volver a Niveles para repetirlo.'
      : lista ? 'Simulación terminada. Volvé a Edición y elegí Finalizar red para comprobar la aprobación.'
        : 'Simulación terminada. Revisá los objetivos pendientes; podés ajustar la red y volver a probar.';
    mostrarMensaje(mensaje, 'exito');
  } catch (error) {
    if (vigente()) mostrarMensaje(`Simulación guardada. No se pudo actualizar el resultado: ${error.message}`, 'error');
  } finally {
    resultadoEnCurso = false;
    if (vigente()) actualizarControlesSimulacion(estadoMotor);
    window.removeEventListener('pagehide', cancelar);
    window.removeEventListener('popstate', cancelar);
  }
}

function actualizarMantenimiento() {
  if (estaMantenimientoActivo(sesion) && estadoMotor?.estado === 'EN_CURSO') {
    actualizarPanelTiempoReal(visor?.escena.pausarAnimacion());
  }
  actualizarControlesSimulacion(estadoMotor);
  document.getElementById('estadoEjecucion').textContent = obtenerMensajeEstadoMotor(estadoMotor ?? crearEstadoInicial());
}

function actualizarControlesSimulacion(estado) {
  const estadoActual = estado?.estado;
  const enCurso = estadoActual === 'EN_CURSO';
  const pausada = estadoActual === 'PAUSADA';
  const horas = document.getElementById('duracionSimulacion');
  horas.disabled = enCurso || pausada || preparacionEnCurso || resultadoEnCurso;
  document.getElementById('aplicarUnidadTiempo').disabled = horas.disabled;
  document.querySelectorAll('[data-paso-horas]').forEach(boton => { boton.disabled = horas.disabled; });
  document.querySelectorAll('[data-paso-ritmo]').forEach(boton => { boton.disabled = preparacionEnCurso || resultadoEnCurso; });
  const campoVelocidades = document.querySelector('[data-controles-circulacion]');
  if (campoVelocidades) campoVelocidades.disabled = guardandoVelocidad || preparacionEnCurso || resultadoEnCurso || estaMantenimientoActivo(sesion) || enCurso || pausada;
  const controlConFoco = document.activeElement;
  const puedeReiniciar = Boolean(parametrosUltimaEjecucion);
  document.getElementById('pausarSimulacion').disabled = !enCurso;
  document.getElementById('pausarSimulacion').hidden = !enCurso;
  document.getElementById('reanudarSimulacion').disabled = !pausada || estaMantenimientoActivo(sesion);
  document.getElementById('reanudarSimulacion').hidden = !pausada;
  document.getElementById('detenerSimulacion').disabled = !enCurso && !pausada;
  document.getElementById('reiniciarSimulacion').disabled = !puedeReiniciar || resultadoEnCurso || estaMantenimientoActivo(sesion);
  document.getElementById('seguirMetro').disabled = !estado?.metroActivo?.transitable;
  actualizarDisponibilidadEjecucion();
  if (controlConFoco?.id === 'pausarSimulacion' && pausada) document.getElementById('reanudarSimulacion').focus({ preventScroll: true });
  if (controlConFoco?.id === 'reanudarSimulacion' && enCurso) document.getElementById('pausarSimulacion').focus({ preventScroll: true });
}

function actualizarDisponibilidadEjecucion() {
  const boton = document.querySelector('#formularioEjecucion button[type="submit"]');
  if (!boton) return;
  const ejecucionActiva = estadoMotor?.estado === 'EN_CURSO' || estadoMotor?.estado === 'PAUSADA';
  boton.hidden = ejecucionActiva;
  boton.disabled = !disenoActual || guardandoVelocidad || preparacionEnCurso || resultadoEnCurso || estaMantenimientoActivo(sesion);
  boton.setAttribute('aria-busy', String(preparacionEnCurso));
  boton.title = estaMantenimientoActivo(sesion) ? MENSAJE_MANTENIMIENTO : preparacionEnCurso
    ? 'Comprobando la red…'
    : (ejecucionActiva ? 'Detené o reiniciá la simulación actual antes de iniciar otra.' : 'Iniciar simulación');
}

function crearEstadoInicial() {
  return {
    estado: 'DETENIDA',
    tiempoTranscurrido: 0,
    metroActivo: null,
  };
}

function formatearTiempo(horas) { const valor = Math.max(0, Number(horas) || 0); return configuracionUvUt ? `${valor.toLocaleString('es-UY', { maximumFractionDigits: 2 })} UT` : formatearDuracion(valor); }

function formatearEstadoMotor(estado) {
  return ({
    DETENIDA: 'Detenida',
    EN_CURSO: 'En recorrido',
    PAUSADA: 'Pausada',
    FINALIZADA: 'Finalizada',
  })[estado] ?? 'Red lista';
}

function obtenerMensajeEstadoMotor(estado) {
  if (estaMantenimientoActivo(sesion)) return obtenerEstadoEjecucion();
  if (estado.estado === 'EN_CURSO') return 'La red permanece visible mientras los metros recorren sus conexiones.';
  if (estado.estado === 'PAUSADA') return 'La animación está pausada. Podés reanudarla, detenerla o reiniciarla.';
  if (estado.estado === 'FINALIZADA') return 'El recorrido terminó. La red continúa visible para revisar el resultado.';
  if (parametrosUltimaEjecucion) return 'La simulación está detenida. Podés reiniciarla sin alterar la red guardada.';
  return obtenerEstadoEjecucion();
}

function obtenerMensajePreparacionSimulacion() {
  const observaciones = disenoActual?.observacionesSimulacion;
  return observaciones?.length
    ? observaciones.join(' ')
    : 'Asigná una unidad a un recorrido continuo. Play comprueba y guarda la red antes de iniciar.';
}

function mostrarEstadoVacio() {
  gestorMusica.establecerContexto('simulacion');
  disenoActual = null;
  actualizarAyuda();
  document.getElementById('estadoVacio').hidden = false;
  document.getElementById('panelSimulacion').hidden = true;
  ubicarPanelAyuda('[data-hud-mapa]');
  organizacion.mostrarDiseno(null);
}

function actualizarAyuda() {
  const resumen = disenoActual?.simulacion;
  panelAyuda?.actualizar({
    diseno: disenoActual,
    escenario: escenariosGlosario.find(e => e.idEscenario === resumen?.idEscenario) ?? resumen,
    consigna: consignaActual,
    estadoConsigna: consignaActual && idDisenoConsigna === resumen?.idDiseno ? 'disponible' : 'noDisponible',
    pantalla: 'simulacion', estadoMotor: estadoMotor?.estado, error: errorAyuda,
  });
}

function mostrarMensaje(texto, tipo = '') {
  if (tipo === 'error') errorAyuda = texto;
  else if (tipo === 'exito') errorAyuda = null;
  actualizarAyuda();
  const mensaje = document.getElementById('mensajeSimulacion');
  mensaje.textContent = texto;
  mensaje.className = `simulacion-mensaje ${tipo}`;
  if (tipo === 'error') mensaje.scrollIntoView({ block: 'nearest' });
}

function obtenerContextoDiseno(idDiseno) {
  const contextoActual = obtenerContextoRuta();
  const idEscenario = disenoActual?.simulacion?.idEscenario ?? contextoActual.idEscenario;
  return {
    idDiseno,
    idEscenario: idEscenario ?? null,
    idIntento: idEscenario === contextoActual.idEscenario ? contextoActual.idIntento : null,
  };
}
