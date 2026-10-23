import { numerarDisenos, etiquetaDiseno } from '../red/NumeracionDisenos.mjs';
import { mostrarFuentesMapa } from '../mapa/FuentesMapa.js';
import { confirmarSistema } from '../componentes/DialogoSistema.js';
import { cerrarSesionRemota, eliminarSesiones, guardarSesionAdministrador, obtenerSesionActiva } from "../autenticacion/sesion.js";
import { inicializarNavegacion } from "../navegacion/NavegacionAplicacion.js";

const sesion = obtenerSesionActiva();
let usuariosDisponibles = [];
let disenosDisponibles = [];
let actividadesDisponibles = [];
let borrandoActividad = false;
let administracionNiveles = null;
let cargaNiveles = null;
let abriendoDiseno = false;
let numerosDisenos = new Map();

if (!sesion) {
  window.location.replace("/login.html?destino=%2Fadmin.html");
} else if (sesion.usuario.rol === 'ADMIN') {
  inicializarAdministracion(sesion);
} else {
  inicializarInformacionJugador();
}

function inicializarInformacionJugador() {
  inicializarNavegacion({ actual: 'administracion' });
  document.getElementById('nombreAdministrador').hidden = true;
  const permitidas = new Set(['fuentes', 'unidades']);
  document.querySelectorAll('.admin-enlace').forEach(boton => {
    if (!permitidas.has(boton.dataset.vista)) { boton.remove(); return; }
    boton.addEventListener('click', () => {
      mostrarVista(boton.dataset.vista);
      if (boton.dataset.vista === 'fuentes') void mostrarFuentesMapa(document.getElementById('listaFuentesMapa'));
    });
  });
  document.querySelectorAll('.admin-vista').forEach(vista => {
    if (!permitidas.has(vista.id.replace('vista-', ''))) vista.remove();
  });
  document.querySelectorAll('.admin-menu-grupo').forEach(grupo => {
    if (!grupo.querySelector('.admin-enlace')) grupo.remove();
  });
  mostrarVista('unidades');
  document.body.setAttribute('aria-busy', 'false');
}

function inicializarAdministracion(sesionAdministrador) {
  inicializarNavegacion({ actual: "administracion" });
  actualizarEtiquetaAdministrador(sesionAdministrador.usuario);
  document.querySelectorAll(".admin-enlace").forEach((boton) => {
    boton.addEventListener("click", () => {
      if (!boton.dataset.vista || boton.classList.contains('activo')) {
        return;
      }

      mostrarVista(boton.dataset.vista);

      if (boton.dataset.vista === "disenos") {
        cargarDisenos(sesionAdministrador.token);
      }

      if (boton.dataset.vista === "configuracion") {
        cargarConfiguracion(sesionAdministrador.token);
      }
      if (boton.dataset.vista === 'niveles') cargarEditorNiveles(sesionAdministrador.token);
      if (boton.dataset.vista === 'fuentes') void mostrarFuentesMapa(document.getElementById('listaFuentesMapa'));

      if (boton.dataset.vista === "actividad") {
        cargarActividad(sesionAdministrador.token);
      }
    });
  });

  document.getElementById("cerrarSesion").addEventListener("click", () => {
    cerrarSesion(sesionAdministrador);
  });

  document.getElementById("cerrarEditorUsuario").addEventListener("click", cerrarEditorUsuario);
  document.getElementById("formularioEditorUsuario").addEventListener("submit", (evento) => {
    guardarUsuarioEditado(evento, sesionAdministrador.token);
  });

  document
    .getElementById("tablaUsuarios")
    .addEventListener("click", (evento) => {
      const botonGuardar = evento.target.closest("[data-guardar-rol]");

      if (botonGuardar) {
        actualizarRol(
          botonGuardar.dataset.guardarRol,
          sesionAdministrador.token,
        );
      }

      const botonEditar = evento.target.closest("[data-editar-usuario]");

      if (botonEditar) {
        abrirEditorUsuario(botonEditar);
      }

      const botonEliminar = evento.target.closest("[data-eliminar-usuario]");

      if (botonEliminar) {
        eliminarUsuario(
          botonEliminar.dataset.eliminarUsuario,
          botonEliminar.dataset.nombreUsuario,
          sesionAdministrador.token,
        );
      }
    });

  document.getElementById("listaDisenos").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-ver-diseno]");
    const botonEliminar = evento.target.closest("[data-eliminar-diseno]");

    if (boton) {
      cargarDetalleDiseno(boton.dataset.verDiseno, sesionAdministrador.token);
    }

    if (botonEliminar) eliminarDisenoAdministrador(botonEliminar.dataset.eliminarDiseno, sesionAdministrador.token);
  });

  document.getElementById("listaConfiguracion").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-guardar-configuracion]");
    if (boton) guardarConfiguracion(boton.dataset.guardarConfiguracion, sesionAdministrador.token);
  });

  document.getElementById("filtroUsuarios").addEventListener("input", filtrarUsuarios);
  document.getElementById("filtroRolUsuarios").addEventListener("change", filtrarUsuarios);
  document.getElementById("filtroDisenos").addEventListener("input", filtrarDisenos);
  document.getElementById("tablaActividad").addEventListener("click", evento => {
    const boton = evento.target.closest('[data-borrar-actividad]');
    if (boton) void borrarActividad(Number(boton.dataset.borrarActividad), sesionAdministrador.token);
  });
  document.getElementById("borrarTodasActividades").addEventListener("click", () => {
    void borrarActividad(null, sesionAdministrador.token);
  });

  cargarUsuarios(sesionAdministrador.token).finally(() => document.body.setAttribute('aria-busy', 'false'));
}

function cargarEditorNiveles(token) {
  if (cargaNiveles) return cargaNiveles;
  const contenedor = document.getElementById('listaNivelesAdmin');
  const mensaje = document.getElementById('mensajeNivelesAdmin');
  contenedor.setAttribute('aria-busy', 'true');
  cargaNiveles = (async () => {
    if (!administracionNiveles) {
      const { crearAdministracionNiveles } = await import('./AdministracionNiveles.js');
      administracionNiveles = crearAdministracionNiveles({
        contenedor, mensaje, token, urlServidor: obtenerUrlServidor, errorRespuesta: obtenerMensajeError,
      });
    }
    await administracionNiveles.cargar();
  })().catch(() => {
    mensaje.textContent = 'No se pudo cargar el editor. Recargá la página para reintentar.';
    mensaje.className = 'admin-mensaje error';
  }).finally(() => { cargaNiveles = null; contenedor.setAttribute('aria-busy', 'false'); });
  return cargaNiveles;
}

function mostrarVista(nombreVista) {
  if (sesion?.usuario?.rol !== 'ADMIN' && !['fuentes','unidades'].includes(nombreVista)) return;
  const titulos = {
    usuarios: "Gestión de usuarios",
    disenos: "Supervisión de diseños",
    configuracion: "Configuración",
    niveles: 'Experiencia de juego',
    actividad: "Actividad reciente",
    fuentes: "Fuentes del mapa",
    unidades: "Unidades y equivalencias",
  };

  document.querySelectorAll(".admin-enlace").forEach((boton) => {
    boton.classList.toggle("activo", boton.dataset.vista === nombreVista);
    boton.setAttribute("aria-pressed", String(boton.dataset.vista === nombreVista));
  });

  document.querySelectorAll(".admin-vista").forEach((vista) => {
    vista.classList.toggle("activa", vista.id === `vista-${nombreVista}`);
  });

  document.querySelector(".admin-aplicacion").classList.toggle("admin-aplicacion--consulta", ["configuracion", "fuentes", "unidades"].includes(nombreVista));
  document.getElementById("tituloVista").textContent = titulos[nombreVista];
  document.getElementById('iconoUsuarios').hidden = nombreVista !== 'usuarios';
  document.getElementById('iconoDisenos').hidden = nombreVista !== 'disenos';
  document.getElementById('iconoConfiguracion').hidden = nombreVista !== 'configuracion';
  document.getElementById('iconoActividad').hidden = nombreVista !== 'actividad';
  document.getElementById('iconoNiveles').hidden = nombreVista !== 'niveles';
  document.getElementById('iconoFuentes').hidden = nombreVista !== 'fuentes';
  document.getElementById('iconoUnidades').hidden = nombreVista !== 'unidades';
}

async function cargarUsuarios(token) {
  mostrarMensaje("Cargando usuarios…");

  try {
    const respuesta = await fetch(
      `${obtenerUrlServidor()}/api/admin/usuarios`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(
          respuesta,
          "No fue posible cargar los usuarios.",
        ),
      );
    }

    usuariosDisponibles = await respuesta.json();
    filtrarUsuarios();
  } catch (error) {
    mostrarMensaje(error.message, "error");

    if (error.message.includes("sesión")) {
      cerrarSesionLocal();
    }
  }
}

function renderizarUsuarios(usuarios) {
  const tablaUsuarios = document.getElementById("tablaUsuarios");

  tablaUsuarios.replaceChildren(...(usuarios.length ? usuarios.map((usuario) => {
      const fila = document.createElement("tr");
      const opciones = ["ADMIN", "JUGADOR"]
        .map(
          (rol) =>
            `<option value="${rol}" ${usuario.rol === rol ? "selected" : ""}>${formatearRol(rol)}</option>`,
        )
        .join("");

      fila.innerHTML = `
        <td>${escaparHtml(`${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim())}</td>
        <td>${escaparHtml(usuario.email)}</td>
        <td><select data-control-general="select" id="rol-${usuario.idUsuario}" class="admin-rol" aria-label="Rol de ${escaparHtml(`${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim())}">${opciones}</select></td>
        <td>
          <button class="admin-guardar" type="button" data-guardar-rol="${usuario.idUsuario}" data-accion-ui="guardar" data-categoria-accion="principal">Guardar</button>
          <button class="admin-secundario" type="button" data-editar-usuario="${usuario.idUsuario}" data-nombre="${escaparHtml(usuario.nombre)}" data-apellido="${escaparHtml(usuario.apellido ?? "")}" data-email="${escaparHtml(usuario.email)}" data-rol="${usuario.rol}" data-identificador-administrador="${escaparHtml(usuario.identificadorAdministrador ?? usuario.nombre)}" data-accion-ui="editar" data-categoria-accion="secundaria">Editar</button>
          <button class="admin-eliminar" type="button" data-eliminar-usuario="${usuario.idUsuario}" data-nombre-usuario="${escaparHtml(`${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim())}" data-accion-ui="eliminar" data-categoria-accion="peligro">Eliminar</button>
        </td>
      `;

      return fila;
    }) : [crearFilaVacia("No hay usuarios que coincidan con el filtro.", 4)]));
}

function filtrarUsuarios() {
  const texto = normalizarTexto(document.getElementById("filtroUsuarios").value);
  const rol = document.getElementById("filtroRolUsuarios").value;
  const usuariosFiltrados = usuariosDisponibles.filter((usuario) => {
    const contenido = `${usuario.nombre ?? ""} ${usuario.apellido ?? ""} ${usuario.email ?? ""}`;
    return (!texto || normalizarTexto(contenido).includes(texto)) && (!rol || usuario.rol === rol);
  });

  renderizarUsuarios(usuariosFiltrados);
  mostrarMensaje(usuariosDisponibles.length && !usuariosFiltrados.length ? "No hay usuarios que coincidan con el filtro." : usuariosDisponibles.length ? "" : "Todavía no hay usuarios registrados.");
}

async function cargarDisenos(token) {
  mostrarMensajeDisenos("Cargando diseños…");

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/disenos`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!respuesta.ok) {
      throw new Error(await obtenerMensajeError(respuesta, "No fue posible cargar los diseños."));
    }

    disenosDisponibles = await respuesta.json();
    filtrarDisenos();
  } catch (error) {
    mostrarMensajeDisenos(error.message, "error");
  }
}

function renderizarDisenos(disenos) {
  const lista = document.getElementById("listaDisenos");
  const grupos = new Map();
  for (const diseno of disenos) {
    const clave = Number.isInteger(diseno.idUsuario) ? `usuario:${diseno.idUsuario}`
      : diseno.correoPropietario ? `correo:${normalizarTexto(diseno.correoPropietario)}`
        : 'sin-usuario';
    if (!grupos.has(clave)) grupos.set(clave, {
      propietario: diseno.propietario || 'Sin usuario asignado',
      correo: diseno.correoPropietario || 'Sin correo registrado',
      disenos: [],
    });
    grupos.get(clave).disenos.push(diseno);
  }
  const gruposOrdenados = [...grupos.values()].sort((a, b) =>
    a.propietario.localeCompare(b.propietario, 'es', { sensitivity: 'base' }));
  lista.replaceChildren(...(gruposOrdenados.length ? gruposOrdenados.map(grupo => {
    const seccion = document.createElement('section');
    seccion.className = 'admin-jugador-disenos';
    const cabecera = document.createElement('header');
    cabecera.className = 'admin-jugador-disenos__cabecera';
    const identidad = document.createElement('div');
    const nombre = document.createElement('h3');
    nombre.textContent = grupo.propietario;
    const correo = document.createElement('p');
    correo.textContent = grupo.correo;
    identidad.append(nombre, correo);
    const cantidad = document.createElement('span');
    cantidad.textContent = `Diseños · ${grupo.disenos.length}`;
    cabecera.append(identidad, cantidad);
    const tarjetas = document.createElement('div');
    tarjetas.className = 'admin-jugador-disenos__tarjetas';
    tarjetas.append(...grupo.disenos.map(diseno => {
      const tarjeta = document.createElement("article");
      const actividad = diseno.idEscenario
        ? diseno.nombre || formatearModoEscenario(diseno.modoEscenario)
        : "Sin actividad asociada";

      tarjeta.innerHTML = `
        <div>
          <h4>${etiquetaDiseno(diseno, numerosDisenos)}</h4>
          <p>${escaparHtml(actividad)}</p>
        </div>
        <div class="admin-acciones-linea">
          <button class="admin-guardar" type="button" data-ver-diseno="${diseno.idDiseno}" data-accion-ui="abrir" data-categoria-accion="principal">Abrir</button>
          <button class="admin-eliminar" type="button" data-eliminar-diseno="${diseno.idDiseno}" data-accion-ui="eliminar" data-categoria-accion="peligro">Eliminar</button>
        </div>
      `;

      return tarjeta;
    }));
    seccion.append(cabecera, tarjetas);
    return seccion;
  }) : [crearEstadoVacio(disenosDisponibles.length ? "No hay diseños que coincidan con el filtro." : "0 diseños")]));
}

function filtrarDisenos() {
  numerosDisenos = numerarDisenos(disenosDisponibles);
  const texto = normalizarTexto(document.getElementById("filtroDisenos").value);
  const disenosFiltrados = disenosDisponibles.filter((diseno) => {
    const contenido = `${diseno.propietario ?? ""} ${diseno.correoPropietario ?? ""}`;
    return !texto || normalizarTexto(contenido).includes(texto);
  });

  renderizarDisenos(disenosFiltrados);
  mostrarMensajeDisenos(disenosDisponibles.length && !disenosFiltrados.length ? "No hay diseños que coincidan con el filtro." : disenosDisponibles.length ? "" : "Todavía no hay diseños creados por jugadores.");
}

function crearFilaVacia(mensaje, cantidadColumnas) {
  const fila = document.createElement("tr");
  fila.innerHTML = `<td colspan="${cantidadColumnas}" class="metronet-vacio">${escaparHtml(mensaje)}</td>`;
  return fila;
}

function crearEstadoVacio(mensaje) {
  const estado = document.createElement("p");
  estado.className = "admin-aviso";
  estado.textContent = mensaje;
  return estado;
}

function normalizarTexto(valor) {
  return (valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function eliminarDisenoAdministrador(idDiseno, token) {
  const diseno = disenosDisponibles.find(d => String(d.idDiseno) === String(idDiseno));
  if (!diseno) return;
  if (!await confirmarSistema(`¿Eliminar definitivamente ${etiquetaDiseno(diseno, numerosDisenos)} de ${diseno.propietario || 'este jugador'}? Se borrará la red. Si pertenece a un nivel completado, se conservarán sus intentos, puntajes, resultados, progreso y desbloqueos. En los demás casos se eliminarán también la partida y sus resultados. Esta acción no se puede deshacer.`, { cancelarSeguro: true, peligro: true })) return;
  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible eliminar el diseño."));
    disenosDisponibles = disenosDisponibles.filter(diseno => String(diseno.idDiseno) !== String(idDiseno));
    filtrarDisenos();
    mostrarMensajeDisenos("");
  } catch (error) { mostrarMensajeDisenos(error.message, "error"); }
}

async function cargarDetalleDiseno(idDiseno, token) {
  if (abriendoDiseno) return;
  abriendoDiseno = true;
  mostrarMensajeDisenos("Abriendo mapa del diseño…");
  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible abrir el diseño."));
    const detalle = await respuesta.json();
    const { abrirVisorDiseno } = await import('./VisorDisenoAdministrador.js');
    abrirVisorDiseno(detalle, etiquetaDiseno(detalle.diseno, numerosDisenos));
    mostrarMensajeDisenos("");
  } catch (error) {
    mostrarMensajeDisenos(error.message, "error");
  } finally {
    abriendoDiseno = false;
  }
}

function mostrarMensajeDisenos(texto, tipo = "") {
  const mensaje = document.getElementById("mensajeDisenos");
  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje ${tipo}`;
}

async function cargarConfiguracion(token) {
  mostrarMensajeConfiguracion("Cargando configuración…");

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/configuracion`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible cargar la configuración."));
    renderizarConfiguracion(await respuesta.json());
    mostrarMensajeConfiguracion("");
  } catch (error) {
    mostrarMensajeConfiguracion(error.message, "error");
  }
}

function renderizarConfiguracion(configuraciones) {
  const lista = document.getElementById("listaConfiguracion");
  // Estos valores se conservan para el juego, pero no se administran en esta pantalla.
  const visibles = configuraciones.filter(configuracion => !['capacidad_unidad', 'velocidad_simulacion'].includes(configuracion.clave));
  const grupos = [
    { claves: ['modo_mantenimiento'] },
  ];
  const conocidas = new Set(grupos.flatMap(grupo => grupo.claves));
  if (visibles.some(configuracion => !conocidas.has(configuracion.clave))) {
    grupos.push({ titulo: 'Otros parámetros', descripcion: 'Configuración adicional de la plataforma.', claves: visibles.filter(configuracion => !conocidas.has(configuracion.clave)).map(configuracion => configuracion.clave) });
  }
  lista.replaceChildren(...grupos.filter(grupo => visibles.some(configuracion => grupo.claves.includes(configuracion.clave))).map(grupo => {
    const seccion = document.createElement('section');
    seccion.className = 'admin-configuracion-grupo';
    if (grupo.titulo) {
      const titulo = document.createElement('h2');
      titulo.textContent = grupo.titulo;
      const descripcion = document.createElement('p');
      descripcion.textContent = grupo.descripcion;
      seccion.append(titulo, descripcion);
    }
    seccion.append(...visibles.filter(configuracion => grupo.claves.includes(configuracion.clave)).map(crearCampoConfiguracion));
    return seccion;
  }));
}

function crearCampoConfiguracion(configuracion) {
    const elemento = document.createElement("article");
    const esMantenimiento = configuracion.clave === "modo_mantenimiento";
    const modo = String(configuracion.valor).trim().toLowerCase();
    const titulo = formatearClave(configuracion.clave);
    const descripcion = esMantenimiento
      ? 'Al activarlo, los jugadores no podrán ingresar. Los administradores conservarán el acceso.'
      : configuracion.descripcion;
    const atributos = `class="admin-configuracion-valor" id="configuracion-${escaparHtml(configuracion.clave)}" aria-label="Valor de ${escaparHtml(titulo)}"`;
    const campo = esMantenimiento
      ? `<select data-control-general="select" ${atributos}>${["activado", "desactivado"].includes(modo) ? "" : '<option value="" selected disabled>Seleccioná un estado</option>'}${["desactivado", "activado"].map(valor => `<option value="${valor}" ${modo === valor ? "selected" : ""}>${valor.toUpperCase()}</option>`).join("")}</select>`
      : `<input ${/^[-+]?\d+(?:[.,]\d+)?$/.test(String(configuracion.valor).trim()) ? 'data-control-general="numero"' : ''} ${atributos} type="text" value="${escaparHtml(configuracion.valor)}" />`;
    elemento.className = `admin-configuracion-item${esMantenimiento ? ' admin-configuracion-item--mantenimiento' : ''}`;
    elemento.innerHTML = `
      <div class="admin-configuracion-descripcion"><h3>${esMantenimiento ? 'Modo de mantenimiento' : escaparHtml(titulo)}</h3><p>${escaparHtml(descripcion)}</p></div>
      <div class="admin-campo-configuracion">${esMantenimiento ? `<label for="configuracion-${escaparHtml(configuracion.clave)}">Estado</label><span class="admin-mantenimiento-indicador" aria-hidden="true"></span>` : ''}${campo}</div>
      <button class="admin-guardar" type="button" data-guardar-configuracion="${escaparHtml(configuracion.clave)}" data-accion-ui="guardar" data-categoria-accion="principal">Guardar</button>
    `;
    return elemento;
}

async function guardarConfiguracion(clave, token) {
  const campo = document.getElementById(`configuracion-${clave}`);
  const valor = campo?.value.trim();
  if (!valor) return mostrarMensajeConfiguracion("Ingresá un valor para guardar.", "error");

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/configuracion/${encodeURIComponent(clave)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valor }),
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible guardar la configuración."));
    mostrarMensajeConfiguracion("");
  } catch (error) {
    mostrarMensajeConfiguracion(error.message, "error");
  }
}

function mostrarMensajeConfiguracion(texto, tipo = "") {
  const mensaje = document.getElementById("mensajeConfiguracion");
  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje ${tipo}`;
}

async function cargarActividad(token) {
  mostrarMensajeActividad("Cargando actividad reciente…");

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/actividades`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!respuesta.ok) {
      throw new Error(await obtenerMensajeError(respuesta, "No fue posible cargar la actividad."));
    }

    actividadesDisponibles = await respuesta.json();
    renderizarActividad(actividadesDisponibles);
  } catch (error) {
    mostrarMensajeActividad(error.message, "error");
  }
}

function renderizarActividad(actividades) {
  const tabla = document.getElementById("tablaActividad");
  document.getElementById('borrarTodasActividades').disabled = borrandoActividad || actividades.length === 0;
  tabla.replaceChildren(...(actividades.length ? actividades.map((actividad) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${escaparHtml(formatearFecha(actividad.fecha))}</td>
      <td>${escaparHtml(actividad.administrador)}</td>
      <td>${escaparHtml(actividad.accion)}</td>
      <td>${escaparHtml(actividad.detalle)}</td>
      <td><button class="admin-eliminar" type="button" data-borrar-actividad="${actividad.idActividad}" ${borrandoActividad ? 'disabled' : ''} data-accion-ui="eliminar" data-categoria-accion="peligro">Eliminar</button></td>
    `;
    return fila;
  }) : [crearFilaVacia("Todavía no hay actividad registrada.", 5)]));
  mostrarMensajeActividad(actividades.length ? "" : "Todavía no hay actividad registrada.");
}

async function borrarActividad(idActividad, token) {
  if (borrandoActividad || actividadesDisponibles.length === 0) return;
  const una = Number.isInteger(idActividad) && idActividad > 0;
  if (una && !actividadesDisponibles.some(actividad => actividad.idActividad === idActividad)) return;
  const pregunta = una
    ? '¿Eliminar esta entrada del registro de actividad? Esta acción no se puede deshacer.'
    : '¿Eliminar todo el registro de actividad de administradores? Esta acción no se puede deshacer.';
  if (!await confirmarSistema(pregunta, { cancelarSeguro: true, peligro: true })) return;
  borrandoActividad = true;
  document.getElementById('borrarTodasActividades').disabled = true;
  document.querySelectorAll('[data-borrar-actividad]').forEach(boton => { boton.disabled = true; });
  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/actividades${una ? `/${idActividad}` : ''}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, 'No fue posible borrar el registro de actividad.'));
    actividadesDisponibles = una ? actividadesDisponibles.filter(actividad => actividad.idActividad !== idActividad) : [];
    renderizarActividad(actividadesDisponibles);

  } catch (error) {
    mostrarMensajeActividad(error.message, 'error');
  } finally {
    borrandoActividad = false;
    document.getElementById('borrarTodasActividades').disabled = actividadesDisponibles.length === 0;
    document.querySelectorAll('[data-borrar-actividad]').forEach(boton => { boton.disabled = false; });
  }
}

function mostrarMensajeActividad(texto, tipo = "") {
  const mensaje = document.getElementById("mensajeActividad");
  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje ${tipo}`;
}

function formatearFecha(fecha) {
  return new Intl.DateTimeFormat("es-UY", { dateStyle: "short", timeStyle: "short" }).format(new Date(fecha));
}

function formatearClave(clave) {
  return clave.replaceAll("_", " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function formatearModoEscenario(modo) {
  return modo === "NIVEL" ? "Nivel" : modo === "EDICION_LIBRE" ? "Edición libre" : "Actividad";
}

async function eliminarUsuario(idUsuario, nombreUsuario, token) {
  if (!await confirmarSistema(`¿Eliminar definitivamente a ${nombreUsuario || "este usuario"}? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const respuesta = await fetch(
      `${obtenerUrlServidor()}/api/admin/usuarios/${idUsuario}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(
          respuesta,
          "No fue posible eliminar el usuario.",
        ),
      );
    }

    mostrarMensaje("");
    usuariosDisponibles = usuariosDisponibles.filter(usuario => String(usuario.idUsuario) !== String(idUsuario));
    filtrarUsuarios();
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function actualizarRol(idUsuario, token) {
  const selectorRol = document.getElementById(`rol-${idUsuario}`);

  if (!selectorRol) {
    return;
  }

  try {
    const respuesta = await fetch(
      `${obtenerUrlServidor()}/api/admin/usuarios/${idUsuario}/rol`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rol: selectorRol.value }),
      },
    );

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(
          respuesta,
          "No fue posible actualizar el rol.",
        ),
      );
    }

    mostrarMensaje("");
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

function abrirEditorUsuario(boton) {
  document.getElementById("editorIdUsuario").value = boton.dataset.editarUsuario;
  document.getElementById("editorNombre").value = boton.dataset.nombre;
  document.getElementById("editorApellido").value = boton.dataset.apellido;
  document.getElementById("editorEmail").value = boton.dataset.email;
  const esAdministrador = boton.dataset.rol === "ADMIN";
  document.getElementById("campoIdentificadorAdministrador").hidden = !esAdministrador;
  document.getElementById("editorIdentificadorAdministrador").value = esAdministrador
    ? boton.dataset.identificadorAdministrador
    : "";
  document.getElementById("editorContrasena").value = "";
  mostrarMensajeEditorUsuario("");
  document.getElementById("editorUsuario").showModal();
}

function cerrarEditorUsuario() {
  document.getElementById("editorUsuario").close();
}

async function guardarUsuarioEditado(evento, token) {
  evento.preventDefault();
  const formulario = evento.currentTarget;

  if (!formulario.checkValidity()) {
    formulario.querySelector(':invalid')?.focus();
    mostrarMensajeEditorUsuario("Revisá los datos obligatorios del usuario.", "error");
    return;
  }

  const idUsuario = document.getElementById("editorIdUsuario").value;
  const nombre = document.getElementById("editorNombre").value.trim();
  const apellido = document.getElementById("editorApellido").value.trim();
  const email = document.getElementById("editorEmail").value.trim();
  const identificadorAdministrador = document.getElementById("editorIdentificadorAdministrador").value.trim();
  const nuevaContrasena = document.getElementById("editorContrasena").value;
  const contrasenaValida = nuevaContrasena.length >= 6 && /[A-Z]/.test(nuevaContrasena) && /[^A-Za-z0-9]/.test(nuevaContrasena);

  if (!nombre || !email) {
    mostrarMensajeEditorUsuario("Completá el nombre y el correo electrónico.", "error");
    return;
  }

  if (!document.getElementById("campoIdentificadorAdministrador").hidden && !identificadorAdministrador) {
    mostrarMensajeEditorUsuario("Completá el identificador de administrador.", "error");
    return;
  }

  if (nuevaContrasena && !contrasenaValida) {
    mostrarMensajeEditorUsuario("La contraseña debe tener 6 caracteres, una mayúscula y un carácter especial.", "error");
    return;
  }

  try {
    const respuesta = await fetch(
      `${obtenerUrlServidor()}/api/admin/usuarios/${idUsuario}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nombre, apellido, email, nuevaContrasena, identificadorAdministrador }),
      },
    );

    if (!respuesta.ok) {
      throw new Error(
        await obtenerMensajeError(
          respuesta,
          "No fue posible actualizar los datos.",
        ),
      );
    }

    const usuarioActualizado = await respuesta.json();
    actualizarSesionAdministradorSiCorresponde(usuarioActualizado);
    cerrarEditorUsuario();
    if (nuevaContrasena && Number(idUsuario) === sesion?.usuario?.idUsuario) {
      mostrarMensaje("");
      window.setTimeout(cerrarSesionLocal, 900);
      return;
    }
    mostrarMensaje("");
    cargarUsuarios(token);
  } catch (error) {
    mostrarMensajeEditorUsuario(error.message, "error");
  }
}

function mostrarMensajeEditorUsuario(texto, tipo = "") {
  const mensaje = document.getElementById("mensajeEditorUsuario");
  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje ${tipo}`;
}

function actualizarSesionAdministradorSiCorresponde(usuarioActualizado) {
  try {
    const sesionAdministrador = JSON.parse(localStorage.getItem("sesionAdministrador"));

    if (sesionAdministrador?.usuario?.idUsuario !== usuarioActualizado.idUsuario) {
      return;
    }

    guardarSesionAdministrador({ ...sesionAdministrador, usuario: usuarioActualizado });
    actualizarEtiquetaAdministrador(usuarioActualizado);
  } catch {
    // La actualización del usuario se conserva aunque no pueda leerse la sesión local.
  }
}

function actualizarEtiquetaAdministrador(administrador) {
  const identificador = administrador.identificadorAdministrador || administrador.nombre;
  document.getElementById("identificadorAdministrador").textContent = identificador;
}

async function cerrarSesion(sesion) {
  if (!await confirmarSistema("¿Querés cerrar la sesión de administración?")) {
    return;
  }

  try {
    await cerrarSesionRemota(sesion);
  } finally {
    cerrarSesionLocal();
  }
}

function cerrarSesionLocal() {
  eliminarSesiones();
  window.location.assign("/admin-login.html");
}

function obtenerUrlServidor() {
  return `${window.location.protocol}//${window.location.hostname}:8080`;
}

async function obtenerMensajeError(respuesta, mensajePredeterminado) {
  try {
    const datos = await respuesta.json();
    return datos.detail || datos.message || mensajePredeterminado;
  } catch {
    return mensajePredeterminado;
  }
}

function mostrarMensaje(texto, tipo = "") {
  const mensaje = document.getElementById("mensajeAdministracion");
  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje ${tipo}`;
}

function formatearRol(rol) {
  return rol === "ADMIN" ? "Administrador" : "Jugador";
}

function escaparHtml(valor) {
  // Se utiliza tanto en texto como en atributos entre comillas.
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caracter]);
}
