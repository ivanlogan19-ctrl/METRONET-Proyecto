import { obtenerSesionActiva } from '../../autenticacion/sesion.js';
export async function solicitarExtras(ruta = '', metodo = 'GET', signal) {
  const sesion = obtenerSesionActiva();
  if (!sesion) throw new Error('Volvé a iniciar sesión para consultar Extras.');
  const respuesta = await fetch(`${location.protocol}//${location.hostname}:8080/api/juego/aprendizaje/extras${ruta}`, {
    method:metodo, headers:{ Authorization:`Bearer ${sesion.token}` }, cache:'no-store', signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  });
  if (!respuesta.ok) throw new Error('No se pudo guardar o consultar tu recorrido. Podés reintentarlo desde Extras.');
  return respuesta.json();
}
