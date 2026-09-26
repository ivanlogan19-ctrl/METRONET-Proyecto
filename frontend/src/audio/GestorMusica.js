import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { PISTAS_MUSICA, VOLUMEN_MUSICA_INICIAL, DURACION_ENTRADA_MS } from './ConfiguracionAudio.js';

const CLAVE_PREFERENCIAS = 'metronet:musica:preferencias';
const CLAVE_POSICIONES = 'metronet:musica:posiciones';

function leer(almacen, clave, defecto) {
  try { return JSON.parse(window[almacen].getItem(clave)) ?? defecto; } catch { return defecto; }
}
function guardar(almacen, clave, valor) {
  try { window[almacen].setItem(clave, JSON.stringify(valor)); } catch { /* El audio no exige almacenamiento. */ }
}
function limitarVolumen(valor) { return Math.max(0, Math.min(1, valor)); }

// Un único reproductor por documento; sessionStorage conserva el punto al navegar
// entre las páginas existentes. No participa en autenticación, reglas ni simulación.
class GestorMusica {
  constructor() {
    const preferencias = leer('localStorage', CLAVE_PREFERENCIAS, {});
    this.volumen = Number.isFinite(preferencias.volumen) ? limitarVolumen(preferencias.volumen) : VOLUMEN_MUSICA_INICIAL;
    this.silenciado = preferencias.silenciado === true;
    this.contexto = 'general';
    this.temporales = new Map();
    this.audio = null;
    this.pista = null;
    this.posiciones = leer('sessionStorage', CLAVE_POSICIONES, {});
    if (!this.posiciones || typeof this.posiciones !== 'object' || Array.isArray(this.posiciones)) this.posiciones = {};
    this.oyentes = new Set();
    this.paginaActiva = true;
    this.esperandoGesto = false;
    this.error = false;
    this.reproduccionPendiente = null;
    this.temporizadorEntrada = null;
    this.inicializado = false;
  }

  inicializar() {
    if (this.inicializado) return;
    this.inicializado = true;
    document.addEventListener('visibilitychange', () => this.sincronizar());
    window.addEventListener('pagehide', () => { this.paginaActiva = false; this.pausar(); });
    window.addEventListener('pageshow', () => { this.paginaActiva = true; this.sincronizar(); });
    window.addEventListener('metronet:sesion-cerrada', () => this.cerrarSesion());
    window.addEventListener('storage', evento => {
      if (evento.key === CLAVE_PREFERENCIAS) {
        const preferencias = leer('localStorage', CLAVE_PREFERENCIAS, {});
        this.silenciado = preferencias.silenciado === true;
        if (Number.isFinite(preferencias.volumen)) this.volumen = limitarVolumen(preferencias.volumen);
      }
      if (!obtenerSesionActiva()) this.cerrarSesion();
      else this.sincronizar();
    });
    const alInteractuar = evento => {
      if (!evento.isTrusted || !this.esperandoGesto || evento.target.closest?.('[data-control-musica]')) return;
      this.esperandoGesto = false;
      this.sincronizar();
    };
    document.addEventListener('pointerdown', alInteractuar);
    document.addEventListener('keydown', alInteractuar);
  }

  establecerContexto(contexto) {
    this.inicializar();
    this.contexto = Object.hasOwn(PISTAS_MUSICA, contexto) ? contexto : 'general';
    this.sincronizar();
  }

  usarContextoTemporal(contexto) {
    // Una transición sin pista no necesita instalar listeners de reproducción.
    if (PISTAS_MUSICA[contexto]) this.inicializar();
    const id = Symbol(contexto);
    this.temporales.set(id, contexto);
    this.sincronizar();
    return () => { if (this.temporales.delete(id)) this.sincronizar(); };
  }

  obtenerContexto() { return [...this.temporales.values()].at(-1) ?? this.contexto; }
  puedeReproducir() {
    try {
      return this.paginaActiva && !document.hidden && !this.silenciado && this.volumen > 0
        && Boolean(obtenerSesionActiva()) && PISTAS_MUSICA[this.obtenerContexto()] === this.pista;
    } catch { return false; }
  }

  prepararPista(pista) {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.dataset.musicaMetronet = '';
      this.audio.hidden = true;
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.addEventListener('loadedmetadata', () => {
        const posicion = this.posiciones[this.pista];
        if (Number.isFinite(posicion) && posicion >= 0 && Number.isFinite(this.audio.duration)) {
          try { this.audio.currentTime = posicion % this.audio.duration; } catch { /* El navegador puede no permitir seek todavía. */ }
        }
      });
      this.audio.addEventListener('error', () => { this.error = true; this.pausar(); this.notificar(); });
      for (const evento of ['playing', 'pause']) this.audio.addEventListener(evento, () => this.notificar());
      document.body.append(this.audio);
    }
    if (this.pista === pista) return;
    this.pausar();
    this.pista = pista;
    this.error = false;
    this.audio.src = pista;
    this.audio.load();
  }

  sincronizar(reintentarInterrupcion = true) {
    const pista = PISTAS_MUSICA[this.obtenerContexto()];
    if (pista) this.prepararPista(pista);
    if (!pista || !this.puedeReproducir() || this.error) {
      this.pausar(); this.notificar(); return;
    }
    if (!this.audio.paused) {
      if (this.temporizadorEntrada === null) this.audio.volume = this.volumen;
      this.notificar(); return;
    }
    if (this.reproduccionPendiente || this.esperandoGesto) { this.notificar(); return; }
    this.audio.volume = 0;
    let interrumpida = false;
    // play puede rechazar por autoplay o por un cambio de contexto durante la carga.
    this.reproduccionPendiente = Promise.resolve().then(() => {
      if (this.puedeReproducir()) return this.audio.play();
    }).then(() => {
      if (!this.puedeReproducir()) this.pausar();
      else if (!this.audio.paused) { this.esperandoGesto = false; this.aparecer(); }
    }).catch(error => {
      if (error.name === 'NotAllowedError') this.esperandoGesto = true;
      else if (error.name === 'AbortError') interrumpida = true;
      else if (error.name !== 'AbortError') this.error = true;
    }).finally(() => {
      this.reproduccionPendiente = null;
      this.notificar();
      // Una pausa puede cancelar play antes de que termine. Recuperar una vez
      // si el usuario ya volvió a gameplay; nunca insistir ante bloqueo de autoplay.
      if (interrumpida && reintentarInterrupcion && this.puedeReproducir() && !this.error) this.sincronizar(false);
    });
    this.notificar();
  }

  aparecer() {
    this.cancelarEntrada();
    const inicio = performance.now();
    const avanzar = () => {
      const ahora = performance.now();
      if (!this.puedeReproducir()) { this.pausar(); return; }
      const avance = Math.min(1, (ahora - inicio) / DURACION_ENTRADA_MS);
      this.audio.volume = this.volumen * avance;
      this.temporizadorEntrada = avance < 1 ? setTimeout(avanzar, 25) : null;
    };
    this.temporizadorEntrada = setTimeout(avanzar, 25);
  }
  cancelarEntrada() {
    if (this.temporizadorEntrada !== null) clearTimeout(this.temporizadorEntrada);
    this.temporizadorEntrada = null;
  }
  pausar() {
    this.cancelarEntrada();
    if (!this.audio) return;
    if (this.pista && this.audio.readyState > 0 && Number.isFinite(this.audio.currentTime)) {
      this.posiciones[this.pista] = this.audio.currentTime;
      guardar('sessionStorage', CLAVE_POSICIONES, this.posiciones);
    }
    this.audio.pause();
  }
  establecerVolumen(valor) {
    if (!Number.isFinite(valor)) return;
    this.volumen = limitarVolumen(valor);
    this.esperandoGesto = false;
    this.guardarPreferencias(); this.sincronizar();
  }
  establecerSilencio(silenciado) {
    this.silenciado = Boolean(silenciado);
    this.esperandoGesto = false;
    this.guardarPreferencias(); this.sincronizar();
  }
  guardarPreferencias() {
    guardar('localStorage', CLAVE_PREFERENCIAS, { volumen: this.volumen, silenciado: this.silenciado });
  }
  activar() { this.esperandoGesto = false; this.sincronizar(); }
  cerrarSesion() {
    this.contexto = 'auth';
    this.temporales.clear();
    this.pausar();
    this.posiciones = {};
    guardar('sessionStorage', CLAVE_POSICIONES, {});
    if (this.audio?.readyState) this.audio.currentTime = 0;
    this.notificar();
  }
  obtenerEstado() {
    return { contexto: this.obtenerContexto(), volumen: this.volumen, silenciado: this.silenciado,
      reproduciendo: Boolean(this.audio && !this.audio.paused), esperandoGesto: this.esperandoGesto,
      disponible: Boolean(PISTAS_MUSICA[this.obtenerContexto()]), error: this.error };
  }
  suscribir(oyente) { this.oyentes.add(oyente); oyente(this.obtenerEstado()); return () => this.oyentes.delete(oyente); }
  notificar() { const estado = this.obtenerEstado(); this.oyentes.forEach(oyente => oyente(estado)); }
}

// También evita duplicados si el servidor de desarrollo sirve dos versiones del módulo.
const CLAVE_GESTOR = Symbol.for('metronet:gestor-musica');
export const gestorMusica = window[CLAVE_GESTOR] ??= new GestorMusica();
