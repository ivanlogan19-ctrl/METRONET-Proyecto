import PanelAyudaContextual from '../educacion/PanelAyudaContextual.js';
import { consultarJuego } from '../educacion/ClientePuntuacion.js';
import { renderizarDesempeno } from './PanelDesempeno.js';
import { inicializarOrganizacionSimulacion } from './OrganizacionSimulacion.js';
import { consultarMejorPuntajeAnterior, presentarResultadoNivel } from '../educacion/TransicionNivel.js';
import { iniciarNivelConTransicion } from '../educacion/PreparacionNivel.js';
import ClienteDisenos, { obtenerSesionActiva } from '../red/ClienteDisenos.js';
import { establecerIdDisenoEnRuta, establecerContextoEnRuta, obtenerContextoRuta, obtenerIdDisenoDeRuta } from '../red/ContextoDiseno.js';
import { crearVisorSimulacion } from './EscenaSimulacion.js';
import { crearFlujoNavegacion, inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { obtenerConfiguracionAplicacion, estaMantenimientoActivo, EVENTO_CONFIGURACION, MENSAJE_MANTENIMIENTO } from '../configuracion/ConfiguracionAplicacion.js';
import { destacarConceptos, cerrarDefinicion } from '../educacion/glosario/GlosarioContextual.js';
import { conceptosDelNivel, CONCEPTOS_SIMULACION } from '../educacion/glosario/ContextoConceptos.js';

const sesion = obtenerSesionActiva();
const idDisenoInicial = obtenerIdDisenoDeRuta();
let cliente = null;
let visor = null;
let organizacion = null;
let panelAyuda = null;
let errorAyuda = null;
let disenoActual = null;
let parametrosUltimaEjecucion = null;
let estadoMotor = null;
let ejecucionPendiente = null;
let resultadoEnCurso = false;
let consignaActual = null;
let idDisenoConsigna = null;
let mensajeConsigna = '';
let numeroSolicitudConsigna = 0;
let escenariosGlosario = [];
const VELOCIDADES_SIMULACION = new Set([0.5, 1, 2, 4]);
const CANTIDAD_ELEMENTOS_VISIBLES_CONSIGNA = 3;

if (!sesion) {
  const destino = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login.html?destino=${encodeURIComponent(destino)}`);
} else {
  inicializar();
}

async function inicializar() {
  panelAyuda = new PanelAyudaContextual(document.querySelector('[data-ayuda-contextual]'));
  inicializarNavegacion({ actual: 'simulacion', etapa: 'simulacion' });
  // Consulta educativa independiente: una falla nunca demora la simulación.
  consultarJuego('/progreso').then(progreso => {
    escenariosGlosario = Array.isArray(progreso?.escenarios) ? progreso.escenarios : [];
    if (disenoActual) { actualizarGlosarioConsigna(); actualizarAyuda(); }
  }).catch(() => {});
  destacarConceptos(document.querySelector('.simulacion-etiqueta-control'), CONCEPTOS_SIMULACION);
  const etiquetaVentana = document.querySelector('label[for="duracionSimulacion"]');
  const ayudaVentana = document.createElement('p');
  ayudaVentana.className = 'simulacion-ayuda';
  ayudaVentana.textContent = 'Consultar duración y tiempo estimado.';
  etiquetaVentana.parentElement.append(ayudaVentana);
  destacarConceptos(ayudaVentana, CONCEPTOS_SIMULACION);
  organizacion = inicializarOrganizacionSimulacion(() => {
    if (visor?.escena.scale.getParentBounds()) visor.escena.scale.refresh();
  });
  aplicarConfiguracionPredeterminada(await obtenerConfiguracionAplicacion(sesion));
  cliente = new ClienteDisenos(sesion);
  document.getElementById('formularioEjecucion').addEventListener('submit', ejecutarSimulacion);
  document.getElementById('listaDisenos').addEventListener('click', seleccionarDiseno);
  document.getElementById('pausarSimulacion').addEventListener('click', pausarSimulacion);
  document.getElementById('reanudarSimulacion').addEventListener('click', reanudarSimulacion);
  document.getElementById('detenerSimulacion').addEventListener('click', detenerSimulacion);
  document.getElementById('reiniciarSimulacion').addEventListener('click', reiniciarSimulacion);
  document.getElementById('seguirMetro').addEventListener('click', alternarSeguimientoMetro);
  document.querySelector('.simulacion-selector-velocidad').addEventListener('click', cambiarVelocidad);
  document.getElementById('verResultadosSimulacion').addEventListener('click', mostrarResultados);
  document.getElementById('referenciasConsigna').addEventListener('click', localizarReferenciaConsigna);
  window.addEventListener('pagehide', limpiarVisor);
  window.addEventListener(EVENTO_CONFIGURACION, actualizarMantenimiento);
  visor = await crearVisorSimulacion(document.getElementById('visorSimulacion'), { alActualizarEstado: actualizarPanelTiempoReal });
  await cargarDisenos();
  if (idDisenoInicial) await abrirDiseno(idDisenoInicial);
}

function aplicarConfiguracionPredeterminada(configuracion) {
  const velocidad = configuracion.velocidadSimulacion;
  document.getElementById('velocidadSimulacion').value = String(velocidad);
  document.querySelectorAll('[data-velocidad]').forEach((boton) => {
    boton.setAttribute('aria-pressed', String(Number(boton.dataset.velocidad) === velocidad));
  });
}

async function cargarDisenos() {
  try {
    const disenos = await cliente.listar();
    renderizarListaDisenos(disenos);
    if (!disenos.length) mostrarMensaje('Todavía no hay diseños disponibles. Creá uno desde Edición.');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

function renderizarListaDisenos(disenos) {
  const lista = document.getElementById('listaDisenos');
  lista.replaceChildren(...disenos.map((diseno) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'simulacion-tarjeta';
    boton.dataset.idDiseno = String(diseno.idDiseno);
    boton.innerHTML = `<strong>${escapar(diseno.nombre)}</strong><span>${formatearEstado(diseno.estado)}</span>`;
    return boton;
  }));
}

async function seleccionarDiseno(evento) {
  const boton = evento.target.closest('[data-id-diseno]');
  if (!boton) return;
  ejecucionPendiente = null;
  await abrirDiseno(Number(boton.dataset.idDiseno));
}

async function abrirDiseno(idDiseno) {
  try {
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
    disenoActual = await cliente.obtener(idDiseno);
    const contexto = obtenerContextoDiseno(idDiseno);
    window.history.replaceState({}, '', establecerIdDisenoEnRuta('/simulacion.html', idDiseno, contexto));
    visor.escena.establecerDiseno(disenoActual);
    actualizarPantalla();
    // Phaser se crea con el panel oculto. Medir al mostrarlo evita un resize tardío al iniciar.
    if (visor.escena.scale.getParentBounds()) visor.escena.scale.refresh();
    await cargarConsignaReal(idDiseno);
    await actualizarDesempeno(idDiseno);
    document.querySelectorAll('[data-id-diseno]').forEach((boton) => {
      boton.classList.toggle('activa', Number(boton.dataset.idDiseno) === idDiseno);
    });
  } catch (error) {
    mostrarMensaje(error.message, 'error');
    mostrarEstadoVacio();
  }
}

function actualizarPantalla() {
  const resumen = disenoActual.simulacion;
  const cantidadEstaciones = disenoActual.estaciones.length;
  document.getElementById('estadoVacio').hidden = true;
  document.getElementById('panelSimulacion').hidden = false;
  organizacion.mostrarDiseno(resumen.idDiseno);
  document.getElementById('tituloSimulacion').textContent = resumen.nombre;
  document.getElementById('nombreDisenoLateral').textContent = resumen.nombre;
  document.getElementById('estadoSimulacion').textContent = formatearEstado(resumen.estado);
  document.getElementById('estadoDisenoLateral').textContent = [formatearEstado(resumen.estado), resumen.dificultad].filter(Boolean).join(' · ');
  document.getElementById('volverEdicion').href = establecerIdDisenoEnRuta('/', resumen.idDiseno, obtenerContextoDiseno(resumen.idDiseno));
  actualizarConsignaSimulacion(resumen);
  document.getElementById('estadoVistaMapa').textContent = cantidadEstaciones
    ? `Montevideo · enfoque sobre ${cantidadEstaciones} estaciones de la red`
    : 'Montevideo · el diseño todavía no tiene estaciones';
  document.getElementById('estadoEjecucion').textContent = obtenerEstadoEjecucion();
  renderizarResultados();
  actualizarPanelTiempoReal(estadoMotor ?? crearEstadoInicial());
  actualizarDisponibilidadEjecucion();
}

function actualizarConsignaSimulacion(resumen) {
  document.getElementById('contextoConsigna').textContent = obtenerContextoConsigna(resumen);
  const estadoConsigna = document.getElementById('estadoConsigna');
  const consignaDisponible = consignaActual && idDisenoConsigna === resumen.idDiseno;
  const estado = consignaDisponible ? consignaActual.estadoGlobal : '';
  estadoConsigna.textContent = formatearEstadoConsigna(estado);
  estadoConsigna.dataset.estado = estado ?? '';
  estadoConsigna.hidden = !estado;
  document.getElementById('tituloConsigna').textContent = resumen.nombre || 'Actividad de simulación';
  document.getElementById('objetivoConsigna').textContent = resumen.objetivo || 'Sin objetivo registrado para este escenario.';
  document.getElementById('objetivoCompactoSimulacion').textContent = document.getElementById('objetivoConsigna').textContent;
  const informacionAdicional = document.getElementById('informacionAdicionalConsigna');
  document.getElementById('descripcionConsigna').textContent = resumen.instrucciones || '';
  informacionAdicional.hidden = !resumen.instrucciones;
  actualizarEstadoObjetivosConsigna(consignaDisponible ? '' : mensajeConsigna);
  renderizarProgresoObjetivosConsigna(consignaDisponible ? consignaActual : null);
  renderizarObjetivosConsigna(consignaDisponible ? consignaActual.condiciones : []);
  renderizarReferenciasConsigna(consignaDisponible ? consignaActual.referenciasObjetivo : []);
  actualizarProgresoEjecucion(estadoMotor ?? crearEstadoInicial());
  actualizarGlosarioConsigna();
  actualizarAyuda();
}

function actualizarGlosarioConsigna() {
  const resumen = disenoActual?.simulacion;
  if (!resumen) return;
  const escenario = escenariosGlosario.find(e => e.idEscenario === resumen.idEscenario) ?? resumen;
  const ids = conceptosDelNivel(escenario);
  for (const selector of ['#objetivoConsigna', '#descripcionConsigna', '#listaObjetivosConsigna', '#listaObjetivosAdicionalesConsigna']) {
    destacarConceptos(document.querySelector(selector), ids);
  }
}

function obtenerContextoConsigna(resumen) {
  const modo = resumen.modo === 'EDICION_LIBRE' ? 'Modo libre' : 'Escenario';
  return [modo, resumen.dificultad].filter(Boolean).join(' · ');
}

async function cargarConsignaReal(idDiseno) {
  const solicitud = ++numeroSolicitudConsigna;
  errorAyuda = null;
  consignaActual = null;
  idDisenoConsigna = null;
  mensajeConsigna = 'Consultando el estado real de los objetivos del escenario…';
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
  return 'No fue posible actualizar los objetivos reales del escenario. La consigna general continúa disponible.';
}

function actualizarEstadoObjetivosConsigna(mensaje) {
  const aviso = document.getElementById('estadoObjetivosConsigna');
  aviso.textContent = mensaje;
  aviso.hidden = !mensaje;
}

function renderizarProgresoObjetivosConsigna(consigna) {
  const seccion = document.getElementById('seccionProgresoObjetivosConsigna');
  if (!consigna) {
    seccion.hidden = true;
    actualizarProgresoCompactoConsigna(null, '');
    return;
  }
  const progreso = normalizarPorcentaje(consigna.progreso);
  const estado = consigna.estadoGlobal ?? '';
  const barra = document.getElementById('progresoObjetivosConsigna');
  const valor = document.getElementById('valorProgresoObjetivosConsigna');
  barra.dataset.estado = estado;
  if (progreso === null) {
    barra.removeAttribute('aria-valuenow');
    barra.setAttribute('aria-valuetext', 'Progreso no disponible');
    document.getElementById('rellenoProgresoObjetivosConsigna').style.width = '0%';
    valor.textContent = '—';
  } else {
    barra.setAttribute('aria-valuenow', String(progreso));
    barra.setAttribute('aria-valuetext', `${formatearEstadoConsigna(estado)} · ${progreso}%`);
    document.getElementById('rellenoProgresoObjetivosConsigna').style.width = `${progreso}%`;
    valor.textContent = `${progreso}%`;
  }
  document.getElementById('estadoProgresoObjetivosConsigna').textContent = formatearEstadoConsigna(estado);
  actualizarProgresoCompactoConsigna(progreso, estado);
  seccion.hidden = false;
}

function actualizarProgresoCompactoConsigna(progreso, estado) {
  const compacto = document.getElementById('progresoCompactoConsigna');
  if (progreso === null) {
    compacto.hidden = true;
    return;
  }
  compacto.hidden = false;
  compacto.dataset.estado = estado;
  compacto.setAttribute('aria-label', `Progreso del escenario: ${progreso}%`);
  document.getElementById('valorProgresoCompactoConsigna').textContent = `${progreso}%`;
  document.getElementById('rellenoProgresoCompactoConsigna').style.width = `${progreso}%`;
}

function normalizarPorcentaje(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const porcentaje = Number(valor);
  return Number.isFinite(porcentaje) ? Math.round(Math.min(100, Math.max(0, porcentaje))) : null;
}

function renderizarObjetivosConsigna(condiciones) {
  const seccion = document.getElementById('objetivosConsigna');
  const contenedor = document.getElementById('listaObjetivosConsigna');
  const lista = Array.isArray(condiciones) ? condiciones.filter(Boolean) : [];
  const principales = lista.slice(0, CANTIDAD_ELEMENTOS_VISIBLES_CONSIGNA);
  const adicionales = lista.slice(CANTIDAD_ELEMENTOS_VISIBLES_CONSIGNA);
  contenedor.replaceChildren(...principales.map(crearObjetivoConsigna));
  renderizarObjetivosAdicionales(adicionales);
  seccion.hidden = lista.length === 0;
}

function renderizarObjetivosAdicionales(objetivos) {
  const detalles = document.getElementById('masObjetivosConsigna');
  const contenedor = document.getElementById('listaObjetivosAdicionalesConsigna');
  contenedor.replaceChildren(...objetivos.map(crearObjetivoConsigna));
  detalles.hidden = objetivos.length === 0;
  document.getElementById('tituloMasObjetivosConsigna').textContent = `Ver ${objetivos.length} más`;
}

function crearObjetivoConsigna(condicion) {
  const elemento = document.createElement('li');
  const completado = condicion.completado === true;
  elemento.className = `simulacion-consigna__objetivo-item${completado ? ' es-completado' : ''}`;
  const indicador = document.createElement('span');
  indicador.className = 'simulacion-consigna__indicador-objetivo';
  indicador.textContent = completado ? '✓' : '○';
  indicador.setAttribute('aria-hidden', 'true');
  const contenido = document.createElement('span');
  contenido.className = 'simulacion-consigna__texto-objetivo';
  contenido.textContent = condicion.texto || condicion.clave || 'Objetivo sin descripción';
  const valor = document.createElement('strong');
  valor.className = 'simulacion-consigna__valor-objetivo';
  valor.textContent = formatearAvanceObjetivo(condicion.actual, condicion.requerido);
  valor.setAttribute('aria-label', `Avance ${valor.textContent}`);
  elemento.append(indicador, contenido, valor);
  return elemento;
}

function formatearAvanceObjetivo(actual, requerido) {
  const valorActual = actual !== null && actual !== undefined && actual !== '' && Number.isFinite(Number(actual)) ? String(actual) : '—';
  const valorRequerido = requerido !== null && requerido !== undefined && requerido !== '' && Number.isFinite(Number(requerido)) ? String(requerido) : '—';
  return `${valorActual}/${valorRequerido}`;
}

function renderizarReferenciasConsigna(referencias) {
  const contenedor = document.getElementById('listaReferenciasConsigna');
  const seccion = document.getElementById('referenciasConsigna');
  const lista = Array.isArray(referencias)
    ? referencias.map((referencia, indice) => ({ referencia, indice })).filter(({ referencia }) => Boolean(referencia))
    : [];
  const principales = lista.slice(0, CANTIDAD_ELEMENTOS_VISIBLES_CONSIGNA);
  const adicionales = lista.slice(CANTIDAD_ELEMENTOS_VISIBLES_CONSIGNA);
  contenedor.replaceChildren(...principales.map(({ referencia, indice }) => crearReferenciaConsigna(referencia, indice)));
  renderizarReferenciasAdicionales(adicionales);
  seccion.hidden = lista.length === 0;
}

function renderizarReferenciasAdicionales(referencias) {
  const detalles = document.getElementById('masReferenciasConsigna');
  const contenedor = document.getElementById('listaReferenciasAdicionalesConsigna');
  contenedor.replaceChildren(...referencias.map(({ referencia, indice }) => crearReferenciaConsigna(referencia, indice)));
  detalles.hidden = referencias.length === 0;
  document.getElementById('tituloMasReferenciasConsigna').textContent = `Ver ${referencias.length} más`;
}

function crearReferenciaConsigna(referencia, indice) {
  const elemento = document.createElement('div');
  const cubierta = referencia.cubierto === true;
  elemento.className = `simulacion-consigna__referencia${cubierta ? ' es-cubierta' : ''}`;
  const contenido = document.createElement('div');
  contenido.className = 'simulacion-consigna__contenido-referencia';
  const nombre = document.createElement('span');
  nombre.textContent = obtenerNombreReferencia(referencia);
  const estado = document.createElement('small');
  estado.textContent = cubierta ? 'Cubierto' : 'Pendiente';
  contenido.append(nombre, estado);
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'simulacion-consigna__localizar';
  boton.dataset.indiceReferencia = String(indice);
  const identificador = obtenerIdentificadorReferencia(referencia);
  if (identificador === null) {
    boton.disabled = true;
    boton.textContent = 'Sin ubicación';
    boton.setAttribute('aria-label', `No hay una ubicación disponible para ${nombre.textContent}`);
    boton.title = 'Esta referencia no tiene una ubicación disponible en el mapa.';
  } else {
    boton.textContent = 'Localizar';
    boton.setAttribute('aria-label', `Localizar ${nombre.textContent} en el mapa`);
  }
  elemento.append(contenido, boton);
  return elemento;
}

function localizarReferenciaConsigna(evento) {
  const boton = evento.target.closest('[data-indice-referencia]');
  if (!boton || !disenoActual) return;
  const indice = Number(boton.dataset.indiceReferencia);
  const referencia = consignaActual?.referenciasObjetivo?.[indice];
  const identificador = obtenerIdentificadorReferencia(referencia);
  if (identificador === null) return;
  const localizada = visor?.escena?.localizarReferencia(identificador);
  if (!localizada) {
    mostrarMensaje(`No fue posible localizar ${obtenerNombreReferencia(referencia)} en el mapa.`, 'error');
    return;
  }
  document.getElementById('estadoVistaMapa').textContent = `Montevideo · referencia localizada: ${obtenerNombreReferencia(referencia)}`;
}

function obtenerIdentificadorReferencia(referencia) {
  const identificador = referencia?.idPunto ?? referencia?.puntoId ?? referencia?.id ?? referencia?.nombrePunto ?? referencia?.nombre;
  return identificador === undefined || identificador === null || identificador === '' ? null : identificador;
}

function obtenerNombreReferencia(referencia) {
  return referencia?.nombrePunto ?? referencia?.nombre ?? 'Punto de interés';
}

function formatearEstadoConsigna(estado) {
  return ({
    INICIADO: 'Iniciado',
    PARCIAL: 'En progreso',
    LISTO: 'Listo',
    COMPLETADO: 'Completado',
  })[estado] ?? formatearEstado(estado);
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
  document.getElementById('estadoProgresoEjecucion').textContent = formatearEstadoMotor(estadoEjecucion);
}

async function actualizarDesempeno(idDiseno, actualizarMotor = true) {
  let desempeno = null;
  try { desempeno = await consultarJuego(`/disenos/${idDiseno}/desempeno`); } catch { /* Mantener disponible la simulación habitual. */ }
  if (disenoActual?.simulacion?.idDiseno !== idDiseno) return;
  if (!Number.isFinite(desempeno?.puntajeMaximo)) desempeno = null;
  document.getElementById('puntajeCompactoSimulacion').textContent = desempeno ? `${desempeno.puntaje} / ${desempeno.puntajeMaximo}` : '—';
  disenoActual.metricasUnidades = desempeno?.unidades ?? [];
  if (actualizarMotor) visor?.escena.establecerDiseno(disenoActual);
  renderizarDesempeno(document.getElementById('desempenoNivel'), disenoActual, desempeno, async (unidad, velocidadPromedio) => {
    try {
      await cliente.solicitar(`/${idDiseno}/unidades/${unidad.idTren}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreLinea: unidad.nombreLinea, capacidad: unidad.capacidad, velocidadPromedio }) });
      await cliente.validar(idDiseno);
      await abrirDiseno(idDiseno);
      mostrarMensaje(`Velocidad actualizada a ${velocidadPromedio} km/h. Revisá el tiempo estimado y ejecutá una nueva simulación.`, 'exito');
    } catch (error) { mostrarMensaje(error.message, 'error'); }
  });
}

function renderizarResultados() {
  const contenedor = document.getElementById('listaResultadosSimulacion');
  const resultados = disenoActual.resultados ?? [];
  contenedor.classList.toggle('metronet-vacio', !resultados.length);
  contenedor.replaceChildren(...resultados.map((resultado) => {
    const elemento = document.createElement('article');
    elemento.className = 'simulacion-resultado';
    elemento.innerHTML = `<strong>${escapar(resultado.estado)} · ${resultado.puntaje} puntos</strong><span>${resultado.duracion}s de ventana visual · reproducción ${resultado.velocidad}×</span><p>${escapar(resultado.comentarios)}</p>`;
    return elemento;
  }));
  if (!resultados.length) contenedor.textContent = 'Aún no se registraron ejecuciones para este diseño.';
}

function obtenerEstadoEjecucion() {
  if (estaMantenimientoActivo(sesion)) return 'La red puede consultarse. La ejecución se habilitará al finalizar el mantenimiento.';
  if (!disenoActual) return '';
  if (!disenoActual.preparadoParaSimular) return obtenerMensajePreparacionSimulacion();
  if (disenoActual.simulacion.estado === 'COMPLETADO') return 'Escenario completado. Podés consultar los resultados, repetir la simulación o continuar con los escenarios.';
  return 'La red está lista para simular. La estructura se mantiene bloqueada durante la ejecución.';
}

async function ejecutarSimulacion(evento) {
  evento.preventDefault();
  if (!disenoActual || resultadoEnCurso || estaMantenimientoActivo(sesion)) return;
  if (!disenoActual.preparadoParaSimular) {
    mostrarMensaje(obtenerMensajePreparacionSimulacion(), 'error');
    return;
  }
  const velocidad = Number(document.getElementById('velocidadSimulacion').value);
  const duracion = Number(document.getElementById('duracionSimulacion').value);
  if (!VELOCIDADES_SIMULACION.has(velocidad) || !Number.isInteger(duracion) || duracion < 10) {
    mostrarMensaje('Elegí un ritmo de reproducción disponible (×) y una ventana visual mínima de 10 segundos.', 'error');
    return;
  }
  try {
    const resultado = await cliente.ejecutar(disenoActual.simulacion.idDiseno, { velocidad, duracion });
    await abrirDiseno(disenoActual.simulacion.idDiseno);
    parametrosUltimaEjecucion = { velocidad, duracion };
    ejecucionPendiente = { idDiseno: disenoActual.simulacion.idDiseno, resultado };
    if (estaMantenimientoActivo(sesion)) return;
    const estado = visor.escena.iniciarAnimacion(velocidad, duracion);
    actualizarPanelTiempoReal(estado);
    crearFlujoNavegacion('resultados');
    document.getElementById('continuarEscenarios').hidden = true;
    document.getElementById('verResultadosSimulacion').hidden = true;
    mostrarMensaje('Recorrido iniciado. Observá el metro antes de consultar el resultado.', 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

async function evaluarEscenarioProgresivo(idDiseno) {
  const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego/disenos/${idDiseno}/evaluar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sesion.token}` },
  });
  // Los diseños no progresivos no se evalúan mediante esta ruta.
  if (respuesta.status === 404) return null;
  if (respuesta.ok) return respuesta.json();
  let mensaje = 'La simulación se registró, pero no fue posible evaluar el escenario.';
  try {
    mensaje = (await respuesta.json()).detail ?? mensaje;
  } catch {
    // La respuesta no incluyó un detalle legible.
  }
  throw new Error(mensaje);
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

function reiniciarSimulacion() {
  if (estaMantenimientoActivo(sesion)) return;
  if (!parametrosUltimaEjecucion || !visor || resultadoEnCurso) return;
  const estado = visor.escena.reiniciarAnimacion();
  actualizarPanelTiempoReal(estado);
  document.getElementById('verResultadosSimulacion').hidden = true;
  mostrarMensaje('Simulación reiniciada con los últimos parámetros.');
}

function cambiarVelocidad(evento) {
  const boton = evento.target.closest('[data-velocidad]');
  if (!boton) return;
  const velocidad = Number(boton.dataset.velocidad);
  if (!VELOCIDADES_SIMULACION.has(velocidad)) return;
  document.getElementById('velocidadSimulacion').value = String(velocidad);
  document.querySelectorAll('[data-velocidad]').forEach((control) => {
    control.setAttribute('aria-pressed', String(control === boton));
  });
  if (parametrosUltimaEjecucion) parametrosUltimaEjecucion = { ...parametrosUltimaEjecucion, velocidad };
  const estado = visor?.escena.establecerVelocidadAnimacion(velocidad);
  actualizarPanelTiempoReal(estado);
}

function alternarSeguimientoMetro() {
  const boton = document.getElementById('seguirMetro');
  const activo = visor?.escena.establecerSeguimientoMetro(boton.getAttribute('aria-pressed') !== 'true');
  boton.setAttribute('aria-pressed', String(Boolean(activo)));
  boton.textContent = activo ? 'Seguir metro: activado' : 'Seguir metro: desactivado';
  mostrarMensaje(activo ? 'La cámara acompaña al metro de forma suave.' : 'Seguimiento desactivado. Podés mover el mapa libremente.');
}

function restablecerSeguimientoMetro() {
  const boton = document.getElementById('seguirMetro');
  boton.setAttribute('aria-pressed', 'false');
  boton.textContent = 'Seguir metro: desactivado';
}

function mostrarResultados() {
  organizacion.abrirSeccion('seccionResultados');
}

function detenerAnimacion() {
  const estado = visor?.escena.detenerAnimacion();
  actualizarPanelTiempoReal(estado);
}

function limpiarVisor() {
  panelAyuda?.eliminar();
  visor?.destruir();
  visor = null;
}

function actualizarPanelTiempoReal(estado) {
  if (!estado) return;
  const cambioEstado = estadoMotor?.estado !== estado.estado;
  estadoMotor = estado;
  if (cambioEstado) { errorAyuda = null; actualizarAyuda(); }
  actualizarProgresoEjecucion(estado);
  const campoVelocidades = document.querySelector('[data-controles-circulacion]');
  if (campoVelocidades) campoVelocidades.disabled = estado.estado === 'EN_CURSO' || estado.estado === 'PAUSADA';
  const metro = estado.metroActivo;
  document.getElementById('velocidadActualSimulacion').textContent = metro?.velocidadKmh ? `${metro.velocidadKmh} km/h` : '—';
  document.getElementById('tiempoSimulacion').textContent = formatearTiempo(estado.tiempoTranscurrido);
  document.getElementById('metroSimulacion').textContent = metro?.identificador ? `${metro.identificador} · ${metro.velocidadKmh || '—'} km/h` : 'Sin unidad activa';
  document.getElementById('lineaSimulacion').textContent = metro?.nombreLinea ?? '—';
  document.getElementById('proximaEstacionSimulacion').textContent = metro?.proximaEstacion ?? (metro?.estacionActual ? `Finalizó en ${metro.estacionActual}` : '—');
  document.getElementById('estadoTiempoReal').textContent = formatearEstadoMotor(estado.estado);
  document.getElementById('estadoEjecucion').textContent = obtenerMensajeEstadoMotor(estado);
  document.getElementById('verResultadosSimulacion').hidden = estado.estado !== 'FINALIZADA';
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
  window.addEventListener('pagehide', cancelar);
  window.addEventListener('popstate', cancelar);
  try {
    const idEscenario = disenoActual?.simulacion?.idEscenario;
    const mejorPuntajeAnterior = await consultarMejorPuntajeAnterior(idEscenario);
    if (controlador.signal.aborted || disenoActual?.simulacion?.idDiseno !== pendiente.idDiseno) return;
    const evaluacion = await evaluarEscenarioProgresivo(pendiente.idDiseno);
    const correspondeAlDisenoActual = disenoActual?.simulacion?.idDiseno === pendiente.idDiseno;
    if (!correspondeAlDisenoActual || controlador.signal.aborted) return;
    if (evaluacion?.completado) {
      disenoActual.simulacion.estado = 'COMPLETADO';
      if (evaluacion.desempeno) {
        const resultado = disenoActual.resultados?.find(r => r.idSimulacion === pendiente.resultado.idSimulacion);
        if (resultado) resultado.puntaje = evaluacion.puntaje;
      }
      actualizarPantalla();
    }
    await cargarConsignaReal(pendiente.idDiseno);
    await actualizarDesempeno(pendiente.idDiseno, false);
    // El resultado se muestra sin reiniciar la animación que acaba de finalizar.
    document.getElementById('continuarEscenarios').hidden = false;
    const detalleEvaluacion = evaluacion ? ` ${evaluacion.mensaje}` : '';
    const puntos = evaluacion?.desempeno
      ? (evaluacion.completado ? `${evaluacion.puntaje} / ${evaluacion.desempeno.puntajeMaximo} puntos.` : 'Consigna pendiente; todavía no se registran puntos.')
      : `${pendiente.resultado.puntaje} puntos.`;
    mostrarMensaje(`Recorrido finalizado: ${puntos}${detalleEvaluacion}`, evaluacion && !evaluacion.completado ? 'advertencia' : 'exito');
    if (evaluacion?.completado) {
      // Consultar el progreso persistido también permite retomar desde Escenarios tras una recarga.
      try {
        const base = `${window.location.protocol}//${window.location.hostname}:8080/api/juego`;
        const headers = { Authorization: `Bearer ${sesion.token}` };
        const respuesta = await fetch(`${base}/progreso`, { headers });
        if (!respuesta.ok) return;
        const progreso = await respuesta.json();
        if (controlador.signal.aborted || disenoActual?.simulacion?.idDiseno !== pendiente.idDiseno) return;
        const accion = await presentarResultadoNivel(progreso, idEscenario, evaluacion, { mejorPuntajeAnterior, signal: controlador.signal });
        if (accion?.siguiente) {
          const inicio = await iniciarNivelConTransicion(accion.siguiente, async signal => {
            const operacion = accion.siguiente.estado === 'COMPLETADO' ? 'volver-a-jugar' : 'iniciar';
            const respuestaInicio = await fetch(`${base}/escenarios/${accion.siguiente.idEscenario}/${operacion}`, { method: 'POST', headers, signal });
            if (!respuestaInicio.ok) throw new Error('No fue posible iniciar el siguiente nivel. Continuá desde Escenarios.');
            return respuestaInicio.json();
          }, { preparado: true });
          if (inicio && !controlador.signal.aborted && disenoActual?.simulacion?.idDiseno === pendiente.idDiseno) {
            window.location.assign(establecerContextoEnRuta('/', inicio));
          }
        } else if (accion?.destino) window.location.assign(accion.destino);
      } catch (error) { mostrarMensaje(`Resultado guardado. ${error.message}`, 'advertencia'); }
    }
  } catch (error) {
    if (disenoActual?.simulacion?.idDiseno !== pendiente.idDiseno) return;
    document.getElementById('continuarEscenarios').hidden = false;
    mostrarMensaje(`El recorrido terminó, pero no se pudo evaluar el escenario: ${error.message}`, 'error');
  } finally {
    resultadoEnCurso = false;
    actualizarControlesSimulacion(estadoMotor);
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
  const controlConFoco = document.activeElement;
  const puedeReiniciar = Boolean(parametrosUltimaEjecucion);
  document.getElementById('pausarSimulacion').disabled = !enCurso;
  document.getElementById('pausarSimulacion').hidden = pausada;
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
  boton.disabled = !disenoActual?.preparadoParaSimular || ejecucionActiva || resultadoEnCurso || estaMantenimientoActivo(sesion);
  boton.title = estaMantenimientoActivo(sesion) ? MENSAJE_MANTENIMIENTO : !disenoActual?.preparadoParaSimular
    ? obtenerMensajePreparacionSimulacion()
    : (ejecucionActiva ? 'Detené o reiniciá la simulación actual antes de iniciar otra.' : '');
}

function crearEstadoInicial() {
  return {
    estado: 'DETENIDA',
    tiempoTranscurrido: 0,
    metroActivo: null,
  };
}

function formatearTiempo(segundos) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

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
    : 'Volvé a Edición, validá la red y agregá una unidad de metro antes de iniciar.';
}

function mostrarEstadoVacio() {
  disenoActual = null;
  actualizarAyuda();
  document.getElementById('estadoVacio').hidden = false;
  document.getElementById('panelSimulacion').hidden = true;
  organizacion.mostrarDiseno(null);
}

function actualizarAyuda() {
  const resumen = disenoActual?.simulacion;
  panelAyuda?.actualizar({
    diseno: disenoActual,
    escenario: escenariosGlosario.find(e => e.idEscenario === resumen?.idEscenario),
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

function formatearEstado(estado) {
  return ({ EN_DISENO: 'En diseño', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADA: 'Completada', COMPLETADO: 'Completado' })[estado] ?? estado;
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

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]);
}
