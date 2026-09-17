import ClienteDisenos, { obtenerSesionActiva } from '../red/ClienteDisenos.js';
import { establecerIdDisenoEnRuta, obtenerContextoRuta, obtenerIdDisenoDeRuta } from '../red/ContextoDiseno.js';
import { crearVisorSimulacion } from './EscenaSimulacion.js';
import { crearFlujoNavegacion, inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { obtenerConfiguracionAplicacion } from '../configuracion/ConfiguracionAplicacion.js';

const sesion = obtenerSesionActiva();
const idDisenoInicial = obtenerIdDisenoDeRuta();
let cliente = null;
let visor = null;
let disenoActual = null;
let parametrosUltimaEjecucion = null;
let estadoMotor = null;
let ejecucionPendiente = null;
let consignaActual = null;
let idDisenoConsigna = null;
let mensajeConsigna = '';
let numeroSolicitudConsigna = 0;
const VELOCIDADES_SIMULACION = new Set([0.5, 1, 2, 4]);
const CANTIDAD_ELEMENTOS_VISIBLES_CONSIGNA = 3;

if (!sesion) {
  const destino = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login.html?destino=${encodeURIComponent(destino)}`);
} else {
  inicializar();
}

async function inicializar() {
  inicializarNavegacion({ actual: 'simulacion', etapa: 'simulacion' });
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
    await cargarConsignaReal(idDiseno);
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
  document.getElementById('tituloSimulacion').textContent = resumen.nombre;
  document.getElementById('nombreDisenoLateral').textContent = resumen.nombre;
  document.getElementById('estadoSimulacion').textContent = formatearEstado(resumen.estado);
  document.getElementById('estadoDisenoLateral').textContent = `${formatearEstado(resumen.estado)} · ${resumen.dificultad}`;
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
  const informacionAdicional = document.getElementById('informacionAdicionalConsigna');
  document.getElementById('descripcionConsigna').textContent = resumen.instrucciones || '';
  informacionAdicional.hidden = !resumen.instrucciones;
  actualizarEstadoObjetivosConsigna(consignaDisponible ? '' : mensajeConsigna);
  renderizarProgresoObjetivosConsigna(consignaDisponible ? consignaActual : null);
  renderizarObjetivosConsigna(consignaDisponible ? consignaActual.condiciones : []);
  renderizarReferenciasConsigna(consignaDisponible ? consignaActual.referenciasObjetivo : []);
  actualizarProgresoEjecucion(estadoMotor ?? crearEstadoInicial());
}

function obtenerContextoConsigna(resumen) {
  const modo = resumen.modo === 'EDICION_LIBRE' ? 'Modo libre' : 'Escenario';
  return [modo, resumen.dificultad].filter(Boolean).join(' · ');
}

async function cargarConsignaReal(idDiseno) {
  const solicitud = ++numeroSolicitudConsigna;
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

function renderizarResultados() {
  const contenedor = document.getElementById('listaResultadosSimulacion');
  const resultados = disenoActual.resultados ?? [];
  contenedor.replaceChildren(...resultados.map((resultado) => {
    const elemento = document.createElement('article');
    elemento.className = 'simulacion-resultado';
    elemento.innerHTML = `<strong>${escapar(resultado.estado)} · ${resultado.puntaje} puntos</strong><span>${resultado.duracion}s · velocidad ${resultado.velocidad}</span><p>${escapar(resultado.comentarios)}</p>`;
    return elemento;
  }));
  if (!resultados.length) contenedor.textContent = 'Aún no se registraron ejecuciones para este diseño.';
}

function obtenerEstadoEjecucion() {
  if (!disenoActual) return '';
  if (!disenoActual.preparadoParaSimular) return obtenerMensajePreparacionSimulacion();
  if (disenoActual.simulacion.estado === 'COMPLETADO') return 'Escenario completado. Podés consultar los resultados, repetir la simulación o continuar con los escenarios.';
  return 'La red está lista para simular. La estructura se mantiene bloqueada durante la ejecución.';
}

async function ejecutarSimulacion(evento) {
  evento.preventDefault();
  if (!disenoActual) return;
  if (!disenoActual.preparadoParaSimular) {
    mostrarMensaje(obtenerMensajePreparacionSimulacion(), 'error');
    return;
  }
  const velocidad = Number(document.getElementById('velocidadSimulacion').value);
  const duracion = Number(document.getElementById('duracionSimulacion').value);
  if (!VELOCIDADES_SIMULACION.has(velocidad) || !Number.isInteger(duracion) || duracion < 10) {
    mostrarMensaje('Elegí una velocidad disponible y una duración mínima de 10 segundos.', 'error');
    return;
  }
  try {
    const resultado = await cliente.ejecutar(disenoActual.simulacion.idDiseno, { velocidad, duracion });
    await abrirDiseno(disenoActual.simulacion.idDiseno);
    parametrosUltimaEjecucion = { velocidad, duracion };
    ejecucionPendiente = { idDiseno: disenoActual.simulacion.idDiseno, resultado };
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
  if (!parametrosUltimaEjecucion || !visor) return;
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
  document.getElementById('tituloResultadosSimulacion').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function detenerAnimacion() {
  const estado = visor?.escena.detenerAnimacion();
  actualizarPanelTiempoReal(estado);
}

function limpiarVisor() {
  visor?.destruir();
  visor = null;
}

function actualizarPanelTiempoReal(estado) {
  if (!estado) return;
  estadoMotor = estado;
  actualizarProgresoEjecucion(estado);
  const metro = estado.metroActivo;
  document.getElementById('tiempoSimulacion').textContent = formatearTiempo(estado.tiempoTranscurrido);
  document.getElementById('metroSimulacion').textContent = metro?.identificador ?? 'Sin unidad activa';
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
  try {
    const evaluacion = await evaluarEscenarioProgresivo(pendiente.idDiseno);
    const correspondeAlDisenoActual = disenoActual?.simulacion?.idDiseno === pendiente.idDiseno;
    if (!correspondeAlDisenoActual) return;
    if (evaluacion?.completado) {
      disenoActual.simulacion.estado = 'COMPLETADO';
      actualizarPantalla();
    }
    await cargarConsignaReal(pendiente.idDiseno);
    document.getElementById('continuarEscenarios').hidden = false;
    const detalleEvaluacion = evaluacion ? ` ${evaluacion.mensaje}` : '';
    mostrarMensaje(`Recorrido finalizado: ${pendiente.resultado.puntaje} puntos.${detalleEvaluacion}`, 'exito');
  } catch (error) {
    if (disenoActual?.simulacion?.idDiseno !== pendiente.idDiseno) return;
    document.getElementById('continuarEscenarios').hidden = false;
    mostrarMensaje(`El recorrido terminó, pero no se pudo evaluar el escenario: ${error.message}`, 'error');
  }
}

function actualizarControlesSimulacion(estado) {
  const estadoActual = estado?.estado;
  const enCurso = estadoActual === 'EN_CURSO';
  const pausada = estadoActual === 'PAUSADA';
  const puedeReiniciar = Boolean(parametrosUltimaEjecucion);
  document.getElementById('pausarSimulacion').disabled = !enCurso;
  document.getElementById('reanudarSimulacion').disabled = !pausada;
  document.getElementById('detenerSimulacion').disabled = !enCurso && !pausada;
  document.getElementById('reiniciarSimulacion').disabled = !puedeReiniciar;
  document.getElementById('seguirMetro').disabled = !estado?.metroActivo?.transitable;
  actualizarDisponibilidadEjecucion();
}

function actualizarDisponibilidadEjecucion() {
  const boton = document.querySelector('#formularioEjecucion button[type="submit"]');
  if (!boton) return;
  const ejecucionActiva = estadoMotor?.estado === 'EN_CURSO' || estadoMotor?.estado === 'PAUSADA';
  boton.disabled = !disenoActual?.preparadoParaSimular || ejecucionActiva;
  boton.title = !disenoActual?.preparadoParaSimular
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
  document.getElementById('estadoVacio').hidden = false;
  document.getElementById('panelSimulacion').hidden = true;
}

function mostrarMensaje(texto, tipo = '') {
  const mensaje = document.getElementById('mensajeSimulacion');
  mensaje.textContent = texto;
  mensaje.className = `simulacion-mensaje ${tipo}`;
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
