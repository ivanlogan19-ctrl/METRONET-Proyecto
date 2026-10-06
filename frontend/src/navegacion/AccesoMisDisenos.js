import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { consultarJuego } from '../educacion/ClientePuntuacion.js';

let consultaPendiente;

// El desbloqueo histórico viene del servicio: reiniciar una campaña no lo revoca.
export function consultarAccesoMisDisenos() {
  if (obtenerSesionActiva()?.usuario?.rol === 'ADMIN') return Promise.resolve(true);
  if (!consultaPendiente) consultaPendiente = consultarJuego('/progreso')
    .then(progreso => progreso?.modoLibreDesbloqueado === true)
    .finally(() => { consultaPendiente = null; });
  return consultaPendiente;
}
