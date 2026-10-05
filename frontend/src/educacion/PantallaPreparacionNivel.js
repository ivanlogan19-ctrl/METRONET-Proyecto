import { obtenerContenidoNivel } from './ContenidoPreparacion.js';
import { crearPresentacionMusicalNivel } from './PresentacionMusicalNivel.js';
import { seleccionarMensajeTransicion } from './MensajesTransicion.js';
import { CONFIGURACION_TRANSICION, MENSAJES_TRANSICION } from './ConfiguracionTransicion.js';
import { crearLogoMetronet } from '../componentes/LogoMetronet.js';
import { crearRecorridoNivel } from './RecorridoNivel.js';
import { seleccionarTarjetaEducativa, tarjetaEducativaActual } from './TarjetasEducativasNivel.js';
import { crearTarjetaEducativaNivel } from './TarjetaEducativaNivel.js';
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
  const hayTarjetas = Boolean(tarjetaEducativaActual(escenario.numero));
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
  const porcentaje = texto('span', '', 'metronet-viaje__porcentaje');
  porcentaje.hidden = true; // No presentar porcentajes ficticios de carga.
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
  const estado = texto('p', MENSAJES_TRANSICION.entrada, 'metronet-viaje__estado');
  estado.setAttribute('role', 'status');
  const acciones = document.createElement('div');
  acciones.className = 'metronet-dialogo-cambios__acciones';
  const volver = texto('button', 'Volver', 'metronet-boton--peligro-secundario');
  volver.type = 'button';
  const jugar = texto('button', MENSAJES_TRANSICION.accion, 'metronet-boton--exito metronet-boton--destacado');
  jugar.type = 'button';
  jugar.disabled = true;
  jugar.title = 'Esperando los datos del nivel';
  acciones.append(volver, jugar);
  const pie = document.createElement('footer');
  pie.className = 'metronet-viaje__pie';
  pie.append(estado, acciones);
  cuerpo.append(cabecera, recorrido, progreso, informacion, pie);
  let tarjetaAbierta = false, tarjetaCompletada = !hayTarjetas, viajeIniciado = false;
  let identificando = false, identificacionLista = false, temporizadorIdentificacion;
  let tarjetaVista = null;
  dialogo.append(cuerpo);

  let cerrado = false, cancelada = false;
  let presentacion;
  let recorridoTerminado = false, datosListos = false;
  let resolver;
  const finalizada = new Promise(resolve => { resolver = resolve; });
  function actualizarEstado() {
    if (cerrado) return;
    jugar.disabled = !datosListos || recorridoTerminado;
    jugar.title = datosListos ? '' : 'Esperando los datos del nivel';
    if (recorridoTerminado) estado.textContent = datosListos ? 'Entrando al nivel…' : 'Esperando la respuesta del nivel…';
    else estado.textContent = MENSAJES_TRANSICION.entrada;
    if (recorridoTerminado && datosListos) {
      if (!identificacionLista && !identificando) {
        identificando = true;
        presentacion.actualizar(1);
        temporizadorIdentificacion = setTimeout(() => {
          identificando = false;
          identificacionLista = true;
          if (tarjetaCompletada) resolver(true);
          else mostrarTarjeta();
        }, CONFIGURACION_TRANSICION.identificacionMs);
      }
    }
  }
  function finalizarRecorrido() {
    recorridoTerminado = true;
    actualizarEstado();
  }
  function iniciarViaje() {
    if (viajeIniciado || cerrado) return;
    viajeIniciado = true;
    presentacion = crearPresentacionMusicalNivel({
      dialogo, contexto: 'inicioNivel', titulo: `NIVEL ${escenario.numero}`,
      puedeMostrarCartel: () => identificando,
      alTerminar: () => animacion.finalizar(),
    });
    animacion.iniciar({
      progreso, porcentaje, obtenerTiempo: presentacion.obtenerTiempo,
      alAvanzar: tiempo => {
        if (movimientoReducido || tiempo >= CONFIGURACION_TRANSICION.revelarConsignaEn) dialogo.classList.add('metronet-viaje--consigna-visible');
        presentacion.actualizar(tiempo);
      },
      alFinalizar: finalizarRecorrido,
    });
  }
  function mostrarTarjeta() {
    if (cerrado || tarjetaAbierta) return;
    const tarjeta = seleccionarTarjetaEducativa(escenario.numero);
    if (!tarjeta) { tarjetaCompletada = true; resolver(true); return; }
    tarjetaVista = crearTarjetaEducativaNivel(tarjeta, escenario.numero, continuarTarjeta);
    presentacion?.eliminar();
    tarjetaAbierta = true;
    cuerpo.hidden = true;
    dialogo.classList.add('metronet-viaje--educativo');
    dialogo.setAttribute('aria-labelledby', tarjetaVista.titulo.id);
    dialogo.prepend(tarjetaVista.elemento);
    tarjetaVista.titulo.focus({ preventScroll: true });
  }
  function continuarTarjeta() {
    if (!tarjetaAbierta || cerrado) return;
    tarjetaAbierta = false;
    tarjetaCompletada = true;
    tarjetaVista.elemento.remove();
    resolver(true);
  }
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    cancelada = true;
    clearTimeout(temporizadorIdentificacion);
    animacion.destruir();
    presentacion?.eliminar();
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
    get identificacionPresentada() { return presentacion?.identificacionPresentada ?? false; },
    marcarDatosListos() { datosListos = true; actualizarEstado(); },
  };
  volver.addEventListener('click', cerrar);
  dialogo.addEventListener('cancel', evento => { evento.preventDefault(); if (tarjetaAbierta) continuarTarjeta(); else cerrar(); });
  dialogo.addEventListener('close', cerrar);
  jugar.addEventListener('click', () => {
    if (!datosListos || recorridoTerminado || cerrado) return;
    presentacion?.detenerAudio();
    animacion.finalizar();
  });
  try {
    document.body.append(dialogo);
    dialogo.showModal();
    titulo.focus({ preventScroll: true });
    transicionActiva = controlador;
    window.addEventListener('pagehide', cerrar);
    window.addEventListener('popstate', cerrar);
    observador.observe(document.body, { childList: true });
    iniciarViaje();
    return controlador;
  } catch (error) { cerrar(); throw error; }
}
