import { establecerCarga, mostrarMensaje, validarFormulario } from './ui.js';
import {
  guardarContextoRecuperacion,
  limpiarContextoRecuperacion,
  obtenerContextoRecuperacion,
  reenviarCodigoRecuperacion,
  verificarCodigoRecuperacion,
} from './recuperacionContrasena.js';

const formulario = document.getElementById('formularioVerificacion');
const campoCodigo = document.getElementById('codigo');
const botonVerificar = document.getElementById('botonVerificar');
const botonReenviar = document.getElementById('botonReenviar');
const contadorReenvio = document.getElementById('contadorReenvio');
const enlaceVolver = document.getElementById('volverRecuperacion');
let temporizadorReenvio = null;
const contexto = obtenerContextoRecuperacion();

if (!contexto) {
  window.location.replace('/recuperar-contrasena.html');
} else {
  inicializarVerificacion();
}

function inicializarVerificacion() {
  campoCodigo.focus();
  campoCodigo.addEventListener('input', normalizarCodigo);
  formulario.addEventListener('submit', verificarCodigo);
  botonReenviar.addEventListener('click', reenviarCodigo);
  enlaceVolver.addEventListener('click', limpiarContextoRecuperacion);
  iniciarContadorReenvio();
}

function normalizarCodigo() {
  campoCodigo.value = campoCodigo.value.replace(/\D/g, '').slice(0, 6);
}

function iniciarContadorReenvio() {
  window.clearInterval(temporizadorReenvio);

  const actualizarContador = () => {
    const contextoActual = obtenerContextoRecuperacion();
    const disponibleEn = Number(contextoActual?.reenvioDisponibleEn) || 0;
    const segundosRestantes = Math.max(0, Math.ceil((disponibleEn - Date.now()) / 1000));
    const bloqueado = segundosRestantes > 0;

    botonReenviar.disabled = bloqueado;
    contadorReenvio.textContent = bloqueado
      ? `Podrás solicitar otro código en ${segundosRestantes} segundos.`
      : '';

    if (!bloqueado) {
      window.clearInterval(temporizadorReenvio);
      temporizadorReenvio = null;
    }
  };

  actualizarContador();
  if (botonReenviar.disabled) {
    temporizadorReenvio = window.setInterval(actualizarContador, 1000);
  }
}

async function verificarCodigo(evento) {
  evento.preventDefault();
  normalizarCodigo();

  if (!validarFormulario(formulario)) {
    mostrarMensaje('Ingresá los seis dígitos del código.', 'error');
    return;
  }

  try {
    establecerCarga(botonVerificar, true);
    await verificarCodigoRecuperacion(obtenerContextoRecuperacion(), campoCodigo.value);
    mostrarMensaje('Código verificado. Ahora podés crear una nueva contraseña.');

    window.setTimeout(() => {
      window.location.assign('/nueva-contrasena.html');
    }, 500);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    establecerCarga(botonVerificar, false);
  }
}

async function reenviarCodigo() {
  try {
    botonReenviar.disabled = true;
    const segundosEspera = await reenviarCodigoRecuperacion(obtenerContextoRecuperacion());
    guardarContextoRecuperacion({ reenvioDisponibleEn: Date.now() + segundosEspera * 1000 });
    mostrarMensaje('Si existe una cuenta asociada, enviamos un nuevo código al correo indicado.');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    iniciarContadorReenvio();
  }
}
