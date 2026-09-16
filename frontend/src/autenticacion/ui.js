export function activarVisibilidadContrasena() {
  document.querySelectorAll('.toggle-password').forEach((boton) => {
    boton.addEventListener('click', () => {
      const campo = document.getElementById(boton.dataset.target);

      if (!campo) {
        return;
      }

      const esContrasena = campo.type === 'password';
      campo.type = esContrasena ? 'text' : 'password';
      boton.textContent = esContrasena ? 'Ocultar' : 'Mostrar';
    });
  });
}

export function mostrarMensaje(texto, tipo = 'exito') {
  const mensaje = document.getElementById('mensaje');

  if (!mensaje) {
    return;
  }

  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`;
}

export function establecerCarga(boton, cargando) {
  boton.disabled = cargando;
  boton.classList.toggle('cargando', cargando);
}

export function validarFormulario(formulario) {
  if (formulario.checkValidity()) {
    return true;
  }

  formulario.reportValidity();
  return false;
}

export async function obtenerMensajeError(respuesta, mensajePredeterminado) {
  try {
    const datos = await respuesta.json();
    return datos.detail || datos.message || mensajePredeterminado;
  } catch {
    return mensajePredeterminado;
  }
}

export function obtenerUrlAutenticacion() {
  return `${window.location.protocol}//${window.location.hostname}:8080/auth`;
}
