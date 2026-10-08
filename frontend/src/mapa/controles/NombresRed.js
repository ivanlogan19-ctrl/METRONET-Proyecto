export function siguienteNombre(tipo, elementos = [], reservados = []) {
  const usados = new Set([...elementos.map(e => String(e.nombre).trim()), ...reservados]);
  let numero = 1;
  while (usados.has(`${tipo} ${String(numero).padStart(2, '0')}`)) numero += 1;
  return `${tipo} ${String(numero).padStart(2, '0')}`;
}

// Número de presentación dentro de esta red. El ID persistido sigue identificando
// la unidad en selección, simulación y API; nunca se reinicia una secuencia de BD.
export function numeroMetroEnRed(idTren, unidades = []) {
  if (idTren === null || idTren === undefined) return null;
  const ordenadas = [...unidades].sort((a, b) => Number(a.idTren) - Number(b.idTren));
  const indice = ordenadas.findIndex(unidad => String(unidad.idTren) === String(idTren));
  return indice < 0 ? null : indice + 1;
}
