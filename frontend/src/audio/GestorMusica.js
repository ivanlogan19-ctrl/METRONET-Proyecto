import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { PISTAS_MUSICA, CONTEXTOS_MUSICA_PUNTUAL, VOLUMEN_MUSICA_INICIAL, DURACION_MEZCLA_MS, UMBRAL_CARGA_MUSICAL_MS } from './ConfiguracionAudio.js';

const CLAVE_PREFERENCIAS = 'metronet:musica:preferencias';
const CLAVE_POSICIONES = 'metronet:musica:posiciones';
const CLAVE_CONTINUIDAD = 'metronet:musica:continuidad';
const limitar = valor => Math.max(0, Math.min(1, valor));
function leer(almacen, clave, defecto) {
  try { return JSON.parse(window[almacen].getItem(clave)) ?? defecto; } catch { return defecto; }
}
function guardar(almacen, clave, valor) {
  try { window[almacen].setItem(clave, JSON.stringify(valor)); } catch { /* La música no exige almacenamiento. */ }
}

// Una autoridad por documento. Hasta dos pistas DIFERENTES durante una mezcla;
// las escenas y paneles nunca poseen el reproductor. En navegación HTML completa
// solo puede recuperarse la posición: no equivale a audio continuo entre documentos.
class GestorMusica {
  constructor() {
    const preferencias = leer('localStorage', CLAVE_PREFERENCIAS, {});
    this.volumen = Number.isFinite(preferencias.volumen) ? limitar(preferencias.volumen) : VOLUMEN_MUSICA_INICIAL;
    this.silenciado = preferencias.silenciado === true;
    this.posiciones = leer('sessionStorage', CLAVE_POSICIONES, {});
    if (!this.posiciones || typeof this.posiciones !== 'object' || Array.isArray(this.posiciones)) this.posiciones = {};
    this.continuidad = leer('sessionStorage', CLAVE_CONTINUIDAD, null);
    guardar('sessionStorage', CLAVE_CONTINUIDAD, null);
    this.contexto = 'general';
    this.temporales = new Map();
    this.canales = new Map();
    this.actual = null;
    this.oyentes = new Set();
    this.paginaActiva = true;
    this.inicializado = false;
    this.mezcla = null;
    this.temporizadorMezcla = null;
  }

  get audio() { return this.actual?.audio ?? null; }
  get pista() { return this.actual?.pista ?? null; }

  inicializar() {
    if (this.inicializado) return;
    this.inicializado = true;
    // La entrada asíncrona puede ejecutarse antes de que el parser cree body.
    if (!document.body) document.addEventListener('DOMContentLoaded', () => {
      for (const canal of this.canales.values()) document.body.prepend(canal.audio);
    }, { once: true });
    document.addEventListener('visibilitychange', () => this.sincronizar());
    window.addEventListener('pagehide', () => {
      const canal = this.actual;
      guardar('sessionStorage', CLAVE_CONTINUIDAD, canal?.audio.loop && !canal.audio.paused
        ? { pista: canal.pista, contexto: this.obtenerContexto(), instante: Date.now() } : null);
      this.paginaActiva = false; this.pausar();
    });
    window.addEventListener('pageshow', () => { this.paginaActiva = true; this.sincronizar(); });
    window.addEventListener('metronet:sesion-cerrada', () => this.cerrarSesion());
    window.addEventListener('storage', evento => {
      if (evento.key === CLAVE_PREFERENCIAS) {
        const preferencias = leer('localStorage', CLAVE_PREFERENCIAS, {});
        this.silenciado = preferencias.silenciado === true;
        if (Number.isFinite(preferencias.volumen)) this.volumen = limitar(preferencias.volumen);
      }
      if (this.contexto !== 'auth' && !obtenerSesionActiva()) this.cerrarSesion();
      else this.sincronizar();
    });
    const alInteractuar = evento => {
      if (!evento.isTrusted || !this.actual?.esperandoGesto || evento.target.closest?.('[data-control-musica]')) return;
      this.activar();
    };
    document.addEventListener('pointerdown', alInteractuar);
    document.addEventListener('keydown', alInteractuar);
  }

  tieneContinuidadReciente() {
    const antiguedad = Date.now() - this.continuidad?.instante;
    return Number.isFinite(antiguedad) && antiguedad >= 0 && antiguedad < 10000;
  }

  reanudarAlCargarDocumento(contexto) {
    // Solo anticipar una pista que ya sonaba. Una entrada tardía nunca debe
    // reemplazar el contexto decidido por la pantalla o una presentación.
    if (this.inicializado || !this.tieneContinuidadReciente()) return;
    if (!['auth', 'menu', 'admin', 'general'].includes(contexto)) return;
    const sesion = contexto === 'auth' ? null : obtenerSesionActiva();
    if (contexto !== 'auth' && !sesion) return;
    if (contexto === 'admin' && sesion.usuario.rol !== 'ADMIN') return;
    if (contexto === 'general') {
      // Editor/simulador: adelantar descarga y seek, pero el contexto real solo
      // lo confirma la pantalla al cargar el diseño. Nunca sonar sobre el nivel previo.
      if (this.continuidad.pista !== PISTAS_MUSICA.gameplay) return;
      this.inicializar();
      this.seleccionarPista(PISTAS_MUSICA.gameplay);
      this.actual.preparado = true;
      this.actual.ganancia = 0;
      this.aplicarVolumen();
    } else if (this.continuidad.pista === PISTAS_MUSICA[contexto]) {
      this.establecerContexto(contexto);
    }
  }

  establecerContexto(contexto) {
    this.inicializar();
    this.contexto = Object.hasOwn(PISTAS_MUSICA, contexto) ? contexto : 'general';
    this.sincronizar();
  }

  usarContextoTemporal(contexto, { reiniciar = false } = {}) {
    if (PISTAS_MUSICA[contexto]) this.inicializar();
    const id = Symbol(contexto);
    const temporal = { contexto, efectivo: contexto !== 'loading', temporizador: null };
    this.temporales.set(id, temporal);
    if (!temporal.efectivo) {
      temporal.temporizador = setTimeout(() => {
        temporal.temporizador = null; temporal.efectivo = true; this.sincronizar();
      }, UMBRAL_CARGA_MUSICAL_MS);
    } else {
      if (reiniciar && PISTAS_MUSICA[contexto]) this.seleccionarPista(PISTAS_MUSICA[contexto], true);
      this.sincronizar();
    }
    return () => {
      if (!this.temporales.delete(id)) return;
      clearTimeout(temporal.temporizador);
      if (temporal.efectivo) this.sincronizar();
    };
  }

  obtenerContexto() { return [...this.temporales.values()].filter(t => t.efectivo).at(-1)?.contexto ?? this.contexto; }
  puedeReproducir() {
    try {
      return this.paginaActiva && !document.hidden && !this.silenciado && this.volumen > 0
        && (this.obtenerContexto() === 'auth' || Boolean(obtenerSesionActiva()));
    } catch { return false; }
  }

  crearCanal(pista) {
    const audio = new Audio();
    audio.hidden = true; audio.preload = 'auto';
    audio.loop = !CONTEXTOS_MUSICA_PUNTUAL.some(contexto => PISTAS_MUSICA[contexto] === pista);
    const reanudado = audio.loop && this.continuidad?.pista === pista && this.tieneContinuidadReciente();
    const canal = { audio, pista, ganancia: reanudado ? 1 : 0, finalizada: false, error: false,
      esperandoGesto: false, pendiente: null, eliminado: false, eventos: [] };
    const escuchar = (evento, funcion) => { audio.addEventListener(evento, funcion); canal.eventos.push([evento, funcion]); };
    escuchar('loadedmetadata', () => {
      const posicion = this.posiciones[pista];
      if (audio.loop && Number.isFinite(posicion) && posicion >= 0 && Number.isFinite(audio.duration)) {
        try { audio.currentTime = posicion % audio.duration; } catch { /* Seek no disponible todavía. */ }
      }
      this.notificar();
    });
    escuchar('error', () => {
      canal.error = true;
      if (canal === this.actual) this.mezclarHacia(null);
      else this.eliminarCanal(canal);
      this.notificar();
    });
    escuchar('ended', () => { canal.finalizada = true; this.notificar(); });
    for (const evento of ['playing', 'pause', 'timeupdate']) escuchar(evento, () => this.notificar());
    audio.volume = this.volumen * canal.ganancia;
    audio.src = pista; audio.load();
    this.canales.set(pista, canal);
    return canal;
  }

  seleccionarPista(pista, reiniciar = false) {
    if (this.actual?.pista === pista && !reiniciar) return;
    this.cancelarMezcla();
    if (reiniciar && this.canales.has(pista)) this.eliminarCanal(this.canales.get(pista));
    let destino = this.canales.get(pista);
    // En A→B→C se conserva la salida más audible y se descarta la otra.
    const saliente = [...this.canales.values()].filter(c => c !== destino)
      .sort((a, b) => b.ganancia - a.ganancia)[0];
    for (const canal of [...this.canales.values()]) if (canal !== destino && canal !== saliente) this.eliminarCanal(canal);
    destino ??= this.crearCanal(pista);
    this.actual = destino;
    for (const canal of this.canales.values()) {
      canal.audio.toggleAttribute('data-musica-metronet', canal === destino);
      canal.audio.toggleAttribute('data-musica-saliente', canal !== destino);
      if (!canal.audio.isConnected) (document.body ?? document.documentElement).append(canal.audio);
    }
    // Mantener identificable el reproductor actual para controles y accesibilidad.
    (document.body ?? document.documentElement).prepend(destino.audio);
  }

  sincronizar(reintentar = true) {
    const pista = PISTAS_MUSICA[this.obtenerContexto()];
    if (pista) this.seleccionarPista(pista);
    if (!this.puedeReproducir()) { this.pausar(); this.notificar(); return; }
    const canal = this.actual;
    if (!pista || canal?.error || canal?.finalizada) { this.mezclarHacia(null); this.notificar(); return; }
    if (!canal.audio.paused) {
      // Repetir un contexto o cambiar menu→admin con el mismo archivo no toca play ni el fade.
      if (this.mezcla?.destino !== canal && (this.mezcla || canal.ganancia < 1 || this.canales.size > 1)) this.mezclarHacia(canal);
      else this.aplicarVolumen();
      this.notificar(); return;
    }
    if (canal.pendiente || canal.esperandoGesto) { this.notificar(); return; }
    if (canal.preparado) {
      canal.preparado = false;
      canal.ganancia = 1;
      this.aplicarVolumen();
    }
    let interrumpida = false;
    canal.pendiente = Promise.resolve().then(() => {
      if (!canal.eliminado && canal === this.actual && this.puedeReproducir() && PISTAS_MUSICA[this.obtenerContexto()] === canal.pista) return canal.audio.play();
    }).then(() => {
      if (canal.eliminado) return;
      if (canal !== this.actual || !this.puedeReproducir() || PISTAS_MUSICA[this.obtenerContexto()] !== canal.pista) {
        if (!this.mezcla) canal.audio.pause();
      } else if (!canal.audio.paused) { canal.esperandoGesto = false; this.mezclarHacia(canal); }
    }).catch(error => {
      if (canal.eliminado) return;
      if (error.name === 'NotAllowedError') canal.esperandoGesto = true;
      else if (error.name === 'AbortError') interrumpida = true;
      else canal.error = true;
      if (canal === this.actual && !interrumpida) this.mezclarHacia(null);
    }).finally(() => {
      canal.pendiente = null;
      if (canal.eliminado) return;
      this.notificar();
      if (interrumpida && reintentar && canal === this.actual && this.puedeReproducir()) this.sincronizar(false);
    });
    this.notificar();
  }

  mezclarHacia(destino) {
    if (this.mezcla?.destino === destino) return;
    this.cancelarMezcla();
    const origenes = new Map([...this.canales.values()].map(c => [c, c.ganancia]));
    const completar = () => {
      for (const canal of [...this.canales.values()]) {
        if (canal === destino) canal.ganancia = 1;
        else if (canal === this.actual) { canal.ganancia = 0; this.guardarPosicion(canal); canal.audio.pause(); }
        else this.eliminarCanal(canal);
      }
      this.aplicarVolumen();
    };
    if ([...origenes].every(([c, ganancia]) => ganancia === (c === destino ? 1 : 0))) { completar(); return; }
    const mezcla = { destino, inicio: performance.now() };
    this.mezcla = mezcla;
    const avanzar = () => {
      if (this.mezcla !== mezcla) return;
      const avance = limitar((performance.now() - mezcla.inicio) / DURACION_MEZCLA_MS);
      for (const [canal, inicio] of origenes) {
        if (!canal.eliminado) canal.ganancia = inicio + ((canal === destino ? 1 : 0) - inicio) * avance;
      }
      this.aplicarVolumen();
      if (avance < 1) this.temporizadorMezcla = setTimeout(avanzar, 25);
      else { this.cancelarMezcla(); completar(); this.notificar(); }
    };
    avanzar();
  }
  cancelarMezcla() {
    clearTimeout(this.temporizadorMezcla);
    this.temporizadorMezcla = null; this.mezcla = null;
  }
  aplicarVolumen() {
    for (const canal of this.canales.values()) canal.audio.volume = this.silenciado ? 0 : limitar(this.volumen * canal.ganancia);
  }
  guardarPosicion(canal) {
    if (canal.audio.loop && canal.audio.readyState > 0 && Number.isFinite(canal.audio.currentTime)) {
      this.posiciones[canal.pista] = canal.audio.currentTime;
      guardar('sessionStorage', CLAVE_POSICIONES, this.posiciones);
    }
  }
  eliminarCanal(canal) {
    canal.eliminado = true;
    this.guardarPosicion(canal);
    canal.eventos.forEach(([evento, funcion]) => canal.audio.removeEventListener(evento, funcion));
    canal.audio.pause(); canal.audio.removeAttribute('src'); canal.audio.load(); canal.audio.remove();
    this.canales.delete(canal.pista);
  }
  pausar() {
    this.cancelarMezcla();
    for (const canal of [...this.canales.values()]) {
      if (canal !== this.actual) this.eliminarCanal(canal);
      else { this.guardarPosicion(canal); canal.audio.pause(); canal.ganancia = 1; }
    }
    this.aplicarVolumen();
  }
  establecerVolumen(valor) {
    if (!Number.isFinite(valor)) return;
    this.volumen = limitar(valor);
    if (this.actual) this.actual.esperandoGesto = false;
    this.guardarPreferencias(); this.sincronizar();
  }
  establecerSilencio(silenciado) {
    this.silenciado = Boolean(silenciado);
    if (this.actual) this.actual.esperandoGesto = false;
    this.guardarPreferencias(); this.sincronizar();
  }
  guardarPreferencias() { guardar('localStorage', CLAVE_PREFERENCIAS, { volumen: this.volumen, silenciado: this.silenciado }); }
  activar() { if (this.actual) this.actual.esperandoGesto = false; this.sincronizar(); }
  cerrarSesion() {
    this.contexto = 'general';
    this.temporales.forEach(t => clearTimeout(t.temporizador)); this.temporales.clear();
    this.pausar(); this.posiciones = {}; this.continuidad = null;
    guardar('sessionStorage', CLAVE_POSICIONES, {}); guardar('sessionStorage', CLAVE_CONTINUIDAD, null);
    if (this.audio?.readyState) this.audio.currentTime = 0;
    this.notificar();
  }
  obtenerEstado() {
    return { contexto: this.obtenerContexto(), volumen: this.volumen, silenciado: this.silenciado,
      reproduciendo: Boolean(this.audio && !this.audio.paused), esperandoGesto: this.actual?.esperandoGesto ?? false,
      posicion: this.audio?.currentTime ?? 0, duracion: this.audio?.duration ?? 0, finalizada: this.actual?.finalizada ?? false,
      disponible: Boolean(PISTAS_MUSICA[this.obtenerContexto()]), error: this.actual?.error ?? false,
      mezclando: Boolean(this.mezcla), instancias: this.canales.size };
  }
  suscribir(oyente) { this.oyentes.add(oyente); oyente(this.obtenerEstado()); return () => this.oyentes.delete(oyente); }
  notificar() { const estado = this.obtenerEstado(); this.oyentes.forEach(oyente => oyente(estado)); }
}

const CLAVE_GESTOR = Symbol.for('metronet:gestor-musica');
export const gestorMusica = window[CLAVE_GESTOR] ??= new GestorMusica();
