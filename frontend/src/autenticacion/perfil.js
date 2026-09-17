import {
  activarVisibilidadContrasena,
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
  validarFormulario,
} from './ui.js';
import {
  eliminarSesiones,
  guardarSesionAdministrador,
  guardarSesionUsuario,
  obtenerSesionActiva,
} from './sesion.js';
import {
  inicializarNavegacion,
  navegarConCambiosPendientes,
  registrarControlCambios,
} from '../navegacion/NavegacionAplicacion.js';

const sesion = obtenerSesionActiva();
const formularioDatosPersonales = document.getElementById('datosPersonalesForm');
const formularioCorreo = document.getElementById('correoForm');
const formularioContrasena = document.getElementById('contrasenaForm');
const botonDatosPersonales = document.getElementById('guardarDatosPersonales');
const botonCorreo = document.getElementById('guardarCorreo');
const botonContrasena = document.getElementById('guardarContrasena');
let perfilInicial = null;

if (!sesion) {
  window.location.replace('/login.html');
} else {
  inicializarNavegacion({ actual: 'perfil' });
  registrarEventos();
  cargarPerfil();
}

function registrarEventos() {
  formularioDatosPersonales.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    await guardarDatosPersonales();
  });
  formularioCorreo.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    await guardarCorreo();
  });
  formularioContrasena.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    await guardarContrasena();
  });
  document.querySelector('[data-volver-perfil]').addEventListener('click', (evento) => {
    evento.preventDefault();
    navegarConCambiosPendientes('/inicio.html');
  });
  registrarControlCambios({
    hayCambios: hayCambiosSinGuardar,
    guardar: guardarCambiosPendientes,
  });
  activarVisibilidadContrasena();
}

async function cargarPerfil() {
  try {
    const respuesta = await solicitar('/perfil');
    perfilInicial = {
      nombre: respuesta.nombre ?? '',
      apellido: respuesta.apellido ?? '',
      email: respuesta.email ?? '',
    };
    document.getElementById('nombre').value = perfilInicial.nombre;
    document.getElementById('apellido').value = perfilInicial.apellido;
    document.getElementById('correoActual').value = perfilInicial.email;
    document.getElementById('email').value = '';
    document.getElementById('rolUsuario').textContent = formatearRol(respuesta.rol);
    document.getElementById('fechaCreacion').textContent = formatearFecha(respuesta.fechaCreacion);
    actualizarSesion(respuesta);
  } catch (error) {
    manejarErrorSesion(error);
  }
}

async function guardarDatosPersonales() {
  if (!hayCambiosDatosPersonales()) return true;
  if (!validarFormulario(formularioDatosPersonales)) {
    mostrarMensaje('Completá correctamente tu nombre y apellido.', 'error');
    return false;
  }
  const datos = {
    nombre: document.getElementById('nombre').value.trim(),
    apellido: document.getElementById('apellido').value.trim(),
  };
  try {
    establecerCarga(botonDatosPersonales, true);
    const perfil = await solicitar('/perfil/datos-personales', {
      method: 'PATCH',
      body: JSON.stringify(datos),
    });
    actualizarPerfilGuardado(perfil);
    mostrarMensaje('Información personal actualizada correctamente.');
    return true;
  } catch (error) {
    manejarErrorSesion(error);
    return false;
  } finally {
    establecerCarga(botonDatosPersonales, false);
  }
}

async function guardarCorreo() {
  if (!hayCambiosCorreo()) return true;
  if (!validarFormulario(formularioCorreo)) {
    mostrarMensaje('Ingresá un correo electrónico válido.', 'error');
    return false;
  }
  const email = document.getElementById('email').value.trim();
  try {
    establecerCarga(botonCorreo, true);
    const perfil = await solicitar('/perfil/correo', {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    });
    actualizarPerfilGuardado(perfil);
    mostrarMensaje('Correo electrónico actualizado correctamente.');
    return true;
  } catch (error) {
    manejarErrorSesion(error);
    return false;
  } finally {
    establecerCarga(botonCorreo, false);
  }
}

async function guardarContrasena() {
  if (!hayCambiosContrasena()) return true;
  if (!validarFormulario(formularioContrasena)) {
    mostrarMensaje('Completá correctamente los datos de la contraseña.', 'error');
    return false;
  }
  const contrasenaActual = document.getElementById('contrasenaActual').value;
  const nuevaContrasena = document.getElementById('nuevaContrasena').value;
  const confirmarNuevaContrasena = document.getElementById('confirmarNuevaContrasena').value;
  if (nuevaContrasena !== confirmarNuevaContrasena) {
    mostrarMensaje('La confirmación de la contraseña no coincide.', 'error');
    return false;
  }
  if (!esContrasenaValida(nuevaContrasena)) {
    mostrarMensaje('La nueva contraseña debe tener al menos 6 caracteres, una mayúscula y un carácter especial.', 'error');
    return false;
  }
  try {
    establecerCarga(botonContrasena, true);
    await solicitar('/perfil/contrasena', {
      method: 'PATCH',
      body: JSON.stringify({ contrasenaActual, nuevaContrasena, confirmarNuevaContrasena }),
    });
    formularioContrasena.reset();
    eliminarSesiones();
    mostrarMensaje('Contraseña actualizada correctamente. Iniciá sesión nuevamente para continuar.', 'exito');
    window.setTimeout(() => window.location.replace('/login.html'), 900);
    return false;
  } catch (error) {
    manejarErrorSesion(error);
    return false;
  } finally {
    establecerCarga(botonContrasena, false);
  }
}

async function guardarCambiosPendientes() {
  if (hayCambiosDatosPersonales() && !await guardarDatosPersonales()) return false;
  if (hayCambiosCorreo() && !await guardarCorreo()) return false;
  if (hayCambiosContrasena()) return guardarContrasena();
  return true;
}

async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`${obtenerUrlAutenticacion()}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${sesion.token}`,
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
  });
  if (respuesta.status === 204) return null;
  if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, 'No fue posible actualizar el perfil.'));
  return respuesta.json();
}

function actualizarPerfilGuardado(perfil) {
  perfilInicial = {
    nombre: perfil.nombre ?? '',
    apellido: perfil.apellido ?? '',
    email: perfil.email ?? '',
  };
  document.getElementById('nombre').value = perfilInicial.nombre;
  document.getElementById('apellido').value = perfilInicial.apellido;
  document.getElementById('correoActual').value = perfilInicial.email;
  document.getElementById('email').value = '';
  document.getElementById('rolUsuario').textContent = formatearRol(perfil.rol);
  document.getElementById('fechaCreacion').textContent = formatearFecha(perfil.fechaCreacion);
  actualizarSesion(perfil);
}

function actualizarSesion(perfil) {
  const sesionActualizada = {
    ...sesion,
    usuario: { ...sesion.usuario, ...perfil },
  };
  if (sesion.usuario.rol === 'ADMIN') guardarSesionAdministrador(sesionActualizada);
  else guardarSesionUsuario(sesionActualizada);
  const resumenUsuario = document.querySelector('.metronet-navegacion__usuario summary');
  if (resumenUsuario) resumenUsuario.textContent = obtenerNombreVisible(sesionActualizada.usuario);
}

function hayCambiosSinGuardar() {
  return hayCambiosDatosPersonales() || hayCambiosCorreo() || hayCambiosContrasena();
}

function hayCambiosDatosPersonales() {
  return Boolean(perfilInicial) && (
    document.getElementById('nombre').value.trim() !== perfilInicial.nombre
    || document.getElementById('apellido').value.trim() !== perfilInicial.apellido
  );
}

function hayCambiosCorreo() {
  const nuevoCorreo = document.getElementById('email').value.trim().toLowerCase();
  return Boolean(nuevoCorreo) && nuevoCorreo !== perfilInicial.email.toLowerCase();
}

function hayCambiosContrasena() {
  return ['contrasenaActual', 'nuevaContrasena', 'confirmarNuevaContrasena']
    .some((id) => document.getElementById(id).value.length > 0);
}

function esContrasenaValida(contrasena) {
  return contrasena.length >= 6 && /[A-Z]/.test(contrasena) && /[^A-Za-z0-9]/.test(contrasena);
}

function formatearRol(rol) {
  return rol === 'ADMIN' ? 'Administrador' : 'Jugador';
}

function obtenerNombreVisible(usuario) {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.identificadorAdministrador || 'Usuario';
}

function formatearFecha(fecha) {
  if (!fecha) return 'No disponible';
  return new Intl.DateTimeFormat('es-UY', { dateStyle: 'long' }).format(new Date(fecha));
}

function manejarErrorSesion(error) {
  mostrarMensaje(error.message, 'error');
  if (error.message.toLowerCase().includes('sesión')) {
    eliminarSesiones();
    window.setTimeout(() => window.location.replace('/login.html'), 900);
  }
}
