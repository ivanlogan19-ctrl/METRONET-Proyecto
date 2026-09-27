import { obtenerSesionActiva } from '../autenticacion/sesion.js';
const progresosEnCurso = new Map();

export function consultarJuego(ruta) {
  const sesion = obtenerSesionActiva();
  const token = sesion?.token;
  if (ruta !== '/progreso') return solicitarJuego(ruta, token);
  // Compartir solo la lectura que todavía está en curso. No conservar progreso
  // resuelto: completar/reiniciar un nivel debe consultar nuevamente al servicio.
  if (!progresosEnCurso.has(token)) {
    progresosEnCurso.set(token, solicitarJuego(ruta, token).finally(() => progresosEnCurso.delete(token)));
  }
  return progresosEnCurso.get(token);
}

async function solicitarJuego(ruta, token) {
  const respuesta = await fetch(`${location.protocol}//${location.hostname}:8080/api/juego${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!respuesta.ok) throw new Error('No fue posible consultar el desempeño. Volvé a intentarlo.');
  const texto = await respuesta.text();
  return texto ? JSON.parse(texto) : null;
}
