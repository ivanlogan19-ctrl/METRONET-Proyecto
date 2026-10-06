import { obtenerSesionUsuario } from '../autenticacion/sesion.js';
import './mantenimiento.css';

const URL_ESTADO = `${location.protocol}//${location.hostname}:8080/api/estado`;

export async function consultarEstadoMantenimiento() {
  const respuesta = await fetch(URL_ESTADO, { cache: 'no-store' });
  if (!respuesta.ok) throw new Error('No se pudo consultar el estado de METRONET.');
  return (await respuesta.json()).mantenimiento === true;
}

export async function comprobarAccesoJugador() {
  if (!obtenerSesionUsuario() || location.pathname === '/mantenimiento.html') return;
  document.documentElement.classList.add('metronet-comprobando-acceso');
  try {
    if (await consultarEstadoMantenimiento()) {
      location.replace('/mantenimiento.html');
      // Mantener en pausa el módulo de juego mientras cambia el documento.
      await new Promise(() => {});
    }
  } catch {
    // La API del juego mantiene su propia autorización si falla esta consulta.
  } finally {
    document.documentElement.classList.remove('metronet-comprobando-acceso');
  }
}
