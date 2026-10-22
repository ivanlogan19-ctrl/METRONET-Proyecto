// Cruces visuales: no crean estaciones ni conexiones en el diseño.
export function calcularCrucesLineas(estaciones, tramos) {
  const porNombre = new Map(estaciones.map(estacion => [estacion.nombre, estacion]));
  const segmentos = tramos.flatMap(tramo => {
    const a = porNombre.get(tramo.estacionA), b = porNombre.get(tramo.estacionB);
    if (!a || !b) return [];
    const x = Number(a.posicionX), y = Number(a.posicionY);
    const dx = Number(b.posicionX) - x, dy = Number(b.posicionY) - y;
    return [x, y, dx, dy].every(Number.isFinite) ? [{ x, y, dx, dy, linea: tramo.nombreLinea }] : [];
  });
  const cruces = new Map();
  for (let i = 0; i < segmentos.length; i++) {
    const a = segmentos[i];
    for (let j = i + 1; j < segmentos.length; j++) {
      const b = segmentos[j];
      if (a.linea === b.linea) continue;
      const determinante = a.dx * b.dy - a.dy * b.dx;
      if (Math.abs(determinante) < 1e-9) continue;
      const x = b.x - a.x, y = b.y - a.y;
      const t = (x * b.dy - y * b.dx) / determinante;
      const u = (x * a.dy - y * a.dx) / determinante;
      // Los extremos ya tienen su estación, con su propia forma y color.
      if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) continue;
      const posicionX = a.x + t * a.dx, posicionY = a.y + t * a.dy;
      cruces.set(`${posicionX.toFixed(6)}:${posicionY.toFixed(6)}`, { posicionX, posicionY });
    }
  }
  return [...cruces.values()];
}
