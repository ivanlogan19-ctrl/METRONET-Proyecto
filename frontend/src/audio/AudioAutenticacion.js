import { gestorMusica } from './GestorMusica.js';
import { crearControlMusica } from './ControlMusica.js';

// Entrada exclusiva de login, registro y recuperación. La privacidad y el perfil
// usan otras entradas y no heredan la pista por compartir estilos o componentes.
const tarjeta = document.querySelector('.auth-card');
if (tarjeta && !tarjeta.querySelector('[data-control-musica]')) {
  const control = crearControlMusica();
  control.elemento.classList.add('metronet-audio--autenticacion');
  tarjeta.prepend(control.elemento);
  gestorMusica.establecerContexto('auth');
}
