import { gestorMusica } from './GestorMusica.js';

const DURACION_ESCENA_MS = 5200;
const DURACION_BIENVENIDA_MS = 10000;
const DURACION_REDUCIDA_MS = 1200;

export function iniciarAudioBienvenida({ reducido, alTerminar }) {
  const duracion = reducido ? DURACION_REDUCIDA_MS : DURACION_BIENVENIDA_MS;
  let tiempoVisible = 0;
  let desde = performance.now();
  let oculta = document.hidden;
  let limite;
  let terminada = false;
  let desuscribir = () => {};
  const liberar = gestorMusica.usarContextoTemporal('welcome', { reiniciar: true });
  const obtenerTiempo = () => tiempoVisible + (oculta ? 0 : performance.now() - desde);

  function limpiar() {
    clearTimeout(limite);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    desuscribir();
  }
  function finalizar() {
    if (terminada) return;
    terminada = true;
    limpiar();
    alTerminar();
  }
  function programar() {
    if (!oculta && !terminada) limite = setTimeout(finalizar, Math.max(0, duracion - obtenerTiempo()));
  }
  function alCambiarVisibilidad() {
    if (document.hidden === oculta) return;
    if (document.hidden) {
      tiempoVisible = obtenerTiempo();
      oculta = true;
      clearTimeout(limite);
    } else {
      desde = performance.now();
      oculta = false;
      programar();
    }
  }

  // La canción acompaña la escena, pero el reloj visible gobierna su duración.
  // Al ocultar la pestaña también se pausa la salida; el gestor pausa el audio.
  desuscribir = gestorMusica.suscribir(estado => {
    if (estado.contexto === 'welcome' && estado.finalizada) finalizar();
  });
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  programar();
  return {
    obtenerTiempo: () => Math.min(DURACION_ESCENA_MS, obtenerTiempo() * DURACION_ESCENA_MS / DURACION_BIENVENIDA_MS),
    obtenerDuracionSalida: () => 450 * DURACION_BIENVENIDA_MS / DURACION_ESCENA_MS,
    eliminar({ alNavegar = false } = {}) {
      terminada = true;
      limpiar();
      if (alNavegar) gestorMusica.establecerContexto('general');
      liberar();
    },
  };
}
