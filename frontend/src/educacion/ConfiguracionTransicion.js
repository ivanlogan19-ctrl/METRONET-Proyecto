// El recorrido se normaliza a 1800 ms; la presentación dura la canción completa.
// Sin sonido conserva su duración estimada. El límite de audio mide inactividad.
export const CONFIGURACION_TRANSICION = Object.freeze({
  duracionMs: 1800,
  identificacionMs: 1000,
  audioNivelEstimadoMs: 14968,
  esperaMaximaAudioMs: 20000,
  cartelEn: 0.78,
  salidaEn: 0.06,
  cerrarPuertasEn: 0.04,
  llegadaEn: 0.94,
  revelarConsignaEn: 0,
  revelarDestinoEn: 0,
});

export const MENSAJES_TRANSICION = Object.freeze({
  accion: 'Jugar',
  entrada: 'Entrarás al terminar la música. Pulsá Jugar para comenzar ahora.',
});
