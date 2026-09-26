import { obtenerSesionActiva } from '../autenticacion/sesion.js';

const CLAVE = 'metronet:identificacion-presentada';
let local = null;

// Solo evita repetir un cartel ya mostrado. No transporta permisos ni progreso.
export function registrarIdentificacionPresentada(inicio) {
  local = { idDiseno: inicio.idDiseno, idEscenario: inicio.idEscenario,
    usuario: obtenerSesionActiva()?.usuario?.idUsuario, instante: Date.now() };
  try { sessionStorage.setItem(CLAVE, JSON.stringify(local)); } catch { /* Respaldo en este documento. */ }
}

export function consumirIdentificacionPresentada(idDiseno, idEscenario) {
  const mismoDocumento = Boolean(local);
  let dato = local;
  local = null;
  try { dato ??= JSON.parse(sessionStorage.getItem(CLAVE)); sessionStorage.removeItem(CLAVE); } catch { /* Presentación opcional. */ }
  const navegacion = performance.getEntriesByType('navigation')[0]?.type;
  return dato?.idDiseno === idDiseno && dato.idEscenario === idEscenario
    && dato.usuario === obtenerSesionActiva()?.usuario?.idUsuario
    && Date.now() - dato.instante >= 0 && Date.now() - dato.instante < 30000
    && (mismoDocumento || !['reload', 'back_forward'].includes(navegacion));
}
