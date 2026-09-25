import { continuarConBienvenida, reanudarBienvenida } from "../autenticacion/BienvenidaAcceso.js";
import {
  activarVisibilidadContrasena,
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
} from "../autenticacion/ui.js";
import { guardarSesionAdministrador, obtenerSesionAdministrador } from "../autenticacion/sesion.js";

const formulario = document.getElementById("loginAdminForm");
const botonIngresar = document.getElementById("loginAdminButton");

activarVisibilidadContrasena();

let envioEnCurso = reanudarBienvenida(obtenerSesionAdministrador());
let paginaActiva = true;
window.addEventListener('pagehide', () => { paginaActiva = false; });
window.addEventListener('pageshow', evento => {
  paginaActiva = true;
  if (evento.persisted) {
    envioEnCurso = reanudarBienvenida(obtenerSesionAdministrador());
    establecerCarga(botonIngresar, envioEnCurso);
  }
});

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (envioEnCurso || !paginaActiva) return;

  const datos = {
    usuario: document.getElementById("usuario").value.trim(),
    password: document.getElementById("password").value,
  };

  if (!datos.usuario || !datos.password) {
    mostrarMensaje("Completá usuario y contraseña.", "error");
    return;
  }

  envioEnCurso = true;
  let navegando = false;
  try {
    establecerCarga(botonIngresar, true);
    mostrarMensaje("Validando permisos de administrador…");

    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/login/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(respuesta, "No fue posible iniciar sesión."),
      );
    }

    const sesion = await respuesta.json();
    if (!paginaActiva) return;
    guardarSesionAdministrador(sesion);
    navegando = await continuarConBienvenida(sesion, "/admin.html");
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    if (!navegando) { envioEnCurso = false; establecerCarga(botonIngresar, false); }
  }
});
