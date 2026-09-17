import {
  activarVisibilidadContrasena,
  esContrasenaValida,
  establecerCarga,
  mostrarMensaje,
  validarFormulario,
} from './ui.js';
import {
  cambiarContrasenaRecuperada,
  limpiarContextoRecuperacion,
  obtenerContextoRecuperacion,
} from './recuperacionContrasena.js';

const formulario = document.getElementById('formularioNuevaContrasena');
const botonCambiar = document.getElementById('botonCambiarContrasena');
const contexto = obtenerContextoRecuperacion();

if (!contexto?.tokenRecuperacion || !contexto.idSolicitud) {
  limpiarContextoRecuperacion();
  window.location.replace('/recuperar-contrasena.html');
} else {
  activarVisibilidadContrasena();
  formulario.addEventListener('submit', cambiarContrasena);
}

async function cambiarContrasena(evento) {
  evento.preventDefault();

  if (!validarFormulario(formulario)) {
    mostrarMensaje('Completá los datos para actualizar la contraseña.', 'error');
    return;
  }

  const nuevaContrasena = document.getElementById('nuevaContrasena').value;
  const confirmarContrasena = document.getElementById('confirmarContrasena').value;

  if (!esContrasenaValida(nuevaContrasena)) {
    mostrarMensaje('La contraseña debe tener al menos 6 caracteres, una mayúscula y un carácter especial.', 'error');
    return;
  }

  if (nuevaContrasena !== confirmarContrasena) {
    mostrarMensaje('Las contraseñas no coinciden.', 'error');
    return;
  }

  try {
    establecerCarga(botonCambiar, true);
    await cambiarContrasenaRecuperada(
      obtenerContextoRecuperacion(),
      nuevaContrasena,
      confirmarContrasena,
    );
    limpiarContextoRecuperacion();
    formulario.reset();
    mostrarMensaje('Contraseña actualizada correctamente. Ya podés iniciar sesión.');

    window.setTimeout(() => {
      window.location.replace('/login.html');
    }, 900);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    establecerCarga(botonCambiar, false);
  }
}
