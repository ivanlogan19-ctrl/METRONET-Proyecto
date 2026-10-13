import catalogoRecorrido from '../educacion/recorrido-integral.json';
import { requerirSesion } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta } from '../red/ContextoDiseno.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';
import { iniciarNivelConTransicion } from '../educacion/PreparacionNivel.js';
import { cargarContenidoPublicado } from '../educacion/ContenidoPublicadoNivel.js';

const ESTADOS_EN_CURSO = new Set(['EN_DESARROLLO', 'EN_DISENO', 'GUARDADO', 'VALIDADO', 'COMPLETADA']);
const HISTORIA_NIVELES = Object.fromEntries(catalogoRecorrido.map(n => [n.numero, n.historia.texto]));
const PERSONAJES = Object.freeze({
  Ari: { imagen: '/assets/personajes/ari.svg', rol: 'Diseño de red' },
  Sol: { imagen: '/assets/personajes/sol.svg', rol: 'Cobertura territorial' },
  Dani: { imagen: '/assets/personajes/dani.svg', rol: 'Simulación operativa' },
});
const PROTAGONISTAS_NIVEL = Object.freeze(['Ari', 'Sol', 'Dani', 'Sol', 'Ari', 'Sol', 'Ari', 'Dani', 'Sol', 'Dani']);
const sesion = requerirSesion('/escenarios.html');
let progresoActual = null;
let accionEnCurso = false;

if (sesion) inicializar();

async function inicializar() {
  inicializarNavegacion({ actual: 'escenarios', etapa: 'escenario' });
  configurarDialogoReinicio();
  await cargarProgreso();
}

async function cargarProgreso() {
  establecerEstadoCarga(true);
  try {
    progresoActual = await solicitar('/progreso');
    const niveles = (progresoActual.escenarios ?? []).filter(e => Number.isInteger(e.numero) && e.desbloqueado);
    await Promise.allSettled(niveles.map(async escenario => {
      const enCurso = ESTADOS_EN_CURSO.has(escenario.estado);
      try {
        const contenido = await cargarContenidoPublicado(escenario.numero, {
          idIntento: enCurso ? escenario.idIntento : null,
        });
        escenario.contenidoPublicado = contenido;
        escenario.nombre = contenido.desafio?.nombre ?? escenario.nombre;
        escenario.dificultad = contenido.desafio?.dificultad ?? escenario.dificultad;
        if (!enCurso) {
          escenario.objetivo = contenido.desafio?.objetivo ?? escenario.objetivo;
          escenario.instrucciones = contenido.desafio?.instrucciones ?? escenario.instrucciones;
        }
      } catch { /* La vista conserva el catálogo local si falla la lectura editorial. */ }
    }));
    renderizarPantalla(progresoActual);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
    renderizarPantalla(progresoVacio());
    renderizarEstadoVacio('No fue posible cargar los niveles. Volvé a intentarlo en unos instantes.');
  } finally {
    establecerEstadoCarga(false);
  }
}

async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${sesion.token}`, ...(opciones.headers ?? {}) },
  });
  if (respuesta.ok) return respuesta.json();
  let mensaje = 'No fue posible actualizar el recorrido.';
  try { mensaje = (await respuesta.json()).detail ?? mensaje; } catch { /* La respuesta no incluye detalle. */ }
  throw new Error(mensaje);
}

function progresoVacio() {
  return {
    escenarios: [],
    numeroCampanaActual: 1,
    cantidadNiveles: 0,
    nivelesCompletados: 0,
    campanaCompletada: false,
    campanaCompletadaHistoricamente: false,
    modoLibreDesbloqueado: false,
  };
}

function renderizarPantalla(progreso) {
  renderizarReinicio(progreso);
  renderizarEscenarios(progreso.escenarios ?? []);
}

function renderizarReinicio(progreso) {
  const boton = document.getElementById('botonReiniciarRecorrido');
  const hayProgresoActual = (progreso.nivelesCompletados ?? 0) > 0
    || (progreso.escenarios ?? []).some((escenario) => ESTADOS_EN_CURSO.has(escenario.estado));
  boton.hidden = !hayProgresoActual;
  boton.disabled = !hayProgresoActual;
}

function renderizarEscenarios(escenarios) {
  const lista = document.getElementById('listaEscenarios');
  if (!escenarios.length) return renderizarEstadoVacio('Todavía no hay niveles configurados para este recorrido.');
  lista.replaceChildren(...escenarios.map(crearTarjetaEscenario));
}

function crearTarjetaEscenario(escenario) {
  const tarjeta = document.createElement('article');
  const estado = obtenerEstadoVisual(escenario);
  tarjeta.className = `metronet-escenarios-pagina__tarjeta metronet-escenarios-pagina__tarjeta--${estado.id}${escenario.desbloqueado ? '' : ' bloqueada'}`;
  const encabezado = document.createElement('header');
  encabezado.className = 'metronet-escenarios-pagina__tarjeta-cabecera';
  const etiquetaEstado = document.createElement('span');
  etiquetaEstado.className = `metronet-escenarios-pagina__estado metronet-escenarios-pagina__estado--${estado.id}`;
  etiquetaEstado.textContent = estado.texto;
  encabezado.append(etiquetaEstado);
  const titulo = document.createElement('h2');
  titulo.id = `titulo-escenario-${escenario.idEscenario}`;
  const nombre = nombreSinNumero(escenario);
  titulo.textContent = escenario.numero === null ? escenario.nombre : `Nivel ${escenario.numero}${nombre ? ` · ${nombre}` : ''}`;
  tarjeta.setAttribute('aria-labelledby', titulo.id);
  const contenido = document.createElement('div');
  contenido.className = 'metronet-escenarios-pagina__tarjeta-contenido';
  const protagonista = PROTAGONISTAS_NIVEL[escenario.numero - 1];
  if (protagonista) {
    const personaje = document.createElement('div');
    personaje.className = 'metronet-escenarios-pagina__personaje';
    const imagen = document.createElement('img');
    imagen.src = PERSONAJES[protagonista].imagen;
    imagen.alt = '';
    imagen.width = 64;
    imagen.height = 64;
    imagen.decoding = 'async';
    const nombre = document.createElement('span');
    nombre.textContent = `${protagonista} · ${PERSONAJES[protagonista].rol}`;
    personaje.append(imagen, nombre);
    contenido.append(personaje);
  }
  const relato = document.createElement('p');
  relato.className = 'metronet-escenarios-pagina__relato';
  relato.textContent = escenario.numero === null
    ? (escenario.desbloqueado ? 'Diseñá y probá tu propia red junto a Ari, Sol y Dani, sin consignas obligatorias.' : 'Ayudá a Ari, Sol y Dani a completar los diez niveles para desbloquear el Modo Libre.')
    : obtenerRelatoSeleccion(escenario);
  contenido.append(relato);
  const acciones = document.createElement('footer');
  acciones.className = 'metronet-escenarios-pagina__acciones';
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.disabled = !escenario.desbloqueado || accionEnCurso;
  boton.textContent = estado.accion;
  boton.setAttribute('aria-describedby', titulo.id);
  if (estado.id !== 'bloqueado') {
    boton.addEventListener('click', () => iniciarEscenario(escenario, boton, estado.id === 'completado'));
  }
  acciones.append(boton);
  tarjeta.append(encabezado, titulo, contenido, acciones);
  return tarjeta;
}

function obtenerEstadoVisual(escenario) {
  if (!escenario.desbloqueado || escenario.estado === 'BLOQUEADO') return { id: 'bloqueado', texto: 'Bloqueado', accion: 'Bloqueado' };
  if (ESTADOS_EN_CURSO.has(escenario.estado)) return { id: 'actual', texto: 'En curso', accion: 'Continuar' };
  if (escenario.estado === 'COMPLETADO') return { id: 'completado', texto: 'Completado', accion: 'Volver a jugar' };
  return {
    id: 'disponible',
    texto: escenario.numero === null ? 'Desbloqueado' : 'Disponible',
    accion: escenario.numero === null ? 'Entrar al Modo Libre' : 'Comenzar',
  };
}

function nombreSinNumero(escenario) {
  return String(escenario.nombre ?? '').trim()
    .replace(new RegExp(`^Nivel\\s+${escenario.numero}(?!\\d)(?:\\s*[·:–-]\\s*)?`, 'i'), '');
}

function obtenerRelatoSeleccion(escenario) {
  const publicado = escenario.contenidoPublicado?.desafio?.relato?.trim() ?? escenario.relato?.trim();
  // La publicación que acompaña la consigna prevalece sobre el respaldo local.
  if (publicado) return publicado;
  return HISTORIA_NIVELES[escenario.numero] ?? publicado ?? escenario.objetivo ?? 'Sin descripción disponible.';
}

async function iniciarEscenario(escenario, boton, volverAJugar) {
  if (accionEnCurso) return;
  accionEnCurso = true;
  const textoOriginal = boton.textContent;
  let navegando = false;
  boton.disabled = true;
  boton.textContent = 'Preparando…';
  mostrarMensaje(volverAJugar ? 'Creando un nuevo intento…' : 'Preparando el nivel…');
  try {
    const ruta = volverAJugar ? `/escenarios/${escenario.idEscenario}/volver-a-jugar` : `/escenarios/${escenario.idEscenario}/iniciar`;
    const inicio = await iniciarNivelConTransicion(escenario,
      signal => solicitar(ruta, {
        method: 'POST', signal,
        ...(escenario.contenidoPublicado?.version && (volverAJugar || !ESTADOS_EN_CURSO.has(escenario.estado))
          ? { headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ versionEsperada: escenario.contenidoPublicado.version }) } : {}),
      }));
    if (!inicio) { mostrarMensaje(''); return; }
    if (volverAJugar) try {
      const idUsuario = sesion?.usuario?.idUsuario;
      if (idUsuario != null && Number.isInteger(escenario.numero)) {
        localStorage.removeItem(`metronet:tutorial-nueva-herramienta:v1:${idUsuario}:${escenario.numero}`);
        if (escenario.herramientasHabilitadas?.simulacion === true)
          localStorage.removeItem(`metronet:tutorial-pantalla-simulacion:v2:${idUsuario}`);
      }
    } catch { /* El nuevo intento ya está creado aunque el navegador bloquee el almacenamiento. */ }
    window.location.assign(establecerContextoEnRuta('/', inicio));
    navegando = true;
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    if (!navegando) {
      accionEnCurso = false;
      boton.disabled = false;
      boton.textContent = textoOriginal;
      boton.focus({ preventScroll: true });
    }
  }
}

function configurarDialogoReinicio() {
  const dialogo = document.getElementById('dialogoReiniciarRecorrido');
  const abrir = document.getElementById('botonReiniciarRecorrido');
  const cancelar = dialogo.querySelector('[data-cancelar-reinicio]');
  const confirmar = dialogo.querySelector('[data-confirmar-reinicio]');
  abrir.addEventListener('click', () => dialogo.showModal());
  cancelar.addEventListener('click', () => dialogo.close());
  confirmar.addEventListener('click', async () => {
    if (accionEnCurso || !progresoActual) return;
    accionEnCurso = true;
    confirmar.disabled = true;
    confirmar.textContent = 'Reiniciando…';
    try {
      progresoActual = await solicitar('/recorrido/reiniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroCampanaActual: progresoActual.numeroCampanaActual }),
      });
      // Un nuevo recorrido vuelve a ofrecer las guías; los intentos permanecen en el servidor.
      try {
        const idUsuario = sesion?.usuario?.idUsuario;
        if (idUsuario != null) {
          for (let nivel = 1; nivel <= 10; nivel++)
            localStorage.removeItem(`metronet:tutorial-nueva-herramienta:v1:${idUsuario}:${nivel}`);
          localStorage.removeItem(`metronet:tutorial-pantalla-simulacion:v2:${idUsuario}`);
        }
      } catch { /* La campaña ya se reinició aunque el navegador bloquee el almacenamiento. */ }
      dialogo.close();
      accionEnCurso = false;
      renderizarPantalla(progresoActual);
      mostrarMensaje('El recorrido se reinició. Tus intentos, diseños y simulaciones anteriores se conservaron.');
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    } finally {
      accionEnCurso = false;
      confirmar.disabled = false;
      confirmar.textContent = 'Reiniciar recorrido';
    }
  });
}

function mostrarMensaje(texto, tipo = '') {
  const mensaje = document.getElementById('mensajeEscenarios');
  mensaje.textContent = texto;
  mensaje.className = `metronet-inicio__mensaje ${tipo}`;
}

function renderizarEstadoVacio(texto) {
  const lista = document.getElementById('listaEscenarios');
  const vacio = document.createElement('section');
  vacio.className = 'metronet-escenarios-pagina__vacio';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Niveles no disponibles';
  const detalle = document.createElement('p');
  detalle.textContent = texto;
  vacio.append(titulo, detalle);
  lista.replaceChildren(vacio);
}

function establecerEstadoCarga(estaCargando) {
  const estadoCarga = document.getElementById('estadoCargaEscenarios');
  const lista = document.getElementById('listaEscenarios');
  estadoCarga.hidden = !estaCargando;
  lista.setAttribute('aria-busy', String(estaCargando));
}
