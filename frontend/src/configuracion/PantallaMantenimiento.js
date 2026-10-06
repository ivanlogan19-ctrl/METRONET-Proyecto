import { obtenerSesionUsuario } from '../autenticacion/sesion.js';
import { consultarEstadoMantenimiento } from './ControlAccesoMantenimiento.js';

const estado = document.getElementById('estadoMantenimiento');
let consultando = false;

async function comprobar() {
  if (consultando || document.hidden) return;
  consultando = true;
  try {
    if (!await consultarEstadoMantenimiento()) {
      estado.textContent = 'El servicio volvió. Redirigiendo…';
      location.replace(obtenerSesionUsuario() ? '/inicio.html' : '/login.html');
      return;
    }
    estado.textContent = 'El acceso se habilitará automáticamente al terminar el mantenimiento.';
  } catch {
    estado.textContent = 'Seguimos comprobando el estado del servicio.';
  } finally {
    consultando = false;
  }
}

void comprobar();
window.setInterval(comprobar, 10000);
window.addEventListener('focus', comprobar);
document.addEventListener('visibilitychange', comprobar);
