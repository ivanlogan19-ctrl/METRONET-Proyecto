import { CONFIGURACION_TRANSICION } from './ConfiguracionTransicion.js';
import { gestorMusica } from '../audio/GestorMusica.js';
import { crearRecorridoNivel } from './RecorridoNivel.js';
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
  ranking = null, signal,
} = {}) {
  victoriaActiva?.();
  if (signal?.aborted) return Promise.resolve(null);
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
  const animacion = crearRecorridoNivel({ variante: 'outro', final });
  const recorrido = animacion.elemento;
  recorrido.classList.add('metronet-victoria__recorrido');
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

  let cerrado = false, resolver;
  let liberarMusica = () => {};
  const finalizada = new Promise(resolve => { resolver = resolve; });
  const observador = new MutationObserver(() => { if (!dialogo.isConnected) cancelar(); });
  function terminar(accion = null) {
    if (cerrado) return;
    cerrado = true;
    animacion.destruir();
    observador.disconnect();
    window.removeEventListener('pagehide', cancelar);
    window.removeEventListener('popstate', cancelar);
    signal?.removeEventListener('abort', cancelar);
    dialogo.remove();
    liberarMusica();
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
  function finalizarRecorrido() {
    if (cerrado) return;
    if (final) {
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
    liberarMusica = gestorMusica.usarContextoTemporal('transition');
    document.body.append(dialogo); dialogo.showModal();
    titulo.focus({ preventScroll: true });
    victoriaActiva = cancelar;
    actualizarResumen(null);
    Promise.resolve(ranking).then(actualizarResumen).catch(() => {});
    window.addEventListener('pagehide', cancelar);
    window.addEventListener('popstate', cancelar);
    signal?.addEventListener('abort', cancelar, { once: true });
    observador.observe(document.body, { childList: true });
    animacion.iniciar({
      progreso, porcentaje,
      alAvanzar: tiempo => dialogo.classList.toggle('metronet-victoria--destino', reducido || tiempo >= CONFIGURACION_TRANSICION.revelarDestinoEn),
      alFinalizar: finalizarRecorrido,
    });
    return finalizada;
  } catch (error) { cancelar(); throw error; }
}
