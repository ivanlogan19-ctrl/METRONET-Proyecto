import { gestorMusica } from './GestorMusica.js';

// Reloj común de las presentaciones con una pista puntual. No evalúa niveles
// ni autentica usuarios: avisa al terminar el audio o al agotarse su respaldo.
export function iniciarAudioPresentacion({ contexto, inicio = performance.now(), duracionVisualMs,
  duracionAudioEstimadaMs, demoraSinAudioMs = duracionVisualMs, esperaMaximaMs, alTerminar }) {
  let eliminada = false, finalizada = false, audioIniciado = false, sinAudio = false;
  let desuscribir = () => {};
  let liberar = gestorMusica.usarContextoTemporal(contexto, { reiniciar: true });
  const finalizar = () => {
    if (eliminada || finalizada) return;
    finalizada = true;
    clearTimeout(limiteInicio); clearTimeout(limiteAbsoluto); desuscribir();
    // El resumen puede permanecer abierto. También ante un fallo, mantener
    // silencio hasta que su dueño lo cierre, sin reiniciar gameplay detrás.
    const mantenerSilencio = gestorMusica.usarContextoTemporal('transition');
    liberar(); liberar = mantenerSilencio;
    alTerminar();
  };
  let limiteInicio = setTimeout(finalizar, demoraSinAudioMs);
  const limiteAbsoluto = setTimeout(finalizar, esperaMaximaMs);
  desuscribir = gestorMusica.suscribir(estado => {
    if (eliminada || finalizada || estado.contexto !== contexto) return;
    sinAudio = estado.error || estado.esperandoGesto || estado.silenciado || estado.volumen === 0;
    if (estado.finalizada) { finalizar(); return; }
    if (estado.reproduciendo && !sinAudio) {
      audioIniciado = true;
      clearTimeout(limiteInicio); limiteInicio = null;
    } else if (sinAudio && limiteInicio === null) {
      limiteInicio = setTimeout(finalizar, Math.max(0, demoraSinAudioMs - (performance.now() - inicio)));
    }
  });
  function obtenerEscalaDuracion() {
    if (sinAudio) return 1;
    const duracion = gestorMusica.obtenerEstado().duracion;
    return (Number.isFinite(duracion) && duracion > 0 ? duracion * 1000 : duracionAudioEstimadaMs) / duracionVisualMs;
  }
  return {
    obtenerEscalaDuracion,
    obtenerTiempo() {
      if (finalizada) return duracionVisualMs;
      if (sinAudio) return performance.now() - inicio;
      return audioIniciado ? gestorMusica.obtenerEstado().posicion * 1000 / obtenerEscalaDuracion() : 0;
    },
    eliminar({ alNavegar = false } = {}) {
      if (eliminada) return;
      eliminada = true;
      clearTimeout(limiteInicio); clearTimeout(limiteAbsoluto); desuscribir();
      if (alNavegar) gestorMusica.establecerContexto('general');
      liberar();
    },
  };
}
