import { iniciarAudioBienvenida } from '../audio/AudioBienvenida.js';
import { obtenerDestinoSeguro } from './DestinoSeguro.js';

const CLAVE_PENDIENTE = 'metronet:bienvenida-pendiente';
let bienvenidaActiva = null;

function quitarPendiente() {
  try { sessionStorage.removeItem(CLAVE_PENDIENTE); } catch { /* La presentación no exige almacenamiento. */ }
}

// Una recarga tras autenticar continúa el acceso sin repetir la secuencia ni el POST.
export function reanudarBienvenida(sesion) {
  try {
    const pendiente = JSON.parse(sessionStorage.getItem(CLAVE_PENDIENTE));
    if (!pendiente) return false;
    quitarPendiente();
    if (!sesion?.token || pendiente.rol !== sesion.usuario?.rol
      || pendiente.origen !== location.pathname + location.search
      || !pendiente.destino?.startsWith('/') || pendiente.destino.startsWith('//')) return false;
    location.replace(obtenerDestinoSeguro(pendiente.destino));
    return true;
  } catch { return false; }
}

// Único propietario de la navegación. La música avisa su final; los fallos visuales
// y los límites del audio permiten acceder sin depender de frames ni descargas.
export function continuarConBienvenida(sesion, destino) {
  destino = obtenerDestinoSeguro(destino);
  if (bienvenidaActiva) return bienvenidaActiva;
  bienvenidaActiva = new Promise(resolve => {
    let terminada = false, cobertura, vista, audio;
    const anteriores = new Map();
    const limpiar = () => {
      window.removeEventListener('pagehide', salir);
      window.removeEventListener('popstate', cancelar);
      try { vista?.eliminar(); } catch { /* Un fallo de limpieza tampoco retiene la navegación. */ }
      cobertura?.remove();
      anteriores.forEach((inert, elemento) => { elemento.inert = inert; });
      audio?.eliminar();
    };
    const continuar = () => {
      if (terminada) return;
      terminada = true;
      audio?.eliminar({ alNavegar: true });
      quitarPendiente();
      // La cobertura permanece hasta pagehide: no reaparece el login entre pantallas.
      location.assign(destino);
      resolve(true);
    };
    const salir = () => {
      limpiar();
      if (!terminada) { terminada = true; resolve(false); }
      bienvenidaActiva = null;
    };
    const cancelar = () => { quitarPendiente(); salir(); };
    window.addEventListener('pagehide', salir);
    window.addEventListener('popstate', cancelar);
    let reducido = false;
    try { reducido = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* Usa el límite normal. */ }
    const inicio = performance.now();
    try {
      audio = iniciarAudioBienvenida({ reducido, alTerminar: continuar });
      try { sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ destino, rol: sesion.usuario?.rol, origen: location.pathname + location.search })); } catch { /* Sigue sin almacenamiento. */ }
      cobertura = document.createElement('section');
      cobertura.className = 'metronet-bienvenida';
      cobertura.dataset.movimientoReducido = String(reducido);
      cobertura.setAttribute('role', 'dialog');
      cobertura.setAttribute('aria-modal', 'true');
      cobertura.setAttribute('aria-label', 'Bienvenido a METRONET');
      cobertura.tabIndex = -1;
      // Cobertura mínima inmediata, incluso si falla la descarga del módulo visual/CSS.
      Object.assign(cobertura.style, { position: 'fixed', inset: '0', zIndex: '2000', overflow: 'auto', backgroundColor: '#060c1c', color: '#edf5ff' });
      const titulo = document.createElement('h1');
      titulo.textContent = 'Bienvenido a METRONET';
      cobertura.append(titulo);
      for (const elemento of document.body.children) { anteriores.set(elemento, elemento.inert); elemento.inert = true; }
      document.body.append(cobertura);
      cobertura.focus({ preventScroll: true });
      cobertura.addEventListener('keydown', evento => {
        if (evento.key === 'Escape') { evento.preventDefault(); continuar(); }
        if (evento.key === 'Tab') {
          evento.preventDefault();
          (cobertura.querySelector('button') ?? cobertura).focus();
        }
      });
      import('./PantallaBienvenida.js').then(({ crearPantallaBienvenida }) => {
        if (!terminada) vista = crearPantallaBienvenida(cobertura, {
          reducido, continuar, inicio,
          obtenerTiempo: () => audio.obtenerTiempo(),
          duracionSalida: audio.obtenerDuracionSalida(),
        });
      }).catch(continuar);
    } catch { continuar(); }
  });
  return bienvenidaActiva;
}
