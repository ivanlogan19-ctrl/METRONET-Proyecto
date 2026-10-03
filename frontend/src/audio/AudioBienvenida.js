import { iniciarAudioPresentacion } from './AudioPresentacion.js';

export function iniciarAudioBienvenida({ reducido, inicio, alTerminar }) {
  const audio = iniciarAudioPresentacion({
    contexto: 'welcome', inicio, alTerminar,
    duracionVisualMs: 5200, duracionAudioEstimadaMs: 32575,
    demoraSinAudioMs: reducido ? 1200 : 5200, esperaMaximaMs: 16000,
  });
  return { ...audio, obtenerDuracionSalida: () => 450 * audio.obtenerEscalaDuracion() };
}
