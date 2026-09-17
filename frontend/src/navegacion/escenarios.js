import { requerirSesion } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta } from '../red/ContextoDiseno.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';

const ESTADOS_EN_CURSO = new Set(['EN_DESARROLLO', 'EN_DISENO', 'GUARDADO', 'VALIDADO', 'COMPLETADA']);
const sesion = requerirSesion('/escenarios.html');
let progresoActual = null;
let accionEnCurso = false;

if (sesion) inicializar();

async function inicializar() {
  inicializarNavegacion({ actual: 'escenarios', etapa: 'escenario' });
  configurarDialogoReinicio();
  await cargarProgreso();
}

async function cargarProgreso() {
  establecerEstadoCarga(true);
  try {
    progresoActual = await solicitar('/progreso');
    renderizarPantalla(progresoActual);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
    renderizarPantalla(progresoVacio());
    renderizarEstadoVacio('No fue posible cargar los escenarios. Volvé a intentarlo en unos instantes.');
  } finally {
    establecerEstadoCarga(false);
  }
}

async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${sesion.token}`, ...(opciones.headers ?? {}) },
  });
  if (respuesta.ok) return respuesta.json();
  let mensaje = 'No fue posible actualizar el recorrido.';
  try { mensaje = (await respuesta.json()).detail ?? mensaje; } catch { /* La respuesta no incluye detalle. */ }
  throw new Error(mensaje);
}

function progresoVacio() {
  return {
    escenarios: [],
    numeroCampanaActual: 1,
    cantidadNiveles: 0,
    nivelesCompletados: 0,
    campanaCompletada: false,
    campanaCompletadaHistoricamente: false,
    modoLibreDesbloqueado: false,
  };
}

function renderizarPantalla(progreso) {
  renderizarProgreso(progreso);
  renderizarLogros(progreso);
  renderizarEscenarios(progreso.escenarios ?? []);
}

function renderizarProgreso(progreso) {
  const niveles = obtenerNiveles(progreso.escenarios);
  const descripcion = document.getElementById('descripcionProgresoEscenarios');
  descripcion.textContent = niveles.length
    ? `${progreso.nivelesCompletados} de ${progreso.cantidadNiveles} niveles completados en la campaña actual.`
    : 'Todavía no hay niveles configurados.';
  const lista = document.getElementById('progresoEscenarios');
  const pasoActual = niveles.find((escenario) => obtenerEstadoVisual(escenario).id === 'actual')?.idEscenario
    ?? niveles.find((escenario) => obtenerEstadoVisual(escenario).id === 'disponible')?.idEscenario;
  lista.replaceChildren(...niveles.map((escenario) => {
    const estado = obtenerEstadoVisual(escenario);
    const paso = document.createElement('li');
    paso.className = `metronet-escenarios-pagina__paso-progreso metronet-escenarios-pagina__paso-progreso--${estado.id}`;
    if (escenario.idEscenario === pasoActual) paso.setAttribute('aria-current', 'step');
    const numero = document.createElement('span');
    numero.setAttribute('aria-hidden', 'true');
    numero.textContent = escenario.numero;
    const etiqueta = document.createElement('span');
    etiqueta.textContent = `Nivel ${escenario.numero}`;
    paso.append(numero, etiqueta);
    return paso;
  }));
}

function renderizarLogros(progreso) {
  const lista = document.getElementById('listaLogrosEscenarios');
  const logros = [];
  logros.push(crearLogro(
    'Modo Libre',
    progreso.modoLibreDesbloqueado ? 'Desbloqueado' : 'Bloqueado',
    progreso.modoLibreDesbloqueado
      ? 'Podés crear y simular redes sin consigna obligatoria.'
      : 'Completá los cuatro niveles de una campaña para habilitarlo.',
    progreso.modoLibreDesbloqueado
  ));
  if (progreso.campanaCompletadaHistoricamente) {
    logros.push(crearLogro('Campaña completada anteriormente', 'Registrado', 'Este logro se conserva aunque reinicies el recorrido.', true));
  }
  lista.replaceChildren(...logros);
  const boton = document.getElementById('botonReiniciarRecorrido');
  const hayProgresoActual = (progreso.nivelesCompletados ?? 0) > 0
    || (progreso.escenarios ?? []).some((escenario) => ESTADOS_EN_CURSO.has(escenario.estado));
  boton.hidden = !hayProgresoActual;
  boton.disabled = !hayProgresoActual;
}

function crearLogro(titulo, estado, detalle, positivo = false) {
  const elemento = document.createElement('li');
  elemento.className = `metronet-escenarios-pagina__logro${positivo ? ' metronet-escenarios-pagina__logro--positivo' : ''}`;
  const contenido = document.createElement('div');
  const nombre = document.createElement('strong');
  nombre.textContent = titulo;
  const descripcion = document.createElement('span');
  descripcion.textContent = detalle;
  contenido.append(nombre, descripcion);
  const etiqueta = document.createElement('span');
  etiqueta.className = 'metronet-escenarios-pagina__logro-estado';
  etiqueta.textContent = estado;
  elemento.append(contenido, etiqueta);
  return elemento;
}

function renderizarEscenarios(escenarios) {
  const lista = document.getElementById('listaEscenarios');
  if (!escenarios.length) return renderizarEstadoVacio('Todavía no hay escenarios configurados para este recorrido.');
  lista.replaceChildren(...escenarios.map(crearTarjetaEscenario));
}

function crearTarjetaEscenario(escenario) {
  const tarjeta = document.createElement('article');
  const estado = obtenerEstadoVisual(escenario);
  tarjeta.className = `metronet-escenarios-pagina__tarjeta metronet-escenarios-pagina__tarjeta--${estado.id}${escenario.desbloqueado ? '' : ' bloqueada'}`;
  const encabezado = document.createElement('header');
  encabezado.className = 'metronet-escenarios-pagina__tarjeta-cabecera';
  const identificador = document.createElement('p');
  identificador.textContent = escenario.numero === null ? 'Modo Libre' : `Escenario ${escenario.numero}`;
  const etiquetaEstado = document.createElement('span');
  etiquetaEstado.className = `metronet-escenarios-pagina__estado metronet-escenarios-pagina__estado--${estado.id}`;
  etiquetaEstado.textContent = estado.texto;
  encabezado.append(identificador, etiquetaEstado);
  const titulo = document.createElement('h2');
  titulo.textContent = escenario.nombre;
  const contenido = document.createElement('div');
  contenido.className = 'metronet-escenarios-pagina__tarjeta-contenido';
  const objetivo = document.createElement('p');
  objetivo.className = 'metronet-escenarios-pagina__objetivo';
  const etiquetaObjetivo = document.createElement('strong');
  etiquetaObjetivo.textContent = 'Objetivo';
  objetivo.append(etiquetaObjetivo, document.createTextNode(`: ${escenario.objetivo ?? 'Sin objetivo definido.'}`));
  const instrucciones = document.createElement('p');
  instrucciones.className = 'metronet-escenarios-pagina__instrucciones';
  instrucciones.textContent = escenario.instrucciones ?? 'Sin instrucciones disponibles.';
  contenido.append(objetivo, instrucciones, crearProgresoTarjeta(escenario, estado));
  const estadisticas = crearEstadisticas(escenario);
  if (estadisticas) contenido.append(estadisticas);
  const acciones = document.createElement('footer');
  acciones.className = 'metronet-escenarios-pagina__acciones';
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.disabled = !escenario.desbloqueado || accionEnCurso;
  boton.textContent = estado.accion;
  if (estado.id !== 'bloqueado') {
    boton.addEventListener('click', () => iniciarEscenario(escenario.idEscenario, boton, estado.id === 'completado'));
  }
  acciones.append(boton);
  tarjeta.append(encabezado, titulo, contenido, acciones);
  return tarjeta;
}

function obtenerEstadoVisual(escenario) {
  if (!escenario.desbloqueado || escenario.estado === 'BLOQUEADO') return { id: 'bloqueado', texto: 'Bloqueado', accion: 'Bloqueado' };
  if (ESTADOS_EN_CURSO.has(escenario.estado)) return { id: 'actual', texto: 'En curso', accion: 'Continuar' };
  if (escenario.estado === 'COMPLETADO') return { id: 'completado', texto: 'Completado', accion: 'Volver a jugar' };
  return {
    id: 'disponible',
    texto: escenario.numero === null ? 'Desbloqueado' : 'Disponible',
    accion: escenario.numero === null ? 'Entrar al Modo Libre' : 'Comenzar',
  };
}

function crearProgresoTarjeta(escenario, estado) {
  const contenedor = document.createElement('div');
  contenedor.className = 'metronet-escenarios-pagina__progreso-tarjeta';
  if (estado.id === 'bloqueado') {
    contenedor.textContent = 'Completá los niveles anteriores para desbloquear este desafío.';
    return contenedor;
  }
  if (escenario.numero === null) {
    contenedor.textContent = 'Todas las herramientas están disponibles en este modo.';
    return contenedor;
  }
  const etiqueta = document.createElement('span');
  etiqueta.textContent = `Progreso actual ${escenario.progreso ?? 0}%`;
  const barra = document.createElement('div');
  barra.className = 'metronet-escenarios-pagina__barra-progreso';
  barra.setAttribute('role', 'progressbar');
  barra.setAttribute('aria-label', `Progreso de ${escenario.nombre}`);
  barra.setAttribute('aria-valuemin', '0');
  barra.setAttribute('aria-valuemax', '100');
  barra.setAttribute('aria-valuenow', String(escenario.progreso ?? 0));
  const relleno = document.createElement('span');
  relleno.style.setProperty('--progreso-escenario', `${Math.max(0, Math.min(100, Number(escenario.progreso) || 0))}%`);
  barra.append(relleno);
  contenedor.append(etiqueta, barra);
  return contenedor;
}

function crearEstadisticas(escenario) {
  if (!escenario.cantidadIntentos) return null;
  const estadisticas = document.createElement('p');
  estadisticas.className = 'metronet-escenarios-pagina__estadisticas';
  const datos = [`Intentos: ${escenario.cantidadIntentos}`];
  if (escenario.mejorPuntaje !== null && escenario.mejorPuntaje !== undefined) datos.push(`Mejor puntaje: ${escenario.mejorPuntaje}`);
  if (escenario.ultimoPuntaje !== null && escenario.ultimoPuntaje !== undefined) datos.push(`Último puntaje: ${escenario.ultimoPuntaje}`);
  estadisticas.textContent = datos.join(' · ');
  return estadisticas;
}

async function iniciarEscenario(idEscenario, boton, volverAJugar) {
  if (accionEnCurso) return;
  accionEnCurso = true;
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Preparando…';
  mostrarMensaje(volverAJugar ? 'Creando un nuevo intento…' : 'Preparando el escenario…');
  try {
    const ruta = volverAJugar ? `/escenarios/${idEscenario}/volver-a-jugar` : `/escenarios/${idEscenario}/iniciar`;
    const inicio = await solicitar(ruta, { method: 'POST' });
    window.location.assign(establecerContextoEnRuta('/', inicio));
  } catch (error) {
    accionEnCurso = false;
    boton.disabled = false;
    boton.textContent = textoOriginal;
    mostrarMensaje(error.message, 'error');
  }
}

function configurarDialogoReinicio() {
  const dialogo = document.getElementById('dialogoReiniciarRecorrido');
  const abrir = document.getElementById('botonReiniciarRecorrido');
  const cancelar = dialogo.querySelector('[data-cancelar-reinicio]');
  const confirmar = dialogo.querySelector('[data-confirmar-reinicio]');
  abrir.addEventListener('click', () => dialogo.showModal());
  cancelar.addEventListener('click', () => dialogo.close());
  confirmar.addEventListener('click', async () => {
    if (accionEnCurso || !progresoActual) return;
    accionEnCurso = true;
    confirmar.disabled = true;
    confirmar.textContent = 'Reiniciando…';
    try {
      progresoActual = await solicitar('/recorrido/reiniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroCampanaActual: progresoActual.numeroCampanaActual }),
      });
      dialogo.close();
      renderizarPantalla(progresoActual);
      mostrarMensaje('El recorrido se reinició. Tus intentos, diseños y simulaciones anteriores se conservaron.');
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    } finally {
      accionEnCurso = false;
      confirmar.disabled = false;
      confirmar.textContent = 'Reiniciar recorrido';
    }
  });
}

function obtenerNiveles(escenarios) {
  return [...escenarios]
    .filter((escenario) => escenario.numero !== null)
    .sort((primero, segundo) => primero.numero - segundo.numero);
}

function mostrarMensaje(texto, tipo = '') {
  const mensaje = document.getElementById('mensajeEscenarios');
  mensaje.textContent = texto;
  mensaje.className = `metronet-inicio__mensaje ${tipo}`;
}

function renderizarEstadoVacio(texto) {
  const lista = document.getElementById('listaEscenarios');
  const vacio = document.createElement('section');
  vacio.className = 'metronet-escenarios-pagina__vacio';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Escenarios no disponibles';
  const detalle = document.createElement('p');
  detalle.textContent = texto;
  vacio.append(titulo, detalle);
  lista.replaceChildren(vacio);
}

function establecerEstadoCarga(estaCargando) {
  const estadoCarga = document.getElementById('estadoCargaEscenarios');
  const lista = document.getElementById('listaEscenarios');
  estadoCarga.hidden = !estaCargando;
  lista.setAttribute('aria-busy', String(estaCargando));
}
