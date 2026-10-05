import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';

const sesion = requerirSesion('/aprendizaje.html');
const contenedor = document.getElementById('nivelesAprendizaje');
const dialogo = document.getElementById('tarjetaAprendizaje');
let focoAnterior = null;

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
  const imagen = document.createElement('img');
  imagen.src = tarjeta.imagen;
  imagen.alt = `Esquema original. ${tarjeta.descripcionImagen}`;
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
  cerrar.addEventListener('click', () => dialogo.close());
  acciones.append(posicionTexto, cerrar);
  lectura.append(titulo, figura, nodo('p', tarjeta.texto), idea, fuente, acciones);
  dialogo.replaceChildren(lectura);
  dialogo.showModal();
  titulo.focus({ preventScroll: true });
}

function renderizarNivel(nivel) {
  const seccion = nodo('section', '', `metronet-aprendizaje__nivel${nivel.desbloqueado ? '' : ' metronet-aprendizaje__nivel--bloqueado'}`);
  const cabecera = nodo('header', '', 'metronet-aprendizaje__nivel-cabecera');
  const nombre = nivel.contenido?.desafio?.nombre;
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
  fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego/aprendizaje`, {
    headers: { Authorization: `Bearer ${sesion.token}` }, cache: 'no-store',
  }).then(async respuesta => {
    if (!respuesta.ok) throw new Error('No se pudo consultar tu biblioteca. Actualizá la página para reintentar.');
    return respuesta.json();
  }).then(niveles => {
    if (!Array.isArray(niveles) || niveles.length !== 10) throw new Error('La biblioteca no está disponible en este momento.');
    contenedor.replaceChildren(...niveles.map(renderizarNivel));
    const disponibles = niveles.filter(nivel => nivel.desbloqueado).length;
    document.getElementById('resumenAprendizaje').textContent = sesion.usuario?.rol === 'ADMIN'
      ? 'Vista de administrador · catálogo completo de 70 tarjetas.'
      : `${disponibles} de 10 niveles desbloqueados · ${disponibles * 7} de 70 tarjetas disponibles.`;
  }).catch(error => {
    const aviso = document.getElementById('errorAprendizaje');
    aviso.textContent = error.message;
    aviso.hidden = false;
    document.getElementById('resumenAprendizaje').textContent = 'No fue posible cargar la biblioteca.';
  }).finally(() => { contenedor.setAttribute('aria-busy', 'false'); });
}
