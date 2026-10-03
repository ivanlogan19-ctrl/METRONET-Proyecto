import niveles from './niveles.json';

const LECCIONES = {
  estaciones: ['Estación', 'Elegí el icono de estación y hacé clic en una ubicación válida. Podés colocar varias seguidas: el nombre se genera automáticamente. Arrastrá para mover el mapa; Escape termina la herramienta.'],
  lineas: ['Línea', 'Elegí el icono de línea y dos estaciones distintas. Se crea la línea y su primer tramo; el nombre se asigna automáticamente.'],
  conexiones: ['Conexión', 'Elegí el icono de vía, una línea activa y dos estaciones. Cada destino agrega un tramo; después podés continuar desde esa estación.'],
  metros: ['Unidad de metro', 'Elegí el icono de metro y hacé clic sobre una vía. La unidad se asigna a esa línea. Seleccionala después para editar la velocidad.'],
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

// La guía observa el diseño confirmado por el servidor y las selecciones reales.
// No completa consignas ni introduce una validación alternativa a la del juego.
export function pasoPractico(contexto, estado) {
  const { diseno, escenario, modo, seleccionadas = [], consigna } = contexto;
  if (!diseno) return null;
  const nuevas = herramientasIntroducidas(escenario, contexto.catalogo);
  const paso = (clave, titulo, texto) => ({ clave, titulo, texto });
  if (escenario?.numero === 1) {
    const estaciones = diseno.estaciones?.length ?? 0;
    const minimo = consigna?.condiciones?.find(c => c.clave === 'minimoEstaciones')?.requerido
      ?? escenario.reglasExito?.minimoEstaciones;
    if (Number.isFinite(minimo) && estaciones < minimo) {
      if (modo !== 'crearEstacion') return paso('elegir-estacion', 'Estación', 'Seleccioná el símbolo de estación en la barra de herramientas.');
      return paso('colocar-estacion', 'Estación', estaciones === 0
        ? 'Colocá una estación en una ubicación válida del mapa. Su nombre se genera automáticamente.'
        : 'La estación ya está creada. Colocá otra en un lugar diferente para poder unirlas.');
    }
    const lineas = consigna?.condiciones?.find(c => c.clave === 'minimoLineas')?.requerido
      ?? escenario.reglasExito?.minimoLineas;
    if (Number.isFinite(lineas) && (diseno.lineas?.length ?? 0) < lineas) {
      if (modo !== 'crearLinea') return paso('elegir-linea', 'Línea', 'Ya podés unir estaciones. Seleccioná el símbolo de línea.');
      return paso(seleccionadas.length ? 'destino-linea' : 'origen-linea', 'Línea', seleccionadas.length
        ? 'Seleccioná una estación diferente como destino. La línea aparecerá cuando la creación se confirme.'
        : 'Seleccioná una estación del mapa como origen de la línea.');
    }
    if (!Number.isFinite(minimo) || !Number.isFinite(lineas)) return null;
    const completa = consigna?.condiciones?.length && consigna.condiciones.every(c => c.completado);
    if (estado.aprendidas.has('guardar') && completa) return paso('terminado', 'Práctica completada', 'Guardaste tu red y cumpliste las condiciones. Podés seguir explorando las herramientas.');
    return paso('guardar', 'Guardar', 'Usá el disquete para guardar. METRONET revisará la consigna e indicará si queda algo pendiente.');
  }
  for (const clave of nuevas) {
    const completada = clave === 'conexiones'
      ? consigna?.condiciones?.some(c => c.clave === 'minimoTramos' && c.completado)
      : clave === 'metros' ? diseno.unidadesMetro?.length > 0
      : clave === 'simulacion' ? consigna?.condiciones?.some(c => ['requiereSimulacion', 'simulacionActual'].includes(c.clave) && c.completado) : false;
    if (completada || estado.aprendidas.has(clave)) continue;
    return paso(clave, `Nueva herramienta: ${LECCIONES[clave][0]}`, LECCIONES[clave][1]);
  }
  return null;
}
