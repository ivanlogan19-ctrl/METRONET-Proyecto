import { establecerCarga, mostrarMensaje, obtenerUrlAutenticacion } from "./ui.js";

const formulario = document.getElementById("formularioRecuperacion");
const boton = document.getElementById("botonRecuperar");

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const email = document.getElementById("email").value.trim();

  if (!email) {
    mostrarMensaje("Ingresá tu correo electrónico.", "error");
    return;
  }

  try {
    establecerCarga(boton, true);
    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/recuperar-contrasena`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!respuesta.ok) throw new Error("No fue posible registrar la solicitud.");
    formulario.reset();
    mostrarMensaje("Si la cuenta existe, la solicitud fue enviada al administrador.");
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    establecerCarga(boton, false);
  }
});
