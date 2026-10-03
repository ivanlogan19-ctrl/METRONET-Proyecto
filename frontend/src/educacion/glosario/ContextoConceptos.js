import { obtenerConcepto } from './Conceptos.js';

// Configuración exclusivamente educativa. No altera niveles.json ni sus reglas.
const iniciales = ['diseno', 'linea', 'estacion', 'nivel', 'escenario', 'objetivo', 'regla-exito', 'herramientas', 'progreso', 'intento', 'puntaje'];
const conexiones = [...iniciales, 'conexion'];
const unidades = [...conexiones, 'unidad', 'cantidad-unidades', 'velocidad'];
const geografia = [...unidades, 'poi', 'cobertura', 'unidades-mapa', 'zona', 'barrio', 'simulacion', 'ritmo', 'duracion', 'tiempo-estimado'];
const intercambios = [...geografia, 'transbordo'];

export const CONCEPTOS_POR_NIVEL = Object.freeze({
  1: { ids: iniciales },
  2: { ids: conexiones },
  3: { ids: unidades },
  4: { ids: geografia },
  5: { ids: geografia },
  6: { ids: geografia },
  7: { ids: intercambios },
  8: { ids: intercambios },
  9: { ids: intercambios },
  10: { ids: intercambios },
});

const herramientaConcepto = { estacion: 'estaciones', linea: 'lineas', conexion: 'conexiones', unidad: 'metros', 'cantidad-unidades': 'metros', velocidad: 'metros', simulacion: 'simulacion', ritmo: 'simulacion', duracion: 'simulacion', 'tiempo-estimado': 'simulacion' };
const validos = ids => ids.filter(id => obtenerConcepto(id)?.definicion);
export function conceptosDelNivel(escenario) {
  const configuracion = CONCEPTOS_POR_NIVEL[escenario?.numero];
  const ids = configuracion?.ids ?? (escenario?.modo === 'EDICION_LIBRE' ? [...intercambios, 'modo-libre'] : []);
  return validos(ids).filter(id => escenario?.herramientasHabilitadas?.[herramientaConcepto[id]] !== false);
}

// En la pantalla de simulación estos controles ya están presentes, incluso para
// diseños libres. La consigna utiliza por separado la asociación del escenario.
export const CONCEPTOS_SIMULACION = Object.freeze(['simulacion', 'unidad', 'velocidad', 'ritmo', 'duracion', 'tiempo-estimado', 'puntaje']);
