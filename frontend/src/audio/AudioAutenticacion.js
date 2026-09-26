import { gestorMusica } from './GestorMusica.js';
import { crearControlMusica } from './ControlMusica.js';

// Entrada exclusiva de login, registro y recuperación. La privacidad y el perfil
// usan otras entradas y no heredan la pista por compartir estilos o componentes.
const tarjeta = document.querySelector('.auth-card');
if (tarjeta && !document.querySelector('[data-control-musica]')) {
  const control = crearControlMusica();
  control.elemento.classList.add('metronet-audio--autenticacion');
  const esLogin = Boolean(tarjeta.querySelector('#loginForm, #loginAdminForm'));
  control.elemento.classList.toggle('metronet-audio--login', esLogin);
  (esLogin ? tarjeta.closest('.auth-page') : tarjeta).prepend(control.elemento);
  gestorMusica.establecerContexto('auth');
}
