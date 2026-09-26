export function siguienteNombre(tipo, elementos = [], reservados = []) {
  const usados = new Set([...elementos.map(e => String(e.nombre).trim()), ...reservados]);
  let numero = 1;
  while (usados.has(`${tipo} ${String(numero).padStart(2, '0')}`)) numero += 1;
  return `${tipo} ${String(numero).padStart(2, '0')}`;
}
