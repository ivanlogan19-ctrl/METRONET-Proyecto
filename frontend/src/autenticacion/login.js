import {
  activarVisibilidadContrasena,
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
  validarFormulario,
} from "./ui.js";
import { inicializarLogosMetronet } from "../componentes/LogoMetronet.js";
import { guardarSesionUsuario } from "./sesion.js";

const formulario = document.getElementById("loginForm");
const botonIngresar = document.getElementById("loginButton");

inicializarLogosMetronet();
activarVisibilidadContrasena();

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (!validarFormulario(formulario)) {
    mostrarMensaje("Revisá el correo electrónico y la contraseña.", "error");
    return;
  }

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
    guardarSesionUsuario(sesionUsuario);

    const destino = obtenerDestino();
    mostrarMensaje(destino === "/inicio.html" ? "Ingreso correcto. Abriendo Inicio…" : "Ingreso correcto. Abriendo la sección solicitada…");

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
  return destino?.startsWith("/") && !destino.startsWith("//") ? destino : "/inicio.html";
}
