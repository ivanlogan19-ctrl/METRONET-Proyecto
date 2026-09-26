import { consultarJuego } from './ClientePuntuacion.js';

export async function consultarEstadoAnterior(idEscenario) {
  if (idEscenario == null) return {};
  try {
    const progreso = await consultarJuego('/progreso');
    return { progresoAnterior: progreso, mejorPuntajeAnterior: progreso?.escenarios?.find(e => e.idEscenario === idEscenario)?.mejorPuntaje };
  } catch { return {}; } // Sin referencia fiable no se anuncia récord ni cierre nuevo.
}

export function obtenerModoLibreTrasRecorrido(antes, despues, idEscenario) {
  if (!antes || antes.campanaCompletada !== false || despues?.campanaCompletada !== true
    || antes.numeroCampanaActual !== despues.numeroCampanaActual) return null;
  const niveles = despues.escenarios.filter(e => Number.isInteger(e.numero)).sort((a, b) => a.numero - b.numero);
  const previos = antes.escenarios?.filter(e => Number.isInteger(e.numero)) ?? [];
  const completo = e => e?.completadoEnCampanaActual ?? e?.estado === 'COMPLETADO';
  if (!niveles.length || niveles.length !== previos.length || niveles.at(-1).idEscenario !== idEscenario) return null;
  if (!niveles.every(e => completo(e) && previos.some(p => p.idEscenario === e.idEscenario && p.numero === e.numero))) return null;
  if (!previos.every(e => e.idEscenario === idEscenario ? !completo(e) : completo(e))) return null;
  return despues.escenarios.find(e => e.numero === null && e.desbloqueado) ?? null;
}
// La transición es opcional; un fallo de contenido nunca invalida el resultado persistido.
export async function presentarResultadoNivel(progreso, idEscenario, evaluacion, opciones = {}) {
  if (!evaluacion?.completado || !Array.isArray(progreso?.escenarios)) return null;
  const anterior = progreso.escenarios.find(e => e.idEscenario === idEscenario && e.estado === 'COMPLETADO');
  if (!anterior || !Number.isInteger(anterior.numero)) return null;
  const siguiente = progreso.escenarios.find(e => e.idEscenario === evaluacion.idSiguienteEscenario
    && Number.isInteger(e.numero) && e.desbloqueado);
  const final = !evaluacion.idSiguienteEscenario && anterior.numero === Math.max(...progreso.escenarios.filter(e => Number.isInteger(e.numero)).map(e => e.numero));
  const modoLibre = final ? obtenerModoLibreTrasRecorrido(opciones.progresoAnterior, progreso, idEscenario) : null;
  try {
    const { mostrarTransicionNivel } = await import('./PantallaTransicionNivel.js');
    // La consulta de ranking no retrasa ni bloquea la celebración.
    const ranking = final ? consultarJuego('/ranking').catch(() => null) : null;
    const accion = await mostrarTransicionNivel(anterior, siguiente, {
      ...opciones, puntaje: evaluacion.puntaje, desempeno: evaluacion.desempeno, resumen: progreso, ranking, final, modoLibre,
    });
    if (accion === 'siguiente') return { siguiente };
    if (accion === 'modoLibre') return { siguiente: modoLibre, celebrarRecorrido: true };
    if (accion === 'selector') return { destino: '/escenarios.html' };
    if (accion === 'ranking') return { destino: '/ranking.html' };
    return null;
  } catch { return null; }
}
