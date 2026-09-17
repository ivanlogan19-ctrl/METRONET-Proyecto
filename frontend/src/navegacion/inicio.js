import { requerirSesion } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta } from '../red/ContextoDiseno.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';

const URL_API_JUEGO = `${window.location.protocol}//${window.location.hostname}:8080/api/juego`;
const ESTADOS_CON_INTENTO_ACTIVO = new Set(['EN_DESARROLLO', 'EN_DISENO', 'GUARDADO', 'VALIDADO', 'COMPLETADA']);
const CONSEJOS_METRONET = Object.freeze([
  'Una red clara comienza por conectar estaciones antes de incorporar unidades de metro.',
  'Validá tu red antes de simular: así detectás estaciones aisladas y conexiones incompletas.',
  'Usá los puntos de interés para decidir dónde una estación puede aportar más cobertura.',
  'Probá una línea a la vez antes de agregar nuevas conexiones a tu diseño.',
]);

const sesion = requerirSesion('/inicio.html');
const consejoActual = CONSEJOS_METRONET[Math.floor(Math.random() * CONSEJOS_METRONET.length)];
let navegacionEnCurso = false;

if (sesion) inicializar();

async function inicializar() {
  inicializarNavegacion({ actual: 'inicio' });
  establecerSaludo();
  await cargarTablero();
}

async function cargarTablero() {
  const tablero = document.getElementById('accionesInicio');
  establecerEstadoCarga(true);
  mostrarMensaje('');
  tablero.replaceChildren();
  try {
    const progreso = await solicitar('/progreso');
    renderizarTablero(tablero, progreso);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
    renderizarError(tablero, error.message);
  } finally {
    establecerEstadoCarga(false);
  }
}

async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`${URL_API_JUEGO}${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${sesion.token}`, ...(opciones.headers ?? {}) },
  });
  if (respuesta.ok) return respuesta.json();
  let mensaje = 'No fue posible consultar tu progreso.';
  try { mensaje = (await respuesta.json()).detail ?? mensaje; } catch { /* La respuesta no incluye detalle. */ }
  throw new Error(mensaje);
}

function establecerSaludo() {
  const nombre = String(sesion.usuario?.nombre ?? '').trim();
  const titulo = document.getElementById('tituloInicio');
  titulo.textContent = nombre ? `Bienvenido, ${nombre}` : 'Bienvenido a METRONET';
}

function renderizarTablero(contenedor, progreso) {
  const resumen = crearResumen(progreso);
  contenedor.replaceChildren(
    crearTarjetaContinuar(resumen),
    crearTarjetaModoLibre(resumen),
    crearTarjetaProgreso(resumen),
    crearTarjetaConsejo(),
  );
}

function crearResumen(progreso) {
  const escenarios = progreso.escenarios ?? [];
  const niveles = escenarios
    .filter((escenario) => escenario.numero !== null)
    .sort((primero, segundo) => primero.numero - segundo.numero);
  const modoLibre = escenarios.find((escenario) => escenario.numero === null) ?? null;
  const escenarioActivo = niveles.find((escenario) => ESTADOS_CON_INTENTO_ACTIVO.has(escenario.estado));
  const escenarioDisponible = niveles.find((escenario) => escenario.desbloqueado && escenario.estado !== 'COMPLETADO');
  return {
    niveles,
    modoLibre,
    cantidadCompletados: progreso.nivelesCompletados ?? 0,
    escenarioContinuar: escenarioActivo ?? escenarioDisponible ?? null,
    recorridoCompletado: Boolean(progreso.campanaCompletada),
    campanaCompletadaHistoricamente: Boolean(progreso.campanaCompletadaHistoricamente),
    modoLibreDesbloqueado: Boolean(progreso.modoLibreDesbloqueado),
  };
}

function crearTarjetaContinuar(resumen) {
  const tarjeta = crearTarjeta('continuar', 'Continuar');
  const contenido = document.createElement('div');
  contenido.className = 'metronet-inicio__tarjeta-contenido';
  if (resumen.escenarioContinuar) {
    const escenario = resumen.escenarioContinuar;
    contenido.append(
      crearTituloTarjeta(`Escenario ${escenario.numero} · ${escenario.nombre}`),
      crearEstado(estadoLegible(escenario.estado), 'activo'),
      crearDescripcion(escenario.objetivo || escenario.instrucciones || 'Retomá el próximo paso de tu recorrido.'),
      crearMeta(`${resumen.cantidadCompletados} de ${resumen.niveles.length} niveles completados · Progreso del escenario: ${progresoLegible(escenario.progreso)}`),
    );
    const boton = crearBoton(
      ESTADOS_CON_INTENTO_ACTIVO.has(escenario.estado) ? 'Continuar escenario' : 'Comenzar escenario',
      'azul',
      () => iniciarEscenario(escenario.idEscenario, boton),
    );
    tarjeta.append(contenido, crearPieTarjeta(boton, '/escenarios.html', 'Ver todos los escenarios'));
    return tarjeta;
  }
  if (resumen.recorridoCompletado) {
    contenido.append(
      crearTituloTarjeta('Recorrido completado'),
      crearEstado('Completado', 'completado'),
      crearDescripcion('Completaste todos los escenarios de aprendizaje. El Modo Libre ya está disponible para crear sin consigna.'),
      crearMeta(`${resumen.cantidadCompletados} de ${resumen.niveles.length} niveles completados`),
    );
    tarjeta.append(contenido, crearPieTarjeta(null, '/escenarios.html', 'Ver recorrido completo'));
    return tarjeta;
  }
  contenido.append(
    crearTituloTarjeta('Escenarios no disponibles'),
    crearEstado('Sin datos', 'neutral'),
    crearDescripcion('Todavía no hay un escenario disponible para continuar.'),
  );
  tarjeta.append(contenido, crearPieTarjeta(null, '/escenarios.html', 'Consultar escenarios'));
  return tarjeta;
}

function crearTarjetaModoLibre(resumen) {
  const tarjeta = crearTarjeta('crear', 'Crear');
  const contenido = document.createElement('div');
  contenido.className = 'metronet-inicio__tarjeta-contenido';
  const modoLibre = resumen.modoLibre;
  if (!modoLibre) {
    tarjeta.classList.add('metronet-inicio__tarjeta--bloqueada');
    contenido.append(
      crearTituloTarjeta('Modo Libre'),
      crearEstado('No disponible', 'neutral'),
      crearDescripcion('El Modo Libre se habilitará cuando esté configurado en el recorrido de aprendizaje.'),
    );
    tarjeta.append(contenido);
    return tarjeta;
  }
  if (!resumen.modoLibreDesbloqueado) {
    tarjeta.classList.add('metronet-inicio__tarjeta--bloqueada');
    contenido.append(
      crearTituloTarjeta('🔒 Modo Libre'),
      crearEstado('Bloqueado', 'bloqueado'),
      crearDescripcion('Completá los escenarios de aprendizaje para diseñar una red sin consigna obligatoria.'),
      crearMeta(`${resumen.cantidadCompletados} de ${resumen.niveles.length} niveles completados`),
    );
    tarjeta.append(contenido);
    return tarjeta;
  }
  contenido.append(
    crearTituloTarjeta('Modo Libre'),
    crearEstado('Disponible', 'disponible'),
    crearDescripcion(resumen.campanaCompletadaHistoricamente
      ? 'Logro permanente desbloqueado. Creá una red propia sin reiniciar tus avances anteriores.'
      : 'Creá una red propia, definí líneas, estaciones, conexiones y unidades de metro antes de simularla.'),
  );
  const boton = crearBoton('Iniciar Modo Libre', 'verde', () => iniciarEscenario(modoLibre.idEscenario, boton));
  tarjeta.append(contenido, crearPieTarjeta(boton, '/', 'Abrir mis diseños'));
  return tarjeta;
}

function crearTarjetaProgreso(resumen) {
  const tarjeta = crearTarjeta('progreso', 'Progreso');
  const encabezado = document.createElement('div');
  encabezado.className = 'metronet-inicio__tarjeta-contenido';
  encabezado.append(
    crearTituloTarjeta('Tu recorrido'),
    crearDescripcion(resumen.niveles.length
      ? `${resumen.cantidadCompletados} de ${resumen.niveles.length} niveles completados.`
      : 'Todavía no hay niveles disponibles.'),
  );
  const pasos = document.createElement('ol');
  pasos.className = 'metronet-inicio__pasos';
  const pasosEscenarios = [...resumen.niveles];
  if (resumen.modoLibre) pasosEscenarios.push(resumen.modoLibre);
  pasos.append(...pasosEscenarios.map((escenario) => crearPasoProgreso(escenario, resumen.escenarioContinuar)));
  const accesos = document.createElement('nav');
  accesos.className = 'metronet-inicio__accesos';
  accesos.setAttribute('aria-label', 'Accesos al jugador');
  accesos.append(
    crearEnlace('/escenarios.html', 'Escenarios'),
    crearEnlace('/', 'Mis diseños'),
    crearEnlace('/simulacion.html', 'Simulaciones'),
  );
  tarjeta.append(encabezado, pasos, accesos);
  return tarjeta;
}

function crearTarjetaConsejo() {
  const tarjeta = crearTarjeta('consejo', 'Consejo');
  const contenido = document.createElement('div');
  contenido.className = 'metronet-inicio__tarjeta-contenido';
  contenido.append(
    crearTituloTarjeta('Consejo para tu próxima acción'),
    crearDescripcion(consejoActual),
  );
  const nota = crearMeta('Las funciones disponibles dependen del escenario que elijas.');
  nota.classList.add('metronet-inicio__consejo-nota');
  tarjeta.append(contenido, nota);
  return tarjeta;
}

function crearTarjeta(variante, etiqueta) {
  const tarjeta = document.createElement('section');
  tarjeta.className = `metronet-inicio__tarjeta metronet-inicio__tarjeta--${variante}`;
  const identificador = document.createElement('p');
  identificador.className = 'metronet-inicio__tarjeta-etiqueta';
  identificador.textContent = etiqueta;
  tarjeta.append(identificador);
  return tarjeta;
}

function crearPasoProgreso(escenario, escenarioContinuar) {
  const paso = document.createElement('li');
  const estado = estadoPaso(escenario, escenarioContinuar);
  paso.className = `metronet-inicio__paso metronet-inicio__paso--${estado}`;
  if (escenario.idEscenario === escenarioContinuar?.idEscenario) paso.setAttribute('aria-current', 'step');
  const indicador = document.createElement('span');
  indicador.className = 'metronet-inicio__paso-indicador';
  indicador.setAttribute('aria-hidden', 'true');
  indicador.textContent = escenario.numero ?? '∞';
  const texto = document.createElement('span');
  texto.textContent = escenario.numero === null ? 'Modo Libre' : `Nivel ${escenario.numero}`;
  paso.append(indicador, texto);
  return paso;
}

function estadoPaso(escenario, escenarioContinuar) {
  if (ESTADOS_CON_INTENTO_ACTIVO.has(escenario.estado)) return 'actual';
  if (escenario.completadoEnCampanaActual || escenario.estado === 'COMPLETADO') return 'completado';
  if (escenario.idEscenario === escenarioContinuar?.idEscenario) return 'actual';
  if (escenario.desbloqueado) return 'disponible';
  return 'bloqueado';
}

function crearPieTarjeta(boton, ruta, textoEnlace) {
  const pie = document.createElement('footer');
  pie.className = 'metronet-inicio__tarjeta-pie';
  if (boton) pie.append(boton);
  pie.append(crearEnlace(ruta, textoEnlace));
  return pie;
}

function crearTituloTarjeta(texto) {
  const titulo = document.createElement('h2');
  titulo.textContent = texto;
  return titulo;
}

function crearDescripcion(texto) {
  const descripcion = document.createElement('p');
  descripcion.className = 'metronet-inicio__descripcion';
  descripcion.textContent = texto;
  return descripcion;
}

function crearMeta(texto) {
  const meta = document.createElement('p');
  meta.className = 'metronet-inicio__meta';
  meta.textContent = texto;
  return meta;
}

function crearEstado(texto, variante) {
  const estado = document.createElement('span');
  estado.className = `metronet-inicio__estado metronet-inicio__estado--${variante}`;
  estado.textContent = texto;
  return estado;
}

function crearBoton(texto, variante, accion) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = `metronet-inicio__boton metronet-inicio__boton--${variante}`;
  boton.textContent = texto;
  boton.addEventListener('click', accion);
  return boton;
}

function crearEnlace(ruta, texto) {
  const enlace = document.createElement('a');
  enlace.className = 'metronet-inicio__enlace';
  enlace.href = ruta;
  enlace.textContent = texto;
  return enlace;
}

async function iniciarEscenario(idEscenario, boton) {
  if (navegacionEnCurso) return;
  navegacionEnCurso = true;
  boton.disabled = true;
  const textoOriginal = boton.textContent;
  boton.textContent = 'Preparando…';
  mostrarMensaje('Preparando el escenario…');
  try {
    const inicio = await solicitar(`/escenarios/${idEscenario}/iniciar`, { method: 'POST' });
    window.location.assign(establecerContextoEnRuta('/', inicio));
  } catch (error) {
    boton.disabled = false;
    boton.textContent = textoOriginal;
    navegacionEnCurso = false;
    mostrarMensaje(error.message, 'error');
  }
}

function renderizarError(contenedor, detalleError) {
  const tarjeta = document.createElement('section');
  tarjeta.className = 'metronet-inicio__error';
  const titulo = document.createElement('h2');
  titulo.textContent = 'No pudimos cargar tu inicio';
  const detalle = document.createElement('p');
  detalle.textContent = detalleError || 'Verificá la conexión con el servicio e intentá nuevamente.';
  const acciones = document.createElement('div');
  acciones.className = 'metronet-inicio__error-acciones';
  const reintentar = crearBoton('Reintentar', 'azul', cargarTablero);
  acciones.append(reintentar, crearEnlace('/escenarios.html', 'Ir a escenarios'), crearEnlace('/', 'Abrir mis diseños'));
  tarjeta.append(titulo, detalle, acciones);
  contenedor.replaceChildren(tarjeta);
}

function establecerEstadoCarga(estaCargando) {
  const estado = document.getElementById('estadoInicio');
  const tablero = document.getElementById('accionesInicio');
  estado.hidden = !estaCargando;
  tablero.setAttribute('aria-busy', String(estaCargando));
}

function mostrarMensaje(texto, tipo = '') {
  const mensaje = document.getElementById('mensajeInicio');
  mensaje.textContent = texto;
  mensaje.hidden = !texto;
  mensaje.className = `metronet-inicio__mensaje ${tipo}`;
}

function estadoLegible(estado) {
  return ({
    EN_DESARROLLO: 'En curso',
    EN_DISENO: 'En diseño',
    GUARDADO: 'Guardado',
    VALIDADO: 'Validado',
    COMPLETADA: 'Simulación completada',
    COMPLETADO: 'Completado',
  })[estado] ?? 'Disponible';
}

function progresoLegible(progreso) {
  return `${Math.max(0, Math.min(100, Number(progreso) || 0))}%`;
}
