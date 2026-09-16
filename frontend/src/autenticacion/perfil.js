import {
  establecerCarga,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
  activarVisibilidadContrasena,
  validarFormulario,
} from "./ui.js";

const sesion = obtenerSesion();
const formulario = document.getElementById("perfilForm");
const botonGuardar = document.getElementById("guardarPerfil");
const formularioContrasena = document.getElementById("contrasenaForm");
const botonGuardarContrasena = document.getElementById("guardarContrasena");

if (!sesion) {
  window.location.replace("/login.html");
} else {
  cargarPerfil();
  formulario.addEventListener("submit", guardarPerfil);
  formularioContrasena.addEventListener("submit", guardarContrasena);
  activarVisibilidadContrasena();
}

async function guardarContrasena(evento) {
  evento.preventDefault();

  if (!validarFormulario(formularioContrasena)) {
    mostrarMensaje("Completá correctamente los datos de la contraseña.", "error");
    return;
  }

  const contrasenaActual = document.getElementById("contrasenaActual").value;
  const nuevaContrasena = document.getElementById("nuevaContrasena").value;
  const esValida = nuevaContrasena.length >= 6 && /[A-Z]/.test(nuevaContrasena) && /[^A-Za-z0-9]/.test(nuevaContrasena);

  if (!contrasenaActual || !nuevaContrasena) {
    mostrarMensaje("Completá la contraseña actual y la nueva.", "error");
    return;
  }

  if (!esValida) {
    mostrarMensaje("La nueva contraseña debe tener 6 caracteres, una mayúscula y un carácter especial.", "error");
    return;
  }

  try {
    establecerCarga(botonGuardarContrasena, true);
    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/perfil/contrasena`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sesion.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contrasenaActual, nuevaContrasena }),
    });

    if (!respuesta.ok) {
      throw new Error(await obtenerMensajeError(respuesta, "No fue posible cambiar la contraseña."));
    }

    formularioContrasena.reset();
    mostrarMensaje("Contraseña actualizada correctamente.", "exito");
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    establecerCarga(botonGuardarContrasena, false);
  }
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

  if (!validarFormulario(formulario)) {
    mostrarMensaje("Revisá los datos del perfil.", "error");
    return;
  }

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
