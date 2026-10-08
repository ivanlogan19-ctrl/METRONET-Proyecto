const NOMBRES_PRUEBAS = {
  velocidad: 'cambiar UV',
  duracion: 'cambiar UT',
  individual: 'UV individual',
  global: 'UV global',
  combinacion: 'UV y UT',
};

/** Reúne requisitos relacionados para mostrarlos juntos; la API conserva cada comprobación. */
export function objetivosCompactos(condiciones, numeroNivel) {
  if (!Number.isInteger(numeroNivel) || numeroNivel < 5 || numeroNivel > 10) return condiciones;
  const areas = condiciones.filter(({ clave }) => /^areaObjetivo:\d+$/.test(clave));
  const pruebas = condiciones.filter(({ clave }) => clave.startsWith('aprendizajeSimulacion:'));
  const porClave = Object.fromEntries(condiciones.map(condicion => [condicion.clave, condicion]));
  const nombresAreas = areas.map(({ texto }) => texto.match(/(?:estaciones|Estación) en (.+)$/)?.[1]);
  const agruparAreas = areas.length > 1 && nombresAreas.every(Boolean);
  const agruparPruebas = pruebas.length > 1 && pruebas.every(({ clave }) =>
    NOMBRES_PRUEBAS[clave.slice('aprendizajeSimulacion:'.length)]);
  const agruparCobertura = areas.length === 1 && nombresAreas[0]
    && porClave.requiereObjetivosMismaLinea;
  const agruparLineas = numeroNivel >= 7 && porClave.minimoLineas && porClave.minimoTransbordos;
  const agruparEstaciones = numeroNivel >= 9 && porClave.minimoEstaciones && porClave.maximoEstaciones;
  const grupo = (clave, texto, miembros) => ({
    clave, texto, actual: miembros.filter(({ completado }) => completado).length,
    requerido: miembros.length, completado: miembros.every(({ completado }) => completado),
    detalle: miembros.map(({ texto: descripcion }) => descripcion).join('\n'),
  });
  const reunidas = [];
  let areaAgregada = false;
  let pruebaAgregada = false;
  for (const condicion of condiciones) {
    if (agruparEstaciones && ['minimoEstaciones', 'maximoEstaciones'].includes(condicion.clave)) {
      if (condicion.clave === 'minimoEstaciones') reunidas.push(grupo('rangoEstacionesAgrupado',
        `${porClave.minimoEstaciones.requerido}–${porClave.maximoEstaciones.requerido} estaciones`,
        [porClave.minimoEstaciones, porClave.maximoEstaciones]));
    } else if (agruparLineas && ['minimoLineas', 'minimoTransbordos'].includes(condicion.clave)) {
      if (condicion.clave === 'minimoLineas') reunidas.push(grupo('lineasYTransbordosAgrupados',
        `${porClave.minimoLineas.texto} · ${porClave.minimoTransbordos.texto}`,
        [porClave.minimoLineas, porClave.minimoTransbordos]));
    } else if (agruparCobertura && (condicion.clave === 'requiereObjetivosMismaLinea' || /^areaObjetivo:\d+$/.test(condicion.clave))) {
      if (condicion.clave === areas[0].clave) reunidas.push(grupo('coberturaAgrupada',
        `POI en una línea · ${nombresAreas[0]}`,
        [areas[0], porClave.requiereObjetivosMismaLinea]));
    } else if (agruparAreas && /^areaObjetivo:\d+$/.test(condicion.clave)) {
      if (!areaAgregada) reunidas.push({
        clave: 'areasObjetivoAgrupadas',
        texto: `Estaciones en ${areas.length} barrios objetivo`,
        actual: areas.filter(({ completado }) => completado).length,
        requerido: areas.length,
        completado: areas.every(({ completado }) => completado),
        detalle: areas.map(({ texto }) => texto).join('\n'),
      });
      areaAgregada = true;
    } else if (agruparPruebas && condicion.clave.startsWith('aprendizajeSimulacion:')) {
      if (!pruebaAgregada) reunidas.push({
        clave: 'pruebasSimulacionAgrupadas',
        texto: `Pruebas: ${pruebas.map(({ clave }) => NOMBRES_PRUEBAS[clave.slice('aprendizajeSimulacion:'.length)]).join(' · ')}`,
        actual: pruebas.filter(({ completado }) => completado).length,
        requerido: pruebas.length,
        completado: pruebas.every(({ completado }) => completado),
        detalle: pruebas.map(({ texto }) => texto).join('\n'),
      });
      pruebaAgregada = true;
    } else reunidas.push(condicion);
  }
  return reunidas;
}
