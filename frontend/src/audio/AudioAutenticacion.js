import { gestorMusica } from './GestorMusica.js';
import { crearControlMusica } from './ControlMusica.js';

// Entrada de acceso, registro, recuperación y lectura del consentimiento.
const tarjeta = document.querySelector('.auth-card');
if (tarjeta && !document.querySelector('[data-control-musica]')) {
  const control = crearControlMusica();
  control.elemento.classList.add('metronet-audio--autenticacion');
  tarjeta.prepend(control.elemento);
  gestorMusica.establecerContexto('auth');
}
