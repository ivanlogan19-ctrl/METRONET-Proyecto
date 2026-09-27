import { gestorMusica } from './GestorMusica.js';

// Reloj común de las presentaciones con una pista puntual. No evalúa niveles
// ni autentica usuarios: avisa al terminar el audio o al agotarse su respaldo.
export function iniciarAudioPresentacion({ contexto, inicio = performance.now(), duracionVisualMs,
  duracionAudioEstimadaMs, demoraSinAudioMs = duracionVisualMs, esperaMaximaMs, alTerminar,
  contextoAlFinalizar = 'transition' }) {
  let eliminada = false, finalizada = false, audioIniciado = false, sinAudio = false;
  let ultimaPosicion = 0;
  let desuscribir = () => {};
  let liberar = gestorMusica.usarContextoTemporal(contexto, { reiniciar: true });
  const finalizar = () => {
    if (eliminada || finalizada) return;
    finalizada = true;
    clearTimeout(limiteInicio); clearTimeout(limiteInactividad); desuscribir();
    // El resumen puede permanecer abierto. También ante un fallo, mantener
    // silencio hasta que su dueño lo cierre, sin reiniciar gameplay detrás.
    const mantenerSilencio = gestorMusica.usarContextoTemporal(contextoAlFinalizar);
    liberar(); liberar = mantenerSilencio;
    alTerminar();
  };
  let limiteInicio = setTimeout(finalizar, demoraSinAudioMs);
  let limiteInactividad = setTimeout(finalizar, esperaMaximaMs);
  desuscribir = gestorMusica.suscribir(estado => {
    if (eliminada || finalizada || estado.contexto !== contexto) return;
    sinAudio = estado.error || estado.esperandoGesto || estado.silenciado || estado.volumen === 0;
    if (estado.finalizada) { finalizar(); return; }
    if (estado.reproduciendo && !sinAudio) {
      audioIniciado = true;
      clearTimeout(limiteInicio); limiteInicio = null;
      // Una descarga o pausa temporal no consume el tiempo de la canción.
      // El respaldo limita un audio detenido, no una reproducción que avanza.
      if (estado.posicion > ultimaPosicion) {
        ultimaPosicion = estado.posicion;
        clearTimeout(limiteInactividad);
        limiteInactividad = setTimeout(finalizar, esperaMaximaMs);
      }
    } else if (sinAudio && limiteInicio === null) {
      limiteInicio = setTimeout(finalizar, Math.max(0, demoraSinAudioMs - (performance.now() - inicio)));
    }
  });
  function obtenerEscalaDuracion() {
    if (sinAudio) return demoraSinAudioMs / duracionVisualMs;
    const duracion = gestorMusica.obtenerEstado().duracion;
    return (Number.isFinite(duracion) && duracion > 0 ? duracion * 1000 : duracionAudioEstimadaMs) / duracionVisualMs;
  }
  return {
    obtenerEscalaDuracion,
    obtenerTiempo() {
      if (finalizada) return duracionVisualMs;
      if (sinAudio) return (performance.now() - inicio) / obtenerEscalaDuracion();
      return audioIniciado ? gestorMusica.obtenerEstado().posicion * 1000 / obtenerEscalaDuracion() : 0;
    },
    eliminar({ alNavegar = false } = {}) {
      if (eliminada) return;
      eliminada = true;
      clearTimeout(limiteInicio); clearTimeout(limiteInactividad); desuscribir();
      if (alNavegar) gestorMusica.establecerContexto('general');
      liberar();
    },
  };
}
