let destinoContextual = null;

// Las pantallas con una barra reservada pueden reutilizar también los avisos globales.
export function registrarDestinoNotificaciones(mostrar) {
  destinoContextual = mostrar;
  return () => { if (destinoContextual === mostrar) destinoContextual = null; };
}

const DURACIONES_POR_TIPO = Object.freeze({
  info: 4200,
  exito: 4200,
  advertencia: 6200,
  error: 9000,
});

function normalizarTipo(tipo) {
  return Object.hasOwn(DURACIONES_POR_TIPO, tipo) ? tipo : 'info';
}

function obtenerContenedor() {
  const existente = document.querySelector('[data-notificaciones-metronet]');
  if (existente) return existente;
  const contenedor = document.createElement('section');
  contenedor.className = 'metronet-notificaciones';
  contenedor.dataset.notificacionesMetronet = '';
  contenedor.setAttribute('aria-label', 'Notificaciones de METRONET');
  document.body.append(contenedor);
  return contenedor;
}

export function mostrarNotificacion(texto, tipo = 'info', opciones = {}) {
  if (!texto) return;
  if (destinoContextual) { destinoContextual(texto, tipo); return; }
  const tipoNormalizado = normalizarTipo(tipo);
  const notificacion = document.createElement('article');
  const duracion = opciones.duracion ?? DURACIONES_POR_TIPO[tipoNormalizado];
  notificacion.className = `metronet-notificacion metronet-notificacion--${tipoNormalizado}`;
  notificacion.setAttribute('role', tipoNormalizado === 'error' ? 'alert' : 'status');
  notificacion.innerHTML = '<p></p><button type="button" aria-label="Cerrar notificación">×</button>';
  notificacion.querySelector('p').textContent = texto;
  let temporizador = null;
  const cerrar = () => {
    window.clearTimeout(temporizador);
    notificacion.remove();
  };
  temporizador = window.setTimeout(cerrar, duracion);
  notificacion.querySelector('button').addEventListener('click', cerrar);
  const contenedor = obtenerContenedor();
  while (contenedor.childElementCount >= 3) contenedor.firstElementChild?.remove();
  contenedor.append(notificacion);
}
