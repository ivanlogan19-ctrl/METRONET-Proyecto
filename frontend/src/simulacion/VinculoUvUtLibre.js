// Previsualización en los controles existentes. El servidor recalcula y valida al guardar.
export const esModoLibre = diseno => ['LIBRE', 'EDICION_LIBRE'].includes(diseno?.simulacion?.modo);
export const usaVinculoPorLinea = diseno => diseno?.vinculoUvUtPorLinea ?? (esModoLibre(diseno) || diseno?.simulacion?.modo === 'NIVEL');
export const velocidadInicial = diseno => usaVinculoPorLinea(diseno) ? 1 : 4;
// Sólo presentación: el estado y los kilómetros conservan su precisión original.
export const valorVisible = valor => String(Number(Number(valor).toFixed(2)));
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
  // Un resultado positivo muy pequeño puede mostrarse como 0 con dos decimales.
  if (valor === 0 && direccion > 0) return 0.01;
  if (!Number.isFinite(valor) || valor <= 0) return null;
  let paso = Math.min(1, 10 ** Math.floor(Math.log10(valor)));
  if (direccion < 0 && valor - paso < paso / 10) paso /= 10;
  return Math.max(0.00000001, Number((valor + direccion * paso).toFixed(8)));
}
// Equivalente a BigDecimal.divide(..., 8, CEILING) del servidor.
// Evita que el error binario de 0.07 / 0.01 agregue un decimal al guardar.
function dividirHaciaArriba(distancia, valor) {
  const decimal = numero => {
    const [mantisa, exponente = '0'] = String(numero).toLowerCase().split('e');
    const [entero, fraccion = ''] = mantisa.split('.');
    return { coeficiente: BigInt(entero + fraccion), escala: fraccion.length - Number(exponente) };
  };
  const a = decimal(distancia), b = decimal(valor);
  const potencia = 8 + b.escala - a.escala;
  const numerador = a.coeficiente * 10n ** BigInt(Math.max(0, potencia));
  const denominador = b.coeficiente * 10n ** BigInt(Math.max(0, -potencia));
  const resultado = ((numerador + denominador - 1n) / denominador).toString().padStart(9, '0');
  return Number(`${resultado.slice(0, -8)}.${resultado.slice(-8)}`);
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
    const calculado = dividirHaciaArriba(km, valor);
    return { ...u, velocidadPromedio: referencia === 'UV' ? valor : calculado,
      duracionUt: referencia === 'UT' ? valor : calculado };
  });
  return resultados.length && resultados.every(Boolean) ? resultados : null;
}
