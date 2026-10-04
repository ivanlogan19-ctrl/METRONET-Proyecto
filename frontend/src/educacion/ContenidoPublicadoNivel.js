import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { limpiarTarjetasPublicadas, registrarTarjetasPublicadas } from './TarjetasEducativasNivel.js';

const cache = new Map();

export async function cargarContenidoPublicado(numero, { idIntento = null, signal } = {}) {
  if (!Number.isInteger(numero) || numero < 1 || numero > 10) return null;
  const sesion = obtenerSesionActiva();
  if (!sesion?.token) return null;
  const clave = `${sesion.usuario?.idUsuario ?? 'sesion'}:${idIntento ?? `actual:${numero}`}`;
  // La publicación vigente puede cambiar mientras esta página sigue abierta.
  if (idIntento && cache.has(clave)) {
    const contenido = cache.get(clave);
    registrarTarjetasPublicadas(numero, contenido, sesion.usuario?.idUsuario, idIntento);
    return contenido;
  }
  const ruta = idIntento ? `/intentos/${idIntento}/contenido` : `/niveles/${numero}/contenido`;
  const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego${ruta}`, {
    signal, headers: { Authorization: `Bearer ${sesion.token}` },
  });
  if (!respuesta.ok) {
    if (idIntento) limpiarTarjetasPublicadas(numero);
    throw new Error(respuesta.status === 404
      ? 'El contenido de esta partida no está disponible.' : 'No se pudo cargar el contenido publicado.');
  }
  const contenido = await respuesta.json();
  if (contenido.numero !== numero || !Array.isArray(contenido.tarjetas) || contenido.tarjetas.length !== 6) {
    if (idIntento) limpiarTarjetasPublicadas(numero);
    throw new Error('El contenido publicado está incompleto.');
  }
  cache.set(clave, contenido);
  registrarTarjetasPublicadas(numero, contenido, sesion.usuario?.idUsuario, idIntento);
  return contenido;
}

export function contenidoPublicadoEnCache(numero, idIntento = null) {
  const sesion = obtenerSesionActiva();
  if (!sesion) return null;
  return cache.get(`${sesion.usuario?.idUsuario ?? 'sesion'}:${idIntento ?? `actual:${numero}`}`) ?? null;
}

export function invalidarContenidoActual(numero) {
  const sesion = obtenerSesionActiva();
  if (sesion) cache.delete(`${sesion.usuario?.idUsuario ?? 'sesion'}:actual:${numero}`);
}
