import { CONFIGURACION_VICTORIA } from './ConfiguracionTransicion.js';
import './victoria-nivel.css';

let victoriaActiva = null;
const FELICITACIONES = ['¡Excelente trabajo!', '¡Red resuelta!', '¡Conexión establecida!'];

function texto(etiqueta, valor, clase = '') {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = valor;
  elemento.className = clase;
  return elemento;
}

// Presenta datos ya evaluados por el servidor; no registra puntos ni desbloqueos.
export function mostrarTransicionNivel(anterior, siguiente, {
  puntaje, mejorPuntajeAnterior, final = false, desempeno = null, resumen = null,
  ranking = null, signal, duracionMs = CONFIGURACION_VICTORIA.duracionMs,
} = {}) {
  victoriaActiva?.();
  if (signal?.aborted) return Promise.resolve(null);
  const duracion = Number.isFinite(duracionMs) && duracionMs > 0 ? duracionMs : CONFIGURACION_VICTORIA.duracionMs;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const focoAnterior = document.activeElement;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-cambios metronet-victoria';
  dialogo.classList.toggle('metronet-victoria--final', final);
  dialogo.dataset.movimientoReducido = String(reducido);
  dialogo.setAttribute('aria-labelledby', 'tituloVictoriaNivel');
  const cuerpo = texto('section', '', 'metronet-victoria__contenido');
  const cabecera = texto('header', '', 'metronet-victoria__cabecera');
  const titulo = texto('h2', final ? 'Nivel final completado' : 'Nivel completado');
  titulo.id = 'tituloVictoriaNivel'; titulo.tabIndex = -1;
  cabecera.append(texto('p', FELICITACIONES[Math.floor(Math.random() * FELICITACIONES.length)], 'metronet-victoria__felicitacion'), titulo,
    texto('p', anterior.nombre || `Nivel ${anterior.numero}`));
  const recorrido = texto('div', '', 'metronet-victoria__recorrido');
  recorrido.setAttribute('aria-hidden', 'true');
  // Geometría original: dos andenes, estaciones intermedias y un metro con puertas.
  recorrido.innerHTML = `<svg viewBox="0 0 960 320" focusable="false">
    <path class="victoria-ciudad" d="M0 164 H50 V118 H104 V164 H162 V92 H208 V164 H285 V132 H347 V164 H426 V72 H477 V164 H528 V109 H572 V164 H650 V130 H713 V164 H773 V86 H831 V164 H898 V119 H960"/>
    <g class="victoria-anden"><path d="M30 246 H212 V262 H30 Z M748 246 H930 V262 H748 Z"/><path d="M42 82 H201 M54 82 V210 M189 82 V210 M759 82 H918 M771 82 V210 M906 82 V210"/></g>
    <path class="victoria-riel" d="M45 220 H915 M45 232 H915"/>
    <path class="victoria-linea" d="M124 283 H836" pathLength="100"/>
    <g class="victoria-estaciones">${[124, 302, 480, 658, 836].map(x => `<circle cx="${x}" cy="283" r="8"/>`).join('')}</g>
    <g class="victoria-senal"><rect x="69" y="94" width="110" height="29"/><text x="124" y="114">COMPLETADO</text></g>
    <g class="victoria-destino"><rect x="781" y="94" width="110" height="29"/><text x="836" y="114">${final ? 'META' : 'DESTINO'}</text></g>
    <g class="victoria-tren"><path class="victoria-carroceria" d="M-82 202 V155 L-70 143 H58 L82 164 V202 Z"/>
      <path class="victoria-ventanas" d="M-68 153 H-43 V174 H-68 Z M15 153 H40 V174 H15 Z M48 153 H57 L71 168 V174 H48 Z"/>
      <rect class="victoria-interior" x="-31" y="151" width="34" height="49"/>
      <path class="victoria-puerta victoria-puerta--izquierda" d="M-31 151 H-14 V200 H-31 Z"/>
      <path class="victoria-puerta victoria-puerta--derecha" d="M-14 151 H3 V200 H-14 Z"/>
      <path class="victoria-franja" d="M-82 186 H-35 M7 186 H81"/>
      <path class="victoria-luz" d="M71 182 H79 V192 H71 Z"/>
      <path class="victoria-ruedas" d="M-64 204 H-42 M39 204 H61"/>
    </g>
    <g class="victoria-destellos"><path d="M108 46 V62 M100 54 H116 M855 40 V56 M847 48 H863 M482 103 V119 M474 111 H490"/></g>
  </svg>`;
  const estaciones = texto('div', '', 'metronet-victoria__estaciones');
  estaciones.append(texto('span', `SALIDA · NIVEL ${anterior.numero}`), texto('span', final ? 'FIN DEL RECORRIDO' : siguiente ? `DESTINO · NIVEL ${siguiente.numero}` : 'RED COMPLETADA'));
  recorrido.append(estaciones);
  const resultado = texto('p', '', 'metronet-victoria__resultado');
  if (Number.isFinite(puntaje)) {
    const maximo = desempeno?.puntajeMaximo ?? anterior.puntajeMaximo;
    resultado.append(texto('strong', `${puntaje}${Number.isFinite(maximo) ? ` / ${maximo}` : ''} PTS`));
    if (Number.isFinite(mejorPuntajeAnterior) && puntaje > mejorPuntajeAnterior) {
      resultado.append(texto('span', 'Nuevo récord personal', 'metronet-victoria__record'));
    }
  } else resultado.textContent = 'Tu resultado quedó registrado.';
  const progreso = texto('div', '', 'metronet-victoria__progreso');
  progreso.setAttribute('role', 'progressbar');
  progreso.setAttribute('aria-label', 'Progreso del viaje de victoria');
  progreso.setAttribute('aria-valuemin', '0'); progreso.setAttribute('aria-valuemax', '100');
  const porcentaje = texto('span', '0%');
  progreso.append(texto('span', final ? 'RECORRIDO FINAL' : 'PREPARANDO SIGUIENTE ESTACIÓN'), porcentaje);
  const destino = texto('div', '', 'metronet-victoria__destino');
  destino.append(texto('p', siguiente ? `Próxima estación · Nivel ${siguiente.numero}` : final ? 'Llegaste al final de la línea' : 'Elegí tu próximo recorrido'),
    texto('p', siguiente?.objetivo || siguiente?.nombre || 'Tu red forma parte del recorrido de METRONET.'));
  const estado = texto('p', 'Viaje de transición. El próximo desafío comenzará automáticamente.', 'metronet-victoria__estado');
  estado.setAttribute('role', 'status');
  if (!siguiente) estado.textContent = final ? 'Al llegar verás el resumen del recorrido.' : 'Al llegar volverás al selector de niveles.';
  const cierre = texto('section', '', 'metronet-victoria__resumen'); cierre.hidden = true;
  const resumenTitulo = texto('h3', resumen?.campanaCompletada ? '¡Campaña completada!' : 'Resumen del recorrido');
  resumenTitulo.tabIndex = -1;
  const totales = texto('p', '');
  const posicion = texto('p', '');
  const clasificacion = texto('button', 'Ver desempeño y ranking', 'metronet-boton--primario'); clasificacion.type = 'button';
  cierre.append(resumenTitulo, totales, posicion, clasificacion);
  const acciones = texto('footer', '', 'metronet-victoria__acciones');
  const seleccionar = texto('button', 'Seleccionar nivel'); seleccionar.type = 'button';
  const revisar = texto('button', 'Revisar mi red'); revisar.type = 'button';
  acciones.append(seleccionar, revisar);
  cuerpo.append(cabecera, recorrido, resultado, progreso, destino, estado, cierre, acciones);
  dialogo.append(cuerpo);

  let cerrado = false, frame = null, resolver, ultimoPorcentaje = -1;
  const finalizada = new Promise(resolve => { resolver = resolve; });
  const tren = recorrido.querySelector('.victoria-tren');
  const linea = recorrido.querySelector('.victoria-linea');
  const nodos = [...recorrido.querySelectorAll('circle')];
  const observador = new MutationObserver(() => { if (!dialogo.isConnected) cancelar(); });
  function terminar(accion = null) {
    if (cerrado) return;
    cerrado = true;
    cancelAnimationFrame(frame);
    observador.disconnect();
    window.removeEventListener('pagehide', cancelar);
    window.removeEventListener('popstate', cancelar);
    signal?.removeEventListener('abort', cancelar);
    dialogo.remove();
    if (victoriaActiva === cancelar) victoriaActiva = null;
    if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
    resolver(accion);
  }
  function cancelar() { terminar(); }
  function actualizarResumen(datos) {
    if (cerrado) return;
    const niveles = resumen?.escenarios?.filter(n => Number.isInteger(n.numero)) ?? [];
    const total = Number.isFinite(datos?.puntajeTotal) ? datos.puntajeTotal : niveles.reduce((s, n) => s + (n.mejorPuntaje ?? 0), 0);
    const maximo = Number.isFinite(datos?.puntajeMaximo) ? datos.puntajeMaximo : niveles.reduce((s, n) => s + (n.puntajeMaximo ?? 0), 0);
    totales.textContent = `${resumen?.nivelesCompletados ?? 0} / ${resumen?.cantidadNiveles ?? niveles.length} niveles completados · ${total}${maximo ? ` / ${maximo}` : ''} puntos acumulados.`;
    posicion.textContent = datos?.tuPosicion ? `Tu posición: ${datos.tuPosicion}.` : 'Consultá tus mejores resultados en el ranking.';
  }
  function mostrarProgreso(fraccion) {
    const entero = Math.floor(fraccion * 100);
    if (entero !== ultimoPorcentaje) {
      ultimoPorcentaje = entero;
      porcentaje.textContent = `${entero}%`;
      progreso.setAttribute('aria-valuenow', String(entero));
      progreso.style.setProperty('--avance', `${entero}%`);
      linea.style.strokeDashoffset = String(100 - entero);
      nodos.forEach((nodo, i) => nodo.classList.toggle('activa', entero >= i * 25));
    }
    tren.setAttribute('transform', `translate(${reducido ? (fraccion === 1 ? 836 : 124) : 124 + fraccion * 712} 0)`);
    // En móvil la cámara acompaña al tren y mantiene su tamaño legible.
    const desplazamiento = reducido ? (fraccion === 1 ? 480 : 0) : fraccion * 480;
    recorrido.querySelector('svg').setAttribute('viewBox', matchMedia('(max-width: 600px)').matches ? `${desplazamiento} 55 480 250` : '0 0 960 320');
  }
  const inicio = performance.now();
  function animar(ahora) {
    frame = null;
    if (cerrado) return;
    if (!dialogo.isConnected) { cancelar(); return; }
    const tiempo = Math.min(1, (ahora - inicio) / duracion);
    // Puertas y señal de victoria antes de salir; recorrido y porcentaje comparten avance.
    const recorridoActual = Math.min(1, Math.max(0, (tiempo - 0.16) / (CONFIGURACION_VICTORIA.llegadaEn - 0.16)));
    const avance = recorridoActual * recorridoActual * (3 - 2 * recorridoActual);
    dialogo.classList.toggle('metronet-victoria--puertas', !reducido && tiempo < 0.12);
    dialogo.classList.toggle('metronet-victoria--destino', reducido || tiempo >= CONFIGURACION_VICTORIA.revelarDestinoEn);
    mostrarProgreso(avance);
    if (tiempo < 1) frame = requestAnimationFrame(animar);
    else if (final) {
      dialogo.classList.add('metronet-victoria--llegada');
      cierre.hidden = false; destino.hidden = true;
      estado.textContent = 'Llegaste a destino. Podés consultar el ranking o elegir otro nivel.';
      resumenTitulo.focus({ preventScroll: true });
    } else terminar(siguiente ? 'siguiente' : 'selector');
  }
  seleccionar.addEventListener('click', () => terminar('selector'));
  revisar.addEventListener('click', cancelar);
  clasificacion.addEventListener('click', () => terminar('ranking'));
  dialogo.addEventListener('cancel', e => { e.preventDefault(); cancelar(); });
  dialogo.addEventListener('close', cancelar);
  try {
    document.body.append(dialogo); dialogo.showModal();
    titulo.focus({ preventScroll: true });
    victoriaActiva = cancelar;
    actualizarResumen(null);
    Promise.resolve(ranking).then(actualizarResumen).catch(() => {});
    mostrarProgreso(0);
    window.addEventListener('pagehide', cancelar);
    window.addEventListener('popstate', cancelar);
    signal?.addEventListener('abort', cancelar, { once: true });
    observador.observe(document.body, { childList: true });
    frame = requestAnimationFrame(animar);
    return finalizada;
  } catch (error) { cancelar(); throw error; }
}
