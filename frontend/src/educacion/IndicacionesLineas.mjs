// Aclara requisitos existentes sin crear metas, repartir puntos ni fijar nombres obligatorios.
// La entrada y el editor comparten las mismas indicaciones; el editor usa nombres reales.
export function indicacionesLineas(condiciones, lineas = []) {
  const porClave = Object.fromEntries(condiciones.map(c => [c.clave, c]));
  const cantidad = Number(porClave.minimoLineas?.requerido ?? 0);
  const transbordos = Number(porClave.minimoTransbordos?.requerido ?? 0);
  if (cantidad < 2 && transbordos < 1) return [];
  const nombres = [...new Set(lineas.map(l => String(l.nombre ?? '').trim().replace(/^Línea 0*(\d+)$/i, (_, numero) => `Línea ${Number(numero)}`)).filter(Boolean))];
  const requeridas = Math.max(cantidad, transbordos > 0 ? 2 : 0);
  const disponibles = nombres.map(nombre => ({ nombre, existe: true }));
  let numero = 1;
  while (disponibles.length < requeridas) {
    const nombre = `Línea ${numero++}`;
    if (!disponibles.some(linea => linea.nombre === nombre)) disponibles.push({ nombre, existe: false });
  }
  const grupos = [];
  if (cantidad >= 2) grupos.push({ clave: 'minimoLineas', titulo: 'Construcción por línea',
    filas: disponibles.slice(0, cantidad).map(l => `${l.nombre}: ${l.existe ? 'creada' : 'construí su recorrido'}.`) });
  if (transbordos > 0) grupos.push({ clave: 'minimoTransbordos', titulo: `Transbordos: ${transbordos} en total`,
    filas: disponibles.length === 2
      ? disponibles.map((l, i) => `${l.nombre}: compartí ${transbordos === 1 ? 'una estación' : `${transbordos} estaciones`} con ${disponibles[1-i].nombre}.`)
      : disponibles.map(l => `${l.nombre}: puede participar en un transbordo con otra línea; elegí los pares que conectará tu red.`) });
  if (porClave['aprendizajeSimulacion:individual']) grupos.push({ clave: 'aprendizajeSimulacion:individual',
    titulo: 'Elegí sólo una línea; conservá las otras',
    filas: disponibles.map(l => `${l.nombre}: cambiar manualmente UV y simular.`) });
  if (porClave['aprendizajeSimulacion:combinacion']) grupos.push({ clave: 'aprendizajeSimulacion:combinacion',
    titulo: 'Compará A y B; ajustá una o varias líneas',
    filas: disponibles.map(l => `${l.nombre}: elegir otra UV o UT y simular.`) });
  if (porClave.requiereMetroPorLinea) grupos.push({ clave: 'requiereMetroPorLinea', titulo: 'Metros por línea',
    filas: disponibles.map(l => `${l.nombre}: asigná al menos un metro.`) });
  return grupos;
}

export function condicionesParaIndicaciones(reglas = {}) {
  const condiciones = [];
  for (const clave of ['minimoLineas', 'minimoTransbordos'])
    if (Number(reglas[clave]) > 0) condiciones.push({ clave, requerido: Number(reglas[clave]) });
  if (reglas.requiereMetroPorLinea) condiciones.push({ clave: 'requiereMetroPorLinea' });
  for (const [practica, activa] of Object.entries(reglas.aprendizajeSimulacion ?? {}))
    if (activa) condiciones.push({ clave: `aprendizajeSimulacion:${practica}` });
  return condiciones;
}

export function crearIndicacionesLineas(grupos) {
  const contenedor = document.createElement('div');
  contenedor.className = 'metronet-indicaciones-lineas';
  for (const grupo of grupos) {
    const seccion = document.createElement('section');
    seccion.dataset.indicacionLineas = grupo.clave;
    const titulo = document.createElement('strong');
    titulo.textContent = grupo.titulo;
    seccion.append(titulo);
    for (const fila of grupo.filas) {
      const texto = document.createElement('p');
      texto.textContent = fila;
      seccion.append(texto);
    }
    contenedor.append(seccion);
  }
  return contenedor;
}


// Cambia sólo la etiqueta: mantiene la clave, el contador y la evaluación recibida.
export function metasConLineas(condiciones, lineas = []) {
  const grupos = indicacionesLineas(condiciones, lineas);
  return condiciones.map(condicion => {
    const grupo = grupos.find(g => g.clave === condicion.clave);
    if (!grupo) return condicion;
    const nombres = grupo.filas.map(fila => fila.slice(0, fila.indexOf(':')));
    let texto;
    if (condicion.clave === 'minimoLineas') texto = nombres.map(n => `${n}: construir`).join(' · ');
    if (condicion.clave === 'minimoTransbordos') texto = `${nombres.join(' y ')}: ${condicion.requerido} transbordo${condicion.requerido === 1 ? '' : 's'}`;
    if (condicion.clave === 'aprendizajeSimulacion:individual') texto = `${nombres.join(' o ')}: cambiar UV y simular`;
    if (condicion.clave === 'aprendizajeSimulacion:combinacion') texto = `${nombres.join(' o ')}: comparar UV/UT`;
    if (condicion.clave === 'requiereMetroPorLinea') texto = nombres.map(n => `${n}: asignar un metro`).join(' · ');
    return texto ? { ...condicion, texto } : condicion;
  });
}
