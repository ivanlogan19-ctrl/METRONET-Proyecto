const sesion = obtenerSesion();
const lienzo = document.getElementById("lienzoSimulacion");
const espacioSvg = "http://www.w3.org/2000/svg";
let simulacionActual = null;
let modo = "normal";
let estacionesSeleccionadas = [];
let animaciones = [];

if (!sesion) {
  window.location.replace("/login.html");
} else {
  inicializar();
}

function obtenerSesion() {
  try {
    const sesionJugador = JSON.parse(localStorage.getItem("sesionUsuario"));
    if (sesionJugador?.token && sesionJugador?.usuario?.rol === "JUGADOR") return sesionJugador;

    const sesionAdministrador = JSON.parse(localStorage.getItem("sesionAdministrador"));
    if (sesionAdministrador?.token && sesionAdministrador?.usuario?.rol === "ADMIN") return sesionAdministrador;
  } catch {
    // La sesión inválida se elimina antes de volver al acceso.
  }

  localStorage.removeItem("sesionUsuario");
  localStorage.removeItem("sesionAdministrador");
  return null;
}

function inicializar() {
  document.getElementById("formularioNuevaSimulacion").addEventListener("submit", crearSimulacion);
  document.getElementById("formularioEscenario").addEventListener("submit", crearEscenario);
  document.getElementById("formularioUnidadMetro").addEventListener("submit", incorporarUnidadMetro);
  document.getElementById("formularioEjecucion").addEventListener("submit", ejecutarSimulacion);
  document.getElementById("actualizarEscenario").addEventListener("click", actualizarEscenario);
  document.getElementById("eliminarDiseno").addEventListener("click", eliminarDiseno);
  document.getElementById("listaSimulaciones").addEventListener("click", abrirSimulacionDesdeLista);
  document.getElementById("crearEstacion").addEventListener("click", activarUbicacionEstacion);
  document.getElementById("crearLinea").addEventListener("click", guardarLinea);
  document.getElementById("guardarDiseno").addEventListener("click", guardarDiseno);
  document.getElementById("validarDiseno").addEventListener("click", validarDiseno);
  document.querySelector(".simulacion-gestion").addEventListener("click", gestionarElementoRed);
  document.getElementById("listaUnidadesMetro").addEventListener("click", gestionarUnidadMetro);
  lienzo.addEventListener("click", ubicarEstacion);
  cargarSimulaciones();
}

function urlApi(ruta = "") {
  return `${window.location.protocol}//${window.location.hostname}:8080/api/simulaciones${ruta}`;
}

function opcionesAutorizadas(opciones = {}) {
  return {
    ...opciones,
    headers: { Authorization: `Bearer ${sesion.token}`, ...(opciones.headers ?? {}) },
  };
}

async function crearSimulacion(evento) {
  evento.preventDefault();
  const campo = document.getElementById("nombreSimulacion");
  const nombre = campo.value.trim();
  if (!nombre) return mostrarMensaje("Ingresá un nombre para la simulación.", "error");

  try {
    const respuesta = await fetch(urlApi(), opcionesAutorizadas({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible crear la simulación."));
    campo.value = "";
    mostrarMensaje("Simulación creada. Ya podés diseñar tu red.");
    await cargarSimulaciones(await respuesta.json());
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function cargarSimulaciones(simulacionParaAbrir) {
  try {
    const respuesta = await fetch(urlApi(), opcionesAutorizadas());
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible cargar las simulaciones."));
    const simulaciones = await respuesta.json();
    renderizarLista(simulaciones);
    const idGuardado = Number(localStorage.getItem("simulacionActual"));
    const seleccionada = simulacionParaAbrir ?? simulaciones.find((item) => item.idDiseno === idGuardado) ?? simulaciones[0];
    if (seleccionada) await abrirSimulacion(seleccionada.idDiseno);
    else mostrarEstadoVacio();
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

function mostrarEstadoVacio() {
  simulacionActual = null;
  detenerAnimaciones();
  localStorage.removeItem("simulacionActual");
  document.getElementById("editorSimulacion").hidden = true;
  document.getElementById("estadoVacio").hidden = false;
  document.getElementById("tituloSimulacion").textContent = "Elegí o creá una simulación";
  document.querySelector(".simulacion-etiqueta").textContent = "Diseño de red";
  document.getElementById("estadoSimulacion").textContent = "";
}

function renderizarLista(simulaciones) {
  const lista = document.getElementById("listaSimulaciones");
  lista.replaceChildren(...simulaciones.map((simulacion) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "simulacion-tarjeta";
    boton.dataset.idDiseno = simulacion.idDiseno;
    boton.innerHTML = `${escapar(simulacion.nombre)}<span>${formatearModo(simulacion.modo)} · ${formatearEstado(simulacion.estado)}</span>`;
    return boton;
  }));
}

async function abrirSimulacionDesdeLista(evento) {
  const boton = evento.target.closest("[data-id-diseno]");
  if (boton) await abrirSimulacion(Number(boton.dataset.idDiseno));
}

async function abrirSimulacion(idDiseno) {
  try {
    const respuesta = await fetch(urlApi(`/${idDiseno}`), opcionesAutorizadas());
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible abrir la simulación."));
    simulacionActual = await respuesta.json();
    modo = "normal";
    estacionesSeleccionadas = [];
    localStorage.setItem("simulacionActual", String(idDiseno));
    document.getElementById("editorSimulacion").hidden = false;
    document.getElementById("estadoVacio").hidden = true;
    document.getElementById("tituloSimulacion").textContent = simulacionActual.simulacion.nombre;
    document.querySelector(".simulacion-etiqueta").textContent = `${formatearModo(simulacionActual.simulacion.modo)} · ${simulacionActual.simulacion.dificultad}`;
    document.getElementById("estadoSimulacion").textContent = formatearEstado(simulacionActual.simulacion.estado);
    document.querySelectorAll(".simulacion-tarjeta").forEach((boton) => {
      boton.classList.toggle("activa", Number(boton.dataset.idDiseno) === idDiseno);
    });
    actualizarAccionLinea();
    actualizarAyuda();
    dibujarRed();
    renderizarGestionRed();
    renderizarAprendizaje();
    renderizarOperacion();
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function crearEscenario(evento) {
  evento.preventDefault();
  if (!simulacionActual) return mostrarMensaje("Primero seleccioná el diseño que será la base del escenario.", "error");
  const nombre = document.getElementById("nombreEscenario").value.trim();
  if (!nombre) return mostrarMensaje("Ingresá un nombre para el escenario.", "error");
  const datos = {
    nombre,
    modo: document.getElementById("modoEscenario").value,
    dificultad: document.getElementById("dificultadEscenario").value,
    objetivo: document.getElementById("objetivoEscenario").value.trim(),
    instrucciones: document.getElementById("instruccionesEscenario").value.trim(),
  };
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/escenarios`), opcionesAutorizadas({
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible crear el escenario."));
    document.getElementById("formularioEscenario").reset();
    mostrarMensaje("Escenario creado. Podés practicar sin modificar el diseño original.");
    await cargarSimulaciones(await respuesta.json());
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function actualizarEscenario() {
  if (!simulacionActual) return mostrarMensaje("Elegí un escenario para actualizar.", "error");
  const escenario = simulacionActual.simulacion;
  const nombre = window.prompt("Nombre del escenario:", escenario.nombre);
  if (nombre === null) return;
  const dificultad = window.prompt("Dificultad: Inicial, Intermedio o Avanzado:", escenario.dificultad);
  if (dificultad === null) return;
  const objetivo = window.prompt("Objetivo de aprendizaje:", escenario.objetivo ?? "");
  if (objetivo === null) return;
  const instrucciones = window.prompt("Instrucciones para el usuario:", escenario.instrucciones ?? "");
  if (instrucciones === null) return;
  try {
    const respuesta = await fetch(urlApi(`/${escenario.idDiseno}/escenario`), opcionesAutorizadas({
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim(), dificultad: dificultad.trim(), objetivo: objetivo.trim(), instrucciones: instrucciones.trim() }),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible actualizar el escenario."));
    mostrarMensaje("Escenario actualizado correctamente.");
    await cargarSimulaciones(await respuesta.json());
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function eliminarDiseno() {
  if (!simulacionActual || !window.confirm(`¿Eliminar definitivamente «${simulacionActual.simulacion.nombre}»? Se eliminarán sus elementos y resultados.`)) return;
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}`), opcionesAutorizadas({ method: "DELETE" }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible eliminar el diseño."));
    mostrarMensaje("Diseño eliminado correctamente.");
    await cargarSimulaciones();
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

function activarUbicacionEstacion() {
  if (!simulacionActual) return;
  const nombre = document.getElementById("nombreEstacion").value.trim();
  if (!nombre) return mostrarMensaje("Ingresá el nombre de la estación antes de ubicarla.", "error");
  modo = "crearEstacion";
  estacionesSeleccionadas = [];
  actualizarAccionLinea();
  actualizarAyuda();
}

async function ubicarEstacion(evento) {
  if (modo !== "crearEstacion" || !simulacionActual || !evento.target.classList.contains("simulacion-plano-fondo")) return;
  const rectangulo = lienzo.getBoundingClientRect();
  const posicionX = Math.round(((evento.clientX - rectangulo.left) / rectangulo.width) * 1000);
  const posicionY = Math.round(((evento.clientY - rectangulo.top) / rectangulo.height) * 620);
  const nombre = document.getElementById("nombreEstacion").value.trim();

  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/estaciones`), opcionesAutorizadas({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, posicionX, posicionY }),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible crear la estación."));
    document.getElementById("nombreEstacion").value = "";
    modo = "normal";
    mostrarMensaje(`Estación «${nombre}» creada.`);
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

function seleccionarEstacion(nombre) {
  if (modo !== "crearLinea") return;
  estacionesSeleccionadas = estacionesSeleccionadas.includes(nombre)
    ? estacionesSeleccionadas.filter((estacion) => estacion !== nombre)
    : [...estacionesSeleccionadas, nombre];
  actualizarAyuda();
  dibujarRed();
}

async function guardarLinea() {
  if (!simulacionActual) return;
  const nombre = document.getElementById("nombreLinea").value.trim();
  if (!nombre) return mostrarMensaje("Ingresá un nombre para la línea.", "error");

  if (modo !== "crearLinea") {
    modo = "crearLinea";
    estacionesSeleccionadas = [];
    actualizarAccionLinea();
    actualizarAyuda();
    dibujarRed();
    return;
  }

  if (estacionesSeleccionadas.length < 2) return mostrarMensaje("Seleccioná al menos dos estaciones para la línea.", "error");

  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/lineas`), opcionesAutorizadas({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, estaciones: estacionesSeleccionadas }),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible guardar la línea."));
    document.getElementById("nombreLinea").value = "";
    modo = "normal";
    estacionesSeleccionadas = [];
    actualizarAccionLinea();
    mostrarMensaje(`Línea «${nombre}» creada.`);
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

function actualizarAyuda() {
  const ayuda = document.getElementById("ayudaEditor");
  if (modo === "crearEstacion") ayuda.textContent = "Hacé clic en el plano para ubicar la estación indicada.";
  else if (modo === "crearLinea") ayuda.textContent = `Seleccioná al menos dos estaciones (${estacionesSeleccionadas.length} elegidas) y elegí «Guardar línea».`;
  else ayuda.textContent = "Ingresá el nombre de una estación y elegí «Ubicar estación». Para una línea, ingresá su nombre y elegí «Iniciar línea».";
}

function actualizarAccionLinea() {
  const boton = document.getElementById("crearLinea");

  if (boton) {
    boton.textContent = modo === "crearLinea" ? "Guardar línea" : "Iniciar línea";
  }
}

function dibujarRed() {
  detenerAnimaciones();
  lienzo.replaceChildren(crearElemento("rect", { class: "simulacion-plano-fondo", x: 0, y: 0, width: 1000, height: 620 }));
  const estaciones = new Map(simulacionActual.estaciones.map((estacion) => [estacion.nombre, estacion]));
  simulacionActual.tramos.forEach((tramo, indice) => {
    const origen = estaciones.get(tramo.estacionA);
    const destino = estaciones.get(tramo.estacionB);
    if (!origen || !destino) return;
    lienzo.append(crearElemento("line", {
      class: "simulacion-tramo", x1: origen.posicionX, y1: origen.posicionY, x2: destino.posicionX, y2: destino.posicionY,
      stroke: colorLinea(tramo.nombreLinea, indice),
    }));
  });
  simulacionActual.estaciones.forEach((estacion) => {
    const circulo = crearElemento("circle", {
      class: `simulacion-estacion${estacion.transbordo ? " transbordo" : ""}${estacionesSeleccionadas.includes(estacion.nombre) ? " seleccionada" : ""}`,
      cx: estacion.posicionX, cy: estacion.posicionY, r: 14,
    });
    circulo.addEventListener("click", (evento) => { evento.stopPropagation(); seleccionarEstacion(estacion.nombre); });
    lienzo.append(circulo);
    const etiqueta = crearElemento("text", { class: "simulacion-etiqueta-estacion", x: Number(estacion.posicionX) + 20, y: Number(estacion.posicionY) + 7 });
    etiqueta.textContent = estacion.nombre;
    lienzo.append(etiqueta);
    if (estacion.transbordo) {
      const marcaTransbordo = crearElemento("text", { class: "simulacion-marca-transbordo", x: estacion.posicionX, y: Number(estacion.posicionY) + 5 });
      marcaTransbordo.textContent = "T";
      lienzo.append(marcaTransbordo);
    }
  });
}

function renderizarOperacion() {
  const selectorLinea = document.getElementById("lineaUnidadMetro");
  selectorLinea.replaceChildren(...simulacionActual.lineas.map((linea) => {
    const opcion = document.createElement("option");
    opcion.value = linea.nombre;
    opcion.textContent = linea.nombre;
    return opcion;
  }));
  selectorLinea.disabled = !simulacionActual.lineas.length;
  document.querySelector("#formularioUnidadMetro button").disabled = !simulacionActual.lineas.length;
  const unidades = document.getElementById("listaUnidadesMetro");
  unidades.replaceChildren(...simulacionActual.unidadesMetro.map((unidad) => {
    const elemento = document.createElement("article");
    elemento.className = "simulacion-elemento";
    elemento.innerHTML = `<div><strong>${escapar(unidad.nombreLinea)}</strong><span>Capacidad: ${unidad.capacidad} · Velocidad: ${unidad.velocidadPromedio}</span></div><div class="simulacion-acciones-elemento"><button type="button" class="simulacion-accion-editar" data-editar-unidad="${unidad.idTren}">Editar</button><button type="button" class="simulacion-accion-eliminar" data-eliminar-unidad="${unidad.idTren}">Eliminar</button></div>`;
    return elemento;
  }));
  if (!simulacionActual.unidadesMetro.length) unidades.textContent = "Todavía no hay unidades asignadas.";

  const resultados = document.getElementById("listaResultadosSimulacion");
  resultados.replaceChildren(...simulacionActual.resultados.map((resultado) => {
    const elemento = document.createElement("article");
    elemento.className = "simulacion-resultado";
    elemento.innerHTML = `<strong>${escapar(resultado.estado)} · ${resultado.puntaje} puntos</strong><span>${resultado.duracion}s · velocidad ${resultado.velocidad}</span><p>${escapar(resultado.comentarios)}</p>`;
    return elemento;
  }));
  if (!simulacionActual.resultados.length) resultados.textContent = "Aún no se registraron ejecuciones.";
  document.getElementById("estadoEjecucion").textContent = estadoEjecucion();
}

function estadoEjecucion() {
  if (!["VALIDADO", "COMPLETADA"].includes(simulacionActual.simulacion.estado)) return "Validá la red antes de ejecutar una simulación.";
  if (!simulacionActual.unidadesMetro.length) return "La red está validada. Incorporá una unidad de metro para iniciar.";
  return "La red está lista: podés ejecutar la simulación con los parámetros seleccionados.";
}

async function incorporarUnidadMetro(evento) {
  evento.preventDefault();
  if (!simulacionActual) return;
  const datos = {
    nombreLinea: document.getElementById("lineaUnidadMetro").value,
    capacidad: Number(document.getElementById("capacidadUnidadMetro").value),
    velocidadPromedio: Number(document.getElementById("velocidadUnidadMetro").value),
  };
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/unidades`), opcionesAutorizadas({
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible incorporar la unidad."));
    mostrarMensaje("Unidad de metro incorporada. Validá la red nuevamente antes de ejecutar.");
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function gestionarUnidadMetro(evento) {
  const editar = evento.target.closest("[data-editar-unidad]");
  if (editar) return editarUnidadMetro(Number(editar.dataset.editarUnidad));
  const boton = evento.target.closest("[data-eliminar-unidad]");
  if (!boton || !window.confirm("¿Eliminar esta unidad de metro?")) return;
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/unidades/${boton.dataset.eliminarUnidad}`), opcionesAutorizadas({ method: "DELETE" }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible eliminar la unidad."));
    mostrarMensaje("Unidad eliminada. Validá la red nuevamente antes de ejecutar.");
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function editarUnidadMetro(idTren) {
  const unidad = simulacionActual.unidadesMetro.find((item) => item.idTren === idTren);
  if (!unidad) return;
  const nombreLinea = window.prompt("Línea asignada:", unidad.nombreLinea);
  if (nombreLinea === null) return;
  const capacidad = window.prompt("Capacidad:", unidad.capacidad);
  if (capacidad === null) return;
  const velocidadPromedio = window.prompt("Velocidad promedio:", unidad.velocidadPromedio);
  if (velocidadPromedio === null) return;
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/unidades/${idTren}`), opcionesAutorizadas({
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombreLinea: nombreLinea.trim(), capacidad: Number(capacidad), velocidadPromedio: Number(velocidadPromedio) }),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible actualizar la unidad."));
    mostrarMensaje("Unidad actualizada. Validá la red nuevamente antes de ejecutar.");
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function ejecutarSimulacion(evento) {
  evento.preventDefault();
  if (!simulacionActual) return;
  const datos = {
    velocidad: Number(document.getElementById("velocidadSimulacion").value),
    duracion: Number(document.getElementById("duracionSimulacion").value),
  };
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/ejecutar`), opcionesAutorizadas({
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible ejecutar la simulación."));
    const resultado = await respuesta.json();
    mostrarMensaje(`Simulación completada: ${resultado.puntaje} puntos.`);
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
    animarUnidades(datos.velocidad, datos.duracion);
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

function animarUnidades(velocidad, duracion) {
  detenerAnimaciones();
  const estaciones = new Map(simulacionActual.estaciones.map((estacion) => [estacion.nombre, estacion]));
  const rutas = new Map();
  simulacionActual.tramos.forEach((tramo) => {
    const origen = estaciones.get(tramo.estacionA);
    const destino = estaciones.get(tramo.estacionB);
    if (!origen || !destino) return;
    rutas.set(tramo.nombreLinea, [...(rutas.get(tramo.nombreLinea) ?? []), [origen, destino]]);
  });
  const duracionVisual = Math.max(2600, Math.min(9000, (duracion * 120) / Math.max(velocidad, .5)));
  simulacionActual.unidadesMetro.forEach((unidad, indice) => {
    const ruta = rutas.get(unidad.nombreLinea);
    if (!ruta?.length) return;
    const tren = crearElemento("circle", { class: "simulacion-tren", r: 10, fill: colorLinea(unidad.nombreLinea, indice) });
    lienzo.append(tren);
    const inicio = performance.now() + indice * 260;
    const mover = (ahora) => {
      const progreso = ((ahora - inicio) / duracionVisual) % 1;
      const tramo = ruta[Math.min(ruta.length - 1, Math.floor(progreso * ruta.length))];
      const avance = (progreso * ruta.length) % 1;
      tren.setAttribute("cx", String(Number(tramo[0].posicionX) + (Number(tramo[1].posicionX) - Number(tramo[0].posicionX)) * avance));
      tren.setAttribute("cy", String(Number(tramo[0].posicionY) + (Number(tramo[1].posicionY) - Number(tramo[0].posicionY)) * avance));
      animaciones[indice] = requestAnimationFrame(mover);
    };
    animaciones[indice] = requestAnimationFrame(mover);
  });
}

function detenerAnimaciones() {
  animaciones.forEach((id) => cancelAnimationFrame(id));
  animaciones = [];
}

function renderizarGestionRed() {
  const estaciones = document.getElementById("listaEstacionesDiseno");
  const lineas = document.getElementById("listaLineasDiseno");
  estaciones.replaceChildren(...simulacionActual.estaciones.map((estacion) => crearElementoGestion(
    estacion.nombre,
    estacion.transbordo ? "Transbordo" : "Estación",
    "estacion"
  )));
  lineas.replaceChildren(...simulacionActual.lineas.map((linea) => crearElementoGestion(linea.nombre, "Línea", "linea")));
}

function renderizarAprendizaje() {
  const { simulacion, estaciones, lineas, tramos } = simulacionActual;
  const transbordos = estaciones.filter((estacion) => estacion.transbordo).length;
  document.getElementById("guiaEscenario").textContent = simulacion.instrucciones || guiaPredeterminada(simulacion);
  document.getElementById("informacionRed").textContent = `${estaciones.length} estaciones · ${lineas.length} líneas · ${tramos.length} conexiones · ${transbordos} transbordos. Objetivo: ${simulacion.objetivo || "Explorar el funcionamiento de la red."}`;
  document.getElementById("retroalimentacionEscenario").textContent = recomendacionAprendizaje();
}

function guiaPredeterminada(simulacion) {
  if (simulacion.modo === "NIVEL") return `Nivel ${simulacion.dificultad}: seguí el objetivo y validá la red al finalizar.`;
  return "Edición libre: probá alternativas y corregí los elementos que necesites. El diseño original se conserva.";
}

function recomendacionAprendizaje() {
  const { estaciones, lineas, tramos } = simulacionActual;
  if (estaciones.length < 2) return "Empezá ubicando al menos dos estaciones: una red necesita puntos de origen y destino.";
  if (!lineas.length) return "Buen comienzo. Ahora creá una línea y elegí las estaciones en el orden del recorrido.";
  if (!tramos.length) return "Definí conexiones entre las estaciones de cada línea para representar el recorrido.";
  if (!estaciones.some((estacion) => estacion.transbordo) && lineas.length > 1) return "Considerá marcar una estación de transbordo si dos líneas se conectan en ella.";
  return "La red tiene una estructura inicial. Validala para revisar consistencia y detectar oportunidades de mejora.";
}

function crearElementoGestion(nombre, detalle, tipo) {
  const elemento = document.createElement("article");
  elemento.className = "simulacion-elemento";
  elemento.innerHTML = `<div><strong>${escapar(nombre)}</strong><span>${detalle}</span></div><div class="simulacion-acciones-elemento"><button type="button" class="simulacion-accion-editar" data-accion="editar-${tipo}" data-nombre="${escapar(nombre)}">Editar</button><button type="button" class="simulacion-accion-eliminar" data-accion="eliminar-${tipo}" data-nombre="${escapar(nombre)}">Eliminar</button></div>`;
  return elemento;
}

async function gestionarElementoRed(evento) {
  const boton = evento.target.closest("[data-accion]");
  if (!boton || !simulacionActual) return;
  const { accion, nombre } = boton.dataset;
  if (accion === "editar-estacion") await editarEstacion(nombre);
  if (accion === "eliminar-estacion") await eliminarEstacion(nombre);
  if (accion === "editar-linea") await editarLinea(nombre);
  if (accion === "eliminar-linea") await eliminarLinea(nombre);
}

async function editarEstacion(nombreActual) {
  const estacion = simulacionActual.estaciones.find((item) => item.nombre === nombreActual);
  if (!estacion) return;
  const nombre = window.prompt("Nombre de la estación:", estacion.nombre);
  if (nombre === null) return;
  const posicionX = window.prompt("Posición horizontal (0 a 1000):", estacion.posicionX);
  if (posicionX === null) return;
  const posicionY = window.prompt("Posición vertical (0 a 620):", estacion.posicionY);
  if (posicionY === null) return;
  const transbordo = window.confirm("¿Esta estación permite transbordo entre líneas?");
  await actualizarRed(`/estaciones/${encodeURIComponent(nombreActual)}`, { nombre: nombre.trim(), posicionX: Number(posicionX), posicionY: Number(posicionY), transbordo }, "Estación actualizada.");
}

async function eliminarEstacion(nombre) {
  if (!window.confirm(`¿Eliminar la estación «${nombre}»? También se eliminarán sus conexiones.`)) return;
  await eliminarRed(`/estaciones/${encodeURIComponent(nombre)}`, "Estación eliminada.");
}

async function editarLinea(nombreActual) {
  const nombre = window.prompt("Nombre de la línea:", nombreActual);
  if (nombre === null) return;
  const estacionesActuales = obtenerEstacionesLinea(nombreActual);
  const textoEstaciones = window.prompt(
    "Estaciones de la línea en orden, separadas por coma:",
    estacionesActuales.join(", ")
  );
  if (textoEstaciones === null) return;
  const estaciones = textoEstaciones.split(",").map((estacion) => estacion.trim()).filter(Boolean);
  await actualizarRed(`/lineas/${encodeURIComponent(nombreActual)}`, { nombre: nombre.trim(), estaciones }, "Línea actualizada.");
}

function obtenerEstacionesLinea(nombreLinea) {
  const tramos = simulacionActual.tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
  if (!tramos.length) return [];
  return [...new Set([...tramos.map((tramo) => tramo.estacionA), tramos.at(-1).estacionB])];
}

async function eliminarLinea(nombre) {
  if (!window.confirm(`¿Eliminar la línea «${nombre}»? También se eliminarán sus conexiones.`)) return;
  await eliminarRed(`/lineas/${encodeURIComponent(nombre)}`, "Línea eliminada.");
}

async function actualizarRed(ruta, datos, mensaje) {
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}${ruta}`), opcionesAutorizadas({
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
    }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible actualizar el elemento."));
    mostrarMensaje(mensaje);
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function eliminarRed(ruta, mensaje) {
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}${ruta}`), opcionesAutorizadas({ method: "DELETE" }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible eliminar el elemento."));
    mostrarMensaje(mensaje);
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function validarDiseno() {
  if (!simulacionActual) return;
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/validacion`), opcionesAutorizadas());
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible validar la red."));
    const validacion = await respuesta.json();
    if (validacion.valido) {
      mostrarMensaje("La red es consistente y quedó validada para utilizarse.");
      await abrirSimulacion(simulacionActual.simulacion.idDiseno);
    } else mostrarMensaje(validacion.observaciones.join(" "), "error");
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

async function guardarDiseno() {
  if (!simulacionActual) return;
  try {
    const respuesta = await fetch(urlApi(`/${simulacionActual.simulacion.idDiseno}/guardar`), opcionesAutorizadas({ method: "POST" }));
    if (!respuesta.ok) throw new Error(await mensajeError(respuesta, "No fue posible guardar el diseño."));
    mostrarMensaje("Diseño guardado correctamente.");
    await abrirSimulacion(simulacionActual.simulacion.idDiseno);
  } catch (error) { mostrarMensaje(error.message, "error"); }
}

function crearElemento(nombre, atributos) {
  const elemento = document.createElementNS(espacioSvg, nombre);
  Object.entries(atributos).forEach(([clave, valor]) => elemento.setAttribute(clave, String(valor)));
  return elemento;
}

function colorLinea(nombre, indice) {
  const colores = ["#55c3e7", "#f3ca62", "#9ed49c", "#d7a9f4", "#ff9e92"];
  return colores[(nombre.length + indice) % colores.length];
}

function formatearEstado(estado) {
  if (estado === "EN_DISENO") return "En diseño";
  if (estado === "GUARDADO") return "Guardado";
  if (estado === "VALIDADO") return "Red validada";
  if (estado === "COMPLETADA") return "Simulación completada";
  return estado ?? "Sin estado";
}

function formatearModo(modo) { return modo === "NIVEL" ? "Nivel" : "Edición libre"; }

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[caracter]);
}

async function mensajeError(respuesta, predeterminado) {
  try {
    const datos = await respuesta.json();
    return datos.detail ?? datos.message ?? predeterminado;
  } catch {
    return predeterminado;
  }
}

function mostrarMensaje(texto, tipo = "") {
  const mensaje = document.getElementById("mensajeSimulacion");
  mensaje.textContent = texto;
  mensaje.className = `simulacion-mensaje ${tipo}`;
}
