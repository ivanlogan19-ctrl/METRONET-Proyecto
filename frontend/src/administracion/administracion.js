const sesion = obtenerSesionAdministrador();

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
  document.getElementById("nombreAdministrador").textContent =
    sesionAdministrador.usuario.nombre;

  document.querySelectorAll(".admin-enlace").forEach((boton) => {
    boton.addEventListener("click", () => {
      mostrarVista(boton.dataset.vista);

      if (boton.dataset.vista === "disenos") {
        cargarDisenos(sesionAdministrador.token);
      }
    });
  });

  document.getElementById("cerrarSesion").addEventListener("click", () => {
    cerrarSesion(sesionAdministrador.token);
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
        editarUsuario(botonEditar, sesionAdministrador.token);
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

    if (boton) {
      cargarDetalleDiseno(boton.dataset.verDiseno, sesionAdministrador.token);
    }
  });

  document.getElementById("detalleDiseno").addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-accion-diseno]");

    if (boton) {
      ejecutarAccionDiseno(boton, sesionAdministrador.token);
    }
  });

  cargarUsuarios(sesionAdministrador.token);
}

function mostrarVista(nombreVista) {
  const titulos = {
    usuarios: "Gestión de usuarios",
    disenos: "Supervisión de diseños y escenarios",
    configuracion: "Configuración general",
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

    const usuarios = await respuesta.json();
    renderizarUsuarios(usuarios);
    mostrarMensaje(
      usuarios.length ? "" : "Todavía no hay usuarios registrados.",
    );
  } catch (error) {
    mostrarMensaje(error.message, "error");

    if (error.message.includes("sesión")) {
      cerrarSesionLocal();
    }
  }
}

function renderizarUsuarios(usuarios) {
  const tablaUsuarios = document.getElementById("tablaUsuarios");

  tablaUsuarios.replaceChildren(
    ...usuarios.map((usuario) => {
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
          <button class="admin-secundario" type="button" data-editar-usuario="${usuario.idUsuario}" data-nombre="${escaparHtml(usuario.nombre)}" data-apellido="${escaparHtml(usuario.apellido ?? "")}" data-email="${escaparHtml(usuario.email)}">Editar datos</button>
          <button class="admin-eliminar" type="button" data-eliminar-usuario="${usuario.idUsuario}" data-nombre-usuario="${escaparHtml(`${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim())}">Eliminar usuario</button>
        </td>
      `;

      return fila;
    }),
  );
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

    const disenos = await respuesta.json();
    renderizarDisenos(disenos);
    mostrarMensajeDisenos(disenos.length ? "" : "Todavía no hay diseños ni escenarios creados por jugadores.");
  } catch (error) {
    mostrarMensajeDisenos(error.message, "error");
  }
}

function renderizarDisenos(disenos) {
  const lista = document.getElementById("listaDisenos");
  const detalle = document.getElementById("detalleDiseno");

  detalle.hidden = true;
  detalle.replaceChildren();
  lista.replaceChildren(
    ...disenos.map((diseno) => {
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
        <button class="admin-guardar" type="button" data-ver-diseno="${diseno.idDiseno}">Abrir diseño</button>
      `;

      return tarjeta;
    }),
  );
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
  const { diseno, lineas, estaciones, conexiones } = detalle;

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
    ${crearTablaElementos("Estaciones", estaciones, (estacion) => `
      <tr><td>${escaparHtml(estacion.nombre)}</td><td>${estacion.posicionX}, ${estacion.posicionY}${estacion.transbordo ? " · Transbordo" : ""}</td><td>${botonesAccion("estacion", diseno.idDiseno, { nombre: estacion.nombre, x: estacion.posicionX, y: estacion.posicionY, transbordo: estacion.transbordo })}</td></tr>`)}
    ${crearTablaElementos("Conexiones", conexiones, (conexion) => `
      <tr><td>${escaparHtml(conexion.nombreLinea)}</td><td>${escaparHtml(conexion.nombreEstacion)}</td><td>${botonesAccion("conexion", diseno.idDiseno, { linea: conexion.nombreLinea, estacion: conexion.nombreEstacion })}</td></tr>`)}
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

  try {
    const respuesta = await fetch(url, opciones);
    if (!respuesta.ok) throw new Error(await obtenerMensajeError(respuesta, "No fue posible guardar el cambio."));
    mostrarMensajeDisenos("Diseño actualizado correctamente.");
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

async function editarUsuario(boton, token) {
  const nombre = window.prompt("Nombre:", boton.dataset.nombre);
  if (nombre === null) return;
  const apellido = window.prompt("Apellido:", boton.dataset.apellido);
  if (apellido === null) return;
  const email = window.prompt("Correo electrónico:", boton.dataset.email);
  if (email === null) return;

  try {
    const respuesta = await fetch(
      `${obtenerUrlServidor()}/api/admin/usuarios/${boton.dataset.editarUsuario}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nombre, apellido, email }),
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

    mostrarMensaje("Datos del usuario actualizados correctamente.");
    cargarUsuarios(token);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function cerrarSesion(token) {
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
