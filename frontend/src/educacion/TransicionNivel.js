import { consultarJuego } from './ClientePuntuacion.js';
// La transición es opcional; un fallo de contenido nunca invalida el resultado persistido.
export function obtenerAnteriorCompletado(escenario, escenarios = []) {
  if (escenario?.estado !== 'DISPONIBLE' || !Number.isInteger(escenario.numero)) return null;
  return escenarios.find(e => e.numero === escenario.numero - 1 && e.estado === 'COMPLETADO') ?? null;
}

export async function presentarResultadoNivel(progreso, idEscenario, evaluacion) {
  if (!evaluacion?.completado || !Array.isArray(progreso?.escenarios)) return null;
  const anterior = progreso.escenarios.find(e => e.idEscenario === idEscenario && e.estado === 'COMPLETADO');
  if (!anterior || !Number.isInteger(anterior.numero)) return null;
  const siguiente = progreso.escenarios.find(e => e.idEscenario === evaluacion.idSiguienteEscenario
    && e.desbloqueado && e.estado !== 'COMPLETADO');
  try {
    const { mostrarTransicionNivel } = await import('./PantallaTransicionNivel.js');
    let ranking = null;
    if (progreso.campanaCompletada && !evaluacion.idSiguienteEscenario) {
      try { ranking = await consultarJuego('/ranking'); } catch { /* El cierre sigue disponible si falla el ranking. */ }
    }
    const continuar = await mostrarTransicionNivel(anterior, siguiente, {
      puntaje: evaluacion.puntaje, desempeno: evaluacion.desempeno, resumen: progreso, ranking, final: progreso.campanaCompletada && !evaluacion.idSiguienteEscenario,
    });
    return continuar ? { siguiente: siguiente ?? null } : null;
  } catch { return null; }
}
