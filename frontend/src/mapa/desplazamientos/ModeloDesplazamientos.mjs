export const MAX_FLUJOS = 12;
export function validarDesplazamientos(d) {
  if (d?.version !== 1 || d.anio !== 2016 || !d.zonas || !Array.isArray(d.flujos) || !d.flujos.length) return false;
  const coordenada = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
    && p[0] >= -56.6 && p[0] <= -55.8 && p[1] >= -35 && p[1] <= -34.5;
  if (!Object.values(d.zonas).every(coordenada)) return false;
  const claves = new Set();
  return d.flujos.every(f => {
    const clave = `${f.hora}:${f.origen}:${f.destino}`;
    if (claves.has(clave)) return false;
    claves.add(clave);
    return Number.isInteger(f.hora) && f.hora >= 0 && f.hora < 24
      && f.origen !== f.destino && coordenada(d.zonas[f.origen]) && coordenada(d.zonas[f.destino])
      && Number.isFinite(f.viajes) && f.viajes > 0 && Number.isInteger(f.muestra) && f.muestra > 0;
  });
}
export function flujosPorHora(datos, hora) {
  return datos.flujos.filter(f => f.hora === hora).sort((a, b) => b.viajes - a.viajes
    || a.origen.localeCompare(b.origen) || a.destino.localeCompare(b.destino)).slice(0, MAX_FLUJOS);
}
export function puntoCurva(a, b, t) {
  // Curvas opuestas se separan naturalmente al invertir origen y destino.
  const c = { x: (a.x + b.x)/2 - (b.y - a.y)*.18, y: (a.y + b.y)/2 + (b.x - a.x)*.18 };
  return { x: (1-t)**2*a.x + 2*(1-t)*t*c.x + t*t*b.x,
    y: (1-t)**2*a.y + 2*(1-t)*t*c.y + t*t*b.y };
}
