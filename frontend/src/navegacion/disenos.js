import ClienteDisenos from '../red/ClienteDisenos.js';
import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion, navegarConCambiosPendientes } from './NavegacionAplicacion.js';
import { consultarJuego } from '../educacion/ClientePuntuacion.js';
import { establecerIdDisenoEnRuta, obtenerContextoRuta } from '../red/ContextoDiseno.js';
import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import { consultarAccesoMisDisenos, MENSAJE_DISENOS_BLOQUEADOS } from './AccesoMisDisenos.js';

const sesion = requerirSesion();
if (sesion) iniciar();

function iniciar() {
  inicializarNavegacion({ actual: 'disenos' });
  const administrador = sesion.usuario.rol === 'ADMIN';
  const cliente = new ClienteDisenos(sesion);
  const gestion = administrador ? new ClienteDisenos(sesion, { administracion: true }) : cliente;
  const lista = document.getElementById('listaMisDisenos');
  const mensaje = document.getElementById('mensajeDisenos');
  const formulario = document.getElementById('crearDiseno');
  const buscar = document.getElementById('buscarDisenos');
  const reintentar = document.getElementById('reintentarDisenos');
  const dialogo = document.getElementById('confirmarEliminarDiseno');
  let disenos = [], escenarios = [], catalogoDisponible = false;
  let cargando = false, operacion = false, recargaPendiente = false, versionListado = 0;
  const estados = { EN_DISENO: 'En diseño', EN_DESARROLLO: 'En desarrollo', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADO: 'Completado', COMPLETADA: 'Completada' };
  const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const textoEstado = d => estados[d.estado] ?? d.estado ?? '';
  const protegido = d => !administrador && (!catalogoDisponible || escenarios.some(e => e.idEscenario === d.idEscenario && Number.isInteger(e.numero)));
  const propio = d => !administrador || d.idUsuario === sesion.usuario.idUsuario;
  const ruta = (d, destino) => {
    const anterior = obtenerContextoRuta();
    return establecerIdDisenoEnRuta(destino, d.idDiseno, anterior.idDiseno === d.idDiseno ? anterior : { idEscenario: d.idEscenario });
  };

  if (administrador) {
    document.getElementById('descripcionDisenos').textContent = 'Administrá tus diseños y los de otros jugadores. Cada red indica su propietario; podés abrir tus redes y eliminar cualquiera.';
    document.getElementById('alcanceEliminarDiseno').textContent = 'Esta acción no se puede deshacer. Se eliminarán el diseño, sus elementos, su intento, puntaje y resultados asociados, incluso si el nivel está completado. El progreso y el ranking del propietario pueden cambiar.';
    buscar.placeholder = 'Nombre, propietario o estado';
  }

  function renderizar() {
    const visibles = disenos.filter(d => normalizar(`${d.nombre} ${d.propietario ?? ''} ${textoEstado(d)}`).includes(normalizar(buscar.value)));
    lista.replaceChildren(...visibles.map(d => {
      const fila = document.createElement('li');
      fila.dataset.diseno = d.idDiseno;
      const identidad = document.createElement('div');
      const nombre = document.createElement('strong');
      nombre.textContent = d.nombre;
      const estado = document.createElement('small');
      estado.textContent = `${textoEstado(d)}${protegido(d) && catalogoDisponible ? ' · Escenario educativo' : ''}`;
      identidad.append(nombre, estado);
      if (administrador) {
        const propietario = document.createElement('small');
        propietario.textContent = `Propietario: ${d.propietario || 'Sin usuario asignado'}${propio(d) ? ' · Mi diseño' : ''} · #${d.idDiseno}`;
        identidad.append(propietario);
      }
      const acciones = document.createElement('div');
      acciones.className = 'metronet-disenos__acciones';
      // El editor y el simulador personales conservan sus permisos de propiedad.
      if (propio(d)) for (const [icono, etiqueta, destino] of [['editar', 'Abrir diseño', '/'], ['play', 'Simular diseño', '/simulacion.html']]) {
        const enlace = document.createElement('a');
        enlace.className = 'metronet-boton'; enlace.href = ruta(d, destino);
        configurarBotonIcono(enlace, icono, `${etiqueta}: ${d.nombre}`);
        acciones.append(enlace);
      }
      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      configurarBotonIcono(eliminar, 'eliminar', `Eliminar diseño: ${d.nombre}`);
      eliminar.classList.add('metronet-boton--peligro');
      eliminar.disabled = protegido(d) || operacion;
      eliminar.addEventListener('click', () => confirmarEliminar(d));
      acciones.append(eliminar);
      fila.append(identidad, acciones);
      return fila;
    }));
    mensaje.textContent = visibles.length ? `${visibles.length} ${visibles.length === 1 ? 'diseño disponible' : 'diseños disponibles'}.` : disenos.length ? 'No hay diseños que coincidan con la búsqueda.' : 'Todavía no hay diseños guardados.';
  }

  async function cargar() {
    if (cargando || operacion || dialogo.open) { recargaPendiente = true; return; }
    cargando = true; recargaPendiente = false;
    const version = versionListado;
    lista.setAttribute('aria-busy', 'true'); reintentar.hidden = true;
    try {
      if (!administrador) {
        formulario.hidden = true;
        buscar.closest('label').hidden = true;
        disenos = []; lista.replaceChildren();
      }
      const permitido = await consultarAccesoMisDisenos();
      if (!permitido) {
        mensaje.textContent = MENSAJE_DISENOS_BLOQUEADOS;
        document.getElementById('disenosCreacionEstado').textContent = '';
        document.getElementById('volverEscenariosDisenos').hidden = false;
        return;
      }
      document.getElementById('volverEscenariosDisenos').hidden = true;
      buscar.closest('label').hidden = false;
      const [redes, juego] = await Promise.allSettled([gestion.listar(), administrador ? Promise.resolve([]) : consultarJuego('/escenarios')]);
      // Una respuesta iniciada antes de borrar no puede restaurar el registro eliminado.
      if (version !== versionListado) return;
      catalogoDisponible = juego.status === 'fulfilled' && Array.isArray(juego.value);
      escenarios = catalogoDisponible ? juego.value : [];
      formulario.hidden = !administrador && !escenarios.some(e => e.numero === null && e.desbloqueado);
      document.getElementById('disenosCreacionEstado').textContent = !catalogoDisponible ? 'No se pudo consultar la disponibilidad del Modo Libre. Podés abrir tus diseños; volvé a cargar para gestionar su creación o eliminación.' : formulario.hidden ? 'La creación de redes nuevas está disponible al desbloquear el Modo Libre.' : '';
      if (redes.status === 'fulfilled' && Array.isArray(redes.value)) {
        disenos = redes.value.map(d => ({ ...d, nombre: d.nombre || `Diseño #${d.idDiseno}` }));
        renderizar();
      } else {
        disenos = []; lista.replaceChildren();
        mensaje.textContent = redes.reason?.message || 'No fue posible cargar los diseños.';
      }
      reintentar.hidden = redes.status === 'fulfilled' && Array.isArray(redes.value) && catalogoDisponible;
    } catch (error) {
      mensaje.textContent = 'No se pudo verificar el acceso a Mis diseños. Volvé a intentarlo.';
      reintentar.hidden = false;
    } finally {
      cargando = false; lista.setAttribute('aria-busy', 'false');
      recargarSiPendiente();
    }
  }

  function recargarSiPendiente() {
    if (recargaPendiente && !cargando && !operacion && !dialogo.open) void cargar();
  }

  function confirmarEliminar(diseno) {
    if (operacion || dialogo.open || protegido(diseno)) return;
    const propietario = administrador ? ` Propietario: ${diseno.propietario || 'Sin usuario asignado'}.` : '';
    document.getElementById('nombreEliminarDiseno').textContent = `¿Eliminar «${diseno.nombre}» (#${diseno.idDiseno})?${propietario}`;
    dialogo.returnValue = 'cancelar'; dialogo.showModal();
    dialogo.addEventListener('close', async () => {
      if (dialogo.returnValue !== 'eliminar') { recargarSiPendiente(); return; }
      operacion = true; versionListado++; renderizar();
      let resultado;
      try {
        await gestion.solicitar(`/${diseno.idDiseno}`, { method: 'DELETE' });
        disenos = disenos.filter(d => d.idDiseno !== diseno.idDiseno);
        resultado = 'Diseño eliminado.';
      } catch (error) {
        if (error.estadoHttp === 404) {
          disenos = disenos.filter(d => d.idDiseno !== diseno.idDiseno);
          resultado = 'Este diseño ya no existe. Se actualizó la lista.';
        } else resultado = error.message;
      } finally {
        operacion = false; renderizar(); mensaje.textContent = resultado;
        buscar.focus(); recargarSiPendiente();
      }
    }, { once: true });
  }

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (operacion || formulario.hidden || !formulario.reportValidity()) return;
    const nombre = formulario.elements.nombre.value.trim();
    if (!nombre) { mensaje.textContent = 'Ingresá un nombre para la nueva red.'; return; }
    operacion = true; formulario.querySelector('button').disabled = true; renderizar();
    try {
      const diseno = await cliente.solicitar('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) });
      await navegarConCambiosPendientes(ruta(diseno, '/'));
    } catch (error) { mensaje.textContent = error.message; }
    finally {
      operacion = false; formulario.querySelector('button').disabled = false;
      lista.querySelectorAll('button').forEach(b => { b.disabled = protegido(disenos.find(d => String(d.idDiseno) === b.closest('li').dataset.diseno)); });
      recargarSiPendiente();
    }
  });
  buscar.addEventListener('input', renderizar);
  reintentar.addEventListener('click', cargar);
  window.addEventListener('pageshow', evento => { if (evento.persisted) void cargar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void cargar(); });
  void cargar();
}
