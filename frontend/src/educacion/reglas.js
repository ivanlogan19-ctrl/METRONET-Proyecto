import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';
import { iconoRetro } from '../interfaz/IconosRetro.js';

import politica from './puntuacion-progreso.json';

// Comparte los valores publicados con el backend. No modifica la política de un intento.
// Esta pantalla no calcula ni registra puntajes.
if (requerirSesion('/reglas.html')) {
  inicializarNavegacion({ actual: 'reglas' });
}

function fila(tabla, valores) {
  const tr = document.createElement('tr');
  for (const valor of valores) { const td = document.createElement('td'); td.textContent = valor; tr.append(td); }
  document.querySelector(`${tabla} tbody`)?.append(tr);
}
for (let descuento = 0; descuento <= politica.descuentoMaximo; descuento += politica.descuentoPorEjecucionSinAvance) {
  fila('#ejemplosPuntos', [descuento === 0 ? 'Sin descuentos' : `−${descuento}`, politica.puntosBase - descuento]);
}

document.querySelectorAll('[data-puntos]').forEach(nodo => {
  nodo.textContent = politica[nodo.dataset.puntos];
});
document.getElementById('maximoRanking').textContent = politica.puntosBase * politica.practicasGratuitasPorNivel.length;
document.querySelectorAll('[data-icono-regla]').forEach(nodo => {
  nodo.innerHTML = iconoRetro(nodo.dataset.iconoRegla);
});

// Mismo patrón de pestañas accesibles que la administración de niveles.
const pestanas = [...document.querySelectorAll('.metronet-reglas__pestanas [role="tab"]')];
function mostrarTema(boton) {
  for (const pestana of pestanas) {
    const activa = pestana === boton;
    pestana.setAttribute('aria-selected', String(activa));
    pestana.tabIndex = activa ? 0 : -1;
    document.getElementById(pestana.getAttribute('aria-controls')).hidden = !activa;
  }
}
for (const pestana of pestanas) {
  pestana.addEventListener('click', () => mostrarTema(pestana));
  pestana.addEventListener('keydown', evento => {
    const indice = pestanas.indexOf(pestana);
    const siguiente = { ArrowRight: (indice + 1) % pestanas.length,
      ArrowLeft: (indice + pestanas.length - 1) % pestanas.length,
      Home: 0, End: pestanas.length - 1 }[evento.key];
    if (siguiente === undefined) return;
    evento.preventDefault();
    mostrarTema(pestanas[siguiente]);
    pestanas[siguiente].focus();
  });
}
