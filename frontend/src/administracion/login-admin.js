import {
  activarVisibilidadContrasena,
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
} from "../autenticacion/ui.js";

const formulario = document.getElementById("loginAdminForm");
const botonIngresar = document.getElementById("loginAdminButton");

activarVisibilidadContrasena();

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const datos = {
    usuario: document.getElementById("usuario").value.trim(),
    password: document.getElementById("password").value,
  };

  if (!datos.usuario || !datos.password) {
    mostrarMensaje("Completá usuario y contraseña.", "error");
    return;
  }

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
    localStorage.setItem("usuario", JSON.stringify(sesion.usuario));
    localStorage.setItem("sesionAdministrador", JSON.stringify(sesion));
    mostrarMensaje("Acceso autorizado. Abriendo administración…");

    window.setTimeout(() => {
      window.location.assign("/admin.html");
    }, 600);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    establecerCarga(botonIngresar, false);
  }
});
