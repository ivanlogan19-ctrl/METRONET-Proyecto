import { requerirSesion } from '../autenticacion/sesion.js';
import { establecerContextoEnRuta } from '../red/ContextoDiseno.js';
import { inicializarNavegacion } from './NavegacionAplicacion.js';
import { iniciarNivelConTransicion } from '../educacion/PreparacionNivel.js';
import { cargarContenidoPublicado } from '../educacion/ContenidoPublicadoNivel.js';

const ESTADOS_EN_CURSO = new Set(['EN_DESARROLLO', 'EN_DISENO', 'GUARDADO', 'VALIDADO', 'COMPLETADA']);
// Relato de selección: la misión comprobable sigue en la consigna del editor.
const HISTORIA_NIVELES = Object.freeze({
  1: 'Ari despliega el mapa sobre la mesa. Sol señala dos lugares que necesitan conectarse y Dani propone comenzar por un recorrido sencillo. El proyecto de metro hipotético empieza con una primera línea.',
  2: 'La primera línea ya une dos lugares, pero Sol observa que deja fuera otro destino. Ari extiende el trazado y Dani revisa que el recorrido tenga continuidad. El equipo descubre que crecer exige conectar, no solo dibujar estaciones.',
  3: 'Sobre el plano, todo parece listo. Dani les recuerda que una unidad de metro necesita una ruta sin cortes para circular. Ari y Sol revisan la red antes de poner en marcha el primer tren de su propuesta.',
  4: 'El equipo mira dos extremos de Montevideo: Palacio Legislativo y Rambla de Carrasco. Sol plantea unirlos sin perder de vista los barrios; Dani pide probar en la simulación si la propuesta realmente funciona.',
  5: 'El mapa suma Terminal Tres Cruces y Plaza Virgilio. Ari busca un trazado que acerque esos destinos; Sol comprueba los barrios y Dani compara el recorrido en otra ejecución. Cada decisión cambia la lectura de la red.',
  6: 'El Mirador de la Intendencia entra en la discusión. Para atender el Centro junto al Oeste y el Este, Sol revisa la cobertura, Ari ajusta las conexiones y Dani propone comparar resultados antes de dar el diseño por resuelto.',
  7: 'El avance hacia Brazo Oriental complica la red. Ari plantea dos líneas y Sol encuentra un punto donde cambiar entre ellas. Dani quiere comprobar que ambas puedan operar: el primer transbordo se convierte en una decisión del equipo.',
  8: 'La red llega al entorno del Estadio Centenario. Sol detecta nuevos destinos; Ari organiza más líneas y transbordos. Dani compara cómo responde cada unidad y después el conjunto, porque una red mayor pide coordinación.',
  9: 'El equipo tiene poco margen para sumar estaciones. Sol exige acercarlas a los lugares clave, Ari simplifica el trazado y Dani prueba distintos supuestos. Descubren que una red más precisa puede ser más útil que una más extensa.',
  10: 'Llega la presentación final del proyecto. Ari defiende las conexiones, Sol explica la cobertura de barrios y zonas, y Dani muestra las comparaciones de operación. El equipo reúne lo aprendido en una red hipotética completa y revisable.',
});
const PERSONAJES = Object.freeze({
  Ari: { imagen: '/assets/personajes/ari.svg', rol: 'Trazados' },
  Sol: { imagen: '/assets/personajes/sol.svg', rol: 'Cobertura' },
  Dani: { imagen: '/assets/personajes/dani.svg', rol: 'Operación' },
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
    const niveles = (progresoActual.escenarios ?? []).filter(e => Number.isInteger(e.numero));
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
  renderizarProgreso(progreso);
  renderizarLogros(progreso);
  renderizarEscenarios(progreso.escenarios ?? []);
}

function renderizarProgreso(progreso) {
  const niveles = obtenerNiveles(progreso.escenarios);
  const descripcion = document.getElementById('descripcionProgresoEscenarios');
  descripcion.textContent = niveles.length
    ? `${progreso.nivelesCompletados}/${progreso.cantidadNiveles} completados${progreso.campanaCompletada ? ' · Campaña completa' : ''}`
    : 'Todavía no hay niveles configurados.';
}

function renderizarLogros(progreso) {
  const lista = document.getElementById('listaLogrosEscenarios');
  const logros = [];
  logros.push(crearLogro(
    'Modo Libre',
    progreso.modoLibreDesbloqueado ? 'Desbloqueado' : 'Bloqueado',
    progreso.modoLibreDesbloqueado
      ? 'Podés crear y simular redes sin consigna obligatoria.'
      : 'Completá todos los niveles de una campaña para habilitarlo.',
    progreso.modoLibreDesbloqueado
  ));
  if (progreso.campanaCompletadaHistoricamente) {
    logros.push(crearLogro('Campaña completada anteriormente', 'Registrado', 'Este logro se conserva aunque reinicies el recorrido.', true));
  }
  lista.replaceChildren(...logros);
  const boton = document.getElementById('botonReiniciarRecorrido');
  const hayProgresoActual = (progreso.nivelesCompletados ?? 0) > 0
    || (progreso.escenarios ?? []).some((escenario) => ESTADOS_EN_CURSO.has(escenario.estado));
  boton.hidden = !hayProgresoActual;
  boton.disabled = !hayProgresoActual;
}

function crearLogro(titulo, estado, detalle, positivo = false) {
  const elemento = document.createElement('li');
  elemento.className = `metronet-escenarios-pagina__logro${positivo ? ' metronet-escenarios-pagina__logro--positivo' : ''}`;
  const contenido = document.createElement('div');
  const nombre = document.createElement('strong');
  nombre.textContent = titulo;
  const descripcion = document.createElement('span');
  descripcion.textContent = detalle;
  contenido.append(nombre, descripcion);
  const etiqueta = document.createElement('span');
  etiqueta.className = 'metronet-escenarios-pagina__logro-estado';
  etiqueta.textContent = estado;
  elemento.append(contenido, etiqueta);
  return elemento;
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
  titulo.textContent = escenario.numero === null ? escenario.nombre : `${escenario.numero} · ${nombreSinNumero(escenario)}`;
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
    imagen.width = 40;
    imagen.height = 40;
    imagen.decoding = 'async';
    const nombre = document.createElement('span');
    nombre.textContent = `${protagonista} · ${PERSONAJES[protagonista].rol}`;
    personaje.append(imagen, nombre);
    contenido.append(personaje);
  }
  const relato = document.createElement('p');
  relato.className = 'metronet-escenarios-pagina__relato';
  relato.textContent = escenario.contenidoPublicado?.desafio?.relato
    ?? HISTORIA_NIVELES[escenario.numero] ?? escenario.objetivo ?? 'Sin descripción disponible.';
  contenido.append(relato);
  if (estado.id === 'actual' || estado.id === 'completado') contenido.append(crearProgresoTarjeta(escenario, estado));
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

function crearProgresoTarjeta(escenario, estado) {
  const contenedor = document.createElement('div');
  contenedor.className = 'metronet-escenarios-pagina__progreso-tarjeta';
  if (estado.id === 'bloqueado') {
    contenedor.textContent = 'Completá los niveles anteriores para desbloquear este desafío.';
    return contenedor;
  }
  if (escenario.numero === null) {
    contenedor.textContent = 'Todas las herramientas están disponibles en este modo.';
    return contenedor;
  }
  const etiqueta = document.createElement('span');
  etiqueta.textContent = `Progreso actual ${escenario.progreso ?? 0}%`;
  const barra = document.createElement('div');
  barra.className = 'metronet-escenarios-pagina__barra-progreso';
  barra.setAttribute('role', 'progressbar');
  barra.setAttribute('aria-label', `Progreso de ${escenario.nombre}`);
  barra.setAttribute('aria-valuemin', '0');
  barra.setAttribute('aria-valuemax', '100');
  barra.setAttribute('aria-valuenow', String(escenario.progreso ?? 0));
  const relleno = document.createElement('span');
  relleno.style.setProperty('--progreso-escenario', `${Math.max(0, Math.min(100, Number(escenario.progreso) || 0))}%`);
  barra.append(relleno);
  contenedor.append(etiqueta, barra);
  return contenedor;
}

function nombreSinNumero(escenario) {
  return String(escenario.nombre ?? '').replace(new RegExp(`^Nivel\\s+${escenario.numero}\\s*[·:–-]\\s*`, 'i'), '');
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
      dialogo.close();
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

function obtenerNiveles(escenarios) {
  return [...escenarios]
    .filter((escenario) => escenario.numero !== null)
    .sort((primero, segundo) => primero.numero - segundo.numero);
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
