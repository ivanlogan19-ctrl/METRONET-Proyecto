import { iconosTrofeos } from './IconosTrofeos.js';
import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { consultarJuego } from './ClientePuntuacion.js';
const sesion = requerirSesion('/ranking.html');
const formatoPuntos = valor => String(valor ?? 0).padStart(6, '0');
const texto = (tag, valor) => { const e = document.createElement(tag); e.textContent = valor; return e; };
if (sesion) {
  inicializarNavegacion({ actual: 'ranking' });
  document.getElementById('reintentarRanking').addEventListener('click', cargar);
  document.getElementById('reintentarTrofeos').addEventListener('click', cargarTrofeos);
  cargar();
  cargarTrofeos();
}
async function cargar() {
  const mensaje = document.getElementById('mensajeRanking'), boton = document.getElementById('reintentarRanking');
  const estado = document.getElementById('estadoRanking');
  boton.hidden = true; estado.hidden = false; mensaje.textContent = 'Consultando resultados…';
  mensaje.classList.remove('error');
  document.getElementById('clasificacionRanking').replaceChildren();
  try {
    const [ranking, progreso] = await Promise.all([consultarJuego('/ranking'), consultarJuego('/progreso')]);
    if (!Array.isArray(ranking?.jugadores) || !Array.isArray(progreso?.escenarios)) throw new Error('No hay resultados disponibles.');
    document.getElementById('tituloMiDesempeno').textContent = sesion.usuario.rol === 'ADMIN' ? 'ADMIN // Modo de pruebas' : 'Tu desempeño';
    document.getElementById('resumenPuntaje').textContent = sesion.usuario.rol === 'ADMIN'
      ? 'Modo de pruebas: acceso completo a los niveles. Esta cuenta no participa en el ranking.'
      : `${progreso.campanaCompletada ? '¡Campaña completada! ' : ''}${progreso.nivelesCompletados} / ${progreso.cantidadNiveles} niveles en la campaña actual. Mejor puntaje acumulado: ${ranking.puntajeTotal} / ${ranking.puntajeMaximo}. Tu posición: ${ranking.tuPosicion ?? 'Sin clasificación'}.`;
    document.getElementById('puntajesPorNivel').replaceChildren(...progreso.escenarios.filter(n => Number.isInteger(n.numero)).map(n => {
      const item = document.createElement('li');
      item.append(texto('strong', `Nivel ${String(n.numero).padStart(2, '0')} · ${n.nombre}`), texto('span', `Mejor: ${n.mejorPuntaje ?? 0} / ${n.puntajeMaximo ?? 100}`), texto('small', `Mejor del último intento: ${n.ultimoPuntaje ?? 'Sin resultado'}`));
      return item;
    }));
    document.getElementById('clasificacionRanking').replaceChildren(...ranking.jugadores.map(j => {
      const item = document.createElement('tr'); item.classList.toggle('ranking-propio', Boolean(j.sosVos));
      item.classList.toggle('ranking-destacado', j.posicion <= 3);
      if (j.sosVos) item.setAttribute('aria-label', `Tu posición: ${j.posicion}`);
      const puntos = texto('td', formatoPuntos(j.puntajeTotal)); puntos.setAttribute('aria-label', `${j.puntajeTotal} puntos`);
      item.append(texto('td', String(j.posicion).padStart(2, '0')), texto('td', `${j.jugador}${j.sosVos ? ' · Vos' : ''}`), puntos, texto('td', String(j.nivelesCompletados).padStart(2, '0')));
      return item;
    }));
    estado.hidden = ranking.jugadores.length > 0;
    mensaje.textContent = ranking.jugadores.length ? '' : 'Sin puntajes registrados. Todavía no hay jugadores clasificados.';
  } catch (error) { mensaje.textContent = error.message; mensaje.classList.add('error'); boton.hidden = false; }
}

async function cargarTrofeos() {
  const resumen = document.getElementById('resumenTrofeos');
  const reintentar = document.getElementById('reintentarTrofeos');
  reintentar.hidden = true;
  resumen.textContent = 'Consultando premios…';
  try {
    const trofeos = await consultarJuego('/trofeos');
    if (!Array.isArray(trofeos) || trofeos.length !== 5) throw new Error('Respuesta de premios incompleta.');
    renderizarTrofeos(trofeos);
  } catch {
    resumen.textContent = 'No fue posible consultar los premios. La clasificación sigue disponible.';
    reintentar.hidden = false;
  }
}


function renderizarTrofeos(trofeos) {
  const administrador = sesion.usuario?.rol === 'ADMIN';
  const galeria = document.getElementById('galeriaTrofeos');
  galeria.replaceChildren(...trofeos.map(trofeo => {
    const tarjeta = texto('article', '');
    tarjeta.className = `ranking-trofeo${trofeo.obtenido ? ' ranking-trofeo--obtenido' : ''}`;
    const icono = document.createElement('div');
    icono.className = 'ranking-trofeo__icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.innerHTML = `<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconosTrofeos[trofeo.id] ?? ''}</svg>`;
    tarjeta.append(icono, texto('h3', trofeo.nombre),
      texto('span', administrador ? 'En exhibición' : trofeo.obtenido ? 'Obtenido' : 'Por conseguir'),
      texto('p', trofeo.obtenido ? trofeo.motivo : trofeo.requisito));
    return tarjeta;
  }));
  const obtenidos = trofeos.filter(trofeo => trofeo.obtenido).length;
  document.getElementById('resumenTrofeos').textContent = administrador
    ? 'Catálogo completo · la vista de administrador no atribuye premios.'
    : `${obtenidos} de 5 trofeos obtenidos`;
}
