import { iniciarAudioPresentacion } from '../audio/AudioPresentacion.js';
import { CONFIGURACION_TRANSICION as TIEMPOS } from './ConfiguracionTransicion.js';
import './identificacion-nivel.css';

// Viaje y cartel comparten documento, reproductor y reloj. La navegación ocurre
// después de ended; nunca se intenta reconstruir el audio entre estas dos fases.
export function crearPresentacionMusicalNivel({ dialogo, contexto, titulo, subtitulo,
  puedeMostrarCartel = () => true, alTerminar }) {
  const cartel = document.createElement('section');
  cartel.className = 'metronet-cartel-transicion';
  cartel.hidden = true;
  cartel.setAttribute('role', 'status');
  const texto = document.createElement('div');
  texto.className = 'metronet-identificacion__cartel';
  const nombre = document.createElement('strong');
  nombre.textContent = titulo;
  texto.append(nombre);
  if (subtitulo) {
    const detalle = document.createElement('p');
    detalle.textContent = subtitulo;
    texto.append(detalle);
  }
  cartel.append(texto);
  dialogo.append(cartel);
  let presentada = false;
  function actualizar(tiempo) {
    const visible = tiempo >= TIEMPOS.cartelEn && puedeMostrarCartel();
    if (visible) presentada = true;
    cartel.hidden = !visible;
    dialogo.classList.toggle('metronet-transicion--cartel', visible);
  }
  const audio = iniciarAudioPresentacion({
    contexto, duracionVisualMs: TIEMPOS.duracionMs,
    duracionMaximaMs: TIEMPOS.duracionVisibleMs,
    duracionAudioEstimadaMs: TIEMPOS.audioNivelEstimadoMs,
    demoraSinAudioMs: TIEMPOS.audioNivelEstimadoMs,
    esperaMaximaMs: TIEMPOS.esperaMaximaAudioMs,
    contextoAlFinalizar: 'general',
    alTerminar() { actualizar(1); alTerminar(); },
  });
  return {
    get identificacionPresentada() { return presentada; },
    obtenerTiempo: () => Math.min(1, audio.obtenerTiempo() / TIEMPOS.duracionMs),
    actualizar,
    detenerAudio() { audio.eliminar(); },
    ocultarCartel() { cartel.hidden = true; dialogo.classList.remove('metronet-transicion--cartel'); },
    eliminar() { audio.eliminar(); cartel.remove(); dialogo.classList.remove('metronet-transicion--cartel'); },
  };
}
