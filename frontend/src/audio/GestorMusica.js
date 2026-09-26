import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { PISTAS_MUSICA, CONTEXTOS_MUSICA_PUNTUAL, VOLUMEN_MUSICA_INICIAL, DURACION_ENTRADA_MS } from './ConfiguracionAudio.js';

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
    this.pistaFinalizada = false;
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
      if (this.contexto !== 'auth' && !obtenerSesionActiva()) this.cerrarSesion();
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

  usarContextoTemporal(contexto, { reiniciar = false } = {}) {
    // Una transición sin pista no necesita instalar listeners de reproducción.
    if (PISTAS_MUSICA[contexto]) this.inicializar();
    const id = Symbol(contexto);
    this.temporales.set(id, contexto);
    if (reiniciar && PISTAS_MUSICA[contexto]) this.prepararPista(PISTAS_MUSICA[contexto], true);
    this.sincronizar();
    return () => { if (this.temporales.delete(id)) this.sincronizar(); };
  }

  obtenerContexto() { return [...this.temporales.values()].at(-1) ?? this.contexto; }
  puedeReproducir() {
    try {
      const contexto = this.obtenerContexto();
      return this.paginaActiva && !document.hidden && !this.silenciado && this.volumen > 0
        // El acceso tiene música antes de autenticar; gameplay sigue exigiendo sesión.
        && (contexto === 'auth' || Boolean(obtenerSesionActiva())) && PISTAS_MUSICA[contexto] === this.pista;
    } catch { return false; }
  }

  prepararPista(pista, reiniciar = false) {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.dataset.musicaMetronet = '';
      this.audio.hidden = true;
      this.audio.preload = 'auto';
      this.audio.addEventListener('loadedmetadata', () => {
        const posicion = this.posiciones[this.pista];
        if (this.audio.loop && Number.isFinite(posicion) && posicion >= 0 && Number.isFinite(this.audio.duration)) {
          try { this.audio.currentTime = posicion % this.audio.duration; } catch { /* El navegador puede no permitir seek todavía. */ }
        }
        this.notificar();
      });
      this.audio.addEventListener('error', () => { this.error = true; this.pausar(); this.notificar(); });
      this.audio.addEventListener('ended', () => {
        this.pistaFinalizada = true;
        this.notificar();
      });
      for (const evento of ['playing', 'pause', 'timeupdate']) this.audio.addEventListener(evento, () => this.notificar());
      document.body.append(this.audio);
    }
    if (this.pista === pista && !reiniciar) return;
    this.pausar();
    this.pista = pista;
    this.pistaFinalizada = false;
    this.error = false;
    this.esperandoGesto = false;
    // Las presentaciones puntuales empiezan desde cero y se reproducen una sola vez.
    this.audio.loop = !CONTEXTOS_MUSICA_PUNTUAL.some(contexto => PISTAS_MUSICA[contexto] === pista);
    this.audio.src = pista;
    this.audio.load();
  }

  sincronizar(reintentarInterrupcion = true) {
    const pista = PISTAS_MUSICA[this.obtenerContexto()];
    if (pista) this.prepararPista(pista);
    if (!pista || !this.puedeReproducir() || this.error || (this.audio?.ended && !this.audio.loop)) {
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
      // si el usuario ya volvió a un contexto con música; no insistir ante bloqueo de autoplay.
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
    if (this.pista && this.audio.loop && this.audio.readyState > 0 && Number.isFinite(this.audio.currentTime)) {
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
    // Cerrar sesión no convierte la pantalla anterior en una pantalla de acceso.
    this.contexto = 'general';
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
      posicion: this.audio?.currentTime ?? 0, duracion: this.audio?.duration ?? 0, finalizada: this.pistaFinalizada,
      disponible: Boolean(PISTAS_MUSICA[this.obtenerContexto()]), error: this.error };
  }
  suscribir(oyente) { this.oyentes.add(oyente); oyente(this.obtenerEstado()); return () => this.oyentes.delete(oyente); }
  notificar() { const estado = this.obtenerEstado(); this.oyentes.forEach(oyente => oyente(estado)); }
}

// También evita duplicados si el servidor de desarrollo sirve dos versiones del módulo.
const CLAVE_GESTOR = Symbol.for('metronet:gestor-musica');
export const gestorMusica = window[CLAVE_GESTOR] ??= new GestorMusica();
