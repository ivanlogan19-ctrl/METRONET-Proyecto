import RecorridoInicial from './RecorridoInicial.js';
import './tutorial-inicial.css';

const PASOS = [
  ['#visorSimulacion', 'Mapa', 'Acá observás la misma red que construiste. La simulación conserva sus estaciones y conexiones.'],
  ['#unidadCirculacion', 'Unidad', 'Todas aplica las UV a todas las unidades. Elegí un metro para modificar solamente ese; MIXTO indica valores distintos.'],
  ['.simulacion-parametro-velocidad', 'Velocidad · UV', 'METRONET representa la velocidad en UV, una escala didáctica propia. Aplicá el cambio con el disquete.'],
  ['#duracionSimulacion', 'Duración · h', 'La duración indica cuántas horas simuladas representa la ejecución, no horas reales de espera.'],
  ['.simulacion-ritmo', 'Ritmo · ×', 'El ritmo cambia qué tan rápido ves la simulación. No modifica las UV ni las horas simuladas.'],
  ['.simulacion-mandos', 'Play / Pausa', 'Play comprueba y guarda la red antes de ejecutar. Pausa detiene el avance y permite reanudarlo.'],
  ['.simulacion-mandos', 'Detener / Reiniciar', 'Detener interrumpe la animación. Reiniciar vuelve al principio conservando la configuración.'],
  ['.simulacion-parametro-velocidad', 'Probá las UV', 'Cambiá realmente las UV y aplicalas con el disquete. El tutorial continúa cuando se guardan.', 'velocidad'],
  ['#duracionSimulacion', 'Probá las horas', 'Cambiá la cantidad de horas simuladas. Las UV permanecen iguales.', 'duracion'],
  ['#formularioEjecucion button[type=submit]', 'Poné la red en marcha', 'Iniciá la simulación. Después compará ejecuciones siguiendo la pista del nivel.', 'inicio'],
];

// El servidor descarta campañas con ejecuciones previas. El navegador recuerda
// una presentación interrumpida antes de Play; nunca escribe progreso ni puntaje.
export function presentarTutorialSimulacion({ progreso, escenario, idUsuario, resultados = [] }) {
  if (!Number.isInteger(escenario?.numero) || escenario.herramientasHabilitadas?.simulacion !== true || !progreso?.tutorialSimulacionDisponible || resultados.length
      || !Number.isInteger(progreso.numeroCampanaActual) || idUsuario == null) return null;
  const clave = `metronet:tutorial-simulacion:${idUsuario}:${progreso.numeroCampanaActual}`;
  try { if (localStorage.getItem(clave)) return null; } catch { return null; }
  const recorrido = new RecorridoInicial(() => {}, { pasos: PASOS, interactivo: true });
  recorrido.iniciar();
  try { localStorage.setItem(clave, 'presentado'); } catch { /* No altera la ejecución. */ }
  return recorrido;
}
