import { establecerCarga, mostrarMensaje, validarFormulario } from './ui.js';
import { limpiarContextoRecuperacion, solicitarCodigoRecuperacion } from './recuperacionContrasena.js';

const formulario = document.getElementById("formularioRecuperacion");
const boton = document.getElementById("botonRecuperar");

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (!validarFormulario(formulario)) {
    mostrarMensaje("Ingresá un correo electrónico válido.", "error");
    return;
  }
  const email = document.getElementById("email").value.trim();

  if (!email) {
    mostrarMensaje("Ingresá tu correo electrónico.", "error");
    return;
  }

  try {
    establecerCarga(boton, true);
    limpiarContextoRecuperacion();
    await solicitarCodigoRecuperacion(email);
    mostrarMensaje('Si existe una cuenta asociada a ese correo, recibirás un código para recuperar tu contraseña.');

    window.setTimeout(() => {
      window.location.assign('/verificar-codigo.html');
    }, 700);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    establecerCarga(boton, false);
  }
});
