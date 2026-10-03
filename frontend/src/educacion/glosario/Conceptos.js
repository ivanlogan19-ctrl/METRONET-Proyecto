// Explicaciones del comportamiento IMPLEMENTADO, no transcripciones del Documento
// METRONET. UV, horas y ritmo reflejan el cambio formal de escala aprobado;
// la actualización del documento académico se registra por separado.
const concepto = (id, termino, definicion, categoria, alias = [], nombreCompleto = null) =>
  Object.freeze({ id, termino, nombreCompleto, definicion, categoria, alias: Object.freeze(alias) });

export const CONCEPTOS = Object.freeze([
  concepto('metronet', 'METRONET', 'Sistema educativo para diseñar líneas de metro y observar la circulación de sus unidades sobre el mapa.', 'Sistema'),
  concepto('diseno', 'Diseño', 'Red que construís y guardás, con sus estaciones, líneas, conexiones y unidades de metro.', 'Red', ['diseños']),
  concepto('linea', 'Línea de metro', 'Agrupa estaciones y sus conexiones para organizar un recorrido de metro.', 'Red', ['línea', 'líneas', 'líneas de metro']),
  concepto('estacion', 'Estación', 'Punto que ubicás en el mapa y que puede formar parte del recorrido de una o varias líneas.', 'Red', ['estaciones']),
  concepto('conexion', 'Conexión', 'Tramo que une dos estaciones de una misma línea para construir su recorrido.', 'Red', ['conexiones', 'tramo', 'tramos']),
  concepto('escenario', 'Actividad', 'Actividad con un objetivo y condiciones para trabajar sobre un diseño de red.', 'Aprendizaje', ['escenarios']),
  concepto('nivel', 'Nivel', 'Parte de la campaña educativa. Su consigna indica qué construir y qué herramientas podés utilizar.', 'Aprendizaje', ['niveles']),
  concepto('modo-libre', 'Modo Libre', 'Espacio de edición de redes que se desbloquea al completar la campaña educativa.', 'Aprendizaje', ['edición libre']),
  concepto('intento', 'Intento', 'Participación registrada al iniciar o volver a jugar un nivel.', 'Aprendizaje', ['intentos']),
  concepto('poi', 'POI', 'Lugar de referencia del mapa. Cuando es un objetivo, la consigna indica qué cobertura debe darle tu red.', 'Geografía', ['punto de interés', 'puntos de interés'], 'Punto de interés'),
  concepto('cobertura', 'Cobertura', 'Un POI queda cubierto si hay una estación dentro del radio indicado por el nivel. Ese radio usa unidades del mapa.', 'Geografía', ['radio de cobertura']),
  concepto('unidades-mapa', 'Unidades del mapa', 'Medida usada para las posiciones y los radios de cobertura del mapa. Un radio indicado en estas unidades no está expresado en metros.', 'Geografía'),
  concepto('zona', 'Zona', 'Agrupación de barrios utilizada por METRONET para organizar sectores del mapa.', 'Geografía', ['zonas']),
  concepto('barrio', 'Barrio', 'Área delimitada en el mapa. Una estación pertenece a un barrio cuando está dentro de sus límites.', 'Geografía', ['barrios']),
  concepto('transbordo', 'Transbordo', 'Estación compartida por al menos dos líneas y marcada como transbordo. Permite relacionar sus recorridos.', 'Red', ['transbordos']),
  concepto('unidad', 'Unidad de metro', 'Metro asignado a una línea. Configurás su capacidad y velocidad promedio desde el Constructor.', 'Circulación', ['unidades de metro', 'unidad', 'unidades', 'metro', 'metros']),
  concepto('cantidad-unidades', 'Cantidad de unidades', 'Número de metros asignados a la red. Revisá la cantidad requerida por la consigna y su distribución entre líneas.', 'Circulación'),
  concepto('capacidad', 'Capacidad', 'Valor numérico que configurás para una unidad de metro. La simulación actual no representa su ocupación.', 'Circulación'),
  concepto('velocidad', 'UV — Unidad de Velocidad', 'Escala didáctica de METRONET para representar la velocidad de las unidades de metro. No equivale a una velocidad física.', 'Circulación', ['UV', 'unidad de velocidad', 'velocidad', 'velocidades', 'velocidad promedio', 'velocidades promedio']),
  concepto('simulacion', 'Simulación', 'Representación del movimiento de los metros sobre los recorridos del diseño. Permite observar su circulación y consultar resultados.', 'Simulación', ['simulaciones']),
  concepto('ritmo', 'Ritmo de reproducción', 'Multiplicador ×0.5, ×1, ×2 o ×4 que cambia la rapidez de la animación. No cambia las UV de los metros ni las horas simuladas; no otorga puntos.', 'Simulación', ['ritmo']),
  concepto('duracion', 'Duración simulada', 'Cantidad de horas representadas dentro de una ejecución. No es el tiempo real que tarda la animación.', 'Simulación', ['duración']),
  concepto('tiempo-estimado', 'Tiempo simulado', 'Horas representadas que ya transcurrieron durante la ejecución. Su avance visual depende del ritmo de reproducción.', 'Simulación', ['tiempos estimados', 'tiempo de recorrido']),
  concepto('objetivo', 'Objetivo', 'Resultado que te pide alcanzar la consigna del nivel.', 'Aprendizaje', ['objetivos']),
  concepto('regla-exito', 'Regla de éxito', 'Condición que se comprueba para completar el nivel, como alcanzar una cantidad de estaciones o cubrir los lugares indicados.', 'Aprendizaje', ['reglas de éxito', 'condiciones']),
  concepto('herramientas', 'Herramientas habilitadas', 'Acciones disponibles para construir la red en el nivel actual.', 'Aprendizaje'),
  concepto('progreso', 'Progreso', 'Avance mostrado para el nivel o la reproducción. La etiqueta de cada indicador señala cuál estás consultando.', 'Aprendizaje'),
  concepto('puntaje', 'Puntaje', 'Valoración del resultado según los criterios del nivel. El puntaje estimado anticipa el resultado; el registrado corresponde al intento evaluado.', 'Aprendizaje', ['puntuación', 'puntos']),
]);

const registro = new Map(CONCEPTOS.map(entrada => [entrada.id, entrada]));
export const obtenerConcepto = id => registro.get(id) ?? null;
export const tituloConcepto = entrada => entrada.nombreCompleto ? `${entrada.termino} — ${entrada.nombreCompleto}` : entrada.termino;

// Solo busca alias dentro de un contexto previamente seleccionado por IDs.
// Nunca usa el texto para decidir qué conceptos corresponden a un nivel.
export function segmentarConceptos(texto, ids = []) {
  const contenido = String(texto ?? '');
  const alias = new Map();
  for (const id of ids) {
    const entrada = obtenerConcepto(id);
    if (!entrada?.definicion) continue;
    for (const nombre of [entrada.termino, entrada.nombreCompleto, ...entrada.alias].filter(Boolean)) alias.set(nombre.toLocaleLowerCase('es'), id);
  }
  const escapar = valor => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alternativas = [...alias.keys()].sort((a, b) => b.length - a.length).map(escapar);
  if (!alternativas.length) return [{ texto: contenido }];
  const patron = new RegExp(`(?<![\\p{L}\\p{N}_])(${alternativas.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
  const segmentos = [];
  let posicion = 0;
  for (const coincidencia of contenido.matchAll(patron)) {
    if (coincidencia.index > posicion) segmentos.push({ texto: contenido.slice(posicion, coincidencia.index) });
    segmentos.push({ texto: coincidencia[0], id: alias.get(coincidencia[0].toLocaleLowerCase('es')) });
    posicion = coincidencia.index + coincidencia[0].length;
  }
  if (posicion < contenido.length) segmentos.push({ texto: contenido.slice(posicion) });
  return segmentos;
}
