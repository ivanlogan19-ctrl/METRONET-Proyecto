// El recorrido se normaliza a 1800 ms y se muestra durante 11 s visibles.
// La música suena a velocidad normal y se desvanece al concluir el viaje.
export const CONFIGURACION_TRANSICION = Object.freeze({
  duracionMs: 1800,
  duracionVisibleMs: 11000,
  identificacionMs: 1000,
  audioNivelEstimadoMs: 13767,
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
  entrada: 'Entrarás al terminar el recorrido. Pulsá Jugar para comenzar ahora.',
});
