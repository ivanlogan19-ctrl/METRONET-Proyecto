// Previsualización en los controles existentes. El servidor recalcula y valida al guardar.
export const esModoLibre = diseno => ['LIBRE', 'EDICION_LIBRE'].includes(diseno?.simulacion?.modo);
// El identificador existente selecciona la línea del metro en Modo Libre.
export function seleccionarUnidades(unidades, id, porLinea = false) {
  if (id === 'todas') return unidades;
  const elegida = unidades.find(u => String(u.idTren) === String(id));
  return elegida ? unidades.filter(u => porLinea ? u.nombreLinea === elegida.nombreLinea : u.idTren === elegida.idTren) : [];
}
export function representantesLineas(unidades) {
  return unidades.filter((u, i) => unidades.findIndex(v => v.nombreLinea === u.nombreLinea) === i);
}
// Pasos decimales para recorridos cortos, sin llevar una duración a casi cero
// ni enviar la cola binaria de una suma (por ejemplo, 1.3392804099999999).
export function desplazarValorVinculado(valor, direccion) {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  let paso = Math.min(1, 10 ** Math.floor(Math.log10(valor)));
  if (direccion < 0 && valor - paso < paso / 10) paso /= 10;
  return Math.max(0.00000001, Number((valor + direccion * paso).toFixed(8)));
}
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
