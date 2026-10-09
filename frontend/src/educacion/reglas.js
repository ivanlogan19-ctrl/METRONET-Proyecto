import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion } from '../navegacion/NavegacionAplicacion.js';

import politica from './puntuacion-progreso.json';

// Comparte los valores publicados con el backend. No modifica la política de un intento.
// Esta pantalla no calcula ni registra puntajes.
if (requerirSesion('/reglas.html')) inicializarNavegacion({ actual: 'reglas' });

function fila(tabla, valores) {
  const tr = document.createElement('tr');
  for (const valor of valores) { const td = document.createElement('td'); td.textContent = valor; tr.append(td); }
  document.querySelector(`${tabla} tbody`)?.append(tr);
}
for (let descuento = 0; descuento <= politica.descuentoMaximo; descuento += politica.descuentoPorEjecucionSinAvance) {
  fila('#ejemplosPuntos', [descuento === 0 ? 'Sin descuentos' : `−${descuento}`, politica.puntosBase - descuento]);
}
