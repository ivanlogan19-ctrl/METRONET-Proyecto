import { continuarConBienvenida, reanudarBienvenida } from "./BienvenidaAcceso.js";
import {
  activarVisibilidadContrasena,
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
  validarFormulario,
} from "./ui.js";
import { inicializarLogosMetronet } from "../componentes/LogoMetronet.js";
import { guardarSesionUsuario, obtenerSesionUsuario } from "./sesion.js";
import { consultarEstadoMantenimiento } from '../configuracion/ControlAccesoMantenimiento.js';

try {
  if (await consultarEstadoMantenimiento()) {
    window.location.replace('/mantenimiento.html');
    await new Promise(() => {});
  }
} catch { /* Si falla la consulta, el servidor conserva el bloqueo de acceso. */ }

const formulario = document.getElementById("loginForm");
const botonIngresar = document.getElementById("loginButton");

inicializarLogosMetronet();
activarVisibilidadContrasena();

let envioEnCurso = reanudarBienvenida(obtenerSesionUsuario());
let paginaActiva = true;
window.addEventListener('pagehide', () => { paginaActiva = false; });
window.addEventListener('pageshow', evento => {
  paginaActiva = true;
  if (evento.persisted) {
    envioEnCurso = reanudarBienvenida(obtenerSesionUsuario());
    establecerCarga(botonIngresar, envioEnCurso);
  }
});

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (envioEnCurso || !paginaActiva) return;

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

  envioEnCurso = true;
  let navegando = false;
  try {
    establecerCarga(botonIngresar, true);
    mostrarMensaje("Validando credenciales…");

    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    if (respuesta.status === 503) {
      navegando = true;
      window.location.replace('/mantenimiento.html');
      return;
    }

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(respuesta, "No fue posible iniciar sesión."),
      );
    }

    const sesionUsuario = await respuesta.json();
    if (!paginaActiva) return;
    guardarSesionUsuario(sesionUsuario);

    navegando = await continuarConBienvenida(sesionUsuario);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    if (!navegando) { envioEnCurso = false; establecerCarga(botonIngresar, false); }
  }
});
