import { inicializarAvisoMantenimiento } from '../configuracion/AvisoMantenimiento.js';
import { comprobarAccesoJugador } from '../configuracion/ControlAccesoMantenimiento.js';
import { inicializarAyudasSistema } from '../componentes/AyudasSistema.js';
import { eliminarSesiones, obtenerSesionActiva } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta, obtenerContextoRuta } from '../red/ContextoDiseno.js';
import { gestorMusica } from '../audio/GestorMusica.js';
import { crearControlMusica } from '../audio/ControlMusica.js';

await comprobarAccesoJugador();

const ETAPAS_FLUJO = [
  { id: 'escenario', texto: 'Nivel' },
  { id: 'edicion', texto: 'Edición' },
  { id: 'simulacion', texto: 'Simulación' },
  { id: 'resultados', texto: 'Resultados' },
];

let controlCambios = null;
let confirmarSalida = null;
let versionNavegacion = 0;
let guardadoSalida = null;
window.addEventListener('pagehide', () => { versionNavegacion++; });
let limpiarEventosUsuario = null;
let limpiarMantenimiento = null;
let controlMusica = null;
let limpiarProteccionSesion = null;

function protegerVistaDeSesion(sesion) {
  let invalidada = false;
  const comprobar = () => {
    if (invalidada || obtenerSesionActiva()?.token === sesion.token) return;
    invalidada = true;
    versionNavegacion++;
    controlCambios = null;
    window.removeEventListener('beforeunload', registrarAdvertenciaNativa);
    // No conservar información de la cuenta anterior al volver desde BFCache
    // o al cerrar/cambiar la sesión en otra pestaña.
    document.body.hidden = true;
    window.location.replace(obtenerSesionActiva() ? '/inicio.html' : '/login.html');
  };
  window.addEventListener('pageshow', comprobar);
  window.addEventListener('storage', comprobar);
  return () => {
    window.removeEventListener('pageshow', comprobar);
    window.removeEventListener('storage', comprobar);
  };
}

function obtenerNombreUsuario(sesion) {
  const usuario = sesion?.usuario ?? {};
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.identificadorAdministrador || 'Usuario';
}

function esNavegacionModificada(evento) {
  return evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey;
}

function crearEnlace(texto, ruta, activo) {
  const enlace = document.createElement('a');
  enlace.className = `metronet-navegacion__enlace${activo ? ' activo' : ''}`;
  enlace.href = ruta;
  enlace.textContent = texto;
  enlace.dataset.navegacion = 'true';
  return enlace;
}

function crearDialogoCambios() {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-cambios';
  dialogo.dataset.dialogoCambios = 'true';
  dialogo.innerHTML = `
    <form method="dialog" class="metronet-dialogo-cambios__contenido">
      <h2>Revisión pendiente</h2>
      <p>Las operaciones confirmadas ya están almacenadas. Podés guardar y revisar la red antes de salir.</p>
      <div class="metronet-dialogo-cambios__acciones">
        <button value="cancelar" type="submit">Cancelar</button>
        <button value="salir" type="submit" data-accion-salir>Continuar sin revisar</button>
        <button value="guardar" type="submit" data-accion-guardar>Guardar y continuar</button>
      </div>
    </form>`;
  document.body.append(dialogo);
  return dialogo;
}

function solicitarConfirmacionCambios() {
  if (confirmarSalida) return confirmarSalida;
  confirmarSalida = new Promise((resolver) => {
    const dialogo = document.querySelector('[data-dialogo-cambios]') ?? crearDialogoCambios();
    dialogo.addEventListener('close', () => resolver(dialogo.returnValue), { once: true });
    dialogo.returnValue = 'cancelar';
    dialogo.showModal();
  }).finally(() => { confirmarSalida = null; });
  return confirmarSalida;
}

function registrarAdvertenciaNativa(evento) {
  if (!controlCambios?.hayCambios()) return;
  evento.preventDefault();
  evento.returnValue = '';
}

export function registrarControlCambios({ hayCambios, guardar }) {
  controlCambios = { hayCambios, guardar };
  window.removeEventListener('beforeunload', registrarAdvertenciaNativa);
  window.addEventListener('beforeunload', registrarAdvertenciaNativa);
  return () => {
    if (controlCambios?.hayCambios === hayCambios) controlCambios = null;
    window.removeEventListener('beforeunload', registrarAdvertenciaNativa);
  };
}

export async function navegarConCambiosPendientes(ruta) {
  // El enlace de la pantalla actual no descarta estado ni reinicia el documento.
  if (new URL(ruta, location.href).href === location.href) return;
  const version = ++versionNavegacion;
  if (!controlCambios?.hayCambios()) return window.location.assign(ruta);
  const accion = await solicitarConfirmacionCambios();
  if (version !== versionNavegacion) return;
  if (accion === 'salir') return window.location.assign(ruta);
  if (accion !== 'guardar') return;
  try {
    guardadoSalida ??= Promise.resolve().then(() => controlCambios.guardar()).finally(() => { guardadoSalida = null; });
    const guardado = await guardadoSalida;
    if (version === versionNavegacion && guardado !== false && !controlCambios?.hayCambios()) window.location.assign(ruta);
  } catch {
    // El editor ya informa el error de guardado y conserva la pantalla actual.
  }
}

async function cerrarSesion(sesion) {
  const ruta = sesion.usuario?.rol === 'ADMIN' ? '/logout/admin' : '/logout';
  try {
    await fetch(`${window.location.protocol}//${window.location.hostname}:8080/auth${ruta}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sesion.token}` },
    });
  } finally {
    eliminarSesiones();
    window.location.replace('/login.html');
  }
}

export function inicializarNavegacion({ actual, etapa } = {}) {
  inicializarAyudasSistema();
  const marcador = document.querySelector('[data-navegacion-global]');
  const sesion = obtenerSesionActiva();
  limpiarProteccionSesion?.();
  limpiarProteccionSesion = sesion ? protegerVistaDeSesion(sesion) : null;
  limpiarMantenimiento?.();
  limpiarMantenimiento = null;
  limpiarEventosUsuario?.();
  limpiarEventosUsuario = null;
  controlMusica?.eliminar();
  controlMusica = null;
  if (!marcador || !sesion) return null;
  // El editor/simulador decide la música al terminar de cargar la lista o la red.
  const esPantallaDeJuego = actual === 'edicion' || actual === 'simulacion';
  gestorMusica.establecerContexto(esPantallaDeJuego ? 'general' : actual === 'administracion' ? 'admin' : actual === 'aprendizaje' ? 'educativo' : 'menu');
  const contexto = obtenerContextoRuta();
  const cabecera = document.createElement('header');
  cabecera.className = 'metronet-navegacion';
  const enlaces = document.createElement('nav');
  enlaces.className = 'metronet-navegacion__enlaces';
  enlaces.setAttribute('aria-label', 'Navegación principal');
  enlaces.append(
    crearEnlace('Inicio', '/inicio.html', actual === 'inicio'),
    crearEnlace('Niveles', '/escenarios.html', actual === 'escenarios'),
    crearEnlace('Aprendizaje', '/aprendizaje.html', actual === 'aprendizaje'),
    crearEnlace('Reglas', '/reglas.html', actual === 'reglas'),
    crearEnlace('Ranking', '/ranking.html', actual === 'ranking'),
    crearEnlace('Mis diseños', establecerContextoEnRuta('/disenos.html', contexto), ['disenos', 'edicion', 'simulacion'].includes(actual)),
  );
  if (sesion.usuario?.rol === 'ADMIN') enlaces.append(crearEnlace('Administración', '/admin.html', actual === 'administracion'));
  const usuario = document.createElement('details');
  usuario.className = 'metronet-navegacion__usuario';
  const resumenUsuario = document.createElement('summary');
  resumenUsuario.textContent = obtenerNombreUsuario(sesion);
  usuario.append(resumenUsuario);
  const menuUsuario = document.createElement('div');
  menuUsuario.className = 'metronet-navegacion__menu-usuario';
  menuUsuario.append(
    crearEnlace('Inicio', '/inicio.html', actual === 'inicio'),
    crearEnlace('Niveles', '/escenarios.html', actual === 'escenarios'),
    crearEnlace('Aprendizaje', '/aprendizaje.html', actual === 'aprendizaje'),
    crearEnlace('Reglas', '/reglas.html', actual === 'reglas'),
    crearEnlace('Ranking', '/ranking.html', actual === 'ranking'),
    crearEnlace('Mis diseños', establecerContextoEnRuta('/disenos.html', contexto), ['disenos', 'edicion', 'simulacion'].includes(actual)),
  );
  if (sesion.usuario?.rol === 'ADMIN') menuUsuario.append(crearEnlace('Administración', '/admin.html', actual === 'administracion'));
  const enlacePerfil = crearEnlace('Mi perfil', '/perfil.html', actual === 'perfil');
  enlacePerfil.classList.add('metronet-navegacion__enlace-perfil');
  menuUsuario.append(enlacePerfil);
  const botonCerrar = document.createElement('button');
  botonCerrar.type = 'button';
  botonCerrar.textContent = 'Cerrar sesión';
  botonCerrar.className = 'metronet-boton--peligro';
  botonCerrar.addEventListener('click', () => cerrarSesion(sesion));
  menuUsuario.append(botonCerrar);
  usuario.append(menuUsuario);
  const cerrarMenuAlHacerClicFuera = (evento) => {
    if (!usuario.contains(evento.target)) usuario.removeAttribute('open');
  };
  const cerrarMenuConEscape = (evento) => {
    if (evento.key !== 'Escape' || !usuario.open) return;
    usuario.removeAttribute('open');
    resumenUsuario.focus();
  };
  document.addEventListener('click', cerrarMenuAlHacerClicFuera);
  document.addEventListener('keydown', cerrarMenuConEscape);
  limpiarEventosUsuario = () => {
    document.removeEventListener('click', cerrarMenuAlHacerClicFuera);
    document.removeEventListener('keydown', cerrarMenuConEscape);
  };
  controlMusica = ['edicion', 'simulacion'].includes(actual) ? null : crearControlMusica();
  // En Inicio ya se muestra la marca grande junto al saludo.
  cabecera.append(enlaces);
  if (controlMusica) cabecera.append(controlMusica.elemento);
  cabecera.append(usuario);
  cabecera.addEventListener('click', (evento) => {
    const enlace = evento.target.closest('a[data-navegacion]');
    if (enlace?.getAttribute('aria-disabled') === 'true') { evento.preventDefault(); return; }
    if (!enlace || esNavegacionModificada(evento)) return;
    evento.preventDefault();
    navegarConCambiosPendientes(enlace.href);
  });
  marcador.replaceChildren(cabecera);
  limpiarMantenimiento = inicializarAvisoMantenimiento(marcador, sesion);
  crearFlujoNavegacion(etapa);
  return cabecera;
}

export function crearFlujoNavegacion(etapa) {
  const marcador = document.querySelector('[data-flujo-navegacion]');
  if (!marcador || !etapa) return;
  const flujo = document.createElement('nav');
  flujo.className = 'metronet-flujo';
  flujo.setAttribute('aria-label', 'Progreso del flujo de juego');
  ETAPAS_FLUJO.forEach((paso, indice) => {
    const elemento = document.createElement('span');
    elemento.className = `metronet-flujo__paso${paso.id === etapa ? ' actual' : ''}`;
    elemento.textContent = paso.texto;
    flujo.append(elemento);
    if (indice < ETAPAS_FLUJO.length - 1) {
      const separador = document.createElement('span');
      separador.className = 'metronet-flujo__separador';
      separador.setAttribute('aria-hidden', 'true');
      separador.textContent = '›';
      flujo.append(separador);
    }
  });
  marcador.replaceChildren(flujo);
}
