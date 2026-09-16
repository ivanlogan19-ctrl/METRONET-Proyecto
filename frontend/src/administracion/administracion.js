const sesion = obtenerSesionAdministrador();
let usuariosDisponibles = [];
let disenosDisponibles = [];

if (!sesion) {
  window.location.replace("/admin-login.html");
} else {
  inicializarAdministracion(sesion);
}

function obtenerSesionAdministrador() {
  try {
    const sesionGuardada = JSON.parse(
      localStorage.getItem("sesionAdministrador"),
    );

    if (sesionGuardada?.token && sesionGuardada?.usuario?.rol === "ADMIN") {
      return sesionGuardada;
    }
  } catch {
    // La sesión dañada se elimina antes de volver al acceso de administrador.
  }

  localStorage.removeItem("sesionAdministrador");
  return null;
}

function inicializarAdministracion(sesionAdministrador) {
  actualizarEtiquetaAdministrador(sesionAdministrador.usuario);

  document.querySelectorAll(".admin-enlace").forEach((boton) => {
    boton.addEventListener("click", () => {
      if (!boton.dataset.vista) {
        return;
      }

      mostrarVista(boton.dataset.vista);

      if (boton.dataset.vista === "disenos") {
        cargarDisenos(sesionAdministrador.token);
      }

      if (boton.dataset.vista === "configuracion") {
        cargarConfiguracion(sesionAdministrador.token);
      }

      if (boton.dataset.vista === "actividad") {
        cargarActividad(sesionAdministrador.token);
      }
    });
  });

  document.getElementById("cerrarSesion").addEventListener("click", () => {
    cerrarSesion(sesionAdministrador.token);
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

  document.getElementById("tablaRecuperaciones").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-atender-recuperacion]");
    if (boton) marcarRecuperacionAtendida(boton.dataset.atenderRecuperacion, sesionAdministrador.token);
  });

  document.getElementById("listaDisenos").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-ver-diseno]");
    const botonEliminar = evento.target.closest("[data-eliminar-diseno]");

    if (boton) {
      cargarDetalleDiseno(boton.dataset.verDiseno, sesionAdministrador.token);
    }

    if (botonEliminar) eliminarDisenoAdministrador(botonEliminar.dataset.eliminarDiseno, sesionAdministrador.token);
  });

  document.getElementById("detalleDiseno").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-accion-diseno]");

    if (boton) {
      ejecutarAccionDiseno(boton, sesionAdministrador.token);
    }

    const botonCrear = evento.target.closest("[data-crear-diseno]");

    if (botonCrear) {
      crearElementoDiseno(botonCrear, sesionAdministrador.token);
    }
  });

  document.getElementById("listaConfiguracion").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-guardar-configuracion]");
    if (boton) guardarConfiguracion(boton.dataset.guardarConfiguracion, sesionAdministrador.token);
  });

  document.getElementById("filtroUsuarios").addEventListener("input", filtrarUsuarios);
  document.getElementById("filtroRolUsuarios").addEventListener("change", filtrarUsuarios);
  document.getElementById("filtroDisenos").addEventListener("input", filtrarDisenos);

  cargarUsuarios(sesionAdministrador.token);
}

function mostrarVista(nombreVista) {
  const titulos = {
    usuarios: "Gestión de usuarios",
    disenos: "Supervisión de escenarios diseñados",
    configuracion: "Configuración general",
    actividad: "Actividad reciente",
  };

  document.querySelectorAll(".admin-enlace").forEach((boton) => {
    boton.classList.toggle("activo", boton.dataset.vista === nombreVista);
  });

  document.querySelectorAll(".admin-vista").forEach((vista) => {
    vista.classList.toggle("activa", vista.id === `vista-${nombreVista}`);
  });

  document.getElementById("tituloVista").textContent = titulos[nombreVista];
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
    cargarRecuperaciones(token);
  } catch (error) {
    mostrarMensaje(error.message, "error");

    if (error.message.includes("sesión")) {
      cerrarSesionLocal();
    }
  }
}

async function cargarRecuperaciones(token) {
  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/recuperaciones`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible cargar las solicitudes."));
    renderizarRecuperaciones(await respuesta.json());
    mostrarMensajeRecuperaciones("");
  } catch (error) {
    mostrarMensajeRecuperaciones(error.message, "error");
  }
}

function renderizarRecuperaciones(solicitudes) {
  const tabla = document.getElementById("tablaRecuperaciones");
  tabla.replaceChildren(...(solicitudes.length ? solicitudes.map((solicitud) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${escaparHtml(solicitud.nombreUsuario)}</td>
      <td>${escaparHtml(solicitud.email)}</td>
      <td>${escaparHtml(solicitud.estado)}</td>
      <td>${solicitud.estado === "PENDIENTE" ? `<button class="admin-guardar" type="button" data-atender-recuperacion="${solicitud.idSolicitud}">Marcar atendida</button>` : "—"}</td>
    `;
    return fila;
  }) : [crearFilaVaciaRecuperaciones()]));
}

function crearFilaVaciaRecuperaciones() {
  const fila = document.createElement("tr");
  fila.innerHTML = '<td colspan="4">No hay solicitudes de recuperación pendientes.</td>';
  return fila;
}

async function marcarRecuperacionAtendida(idSolicitud, token) {
  if (!window.confirm("¿Confirmás que la solicitud fue atendida?")) {
    return;
  }

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/recuperaciones/${idSolicitud}/atendida`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible actualizar la solicitud."));
    mostrarMensajeRecuperaciones("Solicitud marcada como atendida. Actualizá la contraseña desde Editar datos del usuario.");
    cargarRecuperaciones(token);
  } catch (error) {
    mostrarMensajeRecuperaciones(error.message, "error");
  }
}

function mostrarMensajeRecuperaciones(texto, tipo = "") {
  const mensaje = document.getElementById("mensajeRecuperaciones");
  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje ${tipo}`;
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
        <td><select id="rol-${usuario.idUsuario}" class="admin-rol">${opciones}</select></td>
        <td>
          <button class="admin-guardar" type="button" data-guardar-rol="${usuario.idUsuario}">Guardar rol</button>
          <button class="admin-secundario" type="button" data-editar-usuario="${usuario.idUsuario}" data-nombre="${escaparHtml(usuario.nombre)}" data-apellido="${escaparHtml(usuario.apellido ?? "")}" data-email="${escaparHtml(usuario.email)}" data-rol="${usuario.rol}" data-identificador-administrador="${escaparHtml(usuario.identificadorAdministrador ?? usuario.nombre)}">Editar datos</button>
          <button class="admin-eliminar" type="button" data-eliminar-usuario="${usuario.idUsuario}" data-nombre-usuario="${escaparHtml(`${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim())}">Eliminar usuario</button>
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
  mostrarMensajeDisenos("Cargando diseños y escenarios…");

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/disenos`, {
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
  const detalle = document.getElementById("detalleDiseno");

  detalle.hidden = true;
  detalle.replaceChildren();
  lista.replaceChildren(...(disenos.length ? disenos.map((diseno) => {
      const tarjeta = document.createElement("article");
      const escenario = diseno.idEscenario
        ? `Escenario #${diseno.idEscenario} · ${formatearModoEscenario(diseno.modoEscenario)}`
        : "Sin escenario asociado";

      tarjeta.innerHTML = `
        <div>
          <h3>Diseño #${diseno.idDiseno}</h3>
          <p>${escaparHtml(diseno.propietario)} · ${escaparHtml(diseno.correoPropietario ?? "Sin correo")}</p>
          <p>${escaparHtml(escenario)}</p>
        </div>
        <div class="admin-acciones-linea">
          <button class="admin-guardar" type="button" data-ver-diseno="${diseno.idDiseno}">Abrir diseño</button>
          <button class="admin-eliminar" type="button" data-eliminar-diseno="${diseno.idDiseno}">Eliminar</button>
        </div>
      `;

      return tarjeta;
    }) : [crearEstadoVacio("No hay diseños que coincidan con el filtro.")]));
}

function filtrarDisenos() {
  const texto = normalizarTexto(document.getElementById("filtroDisenos").value);
  const disenosFiltrados = disenosDisponibles.filter((diseno) => {
    const contenido = `${diseno.idDiseno} ${diseno.propietario ?? ""} ${diseno.correoPropietario ?? ""} ${diseno.modoEscenario ?? ""}`;
    return !texto || normalizarTexto(contenido).includes(texto);
  });

  renderizarDisenos(disenosFiltrados);
  mostrarMensajeDisenos(disenosDisponibles.length && !disenosFiltrados.length ? "No hay diseños que coincidan con el filtro." : disenosDisponibles.length ? "" : "Todavía no hay diseños ni escenarios creados por jugadores.");
}

function crearFilaVacia(mensaje, cantidadColumnas) {
  const fila = document.createElement("tr");
  fila.innerHTML = `<td colspan="${cantidadColumnas}">${escaparHtml(mensaje)}</td>`;
  return fila;
}

function crearEstadoVacio(mensaje) {
  const estado = document.createElement("p");
  estado.className = "admin-aviso";
  estado.textContent = mensaje;
  return estado;
}

function normalizarTexto(valor) {
  return (valor ?? "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
}

async function eliminarDisenoAdministrador(idDiseno, token) {
  if (!window.confirm(`¿Eliminar definitivamente el diseño #${idDiseno}, sus escenarios, resultados y elementos asociados?`)) return;
  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible eliminar el diseño."));
    mostrarMensajeDisenos("Diseño eliminado correctamente.");
    cargarDisenos(token);
  } catch (error) { mostrarMensajeDisenos(error.message, "error"); }
}

async function cargarDetalleDiseno(idDiseno, token) {
  mostrarMensajeDisenos("Cargando elementos del diseño…");

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!respuesta.ok) {
      throw new Error(await obtenerMensajeError(respuesta, "No fue posible abrir el diseño."));
    }

    renderizarDetalleDiseno(await respuesta.json());
    mostrarMensajeDisenos("");
  } catch (error) {
    mostrarMensajeDisenos(error.message, "error");
  }
}

function renderizarDetalleDiseno(detalle) {
  const contenedor = document.getElementById("detalleDiseno");
  const { diseno, lineas, estaciones, conexiones, tramos, unidadesMetro } = detalle;

  contenedor.hidden = false;
  contenedor.innerHTML = `
    <div class="admin-detalle-encabezado">
      <div>
        <h3>Diseño #${diseno.idDiseno}</h3>
        <p>Jugador: ${escaparHtml(diseno.propietario)} · ${escaparHtml(diseno.correoPropietario ?? "Sin correo")}</p>
      </div>
      <button class="admin-secundario" type="button" data-accion-diseno="cerrar" data-id-diseno="${diseno.idDiseno}">Cerrar detalle</button>
    </div>
    ${crearTablaElementos("Líneas de metro", lineas, (linea) => `
      <tr><td>${escaparHtml(linea.nombre)}</td><td>${linea.modificable ? "Sí" : "No"}</td><td>${botonesAccion("linea", diseno.idDiseno, { nombre: linea.nombre })}</td></tr>`)}
    <button class="admin-guardar" type="button" data-crear-diseno="linea" data-id-diseno="${diseno.idDiseno}">Agregar línea</button>
    ${crearTablaElementos("Estaciones", estaciones, (estacion) => `
      <tr><td>${escaparHtml(estacion.nombre)}</td><td>${estacion.posicionX}, ${estacion.posicionY}${estacion.transbordo ? " · Transbordo" : ""}</td><td>${botonesAccion("estacion", diseno.idDiseno, { nombre: estacion.nombre, x: estacion.posicionX, y: estacion.posicionY, transbordo: estacion.transbordo })}</td></tr>`)}
    <button class="admin-guardar" type="button" data-crear-diseno="estacion" data-id-diseno="${diseno.idDiseno}">Agregar estación</button>
    ${crearTablaElementos("Paradas por línea", conexiones, (conexion) => `
      <tr><td>${escaparHtml(conexion.nombreLinea)}</td><td>${escaparHtml(conexion.nombreEstacion)}</td><td>${botonesAccion("conexion", diseno.idDiseno, { linea: conexion.nombreLinea, estacion: conexion.nombreEstacion })}</td></tr>`)}
    <button class="admin-guardar" type="button" data-crear-diseno="conexion" data-id-diseno="${diseno.idDiseno}">Agregar parada a línea</button>
    ${crearTablaElementos("Tramos entre estaciones", tramos, (tramo) => `
      <tr><td>${escaparHtml(tramo.nombreLinea)}</td><td>${escaparHtml(tramo.estacionA)} · ${escaparHtml(tramo.estacionB)}</td><td>${botonesAccion("tramo", diseno.idDiseno, { linea: tramo.nombreLinea, estacionA: tramo.estacionA, estacionB: tramo.estacionB })}</td></tr>`)}
    <button class="admin-guardar" type="button" data-crear-diseno="tramo" data-id-diseno="${diseno.idDiseno}">Agregar tramo</button>
    ${crearTablaElementos("Unidades de metro", unidadesMetro, (unidad) => `
      <tr><td>${escaparHtml(unidad.nombreLinea)}</td><td>Capacidad: ${unidad.capacidad} · Velocidad: ${unidad.velocidadPromedio}</td><td>${botonesAccion("unidad", diseno.idDiseno, { idTren: unidad.idTren, linea: unidad.nombreLinea, capacidad: unidad.capacidad, velocidad: unidad.velocidadPromedio })}</td></tr>`)}
    <button class="admin-guardar" type="button" data-crear-diseno="unidad" data-id-diseno="${diseno.idDiseno}">Agregar unidad de metro</button>
  `;
}

function crearTablaElementos(titulo, elementos, crearFila) {
  const filas = elementos.length
    ? elementos.map(crearFila).join("")
    : '<tr><td colspan="3">No hay elementos registrados.</td></tr>';

  return `
    <section class="admin-elementos-diseno">
      <h4>${titulo}</h4>
      <div class="admin-tabla-contenedor">
        <table class="admin-tabla admin-tabla-diseno"><tbody>${filas}</tbody></table>
      </div>
    </section>
  `;
}

function botonesAccion(tipo, idDiseno, datos) {
  const atributos = Object.entries(datos)
    .map(([clave, valor]) => `data-${clave}="${escaparHtml(String(valor))}"`)
    .join(" ");

  return `
    <button class="admin-secundario" type="button" data-accion-diseno="editar-${tipo}" data-id-diseno="${idDiseno}" ${atributos}>Modificar</button>
    <button class="admin-eliminar" type="button" data-accion-diseno="eliminar-${tipo}" data-id-diseno="${idDiseno}" ${atributos}>Eliminar</button>
  `;
}

async function ejecutarAccionDiseno(boton, token) {
  const accion = boton.dataset.accionDiseno;

  if (accion === "cerrar") {
    document.getElementById("detalleDiseno").hidden = true;
    return;
  }

  const idDiseno = boton.dataset.idDiseno;
  let url = "";
  let opciones = { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };

  if (accion.includes("linea")) {
    const nombre = accion === "editar-linea" ? window.prompt("Nombre de la línea:", boton.dataset.nombre) : null;
    if (accion === "editar-linea" && !nombre) return;
    if (accion === "eliminar-linea" && !window.confirm(`¿Eliminar la línea ${boton.dataset.nombre}?`)) return;
    url = `${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}/lineas/${encodeURIComponent(boton.dataset.nombre)}`;
    opciones = accion === "editar-linea" ? { ...opciones, body: JSON.stringify({ nombre }) } : { method: "DELETE", headers: { Authorization: `Bearer ${token}` } };
  }

  if (accion.includes("estacion")) {
    if (accion === "eliminar-estacion" && !window.confirm(`¿Eliminar la estación ${boton.dataset.nombre}?`)) return;
    url = `${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}/estaciones/${encodeURIComponent(boton.dataset.nombre)}`;
    if (accion === "editar-estacion") {
      const nombre = window.prompt("Nombre de la estación:", boton.dataset.nombre);
      const posicionX = window.prompt("Posición X:", boton.dataset.x);
      const posicionY = window.prompt("Posición Y:", boton.dataset.y);
      if (!nombre || posicionX === null || posicionY === null) return;
      opciones.body = JSON.stringify({ nombre, posicionX: Number(posicionX), posicionY: Number(posicionY), transbordo: boton.dataset.transbordo === "true" });
    } else {
      opciones = { method: "DELETE", headers: { Authorization: `Bearer ${token}` } };
    }
  }

  if (accion.includes("conexion")) {
    const consulta = new URLSearchParams({ linea: boton.dataset.linea, estacion: boton.dataset.estacion });
    if (accion === "editar-conexion") {
      const nombreLinea = window.prompt("Línea de la conexión:", boton.dataset.linea);
      const nombreEstacion = window.prompt("Estación de la conexión:", boton.dataset.estacion);
      if (!nombreLinea || !nombreEstacion) return;
      consulta.set("lineaActual", boton.dataset.linea);
      consulta.set("estacionActual", boton.dataset.estacion);
      consulta.delete("linea");
      consulta.delete("estacion");
      opciones.body = JSON.stringify({ nombreLinea, nombreEstacion });
    } else if (!window.confirm(`¿Eliminar la conexión ${boton.dataset.linea} · ${boton.dataset.estacion}?`)) {
      return;
    } else {
      opciones = { method: "DELETE", headers: { Authorization: `Bearer ${token}` } };
    }
    url = `${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}/conexiones?${consulta}`;
  }

  if (accion.includes("tramo")) {
    const consulta = new URLSearchParams({ linea: boton.dataset.linea, estacionA: boton.dataset.estacionA, estacionB: boton.dataset.estacionB });
    if (accion === "editar-tramo") {
      const nombreLinea = window.prompt("Línea del tramo:", boton.dataset.linea);
      const estacionA = window.prompt("Estación de origen:", boton.dataset.estacionA);
      const estacionB = window.prompt("Estación de destino:", boton.dataset.estacionB);
      if (!nombreLinea || !estacionA || !estacionB) return;
      consulta.set("lineaActual", boton.dataset.linea);
      consulta.set("estacionAActual", boton.dataset.estacionA);
      consulta.set("estacionBActual", boton.dataset.estacionB);
      consulta.delete("linea");
      consulta.delete("estacionA");
      consulta.delete("estacionB");
      opciones.body = JSON.stringify({ nombreLinea, estacionA, estacionB });
    } else if (!window.confirm(`¿Eliminar el tramo ${boton.dataset.estacionA} · ${boton.dataset.estacionB}?`)) {
      return;
    } else {
      opciones = { method: "DELETE", headers: { Authorization: `Bearer ${token}` } };
    }
    url = `${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}/tramos?${consulta}`;
  }

  if (accion.includes("unidad")) {
    if (accion === "editar-unidad") {
      const nombreLinea = window.prompt("Línea asignada:", boton.dataset.linea);
      const capacidad = window.prompt("Capacidad:", boton.dataset.capacidad);
      const velocidadPromedio = window.prompt("Velocidad promedio:", boton.dataset.velocidad);
      if (!nombreLinea || capacidad === null || velocidadPromedio === null) return;
      opciones.body = JSON.stringify({ nombreLinea, capacidad: Number(capacidad), velocidadPromedio: Number(velocidadPromedio) });
    } else if (!window.confirm("¿Eliminar esta unidad de metro?")) {
      return;
    } else {
      opciones = { method: "DELETE", headers: { Authorization: `Bearer ${token}` } };
    }
    url = `${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}/unidades/${boton.dataset.idTren}`;
  }

  try {
    const respuesta = await fetch(url, opciones);
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible guardar el cambio."));
    mostrarMensajeDisenos("Diseño actualizado correctamente.");
    cargarDetalleDiseno(idDiseno, token);
  } catch (error) {
    mostrarMensajeDisenos(error.message, "error");
  }
}

async function crearElementoDiseno(boton, token) {
  const idDiseno = boton.dataset.idDiseno;
  const tipo = boton.dataset.crearDiseno;
  let cuerpo = null;
  let ruta = "";

  if (tipo === "linea") {
    const nombre = window.prompt("Nombre de la línea:");
    if (!nombre) return;
    cuerpo = { nombre };
    ruta = "lineas";
  }

  if (tipo === "estacion") {
    const nombre = window.prompt("Nombre de la estación:");
    const posicionX = window.prompt("Posición X:", "500");
    const posicionY = window.prompt("Posición Y:", "300");
    if (!nombre || posicionX === null || posicionY === null) return;
    cuerpo = { nombre, posicionX: Number(posicionX), posicionY: Number(posicionY), transbordo: false };
    ruta = "estaciones";
  }

  if (tipo === "conexion") {
    const nombreLinea = window.prompt("Nombre de la línea:");
    const nombreEstacion = window.prompt("Nombre de la estación:");
    if (!nombreLinea || !nombreEstacion) return;
    cuerpo = { nombreLinea, nombreEstacion };
    ruta = "conexiones";
  }

  if (tipo === "tramo") {
    const nombreLinea = window.prompt("Nombre de la línea:");
    const estacionA = window.prompt("Estación de origen:");
    const estacionB = window.prompt("Estación de destino:");
    if (!nombreLinea || !estacionA || !estacionB) return;
    cuerpo = { nombreLinea, estacionA, estacionB };
    ruta = "tramos";
  }

  if (tipo === "unidad") {
    const nombreLinea = window.prompt("Nombre de la línea asignada:");
    const capacidad = window.prompt("Capacidad:", "300");
    const velocidadPromedio = window.prompt("Velocidad promedio:", "40");
    if (!nombreLinea || capacidad === null || velocidadPromedio === null) return;
    cuerpo = { nombreLinea, capacidad: Number(capacidad), velocidadPromedio: Number(velocidadPromedio) };
    ruta = "unidades";
  }

  try {
    const respuesta = await fetch(`${obtenerUrlServidor()}/api/admin/disenos/${idDiseno}/${ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible crear el elemento."));
    mostrarMensajeDisenos("Elemento creado correctamente.");
    cargarDetalleDiseno(idDiseno, token);
  } catch (error) {
    mostrarMensajeDisenos(error.message, "error");
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
  lista.replaceChildren(...configuraciones.map((configuracion) => {
    const elemento = document.createElement("article");
    elemento.className = "admin-configuracion-item";
    elemento.innerHTML = `
      <div><h3>${escaparHtml(formatearClave(configuracion.clave))}</h3><p>${escaparHtml(configuracion.descripcion)}</p></div>
      <input id="configuracion-${escaparHtml(configuracion.clave)}" value="${escaparHtml(configuracion.valor)}" aria-label="Valor de ${escaparHtml(configuracion.descripcion)}" />
      <button class="admin-guardar" type="button" data-guardar-configuracion="${escaparHtml(configuracion.clave)}">Guardar</button>
    `;
    return elemento;
  }));
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
    mostrarMensajeConfiguracion("Configuración actualizada correctamente.");
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

    renderizarActividad(await respuesta.json());
  } catch (error) {
    mostrarMensajeActividad(error.message, "error");
  }
}

function renderizarActividad(actividades) {
  const tabla = document.getElementById("tablaActividad");
  tabla.replaceChildren(...(actividades.length ? actividades.map((actividad) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${escaparHtml(formatearFecha(actividad.fecha))}</td>
      <td>${escaparHtml(actividad.administrador)}</td>
      <td>${escaparHtml(actividad.accion)}</td>
      <td>${escaparHtml(actividad.detalle)}</td>
    `;
    return fila;
  }) : [crearFilaVacia("Todavía no hay actividad registrada.", 4)]));
  mostrarMensajeActividad(actividades.length ? "" : "Todavía no hay actividad registrada.");
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
  return modo === "NIVEL" ? "Nivel" : modo === "EDICION_LIBRE" ? "Edición libre" : "Escenario";
}

async function eliminarUsuario(idUsuario, nombreUsuario, token) {
  if (!window.confirm(`¿Eliminar definitivamente a ${nombreUsuario || "este usuario"}? Esta acción no se puede deshacer.`)) {
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

    mostrarMensaje("Usuario eliminado correctamente.");
    cargarUsuarios(token);
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

    mostrarMensaje("Rol actualizado correctamente.");
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
    formulario.reportValidity();
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
    mostrarMensaje("Datos del usuario actualizados correctamente.");
    cargarUsuarios(token);
  } catch (error) {
    mostrarMensaje(error.message, "error");
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

    sesionAdministrador.usuario = usuarioActualizado;
    localStorage.setItem("sesionAdministrador", JSON.stringify(sesionAdministrador));
    actualizarEtiquetaAdministrador(usuarioActualizado);
  } catch {
    // La actualización del usuario se conserva aunque no pueda leerse la sesión local.
  }
}

function actualizarEtiquetaAdministrador(administrador) {
  const identificador = administrador.identificadorAdministrador || administrador.nombre;
  document.getElementById("nombreAdministrador").textContent = `Administrador: ${identificador}`;
}

async function cerrarSesion(token) {
  if (!window.confirm("¿Querés cerrar la sesión de administración?")) {
    return;
  }

  try {
    await fetch(`${obtenerUrlServidor()}/auth/logout/admin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } finally {
    cerrarSesionLocal();
  }
}

function cerrarSesionLocal() {
  localStorage.removeItem("usuario");
  localStorage.removeItem("sesionAdministrador");
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
  const contenedor = document.createElement("span");
  contenedor.textContent = valor ?? "";
  return contenedor.innerHTML;
}
