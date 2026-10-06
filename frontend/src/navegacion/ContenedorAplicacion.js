import { gestorMusica } from '../audio/GestorMusica.js';

const CLAVE = Symbol.for('metronet:contenedor');
const pantallas = new Set(['/', '/index.html', '/login.html', '/admin-login.html', '/registro.html',
  '/recuperar-contrasena.html', '/verificar-codigo.html', '/nueva-contrasena.html', '/mantenimiento.html', '/inicio.html',
  '/escenarios.html', '/aprendizaje.html', '/ranking.html', '/disenos.html', '/perfil.html', '/privacidad.html', '/admin.html', '/simulacion.html']);
const marco = document.querySelector('#pantalla-metronet');
const error = document.querySelector('#error-pantalla');

function rutaPermitida(ruta) {
  try {
    const url = new URL(ruta, location.origin);
    return url.origin === location.origin && pantallas.has(url.pathname) ? url : null;
  } catch { return null; }
}

const parametros = new URLSearchParams(location.search);
const solicitada = rutaPermitida(parametros.get('destino'));
// Abrir directamente el contenedor con una URL guardada también es un arranque.
// Los cambios de pantalla dentro del iframe no vuelven a crear el contenedor.
const inicial = solicitada && !new Set(['/', '/index.html', '/inicio.html', '/escenarios.html',
  '/aprendizaje.html', '/ranking.html', '/disenos.html', '/perfil.html', '/admin.html', '/simulacion.html']).has(solicitada.pathname)
  ? solicitada : new URL('/login.html', location.origin);
let primeraVista = true;
function recibirEntrada(vista) {
  if (!primeraVista || vista !== marco.contentWindow) return null;
  primeraVista = false;
  return { tipo: parametros.get('tipo'), posicion: { x: Number(parametros.get('x')) || 0, y: Number(parametros.get('y')) || 0 } };
}
function sincronizar(vista) {
  if (vista !== marco.contentWindow) return;
  const url = rutaPermitida(vista.location.href);
  if (!url) return;
  // El iframe mantiene el historial nativo compartido. No añadir otra entrada
  // por navegación: duplicaría Atrás/Adelante y rompería los redirects de sesión.
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  document.title = vista.document.title || 'METRONET';
  marco.title = document.title;
  error.hidden = true;
}

window[CLAVE] = Object.freeze({ gestorMusica, sincronizar, recibirEntrada });
window.addEventListener('pagehide', () => {
  // Chrome captura el estado del historial antes de pagehide al recargar.
  // Transportar solo el scroll de esta salida, por pestaña y por ruta exacta.
  try {
    const vista = marco.contentWindow;
    sessionStorage.setItem('metronet:salida-contenedor', JSON.stringify({
      ruta: vista.location.pathname + vista.location.search + vista.location.hash,
      instante: Date.now(), posicion: { x: vista.scrollX, y: vista.scrollY },
    }));
  } catch { /* Un documento no accesible no debe impedir salir. */ }
});
marco.addEventListener('load', () => {
  try {
    if (marco.contentWindow.location.href === 'about:blank') return;
    if (!marco.contentDocument?.querySelector('body') || !rutaPermitida(marco.contentWindow.location.href)) throw new Error('Pantalla no disponible');
    sincronizar(marco.contentWindow);
    if (!marco.contentDocument.documentElement.dataset.contextoMusical) gestorMusica.establecerContexto('general');
  } catch {
    error.hidden = false;
    const respaldo = rutaPermitida(location.href) ?? inicial;
    respaldo.searchParams.set('documento', '1');
    document.querySelector('#abrir-documento').href = respaldo.href;
  }
});
marco.src = inicial.href;
