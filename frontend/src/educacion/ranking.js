import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { consultarJuego } from './ClientePuntuacion.js';
const sesion = requerirSesion('/ranking.html');
const texto = (tag, valor) => { const e = document.createElement(tag); e.textContent = valor; return e; };
if (sesion) {
  inicializarNavegacion({ actual: 'ranking' });
  document.getElementById('reintentarRanking').addEventListener('click', cargar);
  cargar();
}
async function cargar() {
  const mensaje = document.getElementById('mensajeRanking'), boton = document.getElementById('reintentarRanking');
  boton.hidden = true; mensaje.textContent = 'Consultando resultados…';
  try {
    const [ranking, progreso] = await Promise.all([consultarJuego('/ranking'), consultarJuego('/progreso')]);
    if (!Array.isArray(ranking?.jugadores) || !Array.isArray(progreso?.escenarios)) throw new Error('No hay resultados disponibles.');
    document.getElementById('resumenPuntaje').textContent = sesion.usuario.rol === 'ADMIN'
      ? 'Modo de pruebas: acceso completo a los niveles. Esta cuenta no participa en el ranking.'
      : `${progreso.campanaCompletada ? '¡Campaña completada! ' : ''}${progreso.nivelesCompletados} / ${progreso.cantidadNiveles} niveles en la campaña actual. Mejor puntaje acumulado: ${ranking.puntajeTotal} / ${ranking.puntajeMaximo}. Tu posición: ${ranking.tuPosicion ?? 'Sin clasificación'}.`;
    document.getElementById('puntajesPorNivel').replaceChildren(...progreso.escenarios.filter(n => Number.isInteger(n.numero)).map(n => {
      const item = document.createElement('li');
      item.append(texto('strong', n.nombre), texto('span', `Mejor: ${n.mejorPuntaje ?? 0} / ${n.puntajeMaximo ?? 100}`), texto('small', `Mejor del último intento: ${n.ultimoPuntaje ?? 'Sin resultado'}`));
      return item;
    }));
    document.getElementById('clasificacionRanking').replaceChildren(...ranking.jugadores.map(j => {
      const item = document.createElement('li'); item.classList.toggle('ranking-propio', Boolean(j.sosVos));
      if (j.sosVos) item.setAttribute('aria-label', `Tu posición: ${j.posicion}`);
      item.append(texto('span', String(j.posicion).padStart(2, '0')), texto('strong', `${j.jugador}${j.sosVos ? ' · Vos' : ''}`), texto('span', `${j.puntajeTotal} puntos`), texto('small', `${j.nivelesCompletados} niveles`));
      return item;
    }));
    mensaje.textContent = ranking.jugadores.length ? 'Se suma el mejor puntaje por nivel de todos tus intentos; reiniciar no borra esos logros.' : 'Todavía no hay jugadores clasificados.';
  } catch (error) { mensaje.textContent = error.message; boton.hidden = false; }
}
