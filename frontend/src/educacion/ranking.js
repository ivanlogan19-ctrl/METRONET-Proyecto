import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { consultarJuego } from './ClientePuntuacion.js';
const sesion = requerirSesion('/ranking.html');
const formatoPuntos = valor => String(valor ?? 0).padStart(6, '0');
const texto = (tag, valor) => { const e = document.createElement(tag); e.textContent = valor; return e; };
if (sesion) {
  inicializarNavegacion({ actual: 'ranking' });
  document.getElementById('reintentarRanking').addEventListener('click', cargar);
  cargar();
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
