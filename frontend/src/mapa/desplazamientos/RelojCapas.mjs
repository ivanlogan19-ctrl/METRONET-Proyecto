// Reloj visual compartido, independiente del motor de simulación y de UV/UT.
export default class RelojCapas {
  constructor() { this.hora = 8; this.oyentes = new Set(); this.capas = new Set(); this.temporizador = null; }
  suscribir(fn) { this.oyentes.add(fn); return () => this.oyentes.delete(fn); }
  notificar() { for (const fn of this.oyentes) fn(); }
  habilitar(capa, activa) {
    if (this.capas.has(capa) === Boolean(activa)) return;
    if (activa) this.capas.add(capa); else this.capas.delete(capa);
    if (!this.capas.size) this.pausar(); else this.notificar();
  }
  cambiarHora(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return;
    this.hora = ((Math.trunc(n) % 24) + 24) % 24; this.notificar();
  }
  reproducir() {
    if (this.temporizador) return this.pausar();
    if (!this.capas.size) return;
    this.temporizador = setInterval(() => this.cambiarHora(this.hora + 1), 1200); this.notificar();
  }
  pausar() { clearInterval(this.temporizador); this.temporizador = null; this.notificar(); }
  eliminar() { this.pausar(); this.oyentes.clear(); this.capas.clear(); }
}
