import { crearLogoMetronet } from '../componentes/LogoMetronet.js';
import { eliminarSesiones, obtenerSesionActiva } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta, obtenerContextoRuta } from '../red/ContextoDiseno.js';

const ETAPAS_FLUJO = [
  { id: 'escenario', texto: 'Escenario' },
  { id: 'edicion', texto: 'Edición' },
  { id: 'simulacion', texto: 'Simulación' },
  { id: 'resultados', texto: 'Resultados' },
];

let controlCambios = null;
let confirmarSalida = null;
let limpiarEventosUsuario = null;

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
  dialogo.innerHTML = `
    <form method="dialog" class="metronet-dialogo-cambios__contenido">
      <h2>Cambios sin guardar</h2>
      <p>Tenés cambios sin guardar.</p>
      <div class="metronet-dialogo-cambios__acciones">
        <button value="cancelar" type="submit">Cancelar</button>
        <button value="salir" type="submit" data-accion-salir>Salir sin guardar</button>
        <button value="guardar" type="submit" data-accion-guardar>Guardar y continuar</button>
      </div>
    </form>`;
  document.body.append(dialogo);
  return dialogo;
}

function solicitarConfirmacionCambios() {
  return new Promise((resolver) => {
    const dialogo = document.querySelector('.metronet-dialogo-cambios') ?? crearDialogoCambios();
    dialogo.addEventListener('close', () => resolver(dialogo.returnValue), { once: true });
    dialogo.showModal();
  });
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
  if (!controlCambios?.hayCambios()) return window.location.assign(ruta);
  const accion = await solicitarConfirmacionCambios();
  if (accion === 'salir') return window.location.assign(ruta);
  if (accion !== 'guardar') return;
  try {
    const guardado = await controlCambios.guardar();
    if (guardado !== false && !controlCambios.hayCambios()) window.location.assign(ruta);
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
  const marcador = document.querySelector('[data-navegacion-global]');
  const sesion = obtenerSesionActiva();
  limpiarEventosUsuario?.();
  limpiarEventosUsuario = null;
  if (!marcador || !sesion) return null;
  const contexto = obtenerContextoRuta();
  const cabecera = document.createElement('header');
  cabecera.className = 'metronet-navegacion';
  const inicio = document.createElement('a');
  inicio.className = 'metronet-navegacion__marca';
  inicio.href = '/inicio.html';
  inicio.dataset.navegacion = 'true';
  inicio.setAttribute('aria-label', 'Ir a Inicio de METRONET');
  inicio.append(crearLogoMetronet({ alt: 'METRONET' }));
  const enlaces = document.createElement('nav');
  enlaces.className = 'metronet-navegacion__enlaces';
  enlaces.setAttribute('aria-label', 'Navegación principal');
  enlaces.append(
    crearEnlace('Inicio', '/inicio.html', actual === 'inicio'),
    crearEnlace('Escenarios', '/escenarios.html', actual === 'escenarios'),
    crearEnlace('Mis diseños', establecerContextoEnRuta('/', contexto), actual === 'edicion' || actual === 'simulacion'),
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
    crearEnlace('Escenarios', '/escenarios.html', actual === 'escenarios'),
    crearEnlace('Mis diseños', establecerContextoEnRuta('/', contexto), actual === 'edicion' || actual === 'simulacion'),
  );
  if (sesion.usuario?.rol === 'ADMIN') menuUsuario.append(crearEnlace('Administración', '/admin.html', actual === 'administracion'));
  const enlacePerfil = crearEnlace('Mi perfil', '/perfil.html', actual === 'perfil');
  enlacePerfil.classList.add('metronet-navegacion__enlace-perfil');
  menuUsuario.append(enlacePerfil);
  const botonCerrar = document.createElement('button');
  botonCerrar.type = 'button';
  botonCerrar.textContent = 'Cerrar sesión';
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
  cabecera.append(inicio, enlaces, usuario);
  cabecera.addEventListener('click', (evento) => {
    const enlace = evento.target.closest('a[data-navegacion]');
    if (!enlace || esNavegacionModificada(evento)) return;
    evento.preventDefault();
    navegarConCambiosPendientes(enlace.href);
  });
  marcador.replaceChildren(cabecera);
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
