import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { consultarJuego } from '../educacion/ClientePuntuacion.js';

export const MENSAJE_DISENOS_BLOQUEADOS = 'Completá todos los niveles de una campaña para acceder a Mis diseños y crear tus propias redes.';
let consultaPendiente;

// El desbloqueo histórico viene del servicio: reiniciar una campaña no lo revoca.
export function consultarAccesoMisDisenos() {
  if (obtenerSesionActiva()?.usuario?.rol === 'ADMIN') return Promise.resolve(true);
  if (!consultaPendiente) consultaPendiente = consultarJuego('/progreso')
    .then(progreso => progreso?.modoLibreDesbloqueado === true)
    .finally(() => { consultaPendiente = null; });
  return consultaPendiente;
}

export function aplicarAccesoMisDisenos(enlace, permitido) {
  enlace.dataset.rutaDisenos ||= enlace.getAttribute('href');
  enlace.classList.toggle('metronet-acceso-bloqueado', !permitido);
  if (permitido) {
    enlace.href = enlace.dataset.rutaDisenos;
    enlace.removeAttribute('aria-disabled'); enlace.removeAttribute('title');
    enlace.removeAttribute('tabindex'); enlace.removeAttribute('role');
  } else {
    enlace.removeAttribute('href'); enlace.setAttribute('aria-disabled', 'true');
    enlace.setAttribute('role', 'link'); enlace.tabIndex = 0;
    enlace.title = MENSAJE_DISENOS_BLOQUEADOS;
  }
}
