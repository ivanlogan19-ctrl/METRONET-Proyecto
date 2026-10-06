import ClienteDisenos from '../red/ClienteDisenos.js';
import { requerirSesion } from '../autenticacion/sesion.js';
import { inicializarNavegacion, navegarConCambiosPendientes } from './NavegacionAplicacion.js';
import { consultarJuego } from '../educacion/ClientePuntuacion.js';
import { establecerContextoEnRuta, establecerIdDisenoEnRuta, obtenerContextoRuta } from '../red/ContextoDiseno.js';
import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import { consultarAccesoMisDisenos } from './AccesoMisDisenos.js';

const sesion = requerirSesion();
if (sesion) iniciar();

function iniciar() {
  inicializarNavegacion({ actual: 'disenos' });
  const administrador = sesion.usuario.rol === 'ADMIN';
  const cliente = new ClienteDisenos(sesion);
  const gestion = administrador ? new ClienteDisenos(sesion, { administracion: true }) : cliente;
  const lista = document.getElementById('listaMisDisenos');
  const listaLibres = document.getElementById('listaDisenosLibres');
  const mensaje = document.getElementById('mensajeDisenos');
  const botonLibre = document.getElementById('irDisenoLibre');
  const reintentar = document.getElementById('reintentarDisenos');
  const dialogo = document.getElementById('confirmarEliminarDiseno');
  let disenos = [], escenarios = [], catalogoDisponible = false, modoLibre = null;
  let cargando = false, operacion = false, recargaPendiente = false, versionListado = 0;
  const estados = { EN_DISENO: 'En diseño', EN_DESARROLLO: 'En desarrollo', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADO: 'Completado', COMPLETADA: 'Completada' };
  const textoEstado = d => estados[d.estado] ?? d.estado ?? '';
  const protegido = d => !administrador && (!catalogoDisponible || escenarios.some(e => e.idEscenario === d.idEscenario && Number.isInteger(e.numero)));
  const esDisenoLibre = d => d.modo === 'EDICION_LIBRE' || escenarios.some(e => e.idEscenario === d.idEscenario && e.numero === null);
  const propio = d => !administrador || d.idUsuario === sesion.usuario.idUsuario;
  const ruta = (d, destino) => {
    const anterior = obtenerContextoRuta();
    return establecerIdDisenoEnRuta(destino, d.idDiseno, anterior.idDiseno === d.idDiseno ? anterior : { idEscenario: d.idEscenario });
  };

  if (administrador) {
    document.getElementById('alcanceEliminarDiseno').textContent = 'Esta acción no se puede deshacer. Se eliminarán el diseño, sus elementos, su intento, puntaje y resultados asociados, incluso si el nivel está completado. El progreso y el ranking del propietario pueden cambiar.';
  }

  function crearFila(d) {
      const fila = document.createElement('li');
      fila.dataset.diseno = d.idDiseno;
      const identidad = document.createElement('div');
      const nombre = document.createElement('strong');
      nombre.textContent = d.nombre;
      const estado = document.createElement('small');
      const numeroNivel = escenarios.find(e => e.idEscenario === d.idEscenario)?.numero;
      estado.textContent = `${textoEstado(d)}${Number.isInteger(numeroNivel) ? ` · Nivel ${numeroNivel}` : ''}`;
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
        enlace.classList.add(icono === 'editar' ? 'metronet-disenos__accion--editar' : 'metronet-disenos__accion--simular');
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
  }

  function renderizar() {
    const deCampana = disenos.filter(d => !esDisenoLibre(d));
    const libres = disenos.filter(esDisenoLibre);
    lista.replaceChildren(...deCampana.map(crearFila));
    listaLibres.replaceChildren(...libres.map(crearFila));
    mensaje.hidden = deCampana.length > 0;
    mensaje.textContent = deCampana.length ? '' : disenos.length
      ? 'Todavía no hay diseños de campaña guardados.' : 'Todavía no hay diseños guardados.';
  }

  async function cargar() {
    if (cargando || operacion || dialogo.open) { recargaPendiente = true; return; }
    cargando = true; recargaPendiente = false;
    const version = versionListado;
    lista.setAttribute('aria-busy', 'true'); listaLibres.setAttribute('aria-busy', 'true'); reintentar.hidden = true; botonLibre.disabled = true;
    try {
      const [redes, juego, acceso] = await Promise.allSettled([gestion.listar(), consultarJuego('/escenarios'), consultarAccesoMisDisenos()]);
      // Una respuesta iniciada antes de borrar no puede restaurar el registro eliminado.
      if (version !== versionListado) return;
      catalogoDisponible = juego.status === 'fulfilled' && Array.isArray(juego.value);
      escenarios = catalogoDisponible ? juego.value : [];
      modoLibre = acceso.status === 'fulfilled' && acceso.value
        ? escenarios.find(e => e.numero === null && e.desbloqueado) ?? null : null;
      botonLibre.disabled = !modoLibre;
      document.getElementById('explicacionDisenoLibre').hidden = Boolean(modoLibre);
      botonLibre.title = modoLibre ? '' : 'Completá los diez niveles para habilitar el diseño libre.';
      if (redes.status === 'fulfilled' && Array.isArray(redes.value)) {
        disenos = redes.value.map(d => ({ ...d, nombre: d.nombre || `Diseño #${d.idDiseno}` }));
        renderizar();
      } else {
        disenos = []; lista.replaceChildren(); listaLibres.replaceChildren();
        mensaje.hidden = false;
        mensaje.textContent = redes.reason?.message || 'No fue posible cargar los diseños.';
      }
      reintentar.hidden = redes.status === 'fulfilled' && Array.isArray(redes.value)
        && catalogoDisponible && acceso.status === 'fulfilled';
    } catch (error) {
      mensaje.hidden = false;
      mensaje.textContent = 'No se pudo verificar el acceso a Mis diseños. Volvé a intentarlo.';
      reintentar.hidden = false;
    } finally {
      cargando = false; lista.setAttribute('aria-busy', 'false'); listaLibres.setAttribute('aria-busy', 'false');
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
        operacion = false; renderizar(); mensaje.hidden = false; mensaje.textContent = resultado;
        recargarSiPendiente();
      }
    }, { once: true });
  }

  botonLibre.addEventListener('click', async () => {
    if (operacion || !modoLibre || botonLibre.disabled) return;
    operacion = true; botonLibre.disabled = true; renderizar();
    mensaje.hidden = false;
    mensaje.textContent = 'Preparando diseño libre…';
    let errorTexto = null;
    try {
      const respuesta = await fetch(`${window.location.protocol}//${window.location.hostname}:8080/api/juego/escenarios/${modoLibre.idEscenario}/iniciar`, {
        method: 'POST', headers: { Authorization: `Bearer ${sesion.token}` },
      });
      if (!respuesta.ok) {
        let detalle = 'No fue posible abrir el diseño libre.';
        try { detalle = (await respuesta.json()).detail ?? detalle; } catch { /* Sin detalle legible. */ }
        throw new Error(detalle);
      }
      const inicio = await respuesta.json();
      if (!inicio?.idDiseno) throw new Error('No fue posible abrir el diseño libre.');
      await navegarConCambiosPendientes(establecerContextoEnRuta('/', inicio));
    } catch (error) { errorTexto = error.message; }
    finally {
      operacion = false; botonLibre.disabled = !modoLibre; renderizar();
      if (errorTexto) { mensaje.hidden = false; mensaje.textContent = errorTexto; }
      recargarSiPendiente();
    }
  });
  reintentar.addEventListener('click', cargar);
  window.addEventListener('pageshow', evento => { if (evento.persisted) void cargar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void cargar(); });
  void cargar();
}
