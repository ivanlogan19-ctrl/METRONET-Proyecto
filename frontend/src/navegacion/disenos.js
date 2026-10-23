import { numerarDisenos, etiquetaDiseno, nombreDiseno } from '../red/NumeracionDisenos.mjs';
import { configurarAccion } from '../interfaz/AccionesInterfaz.js';
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
  let grupoActivo = 'campana';
  let numerosDisenos = new Map();
  const paginas = { campana: 0, libres: 0 };
  const capacidadPagina = () => (innerWidth < 700 ? 1 : innerWidth < 1050 ? 2 : 3) * (innerHeight < 650 ? 1 : 2);
  let porPagina = capacidadPagina();
  const anterior = document.getElementById('paginaDisenosAnterior');
  const siguiente = document.getElementById('paginaDisenosSiguiente');
  const pestanas = [...document.querySelectorAll('[data-grupo]')];
  const estados = { EN_DISENO: 'En diseño', EN_DESARROLLO: 'En desarrollo', GUARDADO: 'Guardado', VALIDADO: 'Validado', COMPLETADO: 'Completado', COMPLETADA: 'Completada' };
  const textoEstado = d => estados[d.estado] ?? d.estado ?? '';
  const protegido = d => !administrador && (!catalogoDisponible || escenarios.some(e => e.idEscenario === d.idEscenario && Number.isInteger(e.numero)));
  const esDisenoLibre = d => d.modo === 'EDICION_LIBRE' || escenarios.some(e => e.idEscenario === d.idEscenario && e.numero === null);
  const propio = d => d.idUsuario == null || d.idUsuario === sesion.usuario.idUsuario;
  const propietarioDiseno = d => d.propietario || [sesion.usuario.nombre, sesion.usuario.apellido].filter(Boolean).join(' ') || 'Mi cuenta';
  const ruta = (d, destino) => {
    const anterior = obtenerContextoRuta();
    return establecerIdDisenoEnRuta(destino, d.idDiseno, anterior.idDiseno === d.idDiseno ? anterior : { idEscenario: d.idEscenario });
  };

  if (administrador) {
    document.getElementById('alcanceEliminarDiseno').textContent = 'Se borrará la red. Los niveles completados conservarán sus logros, puntajes y resultados. En los demás casos se borrará también la partida. No se puede deshacer.';
  }

  function crearFila(d) {
      const fila = document.createElement('li');
      fila.dataset.diseno = d.idDiseno;
      const cabecera = document.createElement('div');
      cabecera.className = 'metronet-disenos__cabecera';
      const nivel = document.createElement('span');
      nivel.className = 'metronet-disenos__nivel';
      const numeroNivel = escenarios.find(e => e.idEscenario === d.idEscenario)?.numero;
      nivel.textContent = Number.isInteger(numeroNivel) ? `Nivel ${String(numeroNivel).padStart(2, '0')}` : esDisenoLibre(d) ? 'Modo Libre' : 'Diseño';
      const estado = document.createElement('span');
      estado.className = 'metronet-disenos__estado';
      estado.classList.toggle('metronet-disenos__estado--listo', ['VALIDADO', 'COMPLETADO', 'COMPLETADA'].includes(d.estado));
      estado.textContent = textoEstado(d);
      cabecera.append(nivel, estado);
      const nombre = document.createElement('strong');
      nombre.textContent = nombreDiseno(d, numerosDisenos);
      const pie = document.createElement('div');
      pie.className = 'metronet-disenos__pie-tarjeta';
      const propietario = document.createElement('small');
      propietario.textContent = `${propio(d) ? 'Mi diseño' : d.propietario || 'Sin usuario asignado'} · ${etiquetaDiseno(d, numerosDisenos)}`;
      if (administrador && propio(d)) propietario.title = `Propietario: ${propietarioDiseno(d)}`;
      pie.append(propietario);
      const acciones = document.createElement('div');
      acciones.className = 'metronet-disenos__acciones';
      // El editor y el simulador personales conservan sus permisos de propiedad.
      if (propio(d)) for (const [icono, etiqueta, destino] of [['editar', 'Abrir diseño', '/'], ['play', 'Simular diseño', '/simulacion.html']]) {
        acciones.append(crearAcceso(d, icono, etiqueta, destino));
      }
      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      configurarBotonIcono(eliminar, 'eliminar', `Eliminar diseño: ${nombreDiseno(d, numerosDisenos)}`);
      eliminar.classList.add('metronet-boton--peligro');configurarAccion(eliminar,'eliminar',{icono:true});
      eliminar.disabled = protegido(d) || operacion;
      eliminar.addEventListener('click', () => confirmarEliminar(d));
      acciones.append(eliminar);
      pie.append(acciones);
      fila.append(cabecera, nombre, pie);
      return fila;
  }

  function crearAcceso(d, icono, etiqueta, destino) {
    const deshabilitado = icono === 'play' && !d.preparadoParaSimular;
    const enlace = document.createElement(deshabilitado ? 'button' : 'a');
    enlace.className = 'metronet-boton';
    if (deshabilitado) { enlace.type = 'button'; enlace.disabled = true; }
    else enlace.href = ruta(d, destino);
    configurarBotonIcono(enlace, icono, `${etiqueta}: ${nombreDiseno(d, numerosDisenos)}`);
    configurarAccion(enlace, icono === 'editar' ? 'abrir' : 'simular', {icono:true});
    if (deshabilitado) enlace.title = d.verificacion === 'pendiente'
      ? 'Comprobando si la red está preparada para simular.' : 'Prepará la red desde Edición para habilitar su simulación.';
    enlace.classList.add(icono === 'editar' ? 'metronet-disenos__accion--editar' : 'metronet-disenos__accion--simular');
    return enlace;
  }

  async function verificarSimulacion(d) {
    const escenario = escenarios.find(e => e.idEscenario === d.idEscenario);
    if (d.verificacion || !propio(d) || !['VALIDADO', 'COMPLETADA', 'COMPLETADO'].includes(d.estado)
      || escenario?.herramientasHabilitadas?.simulacion === false) return;
    d.verificacion = 'pendiente';
    try { d.preparadoParaSimular = (await cliente.obtener(d.idDiseno))?.preparadoParaSimular === true; }
    catch { d.preparadoParaSimular = false; }
    d.verificacion = 'completa';
    // Una respuesta anterior a una recarga o eliminación no modifica la lista vigente.
    if (!disenos.includes(d)) return;
    for (const fila of document.querySelectorAll('[data-diseno]')) {
      if (fila.dataset.diseno !== String(d.idDiseno)) continue;
      fila.querySelector('.metronet-disenos__accion--simular')?.replaceWith(crearAcceso(d, 'play', 'Simular diseño', '/simulacion.html'));
    }
  }

  function renderizar() {
    numerosDisenos = numerarDisenos(disenos);
    const grupos = { campana: disenos.filter(d => !esDisenoLibre(d)), libres: disenos.filter(esDisenoLibre) };
    for (const [grupo, redes] of Object.entries(grupos)) {
      const sufijo = grupo === 'campana' ? 'Campana' : 'Libres';
      const totalPaginas = Math.max(1, Math.ceil(redes.length / porPagina));
      paginas[grupo] = Math.min(paginas[grupo], totalPaginas - 1);
      const desde = paginas[grupo] * porPagina;
      const visibles = redes.slice(desde, desde + porPagina);
      if (grupo === grupoActivo) visibles.forEach(d => { void verificarSimulacion(d); });
      (grupo === 'campana' ? lista : listaLibres).replaceChildren(...visibles.map(crearFila));
      document.getElementById(`panelDisenos${sufijo}`).hidden = grupo !== grupoActivo;
      document.getElementById(`vacioDisenos${sufijo}`).hidden = redes.length > 0;
      document.getElementById(`resumenDisenos${sufijo}`).textContent = redes.length
        ? `Diseños ${desde + 1}–${Math.min(desde + porPagina, redes.length)} de ${redes.length}` : '0 diseños';
      const pestana = document.getElementById(`pestanaDisenos${sufijo}`);
      pestana.textContent = `${grupo === 'campana' ? 'Diseño de los niveles' : 'Modo Libre'} · ${redes.length}`;
      pestana.setAttribute('aria-selected', String(grupo === grupoActivo));
      pestana.tabIndex = grupo === grupoActivo ? 0 : -1;
      if (grupo === grupoActivo) {
        anterior.disabled = paginas[grupo] === 0;
        siguiente.disabled = paginas[grupo] === totalPaginas - 1;
        document.getElementById('paginaDisenosActual').textContent = `Página ${paginas[grupo] + 1} de ${totalPaginas}`;
      }
    }
  }

  pestanas.forEach((boton, indice) => {
    boton.addEventListener('click', () => { grupoActivo = boton.dataset.grupo; renderizar(); });
    boton.addEventListener('keydown', evento => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
      evento.preventDefault();
      const destino = evento.key === 'Home' ? 0 : evento.key === 'End' ? pestanas.length - 1
        : (indice + (evento.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length;
      pestanas[destino].click(); pestanas[destino].focus();
    });
  });
  anterior.addEventListener('click', () => { paginas[grupoActivo]--; renderizar(); });
  siguiente.addEventListener('click', () => { paginas[grupoActivo]++; renderizar(); });
  window.addEventListener('resize', () => {
    const capacidad = capacidadPagina();
    if (capacidad === porPagina) return;
    for (const grupo of Object.keys(paginas)) paginas[grupo] = Math.floor(paginas[grupo] * porPagina / capacidad);
    porPagina = capacidad; renderizar();
  });

  async function cargar() {
    if (cargando || operacion || dialogo.open) { recargaPendiente = true; return; }
    cargando = true; recargaPendiente = false;
    const version = versionListado;
    lista.setAttribute('aria-busy', 'true'); listaLibres.setAttribute('aria-busy', 'true'); reintentar.hidden = true; botonLibre.disabled = true;
    try {
      const [redes, juego, acceso] = await Promise.allSettled([cliente.listar(), consultarJuego('/escenarios'), consultarAccesoMisDisenos()]);
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
        disenos = redes.value.filter(propio).map(d => ({ ...d, preparadoParaSimular: false }));
        mensaje.hidden = true;
        renderizar();
      } else {
        disenos = []; renderizar();
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
    const propietario = administrador ? ` · ${propietarioDiseno(diseno)}` : '';
    document.getElementById('nombreEliminarDiseno').textContent = `«${nombreDiseno(diseno, numerosDisenos)}»${propietario}`;
    dialogo.returnValue = 'cancelar'; dialogo.showModal();
    dialogo.addEventListener('close', async () => {
      if (dialogo.returnValue !== 'eliminar') { recargarSiPendiente(); return; }
      operacion = true; versionListado++; renderizar();
      let resultado;
      try {
        await gestion.solicitar(`/${diseno.idDiseno}`, { method: 'DELETE' });
        disenos = disenos.filter(d => d.idDiseno !== diseno.idDiseno);
        resultado = '';
      } catch (error) {
        if (error.estadoHttp === 404) {
          disenos = disenos.filter(d => d.idDiseno !== diseno.idDiseno);
          resultado = 'Este diseño ya no existe. Se actualizó la lista.';
        } else resultado = error.message;
      } finally {
        operacion = false; renderizar(); mensaje.hidden = !resultado; mensaje.textContent = resultado;
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
