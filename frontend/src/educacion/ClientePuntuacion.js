import { obtenerSesionActiva } from '../autenticacion/sesion.js';
export async function consultarJuego(ruta) {
  const sesion = obtenerSesionActiva();
  const respuesta = await fetch(`${location.protocol}//${location.hostname}:8080/api/juego${ruta}`, { headers: { Authorization: `Bearer ${sesion?.token}` } });
  if (!respuesta.ok) throw new Error('No fue posible consultar el desempeño. Volvé a intentarlo.');
  const texto = await respuesta.text();
  return texto ? JSON.parse(texto) : null;
}
