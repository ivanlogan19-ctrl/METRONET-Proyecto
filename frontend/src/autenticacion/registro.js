import {
  activarVisibilidadContrasena,
  establecerCarga,
  esContrasenaValida,
  mostrarMensaje,
  obtenerMensajeError,
  obtenerUrlAutenticacion,
  validarFormulario,
} from "./ui.js";

const formulario = document.getElementById("registroForm");
const botonRegistrar = document.getElementById("registroButton");

activarVisibilidadContrasena();

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (!validarFormulario(formulario)) {
    mostrarMensaje("Revisá los datos obligatorios del registro.", "error");
    return;
  }

  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    apellido: document.getElementById("apellido").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    aceptaDatos: document.getElementById("aceptaDatos").checked,
  };

  if (!datos.nombre || !datos.apellido || !datos.email || !datos.password) {
    mostrarMensaje("Completá todos los campos.", "error");
    return;
  }

  if (!datos.aceptaDatos) {
    mostrarMensaje(
      "Para crear una cuenta debés aceptar el uso de tus datos.",
      "error",
    );
    return;
  }

  if (!esContrasenaValida(datos.password)) {
    mostrarMensaje(
      "La contraseña debe tener al menos 6 caracteres, una mayúscula y un carácter especial.",
      "error",
    );
    return;
  }

  try {
    establecerCarga(botonRegistrar, true);
    mostrarMensaje("Creando usuario…");

    const respuesta = await fetch(`${obtenerUrlAutenticacion()}/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(
          respuesta,
          "No fue posible crear el usuario.",
        ),
      );
    }

    await respuesta.json();
    mostrarMensaje("Usuario creado. Ahora iniciá sesión para continuar.");

    window.setTimeout(() => {
      window.location.assign("/login.html");
    }, 600);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  } finally {
    establecerCarga(botonRegistrar, false);
  }
});
