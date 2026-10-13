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
  ['.simulacion-selector-metros > summary', 'Elegir metros', 'Seleccioná Todos los metros para aplicar UV o UT a todos, o elegí uno para ajustar solo esa unidad.'],
  ['.simulacion-configuracion-metros__desplegable > summary', 'Detalle de metros', 'Abrí este resumen para consultar la UV y la UT guardadas de cada metro. No modifica la red.'],
  ['.simulacion-parametro-velocidad', 'Unidad de velocidad · UV', 'Ajustá la UV del metro seleccionado; con Todos los metros, el mismo valor se aplica al conjunto.'],
  ['.simulacion-parametro-velocidad button[type="submit"]', 'Aplicar UV', 'Confirmá la UV antes del próximo recorrido. El botón se habilita cuando la red permite configurarla.'],
  ['#seccionConfiguracion', 'Duración simulada · UT', 'La duración UT representa el tiempo simulado y es independiente de UV. Confirmala con el disquete.'],
  ['#aplicarUnidadTiempo', 'Aplicar duración', 'Confirmá la duración UT antes del próximo recorrido. Podés cambiarla sin iniciar la simulación.'],
  ['.simulacion-accesos-titulo', 'Sonido y salida', 'Desde esta fila podés controlar el sonido, repetir el tutorial o volver a Edición.'],
];

const RESUMEN = [
  ['territorio', 'Recorré el mapa y ajustá la vista.'],
  ['play', 'Iniciá, pausá o detené el recorrido.'],
  ['metros', 'Elegí todos los metros o una unidad.'],
  ['velocidad', 'Ajustá y aplicá la velocidad UV.'],
  ['reloj', 'Ajustá y aplicá la duración UT.'],
];

export function crearPanelTutorialSimulacion(acceso, alRecorrer, alAbrir = () => {}) {
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
  for (const [icono, descripcion] of RESUMEN) {
    const item = document.createElement('p'); item.innerHTML = iconoRetro(icono);
    const explicacion = document.createElement('span'); explicacion.textContent = descripcion;
    item.append(explicacion); lista.append(item);
  }
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
  const velocidad = ['.simulacion-parametro-velocidad', 'Cambiá UV', 'Modificá la UV y aplicá el valor. Mantené la misma duración UT para observar el efecto de la velocidad.', 'velocidad'];
  const duracion = ['#seccionConfiguracion', 'Cambiá duración UT', 'Aumentá o reducí la duración UT y aplicala. La velocidad UV se conserva.', 'duracion'];
  if (nuevas.includes('simulacion.velocidad')) return [[...PASOS[8]], ejecucion, velocidad, ejecucion];
  if (nuevas.includes('simulacion.duracion')) return [[...PASOS[10]], ejecucion, duracion, ejecucion];
  if (nuevas.includes('simulacion.global') || nuevas.includes('simulacion.individual')) return [PASOS[6], ejecucion,
    ['.simulacion-parametro-velocidad', 'Ajuste global', 'Elegí Todos los metros, aplicá una misma UV nueva al conjunto y conservá la duración UT.', 'velocidad-global'], ejecucion,
    ['.simulacion-selector-metros', 'Elegí una unidad', 'Seleccioná un Metro concreto en el selector.', 'unidad-individual'],
    ['.simulacion-parametro-velocidad', 'Ajuste individual', 'Cambiá y aplicá solo la UV de la unidad elegida. Las otras unidades conservan su valor.', 'velocidad-individual'], ejecucion];
  if (nuevas.includes('simulacion.combinacion')) return [['#formularioEjecucion', 'Comparar A y B', 'Compararemos ejecuciones de la misma red. Cambiar controles sin volver a ejecutar no alcanza.'],
    ejecucion, velocidad, duracion, ejecucion];
  if (numero !== 1 && Number.isInteger(numero)) return [];
  return [PASOS[0], PASOS[6], PASOS[7], PASOS[8], PASOS[10],
    ...PASOS.slice(1,6)];
}

export function abrirTutorialSimulacion(alFinalizar = () => {}, numeroNivel, { primeraVisita = false, escenario, pendientes } = {}) {
  const practicas = pasosSimulacion(numeroNivel, escenario, pendientes);
  const pasos = primeraVisita && numeroNivel !== 1
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

export function presentarTutorialSimulacion({ idUsuario, idDiseno, numeroNivel, numeroCampana, escenario, alFinalizar } = {}) {
  const prefijo = `metronet:tutorial-pantalla-simulacion:v5:${idUsuario ?? 'invitado'}:${numeroCampana ?? 1}:`;
  const clave = `${prefijo}${numeroNivel ?? 'libre'}:${idDiseno ?? 'actual'}`;
  const primeraVisita = `${prefijo}primera-visita`;
  let conocido = false;
  try {
    conocido = Boolean(localStorage.getItem(primeraVisita));
    if (localStorage.getItem(clave)) return null;
  } catch { /* La guía sigue disponible sin almacenamiento. */ }
  const pendientes = funcionesIntroducidas(numeroNivel, escenario).filter(clave => clave.startsWith('simulacion.'));
  if (conocido && numeroNivel !== 1 && (!Number.isInteger(numeroNivel) || !pendientes.length)) return null;
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
