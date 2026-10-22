import { DESCRIPCION_MAPA_LIBRE } from './TutorialCalles.js';
import { funcionesIntroducidas, escenarioCampana } from './FuncionesCampana.js';
import puntos from '../mapa/datos/puntos-interes.json';
import niveles from './niveles.json';
import recorridoIntegral from './recorrido-integral.json';

export const esRecorridoIntegral = escenario => typeof escenario?.recorrido === 'string' && escenario.recorrido.startsWith('integral-2026-10');

const LECCIONES = {
  estaciones: ['Estación', 'Elegí el icono de estación y hacé clic en una ubicación válida. Podés colocar varias seguidas: el nombre se genera automáticamente. Arrastrá para mover el mapa; Escape termina la herramienta.'],
  lineas: ['Línea', 'Elegí el icono de línea y dos estaciones. Las estaciones toman su color; las compartidas son octagonales. Un rombo señala un cruce visual, sin crear conexión.'],
  conexiones: ['Conexión', 'Elegí el icono de vía, una línea activa y dos estaciones. Cada destino agrega un tramo; después podés continuar desde esa estación.'],
  metros: ['Unidad de metro', 'Elegí el icono de metro y hacé clic sobre una vía. La unidad se asigna a esa línea. Seleccionala después para editar la velocidad.'],
  simulacion: ['Simulación', 'El botón verde Simular está en Acciones. Comprueba y guarda la red antes de abrir la simulación; primero construí la red y asigná un metro.'],

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
    texto: diseno.simulacion?.modo === 'EDICION_LIBRE' ? DESCRIPCION_MAPA_LIBRE : 'La rosa de los vientos está dentro del mapa, abajo a la derecha. Usá las flechas para girarlo; la aguja señala el norte. Tocá la rosa para volver a orientar el norte hacia arriba.',
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
    if (estado.aprendidas.has('guardar') && completa) return paso('terminado', 'Práctica completada', 'Guardaste tu avance. Cuando cumplas la consigna, elegí Finalizar red para comprobar la aprobación.');
    return paso('guardar', 'Guardar', 'Usá el disquete para conservar tu avance, aunque esté incompleto. Finalizar red comprueba si aprobaste.');
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
export function pasosPracticosEditor(numero, escenario) {
  const nuevas = funcionesIntroducidas(numero, escenario);
  const objetivo = objetivoTutorialPoi(numero, escenario);
  const mapa = '#metronet-mapa';
  const estacion = '[data-elegir-herramienta="estaciones"]';
  const comunes = [
    [estacion, 'Elegí Estación', 'Seleccioná el icono de estación.', 'estacion-elegida'],
    [mapa, 'Colocá estaciones', 'Colocá las estaciones que pide la consigna en lugares distintos. Arrastrar mueve el mapa; un clic coloca la estación.', 'estaciones-creadas'],
    ['[data-elegir-herramienta="lineas"]', 'Elegí Línea', 'Seleccioná Línea para unir las primeras dos estaciones.', 'linea-elegida'],
    [mapa, 'Origen de la línea', 'Elegí una estación como origen.', 'origen-elegido'],
    [mapa, 'Destino de la línea', 'Elegí otra estación. Se crearán la línea y su primer tramo.', 'linea-creada'],
  ];
  if (nuevas.includes('editor.basico')) return [...comunes,
    ['[data-elegir-herramienta="metros"]', 'Elegí Metro', 'Seleccioná Metro y después tocá la vía de tu línea.', 'metro-elegido'],
    [mapa, 'Asigná el Metro', 'Tocá la vía. La unidad queda asignada cuando se confirme su creación.', 'metro-creado'],
    ['[data-guardar]', 'Guardá la red', 'Pulsá el disquete para conservar el avance. Guardar no termina el nivel.', 'guardado'],
    ['[data-ir-simulacion]', 'Pasá a Simulación', 'Abrí Acciones y pulsá Simular. Allí vas a iniciar el recorrido con Play.'],
  ];
  if (nuevas.includes('editor.extender')) return [
    ['[data-elegir-herramienta="conexiones"]', 'Extendé la línea', 'Creá primero una línea entre dos estaciones. Luego elegí Conexión para agregar otra estación al mismo recorrido.', 'conexion-elegida'],
    [mapa, 'Continuá el recorrido', 'Elegí una estación de la línea y otra estación como destino. El Metro recorrerá también el nuevo tramo.', 'conexion-creada'],
  ];
  if (nuevas.includes('editor.poi') && objetivo) return [
    ['.metronet-poi > summary', 'Puntos de interés de Montevideo', 'Abrí los puntos de interés usando la bandera amarilla.', 'poi-abierto'],
    ['.metronet-poi__categorias', 'Probá una categoría', 'Tocá un icono para mostrar u ocultar sus puntos. Podés combinar categorías para localizar los lugares de la consigna.', 'poi-categoria'],
    ['#metronet-selector-barrios .metronet-panel-encabezado', 'Abrí Barrios', 'Abrí la lista para elegir qué barrios resaltar. La casilla de la izquierda muestra u oculta la capa sin borrar tu selección.', 'barrios-abiertos'],
    ['.metronet-selector-barrios-lista', 'Seleccioná un barrio', 'Marcá un barrio. Podés elegir varios; Ninguno limpia la selección. Las flechas pequeñas permiten ver otros nombres.', 'barrio-seleccionado'],
    ['.metronet-poi__paginacion', 'Más barrios', 'Usá las flechas de los extremos para cambiar de página. Los barrios elegidos se conservan aunque cambies de página.'],
    ['#metronet-selector-barrios .metronet-panel-encabezado', 'Cerrá la lista de barrios', 'Tocá otra vez Barrios. Se cierra la lista y se conserva lo seleccionado.', 'barrios-cerrados'],
    ['#metronet-selector-zonas .metronet-panel-encabezado', 'Abrí Zonas', 'Las zonas agrupan sectores de la ciudad. Abrí su lista para elegir cuáles destacar.', 'zonas-abiertas'],
    ['.metronet-selector-zonas-lista', 'Seleccioná una zona', 'Marcá una o varias zonas. La casilla junto a Zonas permite mostrar u ocultar esa capa; es independiente de Barrios.', 'zona-seleccionada'],
    ['#metronet-selector-zonas .metronet-panel-encabezado', 'Cerrá la lista de zonas', 'Tocá Zonas otra vez para volver a la búsqueda. Tu selección se conserva.', 'zonas-cerradas'],
    ['.metronet-panel-puntos-alternar', 'Buscar punto de interés', 'Abrí la lupa para buscar un punto concreto.', 'buscador-abierto'],
    ['.metronet-panel-puntos-busqueda', `Buscá ${objetivo.nombre}`, `Escribí ${objetivo.nombre}. Los resultados usan el catálogo real del mapa.`, 'poi-buscado'],
    ['.metronet-panel-puntos-lista', 'Localizá el punto', `Seleccioná ${objetivo.nombre} en los resultados para localizarlo en el mapa.`, 'poi-localizado'],
    ['.metronet-punto-interes-mantener', 'Mantené el punto visible', 'Marcá Mantener visible para conservar este punto al cerrar la ficha o buscar otro. Podés desmarcarlo volviendo a abrir su ficha.', 'poi-fijado'],
    ['.metronet-punto-interes-panel-cerrar', 'Volvé al mapa', 'Cerrá la ficha: el marcador que fijaste permanece visible.', 'poi-ficha-cerrada'],
    [mapa, 'Marcador y cobertura', 'El marcador indica el centro. El área visible muestra dónde debe quedar la estación; el límite está incluido.'],
    [estacion, 'Estación dentro del radio', 'Elegí Estación y colocala dentro del área marcada.', 'poi-cubierto'],
  ];
  if (nuevas.includes('editor.transbordo')) return [
    ['[data-elegir-herramienta="lineas"]', 'Un intercambio real', 'Creá otra línea reutilizando una estación de la primera. Un cruce sin estación común no conecta las líneas.'],
    [mapa, 'Compartí una estación', 'Conectá tramos de dos líneas diferentes a una misma estación.', 'transbordo-creado'],
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
    'poi-categoria': controles.categoriaUsada,
    'barrios-abiertos': controles.barriosAbiertos,
    'barrio-seleccionado': controles.barrioSeleccionado,
    'barrios-cerrados': !controles.barriosAbiertos,
    'zonas-abiertas': controles.zonasAbiertas,
    'zona-seleccionada': controles.zonaSeleccionada,
    'zonas-cerradas': !controles.zonasAbiertas,
    'poi-fijado': controles.poiFijado,
    'poi-ficha-cerrada': controles.poiFichaCerrada,
    'buscador-abierto': controles.buscadorAbierto,
    'poi-buscado': controles.poiBuscado,
    'poi-localizado': Number(referencia?.id ?? referencia?.idPunto) === objetivoTutorialPoi(escenario?.numero, escenario)?.id,
    'poi-cubierto': consigna?.referenciasObjetivo?.some(p => Number(p.idPunto) === objetivoTutorialPoi(escenario?.numero, escenario)?.id && p.cubierto),
    'transbordo-creado': completa('minimoTransbordos') || (escenario?.reglasExito?.configuracionRecorrido?.redConectada && completa('minimoLineas') && completa('minimoTramos')),
  })[evento] === true;
}

export function objetivoTutorialPoi(numero, escenario) {
  const id = escenarioCampana(numero, escenario)?.reglasExito?.puntosInteresObjetivo?.[0]?.idPunto;
  return Object.values(puntos.barrios).flatMap(b => b.puntos).find(p => p.id === id);
}
