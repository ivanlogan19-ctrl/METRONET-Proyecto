// Orientación de presentación: las condiciones del servidor son la única fuente
// de cumplimiento. No evalúa reglas de éxito ni calcula cobertura/conectividad.
const aviso = (clave, texto, pista = '', conceptos = [], etiqueta = 'PISTA') => ({ clave, texto, pista, conceptos, etiqueta });
const esPendiente = c => c?.completado === false;

function orientarError(texto, modo, inicial) {
  const mensaje = String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/territorio|geograf|restring|cruz|atraviesa|no se permiten estaciones|prohibe tramos/.test(mensaje)) return aviso('error-territorio',
    'El recorrido sale del espacio permitido. Compará sus extremos con los límites del mapa.',
    'Unir dos estaciones permitidas no garantiza que todo el tramo quede dentro del territorio.', ['estacion', 'conexion', 'zona'], 'REVISÁ');
  if (/nombre/.test(mensaje)) return aviso('error-nombre',
    'El nombre debe distinguir al elemento. Comparalo con los que ya creaste.', '', ['estacion', 'linea'], 'REVISÁ');
  if (/metro|unidad|velocidad|capacidad/.test(mensaje)) return aviso('error-unidad',
    'Revisá la unidad y su línea antes de ponerla en circulación.',
    'La velocidad de la unidad y el ritmo de reproducción representan cosas distintas.', ['unidad', 'velocidad', 'ritmo'], 'REVISÁ');
  if (/estaciones|conexion|tramo|recorrido|linea/.test(mensaje)) return aviso('error-recorrido',
    'Ese recorrido no pudo formarse. Revisá a qué línea pertenecen las estaciones elegidas.',
    inicial && ['crearLinea', 'crearTramo'].includes(modo)
      ? 'Elegí estaciones distintas: el orden define la línea; una conexión une sus extremos.'
      : 'Seguí el recorrido: un tramo duplicado o una ramificación no aporta continuidad.', ['estacion', 'linea', 'conexion'], 'REVISÁ');
  return aviso('error-operacion', 'La acción no quedó confirmada. Revisá el aviso antes de continuar.', '', [], 'REVISÁ');
}

export function obtenerAyudaContextual({ diseno, escenario, consigna, estadoConsigna, modo = 'normal', seleccionadas = [], referencia, error, pantalla = 'editor', estadoMotor, tutorialActivo = false } = {}) {
  if (!diseno || !escenario || escenario.modo === 'EDICION_LIBRE' || !Number.isInteger(escenario.numero)) return null;
  const inicial = String(escenario.dificultad).toLowerCase() === 'inicial';
  const herramientas = escenario.herramientasHabilitadas ?? {};
  const permite = clave => herramientas[clave] !== false;
  if (error) return orientarError(error, modo, inicial);
  if (estadoConsigna !== 'disponible' || !Array.isArray(consigna?.condiciones) || !consigna.condiciones.length || consigna.condiciones.some(c => typeof c?.clave !== 'string' || !c.clave || typeof c.completado !== 'boolean')) return aviso('sin-consigna',
    'El avance aún no está confirmado. Contrastá tu diseño con la consigna visible.', '', [], 'CONTEXTO');
  const condiciones = consigna.condiciones;
  const pendientes = condiciones.filter(esPendiente);
  const falta = clave => pendientes.some(c => c.clave === clave);
  const tiene = clave => condiciones.some(c => c.clave === clave);
  const estaciones = diseno.estaciones?.length ?? 0;
  const lineas = diseno.lineas?.length ?? 0;
  const geografico = tiene('requiereCoberturaPuntosInteres') || condiciones.some(c => c.clave.startsWith('areaObjetivo:'));

  if (consigna.estadoGlobal === 'COMPLETADO' && !pendientes.length) return aviso('completado',
    'Intento completado. Compará tu recorrido con el objetivo antes del siguiente desafío.', '', ['objetivo'], 'LOGRO');
  if (pantalla === 'simulacion' && ['EN_CURSO', 'PAUSADA'].includes(estadoMotor)) return aviso(`circulacion-${estadoMotor}`,
    estadoMotor === 'PAUSADA' ? 'Circulación pausada. Observá cómo se relacionan las líneas y sus recorridos.' : 'Observá qué destinos conecta cada recorrido. La animación sola no confirma los objetivos.',
    'El ritmo cambia la animación; revisá la velocidad de las unidades en Desempeño.', ['linea', 'ritmo', 'velocidad'], 'OBSERVÁ');

  if (inicial && pendientes.length && !tutorialActivo && ['crearLinea', 'crearTramo'].includes(modo)) return aviso(`${modo}-${Math.min(seleccionadas.length, 2)}`,
    seleccionadas.length < 2 ? 'Elegí estaciones distintas en el mapa. El orden de selección ayuda a definir el recorrido.' : 'El recorrido se está construyendo entre las estaciones elegidas.',
    modo === 'crearLinea' ? 'La segunda estación crea la línea y su primer tramo.' : 'Cada estación de destino extiende el recorrido de la línea activa.', ['estacion', 'linea', 'conexion']);
  if (estaciones > 0 && falta('requiereGeografiaValida')) return aviso('territorio', 'Hay una dificultad territorial. Revisá la ubicación de las estaciones y sus tramos.', 'Los límites se aplican al recorrido completo, no solo a sus extremos.', ['estacion', 'conexion', 'zona']);
  const limite = pendientes.find(c => c.clave === 'maximoEstaciones');
  if (limite && limite.actual > limite.requerido) return aviso('limite', 'Hay más estaciones de las permitidas. Compará qué cobertura aporta cada ubicación.', 'Más elementos no siempre mejoran la red: compará su función antes de revisar el diseño.', ['estacion', 'cobertura']);
  if (!estaciones && geografico) return aviso(referencia ? 'referencia-elegida' : 'explorar',
    referencia ? 'Ya exploraste una referencia. Pensá cómo atenderla sin aislarla del recorrido.' : 'Antes de ubicar estaciones, identificá las referencias y áreas que la red debe atender.',
    'POI y barrio tienen distinta cobertura. Compará ambos criterios en la consigna.', ['poi', 'barrio', 'cobertura', 'estacion']);
  if (!estaciones && permite('estaciones')) return aviso('primera-estacion',
    inicial ? 'Aún no hay estaciones. Pensá qué puntos querés relacionar antes de ubicar el primero.' : 'Aún no hay estaciones. Pensá qué ubicaciones pueden sostener el recorrido de la consigna.',
    inicial && !tutorialActivo ? 'Elegí el icono de estación y una ubicación. El nombre se asigna automáticamente.' : 'Relacioná cada estación con una necesidad del escenario.', ['estacion']);
  if (estaciones === 1 && !lineas && permite('estaciones')) return aviso('primera-ubicada',
    'Ya ubicaste la primera estación. Pensá qué lugar conviene relacionar con ella.',
    inicial ? 'Una línea necesita estaciones distintas. Elegí qué otra ubicación puede aportar al recorrido.' : 'Considerá la separación y la función de las próximas ubicaciones, no solo la cantidad.', ['estacion', 'linea']);
  if (!lineas && permite('lineas')) return aviso('primera-linea',
    'Ya hay estaciones sin línea. Pensá en qué orden deberían relacionarse.',
    inicial && !tutorialActivo ? 'Elegí el icono de línea y dos estaciones distintas: quedan conectadas al elegir la segunda.' : 'El orden de las estaciones define qué destinos quedan relacionados por el recorrido.', ['estacion', 'linea', 'conexion']);

  const opciones = [
    ['minimoEstaciones', 'estaciones', 'Aún faltan estaciones. Pensá qué función aportaría cada nueva ubicación.', 'Pensá en ampliar el alcance del recorrido sin repetir la función de una estación cercana.', ['estacion', 'cobertura']],
    ['minimoLineas', 'lineas', 'Aún faltan líneas. Pensá cómo se relacionarían con los recorridos que ya construiste.', 'Una nueva línea puede compartir estaciones, pero necesita un recorrido propio coherente.', ['linea', 'estacion']],
    ['minimoTramos', 'conexiones', 'Faltan conexiones. Revisá qué estaciones deberían vincularse dentro de cada línea.', 'Seguí el recorrido entre estaciones y comprobá sus extremos antes de agregar un tramo.', ['conexion', 'estacion', 'linea']],
    ['requiereCoberturaPuntosInteres', 'estaciones', 'Queda cobertura pendiente. Compará las estaciones con las referencias sin atender.', 'La cercanía visual no confirma cobertura. Consultá cada POI en los objetivos.', ['cobertura', 'estacion', 'poi']],
    ['areas', 'estaciones', 'Hay áreas sin atender. Revisá en qué barrios y zonas quedan las estaciones.', 'Cubrir un POI no garantiza atender todas las áreas: compará ambas condiciones por separado.', ['barrio', 'zona', 'estacion', 'poi']],
    ['requiereObjetivosMismaLinea', 'conexiones', 'Las referencias necesitan un recorrido de la misma línea. Revisá dónde se interrumpe.', 'Cubrir lugares por separado y conectarlos entre sí son condiciones diferentes.', ['linea', 'cobertura', 'conexion']],
    ['minimoTransbordos', 'lineas', 'Faltan transbordos. Revisá qué estaciones relacionan recorridos de distintas líneas.', 'Un transbordo pertenece a varias líneas y está marcado como tal; la ubicación sola no alcanza.', ['transbordo', 'linea', 'estacion']],
    ['minimoMetros', 'metros', 'Los recorridos necesitan unidades para circular. Revisá su distribución entre líneas.', 'Una unidad está asociada a una línea. La cantidad requerida se consulta en los objetivos.', ['unidad', 'linea']],
    ['requiereRedValida', null, 'La red aún requiere revisión. Buscá recorridos aislados o ramificaciones.', 'Guardar comprueba la estructura; la consigna informa las condiciones que todavía faltan.', ['linea', 'conexion']],
  ];
  for (const [clave, herramienta, texto, pista, conceptos] of opciones) {
    const pendiente = clave === 'areas' ? pendientes.some(c => c.clave.startsWith('areaObjetivo:')) : falta(clave);
    if (!pendiente || (herramienta && !permite(herramienta))) continue;
    const cerca = pendientes.length < condiciones.length && pendientes.length <= 2;
    return aviso(clave, texto, pista, conceptos, cerca ? 'POR REVISAR' : 'PISTA');
  }
  const soloCirculacion = pendientes.every(c => ['velocidadCirculacion', 'requiereSimulacion', 'simulacionActual'].includes(c.clave));
  if (soloCirculacion && falta('velocidadCirculacion')) return aviso('velocidad', 'La velocidad no cumple el criterio. Compará los km/h de las unidades con la consigna.', 'Cambiar ×1 o ×2 solo modifica la reproducción; no cambia los km/h evaluados.', ['velocidad', 'unidad', 'ritmo']);
  if (soloCirculacion && (falta('requiereSimulacion') || falta('simulacionActual')) && permite('simulacion')) return aviso('simular',
    pantalla === 'simulacion' ? 'El diseño cumple las condiciones consultadas. Observá qué ocurre al simular.' : 'Falta observar la red en circulación. Simular comprueba automáticamente si está preparada.',
    'Si cambian el diseño o la velocidad, la simulación anterior puede quedar desactualizada.', ['simulacion', 'unidad', 'velocidad'], 'POR REVISAR');
  if (!pendientes.length) return aviso('listo', 'Las condiciones están satisfechas. La evaluación del escenario confirma el resultado.', pantalla === 'editor' && !permite('simulacion') ? 'El disquete Guardar también solicita la evaluación del intento en este escenario.' : 'La evaluación al finalizar la simulación confirma el resultado del intento.', ['objetivo', 'simulacion'], 'POR CONFIRMAR');
  return aviso('otra-condicion', 'Queda una condición pendiente. Compará su descripción con el estado actual de tu red.', 'Si falta una herramienta o el criterio no es claro, conservá el diseño y revisá el aviso.', ['objetivo']);
}
