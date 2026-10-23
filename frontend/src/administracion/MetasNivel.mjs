// Las opciones escriben reglas existentes del evaluador; el texto nunca acredita una meta.
export const accionesMetas = [
  ['minimoEstaciones', 'Ubicar estaciones', 'Ubicar al menos {cantidad} estaciones', 2],
  ['minimoLineas', 'Construir líneas', 'Crear al menos {cantidad} líneas', 1],
  ['minimoTramos', 'Construir tramos de línea', 'Crear al menos {cantidad} tramos', 1],
  ['minimoConexionesLineas', 'Conectar líneas diferentes', 'Unir las líneas: {cantidad} conexiones', 1],
  ['minimoMetros', 'Asignar metros', 'Asignar al menos {cantidad} unidades de metro', 1],
  ['minimoTransbordos', 'Conectar líneas con transbordos', 'Conectar al menos {cantidad} estaciones compartidas por dos líneas', 1],
  ['maximoEstaciones', 'Limitar las estaciones', 'Usar como máximo {cantidad} estaciones', 5],
  ['simulacionActual', 'Simular la configuración actual', 'Simular la red y sus UV/UT actuales'],
  ['requiereMetroPorLinea', 'Asignar un metro a cada línea', 'Asignar al menos un metro a cada línea'],
  ['requiereObjetivosMismaLinea', 'Conectar los POI por una misma línea', 'Conectar los lugares objetivo por una misma línea'],
  ['requiereCoberturaPuntosInteres', 'Cubrir todos los POI', 'Cubrir todos los lugares objetivo'],
  ['requiereGeografiaValida', 'Respetar el territorio permitido', 'Mantener la red dentro del territorio permitido'],
  ['aprendizajeSimulacion:velocidad', 'Cambiar UV y volver a simular', 'Cambiar UV de la línea y simular su UT calculada'],
  ['aprendizajeSimulacion:duracion', 'Cambiar UT y volver a simular', 'Cambiar UT de la línea y simular su UV calculada'],
  ['aprendizajeSimulacion:individual', 'Cambiar una línea conservando las demás', 'Cambiar UV de una línea y simular sin modificar las demás'],
  ['aprendizajeSimulacion:combinacion', 'Comparar dos configuraciones', 'Comparar dos configuraciones proporcionales de la misma red'],
].map(([clave, nombre, texto, cantidad]) => ({clave, nombre, texto, cantidad}));

export function valorMeta(reglas, clave) {
  if (clave.startsWith('aprendizajeSimulacion:')) return reglas.aprendizajeSimulacion?.[clave.split(':')[1]];
  return reglas[clave === 'simulacionActual' ? 'requiereSimulacion' : clave];
}
export function metasActivas(reglas) { return accionesMetas.filter(a => Boolean(valorMeta(reglas, a.clave))); }
export function cambiarMeta(reglas, clave, valor) {
  if (clave.startsWith('aprendizajeSimulacion:')) {
    const practica = clave.split(':')[1];
    reglas.aprendizajeSimulacion ??= {};
    if (valor) reglas.aprendizajeSimulacion[practica] = true;
    else delete reglas.aprendizajeSimulacion[practica];
    if (!Object.keys(reglas.aprendizajeSimulacion).length) delete reglas.aprendizajeSimulacion;
  } else {
    const campo = clave === 'simulacionActual' ? 'requiereSimulacion' : clave;
    if (valor !== false) reglas[campo] = valor; else delete reglas[campo];
  }
  reglas.textosMetas ??= {};
  if (valor === false) delete reglas.textosMetas[clave];
}
export function avisosMetas(reglas, herramientas) {
  const avisos = [];
  if (metasActivas(reglas).length > 5) avisos.push('El nivel admite hasta cinco metas.');
  if ((reglas.puntosInteresObjetivo?.length ?? 0) > 3) avisos.push('El nivel admite hasta tres lugares objetivo.');
  const necesita = (condicion, herramienta, texto) => {
    if (condicion && !herramientas[herramienta]) avisos.push(texto);
  };
  necesita(reglas.minimoEstaciones || reglas.puntosInteresObjetivo?.length, 'estaciones', 'Habilitá Estaciones para cumplir estas metas.');
  necesita(reglas.minimoLineas || reglas.minimoTramos || reglas.requiereObjetivosMismaLinea, 'lineas', 'Habilitá Líneas para construir los recorridos.');
  necesita(reglas.minimoConexionesLineas, 'conexiones', 'Habilitá Conexión para unir líneas diferentes.');
  necesita(reglas.minimoMetros || reglas.requiereMetroPorLinea, 'metros', 'Habilitá Metros para asignar unidades.');
  necesita(reglas.requiereSimulacion || Object.values(reglas.aprendizajeSimulacion ?? {}).some(Boolean), 'simulacion', 'Habilitá Simulación para cumplir estas metas.');
  return avisos;
}
