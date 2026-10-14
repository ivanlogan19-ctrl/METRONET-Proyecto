// Previsualización en los controles existentes. El servidor recalcula y valida al guardar.
export const esModoLibre = diseno => ['LIBRE', 'EDICION_LIBRE'].includes(diseno?.simulacion?.modo);
export function calcularVinculo(diseno, unidades, referencia, valor) {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const resultados = unidades.map(u => {
    const tramos = (diseno.tramos ?? []).filter(t => t.nombreLinea === u.nombreLinea);
    const adyacencias = new Map();
    for (const t of tramos) {
      for (const [a,b] of [[t.estacionA,t.estacionB],[t.estacionB,t.estacionA]]) {
        if (!adyacencias.has(a)) adyacencias.set(a,new Set());
        adyacencias.get(a).add(b);
      }
    }
    if ([...adyacencias.values()].some(vecinos => vecinos.size > 2)) return null;
    const visitadas = new Set(), pendientes = tramos.length ? [tramos[0].estacionA] : [];
    while (pendientes.length) {
      const actual = pendientes.pop();
      if (!visitadas.has(actual)) { visitadas.add(actual); pendientes.push(...adyacencias.get(actual)); }
    }
    if (visitadas.size !== adyacencias.size) return null;
    const km = tramos.reduce((total, t) => total + Number(t.distanciaKm), 0);
    if (!tramos.length || !Number.isFinite(km) || km <= 0) return null;
    const calculado = Math.ceil((km / valor) * 1e8) / 1e8;
    return { ...u, velocidadPromedio: referencia === 'UV' ? valor : calculado,
      duracionUt: referencia === 'UT' ? valor : calculado };
  });
  return resultados.length && resultados.every(Boolean) ? resultados : null;
}
