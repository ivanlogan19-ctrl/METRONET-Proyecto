import { obtenerContenidoNivel } from './ContenidoPreparacion.js';
import { seleccionarMensajeTransicion } from './MensajesTransicion.js';
import { CONFIGURACION_TRANSICION } from './ConfiguracionTransicion.js';
import { crearLogoMetronet } from '../componentes/LogoMetronet.js';
import './transicion-nivel.css';

let transicionActiva = null;

function texto(etiqueta, valor, clase = '') {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = valor;
  elemento.className = clase;
  return elemento;
}

// La promesa solo representa el viaje visual. El llamador espera además los datos reales.
export function crearPreparacionNivel(escenario) {
  transicionActiva?.cerrar();
  const contenido = obtenerContenidoNivel(escenario.numero);
  const mensaje = seleccionarMensajeTransicion(escenario.numero);
  const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const focoAnterior = document.activeElement;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-cambios metronet-preparacion metronet-viaje';
  dialogo.setAttribute('aria-labelledby', 'tituloPreparacionNivel');
  dialogo.dataset.movimientoReducido = String(movimientoReducido);
  const cuerpo = document.createElement('section');
  cuerpo.className = 'metronet-dialogo-cambios__contenido metronet-viaje__contenido';
  const cabecera = document.createElement('header');
  cabecera.className = 'metronet-viaje__cabecera';
  cabecera.append(crearLogoMetronet(), texto('span', `NIVEL ${escenario.numero}`, 'metronet-viaje__nivel'));
  const titulo = texto('h2', escenario.nombre || `Nivel ${escenario.numero}`);
  titulo.id = 'tituloPreparacionNivel';
  titulo.tabIndex = -1;
  const recorrido = document.createElement('div');
  recorrido.className = 'metronet-viaje__recorrido';
  recorrido.setAttribute('aria-hidden', 'true');
  // Riel azul, nodos y metro con ventanas: geometría liviana en el lenguaje del mapa.
  recorrido.innerHTML = `<svg viewBox="0 0 560 100" focusable="false">
    <path class="metronet-viaje__riel" d="M30 62 H530"/>
    <path class="metronet-viaje__linea" d="M30 62 H530" pathLength="100"/>
    <g class="metronet-viaje__estaciones">${[30, 155, 280, 405, 530].map(x => `<circle cx="${x}" cy="62" r="8"/>`).join('')}</g>
    <g class="metronet-viaje__metro"><path d="M-23 47 V24 H15 L23 32 V47 Z"/>
      <path class="metronet-viaje__ventanas" d="M-16 29 H-5 V37 H-16 Z M2 29 H12 L17 34 V37 H2 Z"/>
      <path class="metronet-viaje__ruedas" d="M-16 48 H-8 M8 48 H16"/>
    </g>
  </svg>`;
  const progreso = document.createElement('div');
  progreso.className = 'metronet-viaje__progreso';
  progreso.setAttribute('role', 'progressbar');
  progreso.setAttribute('aria-label', 'Progreso del viaje visual');
  progreso.setAttribute('aria-valuemin', '0');
  progreso.setAttribute('aria-valuemax', '100');
  const porcentaje = texto('span', '0%', 'metronet-viaje__porcentaje');
  progreso.append(texto('span', 'RUMBO AL PRÓXIMO DESAFÍO'), porcentaje);
  const dato = document.createElement('section');
  dato.className = 'metronet-viaje__dato';
  dato.dataset.mensajeId = mensaje.id;
  dato.append(texto('h3', mensaje.categoria), texto('p', mensaje.texto));
  const consigna = document.createElement('section');
  consigna.className = 'metronet-viaje__consigna';
  consigna.append(texto('h3', 'Tu desafío'), texto('p', escenario.objetivo || escenario.instrucciones || contenido?.objetivo || 'Explorá el mapa y revisá la consigna de tu red.'));
  const estado = texto('p', 'Entrarás automáticamente al terminar el viaje.', 'metronet-viaje__estado');
  estado.setAttribute('role', 'status');
  const acciones = document.createElement('div');
  acciones.className = 'metronet-dialogo-cambios__acciones';
  const volver = texto('button', 'Volver');
  volver.type = 'button';
  const leer = texto('button', 'Leer sin prisa');
  leer.type = 'button';
  leer.setAttribute('aria-pressed', 'false');
  acciones.append(volver, leer);
  cuerpo.append(cabecera, titulo, recorrido, progreso, dato, consigna, estado, acciones);
  dialogo.append(cuerpo);

  let frame = null, pausaFinal = null, cerrado = false, cancelada = false;
  let retenerLectura = false, recorridoTerminado = false, datosListos = false, ultimoPorcentaje = -1;
  let resolver;
  const finalizada = new Promise(resolve => { resolver = resolve; });
  const metro = recorrido.querySelector('.metronet-viaje__metro');
  const linea = recorrido.querySelector('.metronet-viaje__linea');
  const estaciones = [...recorrido.querySelectorAll('circle')];

  function actualizarEstado() {
    if (cerrado) return;
    if (retenerLectura) estado.textContent = 'Leé a tu ritmo. Elegí Continuar al nivel cuando estés listo.';
    else if (recorridoTerminado) estado.textContent = datosListos ? 'Destino alcanzado. Entrando al nivel…' : 'Viaje completado. Esperando la respuesta del nivel…';
    else estado.textContent = 'Entrarás automáticamente al terminar el viaje.';
    if (recorridoTerminado && datosListos && !retenerLectura) resolver(true);
  }
  function finalizarRecorrido() {
    pausaFinal = null;
    recorridoTerminado = true;
    actualizarEstado();
  }
  function mostrarProgreso(fraccion) {
    const entero = Math.floor(fraccion * 100);
    if (entero !== ultimoPorcentaje) {
      ultimoPorcentaje = entero;
      porcentaje.textContent = `${entero}%`;
      progreso.setAttribute('aria-valuenow', String(entero));
      // En modo reducido se encienden estaciones sin un desplazamiento continuo.
      linea.style.strokeDashoffset = String(100 - (movimientoReducido ? Math.floor(entero / 25) * 25 : entero));
      estaciones.forEach((estacion, indice) => estacion.classList.toggle('activa', entero >= indice * 25));
    }
    metro.style.transform = `translateX(${movimientoReducido ? 30 : 30 + fraccion * 500}px)`;
    if (movimientoReducido || fraccion >= CONFIGURACION_TRANSICION.revelarConsignaEn) dialogo.classList.add('metronet-viaje--consigna-visible');
  }
  const inicio = performance.now();
  function animar(ahora) {
    frame = null;
    if (cerrado) return;
    if (!dialogo.isConnected) { cerrar(); return; }
    const tiempo = Math.min(1, (ahora - inicio) / CONFIGURACION_TRANSICION.duracionMs);
    // Acelera y desacelera entre estaciones, sin saltos ni porcentajes decrecientes.
    const tramo = tiempo * 4, parcial = tramo % 1;
    const avance = tiempo === 1 ? 1 : (Math.floor(tramo) + parcial * parcial * (3 - 2 * parcial)) / 4;
    mostrarProgreso(avance);
    if (tiempo < 1) frame = requestAnimationFrame(animar);
    else pausaFinal = setTimeout(finalizarRecorrido, CONFIGURACION_TRANSICION.pausaFinalMs);
  }
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    cancelada = true;
    cancelAnimationFrame(frame);
    clearTimeout(pausaFinal);
    window.removeEventListener('pagehide', cerrar);
    window.removeEventListener('popstate', cerrar);
    observador.disconnect();
    dialogo.remove();
    resolver(false);
    if (transicionActiva === controlador) transicionActiva = null;
    if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
  }
  const observador = new MutationObserver(() => { if (!dialogo.isConnected) cerrar(); });
  const controlador = {
    finalizada, cerrar,
    get cancelada() { return cancelada; },
    marcarDatosListos() { datosListos = true; actualizarEstado(); },
  };
  volver.addEventListener('click', cerrar);
  dialogo.addEventListener('cancel', evento => { evento.preventDefault(); cerrar(); });
  dialogo.addEventListener('close', cerrar);
  leer.addEventListener('click', () => {
    retenerLectura = !retenerLectura;
    leer.setAttribute('aria-pressed', String(retenerLectura));
    leer.textContent = retenerLectura ? 'Continuar al nivel' : 'Leer sin prisa';
    if (retenerLectura) dialogo.classList.add('metronet-viaje--consigna-visible');
    actualizarEstado();
  });
  try {
    document.body.append(dialogo);
    dialogo.showModal();
    titulo.focus({ preventScroll: true });
    mostrarProgreso(0);
    transicionActiva = controlador;
    window.addEventListener('pagehide', cerrar);
    window.addEventListener('popstate', cerrar);
    observador.observe(document.body, { childList: true });
    frame = requestAnimationFrame(animar);
    return controlador;
  } catch (error) { cerrar(); throw error; }
}
