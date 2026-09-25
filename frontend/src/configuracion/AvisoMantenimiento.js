import { EVENTO_CONFIGURACION, MENSAJE_MANTENIMIENTO, estaMantenimientoActivo, obtenerConfiguracionAplicacion } from './ConfiguracionAplicacion.js';
import './mantenimiento.css';

export function inicializarAvisoMantenimiento(contenedor, sesion) {
  if (sesion.usuario?.rol !== 'JUGADOR') return () => {};
  const aviso = document.createElement('aside');
  aviso.className = 'metronet-aviso-mantenimiento';
  aviso.setAttribute('role', 'status');
  aviso.hidden = true;
  const titulo = document.createElement('strong');
  titulo.textContent = 'ESTADO DEL SISTEMA // MANTENIMIENTO';
  const texto = document.createElement('p');
  texto.textContent = MENSAJE_MANTENIMIENTO;
  aviso.append(titulo, texto);
  contenedor.append(aviso);
  const actualizar = () => { aviso.hidden = !estaMantenimientoActivo(sesion); };
  const consultar = () => { if (!document.hidden) void obtenerConfiguracionAplicacion(sesion); };
  window.addEventListener(EVENTO_CONFIGURACION, actualizar);
  window.addEventListener('focus', consultar);
  document.addEventListener('visibilitychange', consultar);
  actualizar();
  void obtenerConfiguracionAplicacion(sesion);
  return () => {
    window.removeEventListener(EVENTO_CONFIGURACION, actualizar);
    window.removeEventListener('focus', consultar);
    document.removeEventListener('visibilitychange', consultar);
    aviso.remove();
  };
}
