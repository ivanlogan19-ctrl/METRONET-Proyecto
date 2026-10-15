import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';
import { ajustarIlustracionTarjeta } from '../educacion/AjustarIlustracionTarjeta.js';

import { TARJETAS_EXTRAS } from '../educacion/extras/TarjetasExtras.js';
import { solicitarExtras } from '../educacion/extras/ClienteExtras.js';
import { abrirExtras } from '../educacion/extras/PresentacionExtras.js';

const sesion = requerirSesion('/aprendizaje.html');
const contenedor = document.getElementById('nivelesAprendizaje');
const dialogo = document.getElementById('tarjetaAprendizaje');
let focoAnterior = null;
let nivelSeleccionado = '1';

function seleccionarNivel(numero) {
  nivelSeleccionado = String(numero);
  document.querySelectorAll('#selectorAprendizaje button').forEach(boton => {
    boton.setAttribute('aria-pressed', String(boton.dataset.nivel === nivelSeleccionado));
  });
  contenedor.querySelectorAll('[data-numero]').forEach(seccion => {
    seccion.hidden = seccion.dataset.numero !== nivelSeleccionado;
  });
  contenedor.hidden = nivelSeleccionado === 'libre';
  document.getElementById('extrasAprendizaje').hidden = nivelSeleccionado !== 'libre';
}

function crearSelector() {
  const selector = document.getElementById('selectorAprendizaje');
  for (const numero of [...Array.from({ length: 10 }, (_, i) => String(i + 1)), 'libre']) {
    const boton = nodo('button', numero === 'libre' ? 'Modo Libre' : numero.padStart(2, '0'));
    boton.type = 'button';
    boton.dataset.nivel = numero;
    boton.setAttribute('aria-label', numero === 'libre' ? 'Modo Libre' : `Nivel ${numero}`);
    boton.addEventListener('click', () => seleccionarNivel(numero));
    selector.append(boton);
  }
  seleccionarNivel(nivelSeleccionado);
}

function nodo(etiqueta, texto, clase = '') {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = texto;
  if (clase) elemento.className = clase;
  return elemento;
}

function abrirTarjeta(tarjeta, numero, posicion, total) {
  focoAnterior = document.activeElement;
  const lectura = nodo('article', '', 'metronet-aprendizaje__lectura');
  const titulo = nodo('h2', tarjeta.titulo);
  titulo.id = 'tituloTarjetaAprendizaje';
  titulo.tabIndex = -1;
  const figura = document.createElement('figure');
  figura.className = 'metronet-ilustracion-ampliable';
  const imagen = document.createElement('img');
  imagen.src = tarjeta.imagen;
  imagen.alt = tarjeta.descripcionImagen;
  imagen.width = 720;
  imagen.height = 246;
  const respaldo = nodo('p', tarjeta.descripcionImagen);
  respaldo.hidden = true;
  imagen.addEventListener('error', () => { imagen.hidden = true; respaldo.hidden = false; });
  figura.append(imagen, respaldo);
  const idea = nodo('p', `Idea clave · ${tarjeta.aprendizaje}`, 'metronet-aprendizaje__idea');
  const fuente = nodo('p', 'Fuente: ', 'metronet-aprendizaje__fuente');
  const enlace = nodo('a', tarjeta.fuente);
  enlace.href = tarjeta.url;
  enlace.target = '_blank';
  enlace.rel = 'noopener noreferrer';
  fuente.append(enlace);
  const acciones = nodo('footer', '', 'metronet-aprendizaje__acciones');
  const posicionTexto = nodo('span', `Nivel ${numero} · Tarjeta ${posicion} de ${total}`);
  const cerrar = nodo('button', 'Volver a las tarjetas');
  cerrar.type = 'button';
  cerrar.className = 'metronet-aprendizaje__volver';
  cerrar.addEventListener('click', () => dialogo.close());
  acciones.append(posicionTexto, cerrar);
  lectura.append(titulo, figura, nodo('p', tarjeta.texto, 'metronet-aprendizaje__texto'), idea, fuente, acciones);
  dialogo.replaceChildren(lectura);
  dialogo.showModal();
  ajustarIlustracionTarjeta();
  titulo.focus({ preventScroll: true });
}

function renderizarNivel(nivel) {
  const seccion = nodo('section', '', `metronet-aprendizaje__nivel${nivel.desbloqueado ? '' : ' metronet-aprendizaje__nivel--bloqueado'}`);
  seccion.dataset.numero = String(nivel.numero);
  const cabecera = nodo('header', '', 'metronet-aprendizaje__nivel-cabecera');
  const nombre = String(nivel.contenido?.desafio?.nombre ?? '').trim()
    .replace(new RegExp(`^Nivel\\s+${nivel.numero}(?!\\d)(?:\\s*[·:–-]\\s*)?`, 'i'), '');
  cabecera.append(nodo('h2', `Nivel ${nivel.numero}${nombre ? ` · ${nombre}` : ''}`),
    nodo('span', nivel.desbloqueado ? 'Desbloqueado' : 'Bloqueado', 'metronet-aprendizaje__estado'));
  seccion.append(cabecera);
  if (!nivel.desbloqueado) {
    seccion.append(nodo('p', `Completá el Nivel ${nivel.numero} para consultar sus siete tarjetas.`));
    return seccion;
  }
  const tarjetas = nivel.contenido?.tarjetas ?? [];
  if (tarjetas.length !== 7) {
    seccion.append(nodo('p', 'Las tarjetas publicadas no están disponibles en este momento.'));
    return seccion;
  }
  const lista = nodo('div', '', 'metronet-aprendizaje__lista');
  tarjetas.forEach((tarjeta, indice) => {
    const boton = nodo('button', '', 'metronet-aprendizaje__tarjeta');
    boton.type = 'button';
    boton.append(nodo('span', `Tarjeta ${indice + 1} de 7`), nodo('strong', tarjeta.titulo));
    boton.addEventListener('click', () => abrirTarjeta(tarjeta, nivel.numero, indice + 1, tarjetas.length));
    lista.append(boton);
  });
  seccion.append(lista);
  return seccion;
}

dialogo.addEventListener('close', () => { if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true }); });

if (sesion) {
  inicializarNavegacion({ actual: 'aprendizaje' });
  crearSelector();
  fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego/aprendizaje`, {
    headers: { Authorization: `Bearer ${sesion.token}` }, cache: 'no-store',
  }).then(async respuesta => {
    if (!respuesta.ok) throw new Error('No se pudo consultar tu biblioteca. Actualizá la página para reintentar.');
    return respuesta.json();
  }).then(niveles => {
    if (!Array.isArray(niveles) || niveles.length !== 10) throw new Error('La biblioteca no está disponible en este momento.');
    contenedor.replaceChildren(...[...niveles].sort((a, b) => a.numero - b.numero).map(renderizarNivel));
    seleccionarNivel(nivelSeleccionado);
    const disponibles = niveles.filter(nivel => nivel.desbloqueado).length;
    const resumen = document.getElementById('resumenAprendizaje');
    resumen.hidden = sesion.usuario?.rol === 'ADMIN';
    resumen.textContent = resumen.hidden ? ''
      : `${disponibles} de 10 niveles desbloqueados · ${disponibles * 7} de 70 tarjetas disponibles.`;
  }).catch(error => {
    const aviso = document.getElementById('errorAprendizaje');
    aviso.textContent = error.message;
    aviso.hidden = false;
    document.getElementById('resumenAprendizaje').textContent = 'No fue posible cargar la biblioteca.';
  }).finally(() => { contenedor.setAttribute('aria-busy', 'false'); });
}

async function cargarExtras() {
  const contenedor = document.getElementById('extrasAprendizaje');
  contenedor.replaceChildren(nodo('h2','Extras · Modo Libre'),nodo('p','Consultando tarjetas…'));
  try {
    renderizarExtras(await solicitarExtras());
  } catch {
    contenedor.replaceChildren(nodo('h2','Extras · Modo Libre'),nodo('p','No fue posible consultar Extras.'));
    const reintentar=nodo('button','Reintentar'); reintentar.type='button';
    reintentar.addEventListener('click',cargarExtras);contenedor.append(reintentar);
  }
}
function renderizarExtras(estado) {
  const contenedor=document.getElementById('extrasAprendizaje');
  const cabecera=nodo('header','','metronet-aprendizaje__nivel-cabecera');
  cabecera.append(nodo('h2','Extras · Modo Libre'),nodo('span',estado.desbloqueado
    ? `7 tarjetas · ${estado.visitadas.length} de 7 recorridas` : 'Bloqueado','metronet-aprendizaje__estado'));
  contenedor.replaceChildren(cabecera);
  if(!estado.desbloqueado)contenedor.append(nodo('p','Ingresá a Modo Libre para desbloquear estas siete tarjetas.'));
  contenedor.classList.toggle('metronet-aprendizaje__nivel--bloqueado',!estado.desbloqueado);
  if(!estado.desbloqueado)return;
  const lista=nodo('div','','metronet-aprendizaje__lista');
  TARJETAS_EXTRAS.forEach((tarjeta,i)=>{
    const boton=nodo('button','','metronet-aprendizaje__tarjeta');boton.type='button';
    const talon=nodo('span',estado.visitadas.includes(tarjeta.id)?'Recorrida':`Extra ${i+1}`);
    if(estado.visitadas.includes(tarjeta.id))talon.className='metronet-aprendizaje__recorrida';
    boton.append(talon,nodo('strong',tarjeta.titulo));
    boton.addEventListener('click',()=>abrirExtras({indiceInicial:i,alActualizar:renderizarExtras}));lista.append(boton);
  });
  contenedor.append(lista);
}
if(sesion)cargarExtras();
