import RecorridoInicial from './RecorridoInicial.js';
import './tutorial-inicial.css';

const PASOS = [
  ['#visorSimulacion', 'Mapa de la red', 'Acá ves estaciones, conexiones y metros. Arrastrá el mapa para recorrerlo.'],
  ['.simulacion-mandos-camara', 'Vista del mapa', 'Usá estos botones para acercar, alejar, ajustar la red o girar el mapa.'],
  ['#formularioEjecucion button[type="submit"]', 'Iniciar', 'Play comienza el recorrido cuando la red está validada y tiene al menos un metro. El tutorial no lo inicia por vos.'],
  ['.simulacion-acciones-ejecucion', 'Pausar y reanudar', 'Durante la ejecución aparece Pausar. Si pausás, Reanudar continúa desde el mismo punto; los botones se habilitan según el estado.'],
  ['#pausarSimulacion', 'Pausar', 'Detiene temporalmente la animación sin perder el recorrido ni su resultado. Aparece durante la ejecución.'],
  ['#detenerSimulacion', 'Detener', 'Termina la animación en curso o pausada. Se habilita solo en esos estados.'],
  ['#reiniciarSimulacion', 'Reiniciar', 'Repite el último recorrido con sus parámetros; se habilita después de una ejecución.'],
  ['.simulacion-selector-metros > summary', 'Elegir metros', 'Seleccioná Todos los metros para aplicar la misma UV a todos, o elegí uno para ajustar solo esa unidad.'],
  ['.simulacion-configuracion-metros__desplegable > summary', 'UT / UV por metro', 'Abrí este resumen para comparar la UV de cada metro con la duración global aplicada. No modifica la red.'],
  ['.simulacion-parametro-velocidad', 'Unidad de velocidad · UV', 'Ajustá la UV del metro seleccionado; con Todos los metros, el mismo valor se aplica al conjunto.'],
  ['.simulacion-parametro-velocidad button[type="submit"]', 'Aplicar UV', 'Confirmá la UV antes del próximo recorrido. El botón se habilita cuando la red permite configurarla.'],
  ['#seccionConfiguracion', 'Unidad de tiempo · UT', 'Ajustá la duración de la ejecución y pulsá Aplicar UT.'],
  ['#aplicarUnidadTiempo', 'Aplicar duración', 'Confirmá la UT antes del próximo recorrido. Podés cambiarla sin iniciar la simulación.'],
  ['.simulacion-accesos-titulo', 'Sonido y salida', 'Desde esta fila podés controlar el sonido, repetir el tutorial o volver a Edición.'],
];

export function abrirTutorialSimulacion(alFinalizar = () => {}) {
  const recorrido = new RecorridoInicial(alFinalizar, {
    interactivo: true,
    senalarDeshabilitados: true,
    disparador: '#tutorialPantallaSimulacion',
    evitarControles: '.simulacion-aplicacion button, .simulacion-aplicacion a[href], .simulacion-aplicacion summary, .simulacion-aplicacion input:not([type="hidden"]), .simulacion-aplicacion select:not([aria-hidden="true"])',
    pasos: PASOS,
    tituloFinal: '¡Listo para simular!',
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
  const recorrido = abrirTutorialSimulacion((completado, motivo) => {
    if (completado || motivo === 'omitido') try {
      localStorage.setItem(clave, completado ? 'presentado' : 'omitido');
    } catch { /* No afecta la simulación. */ }
    alFinalizar?.(completado);
  });
  return recorrido;
}
