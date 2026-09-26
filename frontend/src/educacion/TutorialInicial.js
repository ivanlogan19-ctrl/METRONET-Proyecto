import niveles from './niveles.json';

const LECCIONES = {
  estaciones: ['Estación', 'Elegí el icono de estación y hacé clic en una ubicación válida. Podés colocar varias seguidas: el nombre se genera automáticamente. Arrastrá para mover el mapa; Escape termina la herramienta.'],
  lineas: ['Línea', 'Elegí el icono de línea y dos estaciones distintas. Se crea la línea y su primer tramo; el nombre se asigna automáticamente.'],
  conexiones: ['Conexión', 'Elegí el icono de vía, una línea activa y dos estaciones. Cada destino agrega un tramo; después podés continuar desde esa estación.'],
  metros: ['Unidad de metro', 'Elegí el icono de metro y hacé clic sobre una vía. La unidad se asigna a esa línea. Seleccionala después para editar capacidad y velocidad.'],
  simulacion: ['Simulación', 'El triángulo Simular comprueba y guarda la red antes de iniciar. Podés pausar, reanudar y observar los metros. El disquete Guarda tu avance y revisa la consigna.'],

};

export function leccionesDisponibles({ diseno, escenario, pantalla }) {
  if (!diseno) return [];
  const herramientas = escenario?.herramientasHabilitadas;
  return Object.entries(LECCIONES)
    .filter(([clave]) => pantalla === 'simulacion' ? clave === 'simulacion' : !herramientas || herramientas[clave] === true)
    .map(([clave, [titulo, texto]]) => ({ clave, titulo, texto }));
}

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
