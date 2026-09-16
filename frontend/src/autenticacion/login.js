import {
  activarVisibilidadContrasena,
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
} from "./ui.js";

const formulario = document.getElementById("loginForm");
const botonIngresar = document.getElementById("loginButton");

activarVisibilidadContrasena();

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const datos = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
  };

  if (!datos.email || !datos.password) {
    mostrarMensaje("Completá email y contraseña.", "error");
    return;
  }

  try {
    establecerCarga(botonIngresar, true);
    mostrarMensaje("Validando credenciales…");

    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(respuesta, "No fue posible iniciar sesión."),
      );
    }

    const sesionUsuario = await respuesta.json();
    const usuario = sesionUsuario.usuario;
    localStorage.setItem("usuario", JSON.stringify(usuario));
    localStorage.setItem("sesionUsuario", JSON.stringify(sesionUsuario));

    const destino = obtenerDestino();
    mostrarMensaje(destino === "/" ? "Ingreso correcto. Abriendo el mapa…" : "Ingreso correcto. Abriendo tus simulaciones…");

    window.setTimeout(() => {
      window.location.assign(destino);
    }, 600);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    establecerCarga(botonIngresar, false);
  }
});

function obtenerDestino() {
  const destino = new URLSearchParams(window.location.search).get("destino");
  return destino?.startsWith("/") && !destino.startsWith("//") ? destino : "/";
}
