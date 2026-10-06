import { consultarEstadoMantenimiento } from './ControlAccesoMantenimiento.js';

// La página ya se comprobó antes de montar el juego. Repetir la consulta permite
// retirar una sesión abierta en cuanto el administrador active mantenimiento.
export function inicializarAvisoMantenimiento(_contenedor, sesion) {
  if (sesion.usuario?.rol !== 'JUGADOR') return () => {};
  let detenido = false;
  let consultando = false;
  const comprobar = async () => {
    if (detenido || consultando || document.hidden) return;
    consultando = true;
    try {
      if (await consultarEstadoMantenimiento() && !detenido) location.replace('/mantenimiento.html');
    } catch { /* El servidor verifica cada operación del jugador. */ }
    finally { consultando = false; }
  };
  const intervalo = window.setInterval(comprobar, 10000);
  window.addEventListener('focus', comprobar);
  document.addEventListener('visibilitychange', comprobar);
  return () => {
    detenido = true;
    window.clearInterval(intervalo);
    window.removeEventListener('focus', comprobar);
    document.removeEventListener('visibilitychange', comprobar);
  };
}
