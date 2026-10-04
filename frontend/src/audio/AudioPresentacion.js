import { gestorMusica } from './GestorMusica.js';

// Reloj común de las presentaciones con una pista puntual. No evalúa niveles
// ni autentica usuarios: avisa al terminar el audio o el tiempo visible previsto.
export function iniciarAudioPresentacion({ contexto, inicio = performance.now(), duracionVisualMs,
  duracionAudioEstimadaMs, duracionMaximaMs, demoraSinAudioMs = duracionVisualMs, esperaMaximaMs, alTerminar,
  contextoAlFinalizar = 'transition' }) {
  const duracionVisible = Number.isFinite(duracionMaximaMs) && duracionMaximaMs > 0 ? duracionMaximaMs : null;
  let eliminada = false, finalizada = false, audioIniciado = false, sinAudio = false;
  let ultimaPosicion = 0;
  let tiempoVisible = 0, desde = performance.now(), oculta = document.hidden, limiteDuracion = null;
  let desuscribir = () => {};
  let liberar = gestorMusica.usarContextoTemporal(contexto, { reiniciar: true });
  const obtenerTiempoVisible = () => tiempoVisible + (oculta ? 0 : performance.now() - desde);
  const programarDuracion = () => {
    if (duracionVisible && !oculta && !finalizada && !eliminada)
      limiteDuracion = setTimeout(finalizar, Math.max(0, duracionVisible - obtenerTiempoVisible()));
  };
  const alCambiarVisibilidad = () => {
    if (document.hidden === oculta) return;
    clearTimeout(limiteDuracion);
    if (document.hidden) { tiempoVisible = obtenerTiempoVisible(); oculta = true; }
    else { desde = performance.now(); oculta = false; programarDuracion(); }
  };
  const limpiar = () => {
    clearTimeout(limiteInicio); clearTimeout(limiteInactividad); clearTimeout(limiteDuracion);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    desuscribir();
  };
  const finalizar = () => {
    if (eliminada || finalizada) return;
    if (duracionVisible && document.hidden) { alCambiarVisibilidad(); return; }
    finalizada = true;
    limpiar();
    // El resumen puede permanecer abierto. También ante un fallo, mantener
    // silencio hasta que su dueño lo cierre, sin reiniciar gameplay detrás.
    const mantenerSilencio = gestorMusica.usarContextoTemporal(contextoAlFinalizar);
    liberar(); liberar = mantenerSilencio;
    alTerminar();
  };
  let limiteInicio = duracionVisible ? null : setTimeout(finalizar, demoraSinAudioMs);
  let limiteInactividad = duracionVisible ? null : setTimeout(finalizar, esperaMaximaMs);
  desuscribir = gestorMusica.suscribir(estado => {
    if (eliminada || finalizada || estado.contexto !== contexto) return;
    sinAudio = estado.error || estado.esperandoGesto || estado.silenciado || estado.volumen === 0;
    if (estado.finalizada) { finalizar(); return; }
    if (duracionVisible) return;
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
  if (duracionVisible) { document.addEventListener('visibilitychange', alCambiarVisibilidad); programarDuracion(); }
  function obtenerEscalaDuracion() {
    if (sinAudio) return demoraSinAudioMs / duracionVisualMs;
    const duracion = gestorMusica.obtenerEstado().duracion;
    return (Number.isFinite(duracion) && duracion > 0 ? duracion * 1000 : duracionAudioEstimadaMs) / duracionVisualMs;
  }
  return {
    obtenerEscalaDuracion,
    obtenerTiempo() {
      if (finalizada) return duracionVisualMs;
      if (duracionVisible) return Math.min(duracionVisualMs, obtenerTiempoVisible() * duracionVisualMs / duracionVisible);
      if (sinAudio) return (performance.now() - inicio) / obtenerEscalaDuracion();
      return audioIniciado ? gestorMusica.obtenerEstado().posicion * 1000 / obtenerEscalaDuracion() : 0;
    },
    eliminar({ alNavegar = false } = {}) {
      if (eliminada) return;
      eliminada = true;
      limpiar();
      if (alNavegar) gestorMusica.establecerContexto('general');
      liberar();
    },
  };
}
