import niveles from './niveles.json';

const LECCIONES = {
  estaciones: ['Estación', 'Elegí Estación, escribí un nombre y pulsá Crear estación. Después hacé clic en una ubicación válida del mapa.'],
  lineas: ['Línea', 'Una línea necesita al menos dos estaciones. Elegí Línea, escribí su nombre, pulsá Crear línea y seleccioná las estaciones en orden. Pulsá el mismo botón para confirmar; se conectan las estaciones consecutivas.'],
  conexiones: ['Conexión', 'Para agregar un tramo a una línea existente, elegí Conexión y la línea. Pulsá Conectar estaciones, seleccioná dos estaciones distintas y confirmá con el mismo botón.'],
  metros: ['Unidad de metro', 'En Metros, elegí una línea y configurá capacidad y velocidad. Agregar metro asigna la unidad a ese recorrido; todavía no inicia la simulación.'],
  simulacion: ['Simulación', 'Validar red comprueba si puede circular. Cuando esté preparada, Simular diseño abre la pantalla donde podés iniciar, pausar y observar los metros.'],
};

export function herramientasIntroducidas(escenario, catalogo = []) {
  if (!Number.isInteger(escenario?.numero) || escenario.modo === 'EDICION_LIBRE') return [];
  // El catálogo compartido completa antecedentes cuando la respuesta contiene solo
  // el escenario abierto; la configuración recibida del servidor tiene prioridad.
  const progresion = new Map(niveles.map(n => [n.numero, n]));
  for (const nivel of catalogo) if (Number.isInteger(nivel.numero)) progresion.set(nivel.numero, nivel);
  const anteriores = [...progresion.values()].filter(n => n.numero < escenario.numero);
  return Object.keys(LECCIONES).filter(clave => escenario.herramientasHabilitadas?.[clave] === true
    && !anteriores.some(n => n.herramientasHabilitadas?.[clave] === true));
}

export function siguienteLeccion(contexto, aprendidas = new Set()) {
  const { diseno, escenario, catalogo, consigna } = contexto;
  if (!diseno) return null;
  const disponibles = herramientasIntroducidas(escenario, catalogo);
  const usado = {
    estaciones: diseno.estaciones?.length > 0,
    lineas: diseno.lineas?.length > 0,
    conexiones: consigna?.condiciones?.some(c => c.clave === 'minimoTramos' && c.completado),
    metros: diseno.unidadesMetro?.length > 0,
    simulacion: consigna?.condiciones?.some(c => ['requiereSimulacion', 'simulacionActual'].includes(c.clave) && c.completado),
  };
  for (const clave of disponibles) if (usado[clave]) aprendidas.add(clave);
  const clave = disponibles.find(clave => !aprendidas.has(clave));
  return clave ? { clave, titulo: LECCIONES[clave][0], texto: LECCIONES[clave][1] } : null;
}
