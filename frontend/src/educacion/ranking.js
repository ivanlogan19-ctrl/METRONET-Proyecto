import { iconosTrofeos } from './IconosTrofeos.js';
import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { consultarJuego } from './ClientePuntuacion.js';
import './extras/extras.css';
const sesion = requerirSesion('/ranking.html');
const formatoPuntos = valor => String(valor ?? 0).padStart(6, '0');
const texto = (tag, valor) => { const e = document.createElement(tag); e.textContent = valor; return e; };
let jugadores = [], paginaActual = 0, filasNiveles = [], paginaNiveles = 0;
const NIVELES_POR_PAGINA = 5;
const JUGADORES_POR_PAGINA = 6;
if (sesion) {
  inicializarNavegacion({ actual: 'ranking' });
  document.getElementById('reintentarRanking').addEventListener('click', cargar);
  document.getElementById('reintentarTrofeos').addEventListener('click', cargarTrofeos);
  document.getElementById('rankingAnterior').addEventListener('click', () => cambiarPagina(-1));
  document.getElementById('rankingSiguiente').addEventListener('click', () => cambiarPagina(1));
  document.getElementById('verClasificacion').addEventListener('click', () => mostrarVista(false));
  document.getElementById('verPuntosNivel').addEventListener('click', () => mostrarVista(true));
  document.getElementById('nivelAnterior').addEventListener('click', () => cambiarPaginaNiveles(-1));
  document.getElementById('nivelSiguiente').addEventListener('click', () => cambiarPaginaNiveles(1));
  cargar();
  cargarTrofeos();
}
async function cargar() {
  const mensaje = document.getElementById('mensajeRanking'), boton = document.getElementById('reintentarRanking');
  const estado = document.getElementById('estadoRanking');
  boton.hidden = true; estado.hidden = false; mensaje.textContent = 'Consultando resultados…';
  mensaje.classList.remove('error');
  jugadores = []; paginaActual = 0; renderizarClasificacion();
  try {
    const [ranking, progreso] = await Promise.all([consultarJuego('/ranking'), consultarJuego('/progreso')]);
    if (!Array.isArray(ranking?.jugadores) || !Array.isArray(progreso?.escenarios)) throw new Error('No hay resultados disponibles.');
    const administrador = sesion.usuario.rol === 'ADMIN';
    const tituloPersonal = document.getElementById('tituloMiDesempeno');
    const resumenPersonal = document.getElementById('resumenPuntaje');
    tituloPersonal.hidden = resumenPersonal.hidden = administrador;
    tituloPersonal.textContent = administrador ? '' : 'Tu desempeño';
    resumenPersonal.textContent = administrador ? ''
      : `${progreso.campanaCompletada ? '¡Campaña completada! ' : ''}${progreso.nivelesCompletados} / ${progreso.cantidadNiveles} niveles en la campaña actual. Mejor puntaje acumulado: ${ranking.puntajeTotal} / ${ranking.puntajeMaximo}. Tu posición: ${ranking.tuPosicion ?? 'Sin clasificación'}.`;
    const personal = document.getElementById('resumenPersonalRanking');
    personal.hidden = administrador;
    const niveles = progreso.escenarios.filter(n => Number.isInteger(n.numero) && n.mejorPuntaje != null);
    const resumenNiveles = document.getElementById('resumenPuntosNivel');
    resumenNiveles.hidden = niveles.length > 0;
    resumenNiveles.textContent = niveles.length ? '' : 'Todavía no tenés niveles completados.';
    filasNiveles = niveles.map(n => {
      const item = document.createElement('li');
      item.className = 'ranking-nivel';
      const encabezado = document.createElement('div');
      encabezado.className = 'ranking-nivel__encabezado';
      const nombre = String(n.nombre ?? '').replace(new RegExp(`^Nivel\\s+${n.numero}(?!\\d)(?:\\s*[·:–-]\\s*)?`, 'i'), '').trim();
      encabezado.append(texto('small', `Nivel ${String(n.numero).padStart(2, '0')}`), texto('strong', nombre || 'Sin título'));
      const resultados = document.createElement('div');
      resultados.className = 'ranking-nivel__resultados';
      const mejor = document.createElement('div');
      mejor.append(texto('small', 'Mejor resultado'), texto('strong', `${n.mejorPuntaje} / ${n.puntajeMaximo ?? 100}`));
      const ultimo = document.createElement('div');
      ultimo.append(texto('small', 'Último intento'), texto('span', n.ultimoPuntaje == null ? 'Sin resultado' : `${n.ultimoPuntaje} / ${n.puntajeMaximo ?? 100}`));
      resultados.append(mejor, ultimo);
      item.append(encabezado, resultados);
      return item;
    });
    document.getElementById('puntajesPorNivel').replaceChildren(...filasNiveles);
    paginaNiveles = 0; renderizarPaginaNiveles();
    jugadores = ranking.jugadores;
    renderizarClasificacion();
    estado.hidden = ranking.jugadores.length > 0;
    mensaje.textContent = ranking.jugadores.length ? '' : 'Sin puntajes registrados. Todavía no hay jugadores clasificados.';
  } catch (error) {
    mensaje.textContent = error.message; mensaje.classList.add('error'); boton.hidden = false;
    const resumen = document.getElementById('resumenPuntosNivel');
    resumen.hidden = false; resumen.textContent = 'No fue posible consultar tus puntos. Volvé a Clasificación para reintentar.';
  }
}

function mostrarVista(porNivel) {
  document.getElementById('vistaClasificacion').hidden = porNivel;
  document.getElementById('vistaPuntosNivel').hidden = !porNivel;
  document.getElementById('verClasificacion').setAttribute('aria-pressed', String(!porNivel));
  document.getElementById('verPuntosNivel').setAttribute('aria-pressed', String(porNivel));
  document.getElementById('tituloClasificacion').textContent = porNivel ? 'Tus puntos por nivel' : 'Clasificación general';
}
function cambiarPaginaNiveles(delta) {
  paginaNiveles = Math.max(0, Math.min(Math.ceil(filasNiveles.length / NIVELES_POR_PAGINA) - 1, paginaNiveles + delta));
  renderizarPaginaNiveles();
}
function renderizarPaginaNiveles() {
  filasNiveles.forEach((fila,i) => { fila.hidden = Math.floor(i / NIVELES_POR_PAGINA) !== paginaNiveles; });
  const paginas = Math.max(1, Math.ceil(filasNiveles.length / NIVELES_POR_PAGINA));
  document.getElementById('paginaPuntosNivel').textContent = `${paginaNiveles + 1} / ${paginas}`;
  document.getElementById('nivelAnterior').disabled = paginaNiveles === 0;
  document.getElementById('nivelSiguiente').disabled = paginaNiveles >= paginas - 1;
}

function cambiarPagina(delta) {
  paginaActual = Math.max(0, Math.min(Math.ceil(jugadores.length / JUGADORES_POR_PAGINA) - 1, paginaActual + delta));
  renderizarClasificacion();
}
function renderizarClasificacion() {
  document.getElementById('clasificacionRanking').replaceChildren(...jugadores.slice(paginaActual * JUGADORES_POR_PAGINA, (paginaActual + 1) * JUGADORES_POR_PAGINA).map(j => {
      const item = document.createElement('tr'); item.classList.toggle('ranking-propio', Boolean(j.sosVos));
      item.classList.toggle('ranking-destacado', j.posicion <= 3);
      item.classList.toggle('ranking-primero', j.posicion === 1);
      if (j.sosVos) item.setAttribute('aria-label', `Tu posición: ${j.posicion}`);
      const puntos = texto('td', formatoPuntos(j.puntajeTotal)); puntos.setAttribute('aria-label', `${j.puntajeTotal} puntos`);
      const jugador = texto('td', j.jugador); jugador.title = j.jugador;
      item.append(texto('td', String(j.posicion).padStart(2, '0')), jugador, puntos, texto('td', String(j.nivelesCompletados).padStart(2, '0')));
      return item;
    }));
  const paginas = Math.max(1, Math.ceil(jugadores.length / JUGADORES_POR_PAGINA));
  document.getElementById('paginaRanking').textContent = `${paginaActual + 1} / ${paginas}`;
  document.getElementById('rankingAnterior').disabled = paginaActual === 0;
  document.getElementById('rankingSiguiente').disabled = paginaActual >= paginas - 1;
}

async function cargarTrofeos() {
  const resumen = document.getElementById('resumenTrofeos');
  const reintentar = document.getElementById('reintentarTrofeos');
  reintentar.hidden = true;
  resumen.textContent = 'Consultando premios…';
  try {
    const trofeos = await consultarJuego('/trofeos');
    if (!Array.isArray(trofeos) || trofeos.length !== 6) throw new Error('Respuesta de premios incompleta.');
    renderizarTrofeos(trofeos);
  } catch {
    resumen.textContent = 'No fue posible consultar los premios. La clasificación sigue disponible.';
    reintentar.hidden = false;
  }
}


function renderizarTrofeos(trofeos) {
  const administrador = sesion.usuario?.rol === 'ADMIN';
  const galeria = document.getElementById('galeriaTrofeos');
  const botones = [];
  const seleccionar = (trofeo, elegido) => {
    botones.forEach(b => b.setAttribute('aria-pressed', String(b === elegido)));
    const detalle = document.getElementById('detalleTrofeo');
    detalle.replaceChildren(texto('h3', trofeo.nombre), texto('p', trofeo.obtenido ? trofeo.motivo : trofeo.requisito));
  };
  galeria.replaceChildren(...trofeos.map(trofeo => {
    const tarjeta = texto('button', '');
    tarjeta.type = 'button';
    tarjeta.className = `ranking-trofeo${trofeo.obtenido ? ' ranking-trofeo--obtenido' : ''}`;
    tarjeta.classList.toggle('ranking-trofeo--oculto', trofeo.id === 'extras' && !trofeo.obtenido);
    tarjeta.setAttribute('aria-pressed', 'false');
    tarjeta.setAttribute('aria-controls', 'detalleTrofeo');
    const icono = document.createElement('span');
    icono.className = 'ranking-trofeo__icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.innerHTML = `<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconosTrofeos[trofeo.id] ?? ''}</svg>`;
    const estado = texto('small', administrador ? 'En exhibición' : trofeo.obtenido ? 'Obtenido' : 'Por conseguir');
    tarjeta.append(icono, texto('span', trofeo.nombre), estado);
    tarjeta.addEventListener('click', () => seleccionar(trofeo, tarjeta));
    botones.push(tarjeta);
    return tarjeta;
  }));
  seleccionar(trofeos[0], botones[0]);
  const obtenidos = trofeos.filter(trofeo => trofeo.obtenido).length;
  document.getElementById('resumenTrofeos').textContent = administrador
    ? 'Catálogo completo · la vista de administrador no atribuye premios.'
    : `${obtenidos} de ${trofeos.length} trofeos obtenidos`;
}
