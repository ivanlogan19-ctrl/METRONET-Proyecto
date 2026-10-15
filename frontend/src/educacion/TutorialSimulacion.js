import { ofrecerTutorial } from './OfertaTutorial.js';
import { describirFunciones, funcionesIntroducidas, registrarFuncionesEnsenadas } from './FuncionesCampana.js';
import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';
import RecorridoInicial from './RecorridoInicial.js';
import './tutorial-inicial.css';

const PASOS = [
  ['#visorSimulacion', 'Mapa de la red', 'Acá ves estaciones, conexiones y metros. Arrastrá el mapa para recorrerlo.'],
  ['#formularioEjecucion button[type="submit"]', 'Iniciar', 'Play comienza el recorrido cuando la red está validada y tiene al menos un metro. El tutorial no lo inicia por vos.'],
  ['.simulacion-acciones-ejecucion', 'Pausar y reanudar', 'Durante la ejecución aparece Pausar. Si pausás, Reanudar continúa desde el mismo punto; los botones se habilitan según el estado.'],
  ['#pausarSimulacion', 'Pausar', 'Detiene temporalmente la animación sin perder el recorrido ni su resultado. Aparece durante la ejecución.'],
  ['#detenerSimulacion', 'Detener', 'Termina la animación en curso o pausada. Se habilita solo en esos estados.'],
  ['#reiniciarSimulacion', 'Reiniciar', 'Repite el último recorrido con sus parámetros; se habilita después de una ejecución.'],
  ['.simulacion-selector-metros > summary', 'Elegir línea', 'Elegí una línea para ajustar UV y UT según su distancia. Sus metros comparten la configuración; las demás líneas conservan sus valores.'],
  ['.simulacion-configuracion-metros__desplegable > summary', 'Detalle de metros', 'Abrí este resumen para consultar la UV y la UT guardadas de cada metro. No modifica la red.'],
  ['.simulacion-parametro-velocidad', 'Unidad de velocidad · UV', '1 UV equivale a 1 km por UT. Ajustá la línea seleccionada. Su UT se calcula según la distancia; guardá el valor.'],
  ['.simulacion-parametro-velocidad button[type="submit"]', 'Aplicar UV', 'Confirmá la UV antes del próximo recorrido. El botón se habilita cuando la red permite configurarla.'],
  ['#seccionConfiguracion', 'Duración simulada · UT', '1 UT equivale a una hora del escenario. Al elegir UT, la UV se calcula para completar los kilómetros de la línea. Confirmá la duración con el disquete.'],
  ['#aplicarUnidadTiempo', 'Aplicar duración', 'Confirmá la duración UT antes del próximo recorrido. Al cambiarla se recalcula UV para la distancia de la línea.'],
  ['.simulacion-accesos-titulo', 'Sonido y salida', 'Desde esta fila podés controlar el sonido, repetir el tutorial o volver a Edición.'],
];

const RESUMEN = [
  ['territorio', 'Recorré el mapa y ajustá la vista.'],
  ['play', 'Iniciá, pausá o detené el recorrido.'],
  ['metros', 'Elegí una línea para consultar y ajustar sus valores.'],
  ['velocidad', 'Ajustá y aplicá la velocidad UV.'],
  ['reloj', 'Ajustá y aplicá la duración UT.'],
];

const esModoLibre = modo => ['LIBRE', 'EDICION_LIBRE'].includes(modo);
const PASOS_LIBRE = [
  ['.simulacion-selector-metros > summary', 'Elegir línea', 'Cada línea tiene su propia UV y UT, compartidas por todos sus metros. Elegí una línea para ajustarla sin cambiar las otras.'],
  ['.simulacion-parametro-velocidad', 'Velocidad y tiempo vinculados', 'Al cambiar UV se calcula UT según los kilómetros de la línea. Al cambiar UT se calcula UV. Guardá con los botones habituales; el último valor elegido se conserva al modificar el recorrido.'],
  ['#seccionConfiguracion', 'Tiempos fraccionarios', 'Podés indicar fracciones de UT: 1,5 UT equivale a una hora y media. La duración se calcula con la distancia de la línea seleccionada.'],
  ['[data-medicion-distancias]', 'Distancias de la red', 'La regla muestra u oculta los kilómetros de cada tramo. Arriba del mapa ves el total de la línea seleccionada o de la red. A 4 UV recorrés 4 km por UT; estas distancias te ayudan a elegir velocidad y duración.'],

  ['.simulacion-horarios', 'Horarios de la simulación', 'Inicio es la hora elegida para el escenario. Actual avanza con la ejecución y Fin indica hasta cuándo se simula según la mayor duración UT de tus metros.'],
  ['#horaInicioEscenario', 'Elegir la hora de inicio', 'Escribí la hora o usá las flechas para adelantar o atrasar una hora. Elegila antes de iniciar; durante el recorrido o una pausa queda bloqueada.'],
  ['[data-capa-simulacion="calles"]', 'Calles y avenidas', 'Este botón muestra u oculta las calles para ubicar tu red en la ciudad. Las estaciones, líneas y metros permanecen por encima.'],
  ['[data-capa-simulacion="trafico"]', 'Tráfico sincronizado', 'Activá el tráfico histórico para ver su intensidad por colores. Cambia con la hora Actual de la simulación; son datos históricos, no tráfico en vivo.'],
  ['[data-capa-simulacion="poblacion"]', 'Densidad de población', 'Mostrá dónde se concentra la población. Esta capa censal permanece igual al avanzar el reloj.'],
  ['[data-capa-simulacion="desplazamientos"]', 'Desplazamientos sincronizados', 'Las flechas muestran los desplazamientos históricos del horario Actual. Su animación sigue la ejecución: se pausa y se reinicia junto con ella.'],
  ['[data-capa-simulacion="cobertura"]', 'Cobertura de las estaciones', 'Mostrá u ocultá el área de 500 m alrededor de cada estación para compararla con las capas. El área depende del diseño de la red.'],
  ['.simulacion-capas input[type="range"]', 'Transparencia de las capas', 'Deslizá este control para ver las capas con mayor o menor intensidad, manteniendo tu red visible. Podés combinarlas o apagarlas con sus botones.'],
];
const RESUMEN_LIBRE = [
  ['reloj', 'Elegí Inicio y seguí el horario Actual.'],
  ['trafico', 'Tráfico y desplazamientos siguen el reloj.'],
  ['poblacion', 'La población conserva sus datos censales.'],
  ['cobertura', 'Compará las capas con la cobertura de 500 m.'],
];

export function crearPanelTutorialSimulacion(acceso, alRecorrer, alAbrir = () => {}, obtenerModo = () => undefined) {
  const panel = document.createElement('section');
  panel.className = 'metronet-tutorial__panel metronet-tutorial-simulacion metronet-guia-rapida';
  panel.setAttribute('popover', 'manual');
  panel.setAttribute('aria-label', 'Tutorial de Simulación');
  panel.id = 'metronet-tutorial-simulacion-panel';
  acceso.setAttribute('aria-controls', panel.id);
  acceso.setAttribute('aria-expanded', 'false');
  const cabecera = document.createElement('header');
  const titulo = document.createElement('h2'); titulo.textContent = 'Guía rápida';
  cabecera.append(titulo);
  const estado = document.createElement('p'); estado.className = 'metronet-tutorial__completado';
  estado.textContent = 'Tutorial completado'; estado.hidden = true;
  const lista = document.createElement('div'); lista.className = 'metronet-tutorial__herramientas';
  function actualizarResumen() {
    lista.replaceChildren();
    for (const [icono, descripcion] of esModoLibre(obtenerModo()) ? RESUMEN_LIBRE : RESUMEN) {
    const item = document.createElement('p'); item.innerHTML = iconoRetro(icono);
    const explicacion = document.createElement('span'); explicacion.textContent = descripcion;
    item.append(explicacion); lista.append(item);
    }
  }
  actualizarResumen();
  const repetir = document.createElement('button');
  repetir.type = 'button'; repetir.className = 'metronet-tutorial__repetir';
  configurarBotonIcono(repetir, 'reiniciar', 'Recorrer la pantalla');
  repetir.addEventListener('click', () => { cerrar(); acceso.focus({ preventScroll:true }); alRecorrer(); });
  panel.append(cabecera, estado, lista, repetir);
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
    actualizarResumen();
    panel.showPopover(); acceso.setAttribute('aria-expanded', 'true'); posicionar();
  }
  function cerrarFuera(evento) {
    if (!panel.contains(evento.target) && !acceso.contains(evento.target)) cerrar();
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
  return { abrir:alternar, cerrar, marcarCompletado() { estado.hidden = false; }, eliminar() {
    cerrar(); acceso.removeEventListener('click', alternar);
    document.removeEventListener('pointerdown', cerrarFuera);
    document.removeEventListener('keydown', cerrarEscape);
    window.removeEventListener('resize', posicionar);
    window.removeEventListener('scroll', posicionar, true);
    panel.remove();
  } };
}

export function pasosSimulacion(numero, escenario, pendientes) {
  const nuevas = pendientes ?? funcionesIntroducidas(numero, escenario);
  const ejecucion = ['#formularioEjecucion', 'Observá el recorrido', 'Pulsá Play y esperá a que termine la ejecución. Pausar o detener no completa este paso.', 'ejecucion'];
  const velocidad = ['.simulacion-parametro-velocidad', 'Cambiá UV', 'Modificá la UV y aplicá el valor. Observá la UT calculada según la distancia de esa línea.', 'velocidad'];
  const duracion = ['#seccionConfiguracion', 'Cambiá duración UT', 'Aumentá o reducí la duración UT y aplicala. La velocidad UV se calcula automáticamente para completar esa distancia.', 'duracion'];
  if (numero === 4) return [ejecucion, velocidad, ejecucion, duracion, ejecucion];
  if (nuevas.includes('simulacion.velocidad')) return [[...PASOS[8]], ejecucion, velocidad, ejecucion];
  if (nuevas.includes('simulacion.duracion')) return [[...PASOS[10]], ejecucion, duracion, ejecucion];
  if (nuevas.includes('simulacion.global') || nuevas.includes('simulacion.individual')) return [PASOS[6], ejecucion,
    ['.simulacion-selector-metros', 'Elegí una línea', 'Seleccioná una línea concreta en el selector.', 'unidad-individual'],
    ['.simulacion-parametro-velocidad', 'Ajuste individual', 'Cambiá y aplicá la UV de esa línea. Su UT se calcula sola; las otras líneas conservan sus valores.', 'velocidad-individual'], ejecucion];
  if (nuevas.includes('simulacion.combinacion')) return [['#formularioEjecucion', 'Comparar A y B', 'Compararemos ejecuciones de la misma red. Cambiar controles sin volver a ejecutar no alcanza.'],
    ejecucion, velocidad, duracion, ejecucion];
  if (numero !== 1 && Number.isInteger(numero)) return [];
  return [PASOS[0], PASOS[6], PASOS[7], PASOS[8], PASOS[10],
    ...PASOS.slice(1,6)];
}

export function abrirTutorialSimulacion(alFinalizar = () => {}, numeroNivel, { primeraVisita = false, escenario, pendientes, modo } = {}) {
  const practicas = pasosSimulacion(numeroNivel, escenario, pendientes);
  const pasos = esModoLibre(modo) ? PASOS_LIBRE : primeraVisita && numeroNivel !== 1
    ? [...pasosSimulacion(1), ...practicas]
    : practicas.length ? practicas : pasosSimulacion(1);
  const recorrido = new RecorridoInicial(alFinalizar, {
    interactivo: true,
    senalarDeshabilitados: true,
    disparador: '#tutorialPantallaSimulacion',
    evitarControles: '.simulacion-aplicacion button, .simulacion-aplicacion a[href], .simulacion-aplicacion summary, .simulacion-aplicacion input:not([type="hidden"]), .simulacion-aplicacion select:not([aria-hidden="true"])',
    pasos,
    pasosDinamicos: true,
    tituloFinal: '¡Listo para simular!',
    textoFinal: 'Ya conocés los controles de esta pantalla. Podés repetir el recorrido junto al botón de sonido.',
  });
  recorrido.iniciar();
  return recorrido;
}

export function presentarTutorialSimulacion({ idUsuario, idDiseno, modo, numeroNivel, numeroCampana, escenario, alFinalizar } = {}) {
  if (esModoLibre(modo)) {
    // Independiente del aprendizaje de la campaña: estas funciones solo existen en Modo Libre.
    const clave = `metronet:tutorial-simulacion-libre:v2:${idUsuario ?? 'invitado'}:${idDiseno ?? 'actual'}`;
    try { if (localStorage.getItem(clave)) return null; } catch { /* No bloquea jugar. */ }
    const registrar = (completado, motivo) => {
      if (completado || motivo === 'omitido') try {
        localStorage.setItem(clave, completado ? 'presentado' : 'omitido');
      } catch { /* La ayuda manual sigue disponible. */ }
      alFinalizar?.(completado);
    };
    let recorrido;
    const oferta = ofrecerTutorial({
      titulo: 'Simulación de Modo Libre',
      descripcion: 'Conocé Horarios, las capas sincronizadas y la cobertura de tu red. Te mostramos cómo usar estas funciones en esta pantalla.',
      textoAceptar: 'Recorrer las funciones',
      alAceptar: () => { recorrido = abrirTutorialSimulacion(registrar, undefined, { modo }); },
      alOmitir: () => registrar(false, 'omitido'),
    });
    return { notificar: evento => recorrido?.notificar(evento), terminar: (...args) => { oferta.terminar(); recorrido?.terminar(...args); } };
  }
  const prefijo = `metronet:tutorial-pantalla-simulacion:v6:${idUsuario ?? 'invitado'}:${numeroCampana ?? 1}:`;
  const clave = `${prefijo}${numeroNivel ?? 'libre'}:${idDiseno ?? 'actual'}`;
  const primeraVisita = `${prefijo}primera-visita`;
  let conocido = false;
  try {
    conocido = Boolean(localStorage.getItem(primeraVisita));
    if (localStorage.getItem(clave)) return null;
  } catch { /* La guía sigue disponible sin almacenamiento. */ }
  const pendientes = funcionesIntroducidas(numeroNivel, escenario).filter(clave => clave.startsWith('simulacion.'));
  if (conocido && numeroNivel !== 1 && numeroNivel !== 4 && (!Number.isInteger(numeroNivel) || !pendientes.length)) return null;
  const registrar = (completado, motivo) => {
    if (completado || motivo === 'omitido') try {
      localStorage.setItem(clave, completado ? 'presentado' : 'omitido');
      localStorage.setItem(primeraVisita, 'presentado');
    } catch { /* No afecta la simulación. */ }
    if (completado) registrarFuncionesEnsenadas(idUsuario, ['simulacion.inicial.v2', ...pendientes]);
    alFinalizar?.(completado);
  };
  let recorrido;
  const oferta = ofrecerTutorial({
    descripcion: conocido && pendientes.length ? `Ahora podés ${describirFunciones(pendientes)}. ¿Querés aprender cómo se usa?` : 'Conocé el mapa, los controles y cómo aplicar UV y UT en Simulación.',
    alAceptar: () => {
      try { localStorage.setItem(clave, 'iniciado'); } catch { /* No bloquea jugar. */ }
      recorrido = abrirTutorialSimulacion(registrar, numeroNivel, { primeraVisita: !conocido, escenario, pendientes }); },
    alOmitir: () => registrar(false, 'omitido'),
  });
  return { notificar: evento => recorrido?.notificar(evento), terminar: (...args) => { oferta.terminar(); recorrido?.terminar(...args); } };
}
