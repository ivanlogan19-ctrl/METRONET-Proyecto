// En Simulación, el motor es la única fuente de tiempo: no hay temporizador propio.
export class RelojTerritorial {
  constructor(inicio = 8 * 60) { this.inicio = inicio; this.hora = Math.floor(inicio / 60); this.oyentes = new Set(); }
  suscribir(fn) { this.oyentes.add(fn); return () => this.oyentes.delete(fn); }
  habilitar() {}
  pausar() {}
  reproducir() {}
  sincronizar(ut = 0) {
    const hora = Math.floor((this.inicio + Math.max(0, ut) * 60) / 60) % 24;
    if (hora !== this.hora) { this.hora = hora; for (const fn of this.oyentes) fn(); }
  }
  eliminar() { this.oyentes.clear(); }
}
export function minutosDesdeHora(texto) {
  if (!/^\d{2}:\d{2}$/.test(texto)) return null;
  const [h, m] = texto.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
export function mostrarHora(minutos) {
  const total = Math.max(0, Math.floor(minutos + 1e-7)), dia = Math.floor(total / 1440);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}${dia ? ` +${dia}d` : ''}`;
}
// Destinos sobre una esfera terrestre: radio geográfico, independiente del zoom.
export function circuloCobertura(longitud, latitud, metros = 500) {
  const rad = Math.PI / 180, phi = latitud * rad, lambda = longitud * rad, d = metros / 6371008.8;
  return Array.from({ length: 65 }, (_, i) => {
    const rumbo = i * 2 * Math.PI / 64;
    const lat = Math.asin(Math.sin(phi) * Math.cos(d) + Math.cos(phi) * Math.sin(d) * Math.cos(rumbo));
    const lon = lambda + Math.atan2(Math.sin(rumbo) * Math.sin(d) * Math.cos(phi), Math.cos(d) - Math.sin(phi) * Math.sin(lat));
    return [lon / rad, lat / rad];
  });
}
