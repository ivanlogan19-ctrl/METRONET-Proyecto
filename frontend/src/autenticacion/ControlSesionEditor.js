import { confirmarSistema } from '../componentes/DialogoSistema.js';
import { cerrarSesionRemota, eliminarSesiones, obtenerSesionActiva } from './sesion.js';

export function configurarControlSesionEditor(controlSesion, controlSimulacion) {
  if (controlSimulacion) {
    controlSimulacion.href = obtenerSesionActiva()
      ? '/simulacion.html'
      : '/login.html?destino=%2Fsimulacion.html';
  }
  controlSesion.addEventListener('click', cerrarSesionEditor);
}

export async function cerrarSesionEditor() {
  if (!await confirmarSistema('¿Querés cerrar la sesión actual?')) {
    return;
  }

  const sesion = obtenerSesionActiva();

  if (sesion) {
    try {
      await cerrarSesionRemota(sesion);
    } catch {
      // La sesión local se elimina aunque el servicio ya no esté disponible.
    }
  }

  eliminarSesiones();
  window.location.assign('/login.html');
}
