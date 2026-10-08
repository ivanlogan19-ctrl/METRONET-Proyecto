import niveles from './niveles.json';
import recorridoIntegral from './recorrido-integral.json';

export const esRecorridoIntegral = escenario => escenario?.recorrido === 'integral-2026-10';

const LECCIONES = {
  estaciones: ['Estación', 'Elegí el icono de estación y hacé clic en una ubicación válida. Podés colocar varias seguidas: el nombre se genera automáticamente. Arrastrá para mover el mapa; Escape termina la herramienta.'],
  lineas: ['Línea', 'Elegí el icono de línea y dos estaciones distintas. Se crea la línea y su primer tramo; el nombre se asigna automáticamente.'],
  conexiones: ['Conexión', 'Elegí el icono de vía, una línea activa y dos estaciones. Cada destino agrega un tramo; después podés continuar desde esa estación.'],
  metros: ['Unidad de metro', 'Elegí el icono de metro y hacé clic sobre una vía. La unidad se asigna a esa línea. Seleccionala después para editar la velocidad.'],
  simulacion: ['Simulación', 'El botón verde Simular está en Acciones de nivel. Comprueba y guarda la red antes de abrir la simulación; primero construí la red y asigná un metro.'],

};

export function leccionesDisponibles({ diseno, escenario, pantalla }) {
  if (!diseno) return [];
  const herramientas = escenario?.herramientasHabilitadas;
  const lecciones = Object.entries(LECCIONES)
    .filter(([clave]) => pantalla === 'simulacion' ? clave === 'simulacion' : !herramientas || herramientas[clave] === true)
    .map(([clave, [titulo, texto]]) => ({ clave, titulo, texto }));
  if (pantalla !== 'simulacion') lecciones.unshift({
    clave: 'orientacion-mapa',
    titulo: 'Orientación del mapa',
    texto: 'La rosa de los vientos está dentro del mapa, abajo a la derecha. Usá las flechas para girarlo; la aguja señala el norte. Tocá la rosa para volver a orientar el norte hacia arriba.',
  });
  return lecciones;
}

export function herramientasIntroducidas(escenario, catalogo = []) {
  if (!Number.isInteger(escenario?.numero) || escenario.modo === 'EDICION_LIBRE') return [];
  // El catálogo compartido completa antecedentes cuando la respuesta contiene solo
  // el escenario abierto; la configuración recibida del servidor tiene prioridad.
  const progresion = new Map((esRecorridoIntegral(escenario) ? recorridoIntegral : niveles).map(n => [n.numero, n]));
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

// Pasos prácticos: avanzan únicamente al observar acciones/estado confirmados.
export function pasosPracticosEditor(numero) {
  const mapa = '#metronet-mapa';
  const estacion = '[data-elegir-herramienta="estaciones"]';
  const comunes = [
    [estacion, 'Elegí Estación', 'Seleccioná el icono de estación.', 'estacion-elegida'],
    [mapa, 'Colocá estaciones', 'Colocá las estaciones que pide la consigna en lugares distintos. Arrastrar mueve el mapa; un clic coloca la estación.', 'estaciones-creadas'],
    ['[data-elegir-herramienta="lineas"]', 'Elegí Línea', 'Seleccioná Línea para unir las primeras dos estaciones.', 'linea-elegida'],
    [mapa, 'Origen de la línea', 'Elegí una estación como origen.', 'origen-elegido'],
    [mapa, 'Destino de la línea', 'Elegí otra estación. Se crearán la línea y su primer tramo.', 'linea-creada'],
  ];
  if (numero === 1) return [...comunes,
    ['[data-elegir-herramienta="metros"]', 'Elegí Metro', 'Seleccioná Metro y después tocá la vía de tu línea.', 'metro-elegido'],
    [mapa, 'Asigná el Metro', 'Tocá la vía. La unidad queda asignada cuando se confirme su creación.', 'metro-creado'],
    ['[data-guardar]', 'Guardá la red', 'Pulsá el disquete. Guardar comprueba la red sin completar por vos la simulación.', 'guardado'],
    ['[data-ir-simulacion]', 'Pasá a Simulación', 'Abrí Acciones de nivel y pulsá Simular. Allí vas a iniciar el recorrido con Play.'],
  ];
  if (numero === 5) return [
    ['.metronet-poi > summary', 'Puntos de interés de Montevideo', 'Abrí POI usando la estrella.', 'poi-abierto'],
    ['.metronet-panel-puntos-alternar', 'Buscar punto de interés', 'Abrí la lupa para buscar un lugar concreto.', 'buscador-abierto'],
    ['.metronet-panel-puntos-busqueda', 'Buscá Palacio Legislativo', 'Escribí Palacio Legislativo. Los resultados usan el catálogo real del mapa.', 'poi-buscado'],
    ['.metronet-panel-puntos-lista', 'Localizá el lugar', 'Seleccioná Palacio Legislativo en los resultados para localizarlo en el mapa.', 'poi-localizado'],
    [mapa, 'Estrella y cobertura', 'La estrella marca el centro. El área visible alrededor muestra dónde debe quedar la estación; el límite está incluido.'],
    [estacion, 'Estación dentro del radio', 'Elegí Estación. Colocala dentro del área marcada, sin buscar un punto exacto.', 'poi-cubierto'],
  ];
  if (numero === 7) return [
    ['[data-elegir-herramienta="lineas"]', 'Un intercambio real', 'Creá la segunda línea reutilizando una estación de la primera. Un cruce sin estación común no forma un transbordo.'],
    [mapa, 'Compartí una estación', 'Conectá tramos de dos líneas diferentes a una misma estación. El símbolo de intercambio aparece automáticamente.', 'transbordo-creado'],
  ];
  return [];
}

export function accionPracticaCumplida(evento, contexto, estado, controles = {}) {
  const { diseno, modo, seleccionadas = [], consigna, referencia, escenario } = contexto;
  const completa = clave => consigna?.condiciones?.some(c => c.clave === clave && c.completado);
  const minimo = escenario?.reglasExito?.minimoEstaciones ?? consigna?.condiciones?.find(c => c.clave === 'minimoEstaciones')?.requerido ?? 2;
  return ({
    'estacion-elegida': modo === 'crearEstacion',
    'estaciones-creadas': diseno?.estaciones?.length >= minimo,
    'linea-elegida': modo === 'crearLinea',
    'origen-elegido': seleccionadas.length === 1,
    'linea-creada': diseno?.lineas?.length > 0,
    'conexion-elegida': modo === 'crearTramo',
    'conexion-creada': diseno?.tramos?.length >= 2,
    'metro-elegido': modo === 'crearMetro',
    'metro-creado': diseno?.unidadesMetro?.length > 0,
    guardado: estado?.aprendidas.has('guardar'),
    'poi-abierto': controles.poiAbierto,
    'buscador-abierto': controles.buscadorAbierto,
    'poi-buscado': controles.poiBuscado,
    'poi-localizado': Number(referencia?.id ?? referencia?.idPunto) === 1,
    'poi-cubierto': consigna?.referenciasObjetivo?.some(p => Number(p.idPunto) === 1 && p.cubierto),
    'transbordo-creado': completa('minimoTransbordos'),
  })[evento] === true;
}
