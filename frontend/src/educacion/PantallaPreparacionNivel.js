import { obtenerContenidoNivel } from './ContenidoPreparacion.js';
import { gestorMusica } from '../audio/GestorMusica.js';
import { seleccionarMensajeTransicion } from './MensajesTransicion.js';
import { CONFIGURACION_TRANSICION } from './ConfiguracionTransicion.js';
import { crearLogoMetronet } from '../componentes/LogoMetronet.js';
import { crearRecorridoNivel } from './RecorridoNivel.js';
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
  const identidad = document.createElement('div');
  identidad.className = 'metronet-viaje__identidad';
  const titulo = texto('h2', escenario.nombre || `Nivel ${escenario.numero}`);
  titulo.id = 'tituloPreparacionNivel';
  titulo.tabIndex = -1;
  identidad.append(texto('span', `NIVEL ${escenario.numero}`, 'metronet-viaje__nivel'), titulo);
  cabecera.append(crearLogoMetronet(), identidad);
  const animacion = crearRecorridoNivel({ variante: 'intro' });
  const recorrido = animacion.elemento;
  recorrido.classList.add('metronet-viaje__recorrido');
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
  consigna.append(texto('h3', 'Próximo desafío'), texto('p', escenario.objetivo || contenido?.objetivo || 'Explorá el mapa y revisá la consigna completa dentro del nivel.'));
  const informacion = document.createElement('div');
  informacion.className = 'metronet-viaje__informacion';
  informacion.append(dato, consigna);
  const estado = texto('p', 'Entrarás automáticamente al terminar el viaje.', 'metronet-viaje__estado');
  estado.setAttribute('role', 'status');
  const acciones = document.createElement('div');
  acciones.className = 'metronet-dialogo-cambios__acciones';
  const volver = texto('button', 'Volver', 'metronet-boton--peligro-secundario');
  volver.type = 'button';
  const leer = texto('button', 'Leer sin prisa');
  leer.type = 'button';
  leer.setAttribute('aria-pressed', 'false');
  acciones.append(volver, leer);
  const pie = document.createElement('footer');
  pie.className = 'metronet-viaje__pie';
  pie.append(estado, acciones);
  cuerpo.append(cabecera, recorrido, progreso, informacion, pie);
  dialogo.append(cuerpo);

  let cerrado = false, cancelada = false;
  let liberarMusica = () => {};
  let retenerLectura = false, recorridoTerminado = false, datosListos = false;
  let resolver;
  const finalizada = new Promise(resolve => { resolver = resolve; });
  function actualizarEstado() {
    if (cerrado) return;
    if (retenerLectura) estado.textContent = 'Leé a tu ritmo. Elegí Continuar al nivel cuando estés listo.';
    else if (recorridoTerminado) estado.textContent = datosListos ? 'Destino alcanzado. Entrando al nivel…' : 'Viaje completado. Esperando la respuesta del nivel…';
    else estado.textContent = 'Entrarás automáticamente al terminar el viaje.';
    if (recorridoTerminado && datosListos && !retenerLectura) resolver(true);
  }
  function finalizarRecorrido() {
    recorridoTerminado = true;
    actualizarEstado();
  }
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    cancelada = true;
    animacion.destruir();
    window.removeEventListener('pagehide', cerrar);
    window.removeEventListener('popstate', cerrar);
    observador.disconnect();
    dialogo.remove();
    liberarMusica();
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
    liberarMusica = gestorMusica.usarContextoTemporal('transition');
    document.body.append(dialogo);
    dialogo.showModal();
    titulo.focus({ preventScroll: true });
    transicionActiva = controlador;
    window.addEventListener('pagehide', cerrar);
    window.addEventListener('popstate', cerrar);
    observador.observe(document.body, { childList: true });
    animacion.iniciar({
      progreso, porcentaje,
      alAvanzar: tiempo => {
        if (movimientoReducido || tiempo >= CONFIGURACION_TRANSICION.revelarConsignaEn) dialogo.classList.add('metronet-viaje--consigna-visible');
      },
      alFinalizar: finalizarRecorrido,
    });
    return controlador;
  } catch (error) { cerrar(); throw error; }
}
