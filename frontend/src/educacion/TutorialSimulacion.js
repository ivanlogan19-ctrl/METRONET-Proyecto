import RecorridoInicial from './RecorridoInicial.js';
import './tutorial-inicial.css';

const PASOS = [
  ['#visorSimulacion', 'Mapa de la red', 'Acá ves estaciones, conexiones y metros. Arrastrá el mapa para recorrerlo.'],
  ['.simulacion-mandos-camara', 'Vista del mapa', 'Usá estos botones para acercar, alejar, ajustar la red o girar el mapa.'],
  ['.simulacion-acciones-panel', 'Acciones', 'Iniciá, pausá, reanudá, detené o reiniciá el recorrido con los botones disponibles según su estado.'],
  ['.simulacion-selector-metros > summary', 'Metros', 'Elegí todos los metros o uno en particular para configurar su velocidad.'],
  ['.simulacion-parametro-velocidad', 'Unidad de velocidad · UV', 'Ajustá el valor y pulsá Aplicar UV para usar esa velocidad.'],
  ['#seccionConfiguracion', 'Unidad de tiempo · UT', 'Ajustá la duración de la ejecución y pulsá Aplicar UT.'],
  ['.simulacion-accesos-titulo', 'Sonido y salida', 'Desde esta fila podés controlar el sonido, repetir el tutorial o volver a Edición.'],
];

export function abrirTutorialSimulacion(alFinalizar = () => {}) {
  const recorrido = new RecorridoInicial(alFinalizar, {
    interactivo: true,
    pausable: true,
    disparador: '#tutorialPantallaSimulacion',
    evitarControles: '.simulacion-aplicacion button, .simulacion-aplicacion a[href], .simulacion-aplicacion summary, .simulacion-aplicacion input:not([type="hidden"]), .simulacion-aplicacion select:not([aria-hidden="true"])',
    pasos: PASOS,
    tituloFinal: 'Pantalla lista',
    textoFinal: 'Ya conocés los controles de esta pantalla. Podés repetir el recorrido junto al botón de sonido.',
  });
  recorrido.iniciar();
  return recorrido;
}

export function presentarTutorialSimulacion({ idUsuario, alFinalizar } = {}) {
  const clave = `metronet:tutorial-pantalla-simulacion:v2:${idUsuario ?? 'invitado'}`;
  try {
    if (localStorage.getItem(clave)) return null;
  } catch { /* El recorrido sigue disponible si el almacenamiento está bloqueado. */ }
  const recorrido = abrirTutorialSimulacion(alFinalizar);
  try { localStorage.setItem(clave, 'presentado'); } catch { /* No afecta la simulación. */ }
  return recorrido;
}
