import { obtenerTipoNavegacion } from '../navegacion/TipoNavegacion.js';
import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import './identificacion-nivel.css';
import { CONFIGURACION_TRANSICION } from './ConfiguracionTransicion.js';
import { gestorMusica } from '../audio/GestorMusica.js';
import { consumirIdentificacionPresentada } from './IdentificacionPresentada.js';

export const DURACION_IDENTIFICACION_MS = CONFIGURACION_TRANSICION.identificacionMs;
const CLAVE_ENTRADA = 'metronet:entrada-recorrido';
let entradaLocal = null;
let entradaActiva = null;

// Transporta un evento ya comprobado entre documentos, nunca un desbloqueo.
// Se consume una sola vez; recargar o volver desde el historial no lo reproduce.
export function registrarEntradaRecorrido(inicio) {
  entradaLocal = { idDiseno: inicio.idDiseno, idEscenario: inicio.idEscenario,
    idUsuario: obtenerSesionActiva()?.usuario?.idUsuario, creada: Date.now() };
  try { sessionStorage.setItem(CLAVE_ENTRADA, JSON.stringify(entradaLocal)); } catch { /* La presentación es opcional. */ }
}

function consumirEntradaRecorrido(idDiseno, escenario) {
  const eventoEnEsteDocumento = Boolean(entradaLocal);
  let entrada = entradaLocal;
  entradaLocal = null;
  try { entrada ??= JSON.parse(sessionStorage.getItem(CLAVE_ENTRADA)); sessionStorage.removeItem(CLAVE_ENTRADA); } catch { /* Sin almacenamiento, saludo normal. */ }
  const navegacion = obtenerTipoNavegacion();
  return escenario?.numero === null && entrada?.idDiseno === idDiseno
    && entrada.idEscenario === escenario.idEscenario
    && entrada.idUsuario != null && entrada.idUsuario === obtenerSesionActiva()?.usuario?.idUsuario
    && Date.now() - entrada.creada >= 0 && Date.now() - entrada.creada < 30000
    && (eventoEnEsteDocumento || !['reload', 'back_forward'].includes(navegacion));
}

// Mantiene estable el editor mientras llegan sus datos; el reloj del cartel
// empieza al llamar mostrar(), cuando la red ya está renderizada.
export function crearIdentificacionNivel(contenedor) {
  entradaActiva?.cancelar();
  const cobertura = document.createElement('section');
  cobertura.className = 'metronet-identificacion';
  cobertura.dataset.fase = 'preparando';
  cobertura.setAttribute('aria-label', 'Entrada al nivel');
  const cartel = document.createElement('div');
  cartel.className = 'metronet-identificacion__cartel';
  cartel.setAttribute('role', 'status');
  cartel.setAttribute('aria-live', 'polite');
  cartel.tabIndex = -1;
  cartel.hidden = true;
  cobertura.append(cartel);
  let terminada = false, temporizador, resolver;
  const finalizada = new Promise(resolve => { resolver = resolve; });
  const inerteAnterior = contenedor?.inert ?? false;
  const focoAnterior = document.activeElement;
  const observador = new MutationObserver(() => { if (!cobertura.isConnected) cancelar(); });
  function finalizar(continuar) {
    if (terminada) return;
    terminada = true;
    clearTimeout(temporizador);
    observador.disconnect();
    window.removeEventListener('pagehide', cancelar);
    window.removeEventListener('popstate', cancelar);
    document.removeEventListener('keydown', alTeclado);
    cobertura.remove();
    if (contenedor) contenedor.inert = inerteAnterior;
    if (document.activeElement === document.body && focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
    if (entradaActiva === entrada) entradaActiva = null;
    resolver(continuar);
  }
  function cancelar() { finalizar(false); }
  function alTeclado(e) { if (e.key === 'Escape') { e.preventDefault(); finalizar(true); } }
  const entrada = {
    cancelar,
    async mostrar(escenario, idDiseno, { modo } = {}) {
      if (terminada) return false;
      const nivel = Number.isInteger(escenario?.numero);
      const libre = escenario?.numero === null || modo === 'EDICION_LIBRE';
      if (!nivel && !libre) { finalizar(true); return true; }
      gestorMusica.establecerContexto('gameplay');
      if (nivel && consumirIdentificacionPresentada(idDiseno, escenario.idEscenario)) { finalizar(true); return true; }
      const especial = consumirEntradaRecorrido(idDiseno, escenario);
      const titulo = document.createElement('strong');
      titulo.textContent = especial ? 'RECORRIDO COMPLETADO' : nivel ? `NIVEL ${escenario.numero}` : 'MODO LIBRE';
      cartel.append(titulo);
      if (especial) {
        const subtitulo = document.createElement('p');
        subtitulo.textContent = 'ESTÁS LISTO PARA EL MODO LIBRE';
        cartel.append(subtitulo);
      }
      cobertura.dataset.fase = 'identificacion';
      cobertura.style.setProperty('--identificacion-duracion', `${DURACION_IDENTIFICACION_MS}ms`);
      cartel.hidden = false;
      cartel.focus({ preventScroll: true });
      // No depende de animationend, frames ni del estado del audio.
      temporizador = setTimeout(() => finalizar(true), DURACION_IDENTIFICACION_MS);
      return finalizada;
    },
  };
  try {
    if (contenedor) contenedor.inert = true;
    document.body.append(cobertura);
    window.addEventListener('pagehide', cancelar);
    window.addEventListener('popstate', cancelar);
    document.addEventListener('keydown', alTeclado);
    observador.observe(document.body, { childList: true });
    entradaActiva = entrada;
  } catch { finalizar(true); }
  return entrada;
}
