import { obtenerMensajeError, obtenerUrlAutenticacion } from './ui.js';

const CLAVE_CONTEXTO_RECUPERACION = 'recuperacionContrasena';
const SEGUNDOS_ESPERA_REENVIO = 60;
const RUTAS_RECUPERACION = Object.freeze({
  solicitar: '/recuperar-contrasena',
  verificar: '/recuperar-contrasena/verificar-codigo',
  reenviar: '/recuperar-contrasena/reenviar-codigo',
  cambiar: '/recuperar-contrasena/cambiar-contrasena',
});

function obtenerClaveContexto() {
  return `${window.location.hostname}:${CLAVE_CONTEXTO_RECUPERACION}`;
}

function obtenerRutaRecuperacion(nombre) {
  return `${obtenerUrlAutenticacion()}${RUTAS_RECUPERACION[nombre]}`;
}

async function obtenerDatosOpcionales(respuesta) {
  try {
    return await respuesta.json();
  } catch {
    return {};
  }
}

async function enviarSolicitud(ruta, opciones, mensajePredeterminado) {
  const respuesta = await fetch(ruta, opciones);

  if (!respuesta.ok) {
    throw new Error(await obtenerMensajeError(respuesta, mensajePredeterminado));
  }

  return obtenerDatosOpcionales(respuesta);
}

function guardarContexto(contexto) {
  window.sessionStorage.setItem(obtenerClaveContexto(), JSON.stringify(contexto));
}

export function obtenerContextoRecuperacion() {
  try {
    const contexto = JSON.parse(window.sessionStorage.getItem(obtenerClaveContexto()));
    return contexto?.email ? contexto : null;
  } catch {
    limpiarContextoRecuperacion();
    return null;
  }
}

export function limpiarContextoRecuperacion() {
  window.sessionStorage.removeItem(obtenerClaveContexto());
}

export function guardarContextoRecuperacion(cambios) {
  const contextoActual = obtenerContextoRecuperacion() ?? {};
  guardarContexto({ ...contextoActual, ...cambios });
}

export async function solicitarCodigoRecuperacion(email) {
  const datos = await enviarSolicitud(
    obtenerRutaRecuperacion('solicitar'),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
    'No fue posible enviar el código de recuperación.',
  );

  guardarContexto({
    email,
    idSolicitud: datos.idSolicitud ?? null,
    tokenRecuperacion: null,
    reenvioDisponibleEn: Date.now() + SEGUNDOS_ESPERA_REENVIO * 1000,
  });
}

export async function verificarCodigoRecuperacion(contexto, codigo) {
  const datos = await enviarSolicitud(
    obtenerRutaRecuperacion('verificar'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: contexto.email,
        idSolicitud: contexto.idSolicitud,
        codigo,
      }),
    },
    'No fue posible verificar el código.',
  );
  const tokenRecuperacion = datos.tokenRecuperacion;

  if (!tokenRecuperacion) {
    throw new Error('No fue posible validar el código. Solicitá uno nuevo.');
  }

  guardarContextoRecuperacion({
    idSolicitud: datos.idSolicitud ?? contexto.idSolicitud,
    tokenRecuperacion,
    reenvioDisponibleEn: null,
  });
}

export async function reenviarCodigoRecuperacion(contexto) {
  const datos = await enviarSolicitud(
    obtenerRutaRecuperacion('reenviar'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contexto.email, idSolicitud: contexto.idSolicitud }),
    },
    'No fue posible reenviar el código.',
  );
  const segundosEspera = Number(datos.segundosEspera) || SEGUNDOS_ESPERA_REENVIO;

  guardarContextoRecuperacion({
    idSolicitud: datos.idSolicitud ?? contexto.idSolicitud,
    tokenRecuperacion: null,
    reenvioDisponibleEn: Date.now() + segundosEspera * 1000,
  });

  return segundosEspera;
}

export async function cambiarContrasenaRecuperada(contexto, nuevaContrasena, confirmarNuevaContrasena) {
  await enviarSolicitud(
    obtenerRutaRecuperacion('cambiar'),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idSolicitud: contexto.idSolicitud,
        tokenRecuperacion: contexto.tokenRecuperacion,
        nuevaContrasena,
        confirmarNuevaContrasena,
      }),
    },
    'No fue posible actualizar la contraseña.',
  );
}
