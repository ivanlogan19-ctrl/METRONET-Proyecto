import { seleccionarTarjetaEducativa, tarjetaEducativaActual, tarjetasDisponibles } from './TarjetasEducativasNivel.js';
import { gestorMusica } from '../audio/GestorMusica.js';
import { ajustarIlustracionTarjeta } from './AjustarIlustracionTarjeta.js';
import './tarjeta-educativa-nivel.css';

let secuencia = 0;

function elemento(etiqueta, contenido, clase = '') {
  const nodo = document.createElement(etiqueta);
  nodo.textContent = contenido;
  nodo.className = clase;
  return nodo;
}

export function crearTarjetaEducativaNivel(tarjeta, numero, alContinuar, { desdeAyuda = false, posicion = 0, total = 0, alSiguiente } = {}) {
  const tarjetaVista = document.createElement('section');
  tarjetaVista.className = 'metronet-tarjeta-educativa';
  tarjetaVista.dataset.tarjetaEducativa = tarjeta.id;
  const titulo = elemento('h2', tarjeta.titulo);
  titulo.id = `tituloTarjetaEducativa${++secuencia}`;
  titulo.tabIndex = -1;
  const cabecera = document.createElement('header');
  cabecera.className = 'metronet-tarjeta-educativa__cabecera';
  const identidad = document.createElement('div');
  identidad.append(elemento('span', 'APRENDER DE LA RED', 'metronet-tarjeta-educativa__etiqueta'), titulo);
  cabecera.append(identidad);

  const figura = document.createElement('figure');
  figura.className = 'metronet-tarjeta-educativa__figura metronet-ilustracion-ampliable';
  const imagen = document.createElement('img');
  imagen.src = tarjeta.imagen;
  imagen.alt = `Esquema original. ${tarjeta.descripcionImagen}`;
  imagen.width = 720;
  imagen.height = 246;
  imagen.decoding = 'async';
  const respaldo = elemento('p', tarjeta.descripcionImagen, 'metronet-tarjeta-educativa__respaldo');
  respaldo.hidden = true;
  imagen.addEventListener('error', () => { imagen.hidden = true; respaldo.hidden = false; });
  figura.append(imagen, respaldo);

  const aprendizaje = document.createElement('p');
  aprendizaje.className = 'metronet-tarjeta-educativa__aprendizaje';
  aprendizaje.append(elemento('strong', 'IDEA CLAVE'), document.createTextNode(` ${tarjeta.aprendizaje}`));
  const fuente = elemento('p', 'Fuente: ', 'metronet-tarjeta-educativa__fuente');
  const enlace = elemento('a', tarjeta.fuente);
  enlace.href = tarjeta.url;
  enlace.target = '_blank';
  enlace.rel = 'noopener noreferrer';
  fuente.append(enlace);
  const pie = document.createElement('footer');
  pie.className = 'metronet-tarjeta-educativa__pie';
  const pista = elemento('small', desdeAyuda ? `Tarjeta ${posicion} de ${total} · Nivel ${numero}` : 'Podés volver a leer esta tarjeta desde Ayuda.');
  const acciones = document.createElement('div');
  acciones.className = 'metronet-tarjeta-educativa__acciones';
  const continuar = elemento('button', desdeAyuda ? 'Volver' : 'Continuar →', desdeAyuda ? 'metronet-boton--primario' : 'metronet-boton--exito metronet-boton--destacado');
  continuar.type = 'button';
  continuar.addEventListener('click', alContinuar);
  if (desdeAyuda && alSiguiente) {
    const siguiente = elemento('button', 'Siguiente tarjeta →', 'metronet-boton--exito metronet-boton--destacado');
    siguiente.type = 'button';
    siguiente.addEventListener('click', alSiguiente);
    acciones.append(siguiente);
  }
  acciones.append(continuar);
  pie.append(pista, acciones);
  tarjetaVista.append(cabecera, elemento('p', 'Una idea sobre transporte y planificación de redes.', 'metronet-tarjeta-educativa__subtitulo'), figura,
    elemento('p', tarjeta.texto, 'metronet-tarjeta-educativa__texto'), aprendizaje);
  tarjetaVista.append(fuente, pie);
  ajustarIlustracionTarjeta();
  return { elemento: tarjetaVista, titulo, continuar };
}

// El HUD se cierra antes de llamar; si ya hay un diálogo modal, no se apila otro.
export function abrirTarjetaEducativaDesdeAyuda(numero, focoAnterior) {
  const tarjetas = numero === null
    ? Array.from({ length: 10 }, (_, indice) => indice + 1)
      .flatMap(nivel => tarjetasDisponibles(nivel).map(tarjeta => ({ tarjeta, nivel })))
    : tarjetasDisponibles(numero).map(tarjeta => ({ tarjeta, nivel: numero }));
  if (!tarjetas.length || document.querySelector('dialog[open]')) return false;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-cambios metronet-preparacion metronet-preparacion--educativa';
  let cerrada = false;
  let liberarMusica = () => {};
  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    liberarMusica();
    if (dialogo.open) dialogo.close();
    dialogo.remove();
    if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
  }
  const actual = numero === null ? null : tarjetaEducativaActual(numero);
  let indice = Math.max(0, tarjetas.findIndex(entrada => entrada.tarjeta === actual));
  function mostrarTarjeta(enfocarSiguiente = false) {
    const entrada = tarjetas[indice];
    const vista = crearTarjetaEducativaNivel(entrada.tarjeta, entrada.nivel, cerrar, {
      desdeAyuda: true, posicion: indice + 1, total: tarjetas.length,
      alSiguiente: () => { indice = (indice + 1) % tarjetas.length; mostrarTarjeta(true); },
    });
    dialogo.replaceChildren(vista.elemento);
    dialogo.setAttribute('aria-labelledby', vista.titulo.id);
    dialogo.scrollTop = 0;
    if (enfocarSiguiente) vista.elemento.querySelector('.metronet-tarjeta-educativa__acciones button').focus({ preventScroll: true });
    return vista;
  }
  const vista = mostrarTarjeta();
  dialogo.addEventListener('cancel', evento => { evento.preventDefault(); cerrar(); });
  dialogo.addEventListener('close', cerrar);
  try {
    document.body.append(dialogo);
    dialogo.showModal();
    liberarMusica = gestorMusica.usarContextoTemporal('educativo');
    vista.titulo.focus({ preventScroll: true });
    return true;
  } catch { cerrar(); return false; }
}

// La victoria ya realizó el viaje musical al siguiente nivel. La presentación
// del número ocurre antes de abrir esta tarjeta educativa.
export function presentarTarjetaEducativaTrasVictoria(numero) {
  if (document.querySelector('dialog[open]')) return Promise.resolve(false);
  const tarjeta = seleccionarTarjetaEducativa(numero);
  if (!tarjeta) return Promise.resolve(true);
  const focoAnterior = document.activeElement;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-cambios metronet-preparacion metronet-preparacion--educativa';
  return new Promise(resolve => {
    let cerrada = false;
    let liberarMusica = () => {};
    function terminar(continuar) {
      if (cerrada) return;
      cerrada = true;
      liberarMusica();
      window.removeEventListener('pagehide', cancelar);
      window.removeEventListener('popstate', cancelar);
      if (dialogo.open) dialogo.close();
      dialogo.remove();
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
      resolve(continuar);
    }
    function cancelar() { terminar(false); }
    const vista = crearTarjetaEducativaNivel(tarjeta, numero, () => terminar(true));
    dialogo.setAttribute('aria-labelledby', vista.titulo.id);
    dialogo.addEventListener('cancel', evento => { evento.preventDefault(); terminar(true); });
    dialogo.addEventListener('close', cancelar);
    dialogo.append(vista.elemento);
    try {
      document.body.append(dialogo);
      dialogo.showModal();
      liberarMusica = gestorMusica.usarContextoTemporal('educativo');
      vista.titulo.focus({ preventScroll: true });
      window.addEventListener('pagehide', cancelar);
      window.addEventListener('popstate', cancelar);
    } catch { cancelar(); }
  });
}
