import { consultarJuego } from './ClientePuntuacion.js';

export async function consultarMejorPuntajeAnterior(idEscenario) {
  if (idEscenario == null) return undefined;
  try {
    const progreso = await consultarJuego('/progreso');
    return progreso?.escenarios?.find(e => e.idEscenario === idEscenario)?.mejorPuntaje;
  } catch { return undefined; } // Sin referencia fiable no se anuncia un récord.
}
// La transición es opcional; un fallo de contenido nunca invalida el resultado persistido.
export async function presentarResultadoNivel(progreso, idEscenario, evaluacion, opciones = {}) {
  if (!evaluacion?.completado || !Array.isArray(progreso?.escenarios)) return null;
  const anterior = progreso.escenarios.find(e => e.idEscenario === idEscenario && e.estado === 'COMPLETADO');
  if (!anterior || !Number.isInteger(anterior.numero)) return null;
  const siguiente = progreso.escenarios.find(e => e.idEscenario === evaluacion.idSiguienteEscenario
    && Number.isInteger(e.numero) && e.desbloqueado);
  const final = !evaluacion.idSiguienteEscenario && anterior.numero === Math.max(...progreso.escenarios.filter(e => Number.isInteger(e.numero)).map(e => e.numero));
  try {
    const { mostrarTransicionNivel } = await import('./PantallaTransicionNivel.js');
    // La consulta de ranking no retrasa ni bloquea la celebración.
    const ranking = final ? consultarJuego('/ranking').catch(() => null) : null;
    const accion = await mostrarTransicionNivel(anterior, siguiente, {
      ...opciones, puntaje: evaluacion.puntaje, desempeno: evaluacion.desempeno, resumen: progreso, ranking, final,
    });
    if (accion === 'siguiente') return { siguiente };
    if (accion === 'selector') return { destino: '/escenarios.html' };
    if (accion === 'ranking') return { destino: '/ranking.html' };
    return null;
  } catch { return null; }
}
