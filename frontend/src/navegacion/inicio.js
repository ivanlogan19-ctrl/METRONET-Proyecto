import { requerirSesion } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta } from '../red/ContextoDiseno.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';
import { iniciarNivelConTransicion } from '../educacion/PreparacionNivel.js';
import { crearLogoMetronet } from '../componentes/LogoMetronet.js';

const URL_API_JUEGO = `${window.location.protocol}//${window.location.hostname}:8080/api/juego`;
const ESTADOS_CON_INTENTO_ACTIVO = new Set(['EN_DESARROLLO', 'EN_DISENO', 'GUARDADO', 'VALIDADO', 'COMPLETADA']);
const sesion = requerirSesion('/inicio.html');
let navegacionEnCurso = false;
let escenariosActuales = [];

if (sesion) inicializar();

async function inicializar() {
  inicializarNavegacion({ actual: 'inicio' });
  document.querySelector('[data-marca-inicio]').append(crearLogoMetronet());
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
    escenariosActuales = Array.isArray(progreso.escenarios) ? progreso.escenarios : [];
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
    crearTarjetaAccesos(resumen),
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
  const tarjeta = crearTarjeta('continuar');
  const contenido = document.createElement('div');
  contenido.className = 'metronet-inicio__tarjeta-contenido';
  if (resumen.escenarioContinuar) {
    const escenario = resumen.escenarioContinuar;
    contenido.append(
      crearTituloTarjeta(`Nivel ${escenario.numero} · ${nombreSinNumero(escenario)}`),
      crearEstado(estadoLegible(escenario.estado), 'activo'),
      crearDescripcion(escenario.objetivo || escenario.instrucciones || 'Retomá el próximo paso de tu recorrido.'),
    );
    const boton = crearBoton(
      ESTADOS_CON_INTENTO_ACTIVO.has(escenario.estado) ? 'Continuar' : 'Jugar',
      ESTADOS_CON_INTENTO_ACTIVO.has(escenario.estado) ? 'verde' : 'azul',
      () => iniciarEscenario(escenario, boton),
    );
    if (ESTADOS_CON_INTENTO_ACTIVO.has(escenario.estado)) boton.id = 'continuarNivelInicio';
    tarjeta.append(contenido, crearPieTarjeta(boton, '/escenarios.html', 'Ver todos los niveles'));
    return tarjeta;
  }
  if (resumen.recorridoCompletado) {
    contenido.append(
      crearTituloTarjeta('Recorrido completado'),
      crearEstado('Completado', 'completado'),
      crearDescripcion('Completaste todos los niveles de aprendizaje. El Modo Libre ya está disponible para crear sin consigna.'),
    );
    tarjeta.append(contenido, crearPieTarjeta(null, '/escenarios.html', 'Ver recorrido completo'));
    return tarjeta;
  }
  contenido.append(
    crearTituloTarjeta('Niveles no disponibles'),
    crearEstado('Sin datos', 'neutral'),
    crearDescripcion('Todavía no hay un nivel disponible para continuar.'),
  );
  tarjeta.append(contenido, crearPieTarjeta(null, '/escenarios.html', 'Consultar niveles'));
  return tarjeta;
}

function crearTarjetaModoLibre(resumen) {
  const tarjeta = crearTarjeta('crear');
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
      crearTituloTarjeta('Modo Libre'),
      crearEstado('Bloqueado', 'bloqueado'),
      crearDescripcion('Ayudá a Ari, Sol y Dani a completar los niveles de la historia para desbloquear el Modo Libre.'),
    );
    tarjeta.append(contenido);
    return tarjeta;
  }
  contenido.append(
    crearTituloTarjeta('Modo Libre'),
    crearEstado(ESTADOS_CON_INTENTO_ACTIVO.has(modoLibre.estado) ? 'En curso' : 'Disponible', 'disponible'),
    crearDescripcion(resumen.campanaCompletadaHistoricamente
      ? 'Logro permanente desbloqueado. Creá una red propia sin reiniciar tus avances anteriores.'
      : 'Creá una red propia, definí líneas, estaciones, conexiones y unidades de metro antes de simularla.'),
  );
  const boton = crearBoton(ESTADOS_CON_INTENTO_ACTIVO.has(modoLibre.estado) ? 'Continuar en Modo Libre' : 'Jugar en Modo Libre', 'verde', () => iniciarEscenario(modoLibre, boton));
    tarjeta.append(contenido, crearPieTarjeta(boton, '/disenos.html', 'Abrir mis diseños'));
  return tarjeta;
}

function crearTarjetaAccesos(resumen) {
  const tarjeta = crearTarjeta('progreso', 'Tu recorrido');
  const avance = crearMeta(resumen.niveles.length
    ? `${resumen.cantidadCompletados}/${resumen.niveles.length} niveles completados`
    : 'Sin niveles disponibles');
  avance.classList.add('metronet-inicio__avance-recorrido');
  const accesos = document.createElement('nav');
  accesos.className = 'metronet-inicio__accesos';
  accesos.setAttribute('aria-label', 'Accesos al jugador');
  const misDisenos = crearEnlace('/disenos.html', 'Mis diseños');
  accesos.append(
    crearEnlace('/escenarios.html', 'Niveles'),
    misDisenos,
    crearEnlace('/simulacion.html', 'Simulaciones'),
  );
  tarjeta.append(avance, accesos);
  return tarjeta;
}

function crearTarjeta(variante, etiqueta) {
  const tarjeta = document.createElement('section');
  tarjeta.className = `metronet-inicio__tarjeta metronet-inicio__tarjeta--${variante}`;
  if (etiqueta) {
    const identificador = document.createElement('p');
    identificador.className = 'metronet-inicio__tarjeta-etiqueta';
    identificador.textContent = etiqueta;
    tarjeta.append(identificador);
  }
  return tarjeta;
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

async function iniciarEscenario(escenario, boton) {
  if (navegacionEnCurso) return;
  navegacionEnCurso = true;
  boton.disabled = true;
  const textoOriginal = boton.textContent;
  let navegando = false;
  boton.textContent = 'Preparando…';
  mostrarMensaje(escenario.numero === null ? 'Preparando Modo Libre…' : 'Preparando el nivel…');
  try {
    const inicio = await iniciarNivelConTransicion(escenario,
      signal => solicitar(`/escenarios/${escenario.idEscenario}/iniciar`, {
        method: 'POST', signal,
        ...(escenario.contenidoPublicado?.version && !ESTADOS_CON_INTENTO_ACTIVO.has(escenario.estado)
          ? { headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ versionEsperada: escenario.contenidoPublicado.version }) } : {}),
      }));
    if (!inicio) { mostrarMensaje(''); return; }
    window.location.assign(establecerContextoEnRuta('/', inicio));
    navegando = true;
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    if (!navegando) {
      boton.disabled = false;
      boton.textContent = textoOriginal;
      navegacionEnCurso = false;
      boton.focus({ preventScroll: true });
    }
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
  acciones.append(reintentar, crearEnlace('/escenarios.html', 'Ir a niveles'), crearEnlace('/disenos.html', 'Abrir mis diseños'));
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

function nombreSinNumero(escenario) {
  return String(escenario.nombre ?? '').replace(new RegExp(`^Nivel\\s+${escenario.numero}\\s*[·:–-]\\s*`, 'i'), '');
}
