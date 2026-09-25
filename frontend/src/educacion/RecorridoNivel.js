import { CONFIGURACION_TRANSICION } from './ConfiguracionTransicion.js';
import './recorrido-nivel.css';

// Escena compartida de niveles, independiente del contenido educativo y del resultado.
export function crearRecorridoNivel({ variante, final = false }) {
  const elemento = document.createElement('div');
  elemento.className = 'metronet-recorrido-nivel';
  elemento.dataset.variante = variante;
  elemento.dataset.final = String(final);
  elemento.setAttribute('aria-hidden', 'true');
  elemento.innerHTML = `<svg viewBox="0 0 960 320" focusable="false">
    <path class="recorrido-ciudad" d="M0 164 H50 V118 H104 V164 H162 V92 H208 V164 H285 V132 H347 V164 H426 V72 H477 V164 H528 V109 H572 V164 H650 V130 H713 V164 H773 V86 H831 V164 H898 V119 H960"/>
    <g class="recorrido-anden"><path d="M30 246 H212 V262 H30 Z M748 246 H930 V262 H748 Z"/><path d="M42 82 H201 M54 82 V210 M189 82 V210 M759 82 H918 M771 82 V210 M906 82 V210"/></g>
    <path class="recorrido-riel" d="M45 220 H915 M45 232 H915"/>
    <path class="recorrido-linea" d="M124 283 H836" pathLength="100"/>
    <g class="recorrido-estaciones">${[124, 302, 480, 658, 836].map(x => `<circle cx="${x}" cy="283" r="8"/>`).join('')}</g>
    <g class="recorrido-senal"><rect x="69" y="94" width="110" height="29"/><text x="124" y="114">${variante === 'intro' ? 'SALIDA' : 'COMPLETADO'}</text></g>
    <g class="recorrido-destino"><rect x="781" y="94" width="110" height="29"/><text x="836" y="114">${final ? 'META' : 'DESTINO'}</text></g>
    <g class="recorrido-tren"><path class="recorrido-carroceria" d="M-82 202 V155 L-70 143 H58 L82 164 V202 Z"/>
      <path class="recorrido-ventanas" d="M-68 153 H-43 V174 H-68 Z M15 153 H40 V174 H15 Z M48 153 H57 L71 168 V174 H48 Z"/>
      <rect class="recorrido-interior" x="-31" y="151" width="34" height="49"/>
      <path class="recorrido-puerta recorrido-puerta--izquierda" d="M-31 151 H-14 V200 H-31 Z"/>
      <path class="recorrido-puerta recorrido-puerta--derecha" d="M-14 151 H3 V200 H-14 Z"/>
      <path class="recorrido-franja" d="M-82 186 H-35 M7 186 H81"/>
      <path class="recorrido-luz" d="M71 182 H79 V192 H71 Z"/>
      <path class="recorrido-ruedas" d="M-64 204 H-42 M39 204 H61"/>
    </g>
    <g class="recorrido-destellos"><path d="M108 46 V62 M100 54 H116 M855 40 V56 M847 48 H863 M482 103 V119 M474 111 H490"/></g>
  </svg>`;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const movil = matchMedia('(max-width: 600px)');
  const tren = elemento.querySelector('.recorrido-tren');
  const linea = elemento.querySelector('.recorrido-linea');
  const nodos = [...elemento.querySelectorAll('circle')];
  const svg = elemento.querySelector('svg');
  let frame = null, limite = null, terminado = false, iniciado = false;

  function destruir() {
    terminado = true;
    cancelAnimationFrame(frame);
    clearTimeout(limite);
    frame = limite = null;
  }

  function iniciar({ progreso, porcentaje, alAvanzar, alFinalizar }) {
    if (iniciado || terminado) return;
    iniciado = true;
    const inicio = performance.now();
    let ultimoPorcentaje = -1, falloVisual = false;
    function mostrar(tiempo) {
      const recorrido = Math.min(1, Math.max(0, (tiempo - CONFIGURACION_TRANSICION.salidaEn)
        / (CONFIGURACION_TRANSICION.llegadaEn - CONFIGURACION_TRANSICION.salidaEn)));
      const avance = recorrido * recorrido * (3 - 2 * recorrido);
      const entero = Math.floor(avance * 100);
      if (entero !== ultimoPorcentaje) {
        ultimoPorcentaje = entero;
        porcentaje.textContent = `${entero}%`;
        progreso.setAttribute('aria-valuenow', String(entero));
        progreso.style.setProperty('--avance', `${entero}%`);
      }
      // Un fallo del SVG no interrumpe la información ni la finalización del viaje.
      if (!falloVisual) try {
        linea.style.strokeDashoffset = String(100 - entero);
        nodos.forEach((nodo, i) => nodo.classList.toggle('activa', entero >= i * 25));
        tren.setAttribute('transform', `translate(${reducido ? (avance === 1 ? 836 : 124) : 124 + avance * 712} 0)`);
        const desplazamiento = reducido ? (avance === 1 ? 480 : 0) : avance * 480;
        svg.setAttribute('viewBox', movil.matches ? `${desplazamiento} 55 480 250` : '0 0 960 320');
        elemento.classList.toggle('metronet-recorrido-nivel--puertas', !reducido && tiempo < CONFIGURACION_TRANSICION.cerrarPuertasEn);
      } catch { falloVisual = true; }
      alAvanzar(tiempo);
    }
    function terminar() {
      if (terminado) return;
      destruir();
      try { mostrar(1); } catch { /* El contenido conserva su flujo ante un fallo visual. */ }
      alFinalizar();
    }
    function animar(ahora) {
      frame = null;
      if (terminado) return;
      const tiempo = Math.min(1, (ahora - inicio) / CONFIGURACION_TRANSICION.duracionMs);
      try {
        mostrar(tiempo);
        if (tiempo < 1) frame = requestAnimationFrame(animar);
      } catch { /* El límite independiente mantiene el avance. */ }
    }
    // La navegación nunca depende de recibir el último frame (pestaña oculta o fallo visual).
    limite = setTimeout(terminar, CONFIGURACION_TRANSICION.duracionMs);
    try { mostrar(0); frame = requestAnimationFrame(animar); } catch { /* Conserva el límite. */ }
  }
  return { elemento, iniciar, destruir };
}
