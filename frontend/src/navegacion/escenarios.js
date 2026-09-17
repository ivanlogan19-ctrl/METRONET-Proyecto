import { requerirSesion } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta } from '../red/ContextoDiseno.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';

const sesion = requerirSesion('/escenarios.html');

if (sesion) inicializar();

async function inicializar() {
  inicializarNavegacion({ actual: 'escenarios', etapa: 'escenario' });
  try {
    const escenarios = await solicitar('/escenarios');
    renderizarEscenarios(escenarios);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${sesion.token}`, ...(opciones.headers ?? {}) },
  });
  if (respuesta.ok) return respuesta.json();
  let mensaje = 'No fue posible consultar los escenarios.';
  try { mensaje = (await respuesta.json()).detail ?? mensaje; } catch { /* La respuesta no incluye detalle. */ }
  throw new Error(mensaje);
}

function renderizarEscenarios(escenarios) {
  const lista = document.getElementById('listaEscenarios');
  lista.replaceChildren(...escenarios.map((escenario) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = `metronet-escenarios-pagina__tarjeta${escenario.desbloqueado ? '' : ' bloqueada'}`;
    const nivel = escenario.numero === null ? 'Modo libre' : `Escenario ${escenario.numero}`;
    tarjeta.innerHTML = `<p>${nivel}</p><h2>${escapar(escenario.nombre)}</h2><span>${escapar(escenario.objetivo)}</span><small>${escapar(escenario.instrucciones)}</small><b>${escenario.desbloqueado ? `${formatearEstado(escenario.estado)} · ${escenario.progreso}%` : 'Bloqueado'}</b>`;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.disabled = !escenario.desbloqueado;
    boton.textContent = escenario.desbloqueado ? (escenario.estado === 'COMPLETADO' ? 'Ver escenario' : 'Abrir escenario') : 'Bloqueado';
    boton.addEventListener('click', () => iniciarEscenario(escenario.idEscenario));
    tarjeta.append(boton);
    return tarjeta;
  }));
}

async function iniciarEscenario(idEscenario) {
  mostrarMensaje('Preparando el escenario…');
  try {
    const inicio = await solicitar(`/escenarios/${idEscenario}/iniciar`, { method: 'POST' });
    window.location.assign(establecerContextoEnRuta('/', inicio));
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

function mostrarMensaje(texto, tipo = '') {
  const mensaje = document.getElementById('mensajeEscenarios');
  mensaje.textContent = texto;
  mensaje.className = `metronet-inicio__mensaje ${tipo}`;
}

function formatearEstado(estado) {
  return ({ EN_DESARROLLO: 'En progreso', COMPLETADO: 'Completado', BLOQUEADO: 'Bloqueado' })[estado] ?? estado;
}

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]);
}
