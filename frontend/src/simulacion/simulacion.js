import ClienteDisenos, { obtenerSesionActiva } from '../red/ClienteDisenos.js';
import { establecerIdDisenoEnRuta, obtenerContextoRuta, obtenerIdDisenoDeRuta } from '../red/ContextoDiseno.js';
import { crearVisorSimulacion } from './EscenaSimulacion.js';
import { crearFlujoNavegacion, inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';

const sesion = obtenerSesionActiva();
const idDisenoInicial = obtenerIdDisenoDeRuta();
let cliente = null;
let visor = null;
let disenoActual = null;
let parametrosUltimaEjecucion = null;

if (!sesion) {
  const destino = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login.html?destino=${encodeURIComponent(destino)}`);
} else {
  inicializar();
}

async function inicializar() {
  inicializarNavegacion({ actual: 'simulacion', etapa: 'simulacion' });
  cliente = new ClienteDisenos(sesion);
  document.getElementById('formularioEjecucion').addEventListener('submit', ejecutarSimulacion);
  document.getElementById('listaDisenos').addEventListener('click', seleccionarDiseno);
  document.getElementById('pausarSimulacion').addEventListener('click', pausarSimulacion);
  document.getElementById('reanudarSimulacion').addEventListener('click', reanudarSimulacion);
  document.getElementById('reiniciarSimulacion').addEventListener('click', reiniciarSimulacion);
  window.addEventListener('pagehide', limpiarVisor);
  visor = await crearVisorSimulacion(document.getElementById('visorSimulacion'));
  await cargarDisenos();
  if (idDisenoInicial) await abrirDiseno(idDisenoInicial);
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
  if (boton) await abrirDiseno(Number(boton.dataset.idDiseno));
}

async function abrirDiseno(idDiseno) {
  try {
    detenerAnimacion();
    disenoActual = await cliente.obtener(idDiseno);
    const contexto = obtenerContextoDiseno(idDiseno);
    window.history.replaceState({}, '', establecerIdDisenoEnRuta('/simulacion.html', idDiseno, contexto));
    visor.escena.establecerDiseno(disenoActual);
    actualizarPantalla();
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
  document.querySelector('.simulacion-marca').href = establecerIdDisenoEnRuta('/', resumen.idDiseno, obtenerContextoDiseno(resumen.idDiseno));
  document.getElementById('resumenRed').textContent = `${cantidadEstaciones} estaciones · ${disenoActual.lineas.length} líneas · ${disenoActual.tramos.length} conexiones · ${disenoActual.unidadesMetro.length} unidades de metro.`;
  document.getElementById('instruccionesEscenario').textContent = resumen.instrucciones || resumen.objetivo || 'No hay instrucciones adicionales para este diseño.';
  document.getElementById('estadoVistaMapa').textContent = cantidadEstaciones
    ? `Montevideo · enfoque sobre ${cantidadEstaciones} estaciones de la red`
    : 'Montevideo · el diseño todavía no tiene estaciones';
  document.getElementById('estadoEjecucion').textContent = obtenerEstadoEjecucion();
  actualizarDisponibilidadEjecucion();
  renderizarResultados();
  actualizarControlesAnimacion(false, false);
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
  if (!Number.isFinite(velocidad) || velocidad <= 0 || !Number.isInteger(duracion) || duracion < 10) {
    mostrarMensaje('Ingresá una velocidad positiva y una duración mínima de 10 segundos.', 'error');
    return;
  }
  try {
    const resultado = await cliente.ejecutar(disenoActual.simulacion.idDiseno, { velocidad, duracion });
    const evaluacion = await evaluarEscenarioProgresivo(disenoActual.simulacion.idDiseno);
    parametrosUltimaEjecucion = { velocidad, duracion };
    await abrirDiseno(disenoActual.simulacion.idDiseno);
    visor.escena.iniciarAnimacion(velocidad, duracion);
    actualizarControlesAnimacion(true, false);
    crearFlujoNavegacion('resultados');
    document.getElementById('continuarEscenarios').hidden = false;
    const detalleEvaluacion = evaluacion ? ` ${evaluacion.mensaje}` : '';
    mostrarMensaje(`Simulación registrada: ${resultado.puntaje} puntos.${detalleEvaluacion}`, 'exito');
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
  visor?.escena.pausarAnimacion();
  actualizarControlesAnimacion(true, true);
  mostrarMensaje('Animación pausada. El resultado permanece guardado.');
}

function reanudarSimulacion() {
  visor?.escena.reanudarAnimacion();
  actualizarControlesAnimacion(true, false);
  mostrarMensaje('Animación reanudada.');
}

function reiniciarSimulacion() {
  if (!parametrosUltimaEjecucion || !visor) return;
  visor.escena.iniciarAnimacion(parametrosUltimaEjecucion.velocidad, parametrosUltimaEjecucion.duracion);
  actualizarControlesAnimacion(true, false);
  mostrarMensaje('Vista reiniciada con los últimos parámetros.');
}

function detenerAnimacion() {
  visor?.escena.detenerAnimacion();
  actualizarControlesAnimacion(false, false);
}

function limpiarVisor() {
  visor?.destruir();
  visor = null;
}

function actualizarControlesAnimacion(activa, pausada) {
  document.getElementById('pausarSimulacion').disabled = !activa || pausada;
  document.getElementById('reanudarSimulacion').disabled = !activa || !pausada;
  document.getElementById('reiniciarSimulacion').disabled = !parametrosUltimaEjecucion;
}

function actualizarDisponibilidadEjecucion() {
  const boton = document.querySelector('#formularioEjecucion button[type="submit"]');
  if (!boton) return;
  boton.disabled = !disenoActual?.preparadoParaSimular;
  boton.title = boton.disabled ? obtenerMensajePreparacionSimulacion() : '';
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
