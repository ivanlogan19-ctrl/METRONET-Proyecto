/** Los avances rutinarios ya se reflejan en el mapa y los objetivos del editor. */
export function esAvisoRutinarioEditor(texto, tipo) {
  if (tipo === 'info' || tipo === 'exito') return true;
  return tipo === 'advertencia' && (
    /^Progreso \d+%\./.test(texto)
    || /^\d+ de \d+ criterios satisfechos:/.test(texto)
  );
}

/** Presentación breve; el motivo original sigue disponible para la ayuda contextual. */
export function resumirAdvertenciaEditor(texto) {
  if (texto.startsWith('La conexión sale del territorio válido del mapa.')) return {
    titulo: 'Conexión fuera del mapa',
    mensaje: 'Elegí otras estaciones o agregá una estación intermedia dentro del territorio.',
  };
  if (texto === 'La estación debe quedar dentro del territorio de Montevideo representado en el mapa.') return {
    titulo: 'Estación fuera del mapa',
    mensaje: 'Elegí una ubicación dentro del territorio de Montevideo.',
  };
  const estacion = texto.match(/^No se permiten estaciones en (.+) según la consigna\.$/);
  if (estacion) return {
    titulo: 'Ubicación restringida',
    mensaje: `La consigna no permite estaciones en ${estacion[1]}. Elegí otra ubicación.`,
  };
  const tramo = texto.match(/^La conexión atraviesa (.+), donde la consigna prohíbe tramos\.$/);
  if (tramo) return {
    titulo: 'Conexión restringida',
    mensaje: `La consigna no permite tramos en ${tramo[1]}. Buscá otro recorrido.`,
  };
  const geometria = texto.match(/^Área territorial sin geometría: (.+)$/);
  if (geometria) return {
    titulo: 'Referencia no disponible',
    mensaje: `No se puede comprobar el territorio de ${geometria[1]}. Revisá la configuración del escenario.`,
  };
  return { titulo: 'Revisá esta acción', mensaje: texto };
}
