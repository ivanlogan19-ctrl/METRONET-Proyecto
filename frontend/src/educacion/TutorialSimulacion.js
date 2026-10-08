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
  ['.simulacion-configuracion-metros__desplegable > summary', 'UV por metro', 'Abrí este resumen para comparar la UV de cada metro con la duración global aplicada. No modifica la red.'],
  ['.simulacion-parametro-velocidad', 'Unidad de velocidad · UV', 'Ajustá la UV del metro seleccionado; con Todos los metros, el mismo valor se aplica al conjunto.'],
  ['.simulacion-parametro-velocidad button[type="submit"]', 'Aplicar UV', 'Confirmá la UV antes del próximo recorrido. El botón se habilita cuando la red permite configurarla.'],
  ['#seccionConfiguracion', 'Duración simulada · h', 'La duración representa horas simuladas. Es independiente de UV y del ritmo visual ×; pulsá Aplicar duración.'],
  ['#aplicarUnidadTiempo', 'Aplicar duración', 'Confirmá las horas simuladas antes del próximo recorrido. Podés cambiarla sin iniciar la simulación.'],
  ['.simulacion-accesos-titulo', 'Sonido y salida', 'Desde esta fila podés controlar el sonido, repetir el tutorial o volver a Edición.'],
];

const RESUMEN = [0, 2, 3, 9, 11, 13].map(indice => PASOS[indice]);

export function crearPanelTutorialSimulacion(acceso, alRecorrer, alAbrir = () => {}) {
  const panel = document.createElement('section');
  panel.className = 'metronet-tutorial__panel metronet-tutorial-simulacion';
  panel.setAttribute('popover', 'manual');
  panel.setAttribute('aria-label', 'Tutorial de Simulación');
  panel.id = 'metronet-tutorial-simulacion-panel';
  acceso.setAttribute('aria-controls', panel.id);
  acceso.setAttribute('aria-expanded', 'false');
  const cabecera = document.createElement('header');
  const titulo = document.createElement('h2'); titulo.textContent = 'Tutorial';
  cabecera.append(titulo);
  const introduccion = document.createElement('p');
  introduccion.textContent = 'Estas son las herramientas que utilizarás en Simulación.';
  const lista = document.createElement('div'); lista.className = 'metronet-tutorial__herramientas';
  for (const [, nombre, descripcion] of RESUMEN) {
    const item = document.createElement('p');
    const nombreVisible = document.createElement('strong'); nombreVisible.textContent = `${nombre} → `;
    const explicacion = document.createElement('span'); explicacion.textContent = descripcion;
    item.append(nombreVisible, explicacion); lista.append(item);
  }
  const repetir = document.createElement('button');
  repetir.type = 'button'; repetir.className = 'metronet-tutorial__repetir';
  repetir.textContent = 'Recorrer la pantalla';
  repetir.addEventListener('click', () => { cerrar(); acceso.focus({ preventScroll:true }); alRecorrer(); });
  panel.append(cabecera, introduccion, lista, repetir);
  document.body.append(panel);

  function posicionar() {
    if (!panel.matches(':popover-open')) return;
    const r = acceso.getBoundingClientRect();
    const debajo = innerHeight - r.bottom - 16, encima = r.top - 16;
    const arriba = debajo < 250 && encima > debajo;
    panel.style.left = `${Math.max(12, Math.min(r.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 12))}px`;
    panel.style.top = arriba ? 'auto' : `${r.bottom + 6}px`;
    panel.style.bottom = arriba ? `${innerHeight - r.top + 6}px` : 'auto';
    panel.style.maxHeight = `${Math.max(100, arriba ? encima : debajo)}px`;
  }
  function cerrar() {
    if (panel.matches(':popover-open')) panel.hidePopover();
    acceso.setAttribute('aria-expanded', 'false');
  }
  function alternar() {
    if (panel.matches(':popover-open')) { cerrar(); return; }
    alAbrir();
    panel.showPopover(); acceso.setAttribute('aria-expanded', 'true'); posicionar();
  }
  function cerrarFuera(evento) {
    if (!panel.contains(evento.target) && evento.target !== acceso) cerrar();
  }
  function cerrarEscape(evento) {
    if (evento.key !== 'Escape' || !panel.matches(':popover-open')) return;
    evento.preventDefault(); cerrar(); acceso.focus({ preventScroll:true });
  }
  acceso.addEventListener('click', alternar);
  document.addEventListener('pointerdown', cerrarFuera);
  document.addEventListener('keydown', cerrarEscape);
  window.addEventListener('resize', posicionar);
  window.addEventListener('scroll', posicionar, true);
  return { abrir:alternar, cerrar, eliminar() {
    cerrar(); acceso.removeEventListener('click', alternar);
    document.removeEventListener('pointerdown', cerrarFuera);
    document.removeEventListener('keydown', cerrarEscape);
    window.removeEventListener('resize', posicionar);
    window.removeEventListener('scroll', posicionar, true);
    panel.remove();
  } };
}

export function pasosSimulacion(numero) {
  const ejecucion = ['#formularioEjecucion', 'Observá el recorrido', 'Pulsá Play y esperá a que termine la ejecución. Pausar o detener no completa este paso.', 'ejecucion'];
  const velocidad = ['.simulacion-parametro-velocidad', 'Cambiá UV', 'Modificá la UV y aplicá el valor. Mantené las mismas horas para observar el efecto de la velocidad.', 'velocidad'];
  const duracion = ['#seccionConfiguracion', 'Cambiá horas simuladas', 'Aumentá o reducí las horas y aplicá la duración. UV y ritmo × permanecen independientes.', 'duracion'];
  if (numero === 2) return [[...PASOS[9]], ejecucion, velocidad, ejecucion];
  if (numero === 3) return [[...PASOS[11]], ejecucion, duracion, ejecucion];
  if (numero === 4) return [PASOS[7], ejecucion,
    ['.simulacion-parametro-velocidad', 'Ajuste global', 'Elegí Todos los metros, aplicá una misma UV nueva al conjunto y conservá las horas.', 'velocidad-global'], ejecucion,
    ['.simulacion-selector-metros', 'Elegí una unidad', 'Seleccioná un Metro concreto en el selector.', 'unidad-individual'],
    ['.simulacion-parametro-velocidad', 'Ajuste individual', 'Cambiá y aplicá solo la UV de la unidad elegida. Las otras unidades conservan su valor.', 'velocidad-individual'], ejecucion];
  if (numero === 9) return [['#formularioEjecucion', 'Comparar A y B', 'Compararemos ejecuciones de la misma red. Cambiar controles sin volver a ejecutar no alcanza.'],
    ejecucion, velocidad, duracion, ejecucion];
  if (numero !== 1 && Number.isInteger(numero)) return [];
  return [...PASOS.slice(0,2), PASOS[7], PASOS[9], PASOS[11],
    ['.simulacion-ritmo', 'Ritmo visual ×', 'El ritmo cambia qué tan rápido ves la simulación; no modifica UV ni horas simuladas.'],
    ...PASOS.slice(2,7), ['#seccionMetricas', 'Resultados', 'Al terminar, el nivel comprueba automáticamente la ejecución y actualiza su progreso. No necesitás abrir resultados para completarlo.']];
}

export function abrirTutorialSimulacion(alFinalizar = () => {}, numeroNivel) {
  const recorrido = new RecorridoInicial(alFinalizar, {
    interactivo: true,
    senalarDeshabilitados: true,
    disparador: '#tutorialPantallaSimulacion',
    evitarControles: '.simulacion-aplicacion button, .simulacion-aplicacion a[href], .simulacion-aplicacion summary, .simulacion-aplicacion input:not([type="hidden"]), .simulacion-aplicacion select:not([aria-hidden="true"])',
    pasos: pasosSimulacion(numeroNivel).length ? pasosSimulacion(numeroNivel) : pasosSimulacion(1),
    pasosDinamicos: true,
    tituloFinal: '¡Listo para simular!',
    textoFinal: 'Ya conocés los controles de esta pantalla. Podés repetir el recorrido junto al botón de sonido.',
  });
  recorrido.iniciar();
  return recorrido;
}

export function presentarTutorialSimulacion({ idUsuario, numeroNivel, numeroCampana, repetido = false, alFinalizar } = {}) {
  if (repetido || !Number.isInteger(numeroNivel) || !pasosSimulacion(numeroNivel).length) return null;
  const clave = `metronet:tutorial-pantalla-simulacion:v4:${idUsuario ?? 'invitado'}:${numeroCampana ?? 1}:${numeroNivel ?? 'libre'}`;
  try {
    if (localStorage.getItem(clave)) return null;
  } catch { /* El recorrido sigue disponible si el almacenamiento está bloqueado. */ }
  const recorrido = abrirTutorialSimulacion((completado, motivo) => {
    if (completado || motivo === 'omitido') try {
      localStorage.setItem(clave, completado ? 'presentado' : 'omitido');
    } catch { /* No afecta la simulación. */ }
    alFinalizar?.(completado);
  }, numeroNivel);
  return recorrido;
}
