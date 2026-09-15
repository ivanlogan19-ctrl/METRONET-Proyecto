import {
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
} from "./ui.js";

const sesion = obtenerSesion();
const formulario = document.getElementById("perfilForm");
const botonGuardar = document.getElementById("guardarPerfil");

if (!sesion) {
  window.location.replace("/login.html");
} else {
  cargarPerfil();
  formulario.addEventListener("submit", guardarPerfil);
}

function obtenerSesion() {
  try {
    const sesionGuardada = JSON.parse(localStorage.getItem("sesionUsuario"));
    return sesionGuardada?.token ? sesionGuardada : null;
  } catch {
    return null;
  }
}

async function cargarPerfil() {
  try {
    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/perfil`, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    });

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(
          respuesta,
          "No fue posible cargar el perfil.",
        ),
      );
    }

    const usuario = await respuesta.json();
    document.getElementById("nombre").value = usuario.nombre;
    document.getElementById("apellido").value = usuario.apellido || "";
    document.getElementById("email").value = usuario.email;
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function guardarPerfil(evento) {
  evento.preventDefault();

  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    apellido: document.getElementById("apellido").value.trim(),
    email: document.getElementById("email").value.trim(),
  };

  if (!datos.nombre || !datos.apellido || !datos.email) {
    mostrarMensaje("Completá nombre, apellido y correo electrónico.", "error");
    return;
  }

  try {
    establecerCarga(botonGuardar, true);
    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/perfil`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sesion.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datos),
    });

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(
          respuesta,
          "No fue posible actualizar el perfil.",
        ),
      );
    }

    const usuario = await respuesta.json();
    localStorage.setItem("usuario", JSON.stringify(usuario));
    localStorage.setItem(
      "sesionUsuario",
      JSON.stringify({ ...sesion, usuario }),
    );
    mostrarMensaje("Perfil actualizado correctamente.");
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    establecerCarga(botonGuardar, false);
  }
}
