import Phaser from "phaser";

let modoActual = "normal";
let nombreEstacionPendiente = "";
let estacionSeleccionada = null;
let estacionesCargadas = [];

let nombreLineaPendiente = "";
let tramosLineaPendiente = [];
let estacionTramoPendiente = null;
let estacionesLineaPendiente = [];
let lineaSeleccionada = null;
let dibujosTramosPendientes = [];

let tramosGuardados = [];
let dibujosLineasGuardadas = [];

const idDisenoActual = 1;


// --------
//  LOGICA
// --------

// Lineas

function seleccionarEstacionParaLinea(escena, estacion) {

    // Primer tramo: todavía no hay estaciones en la línea

    // Guarda en variables temporales la primera estación
    if (estacionesLineaPendiente.length === 0) {
        estacionTramoPendiente = estacion;
        estacionesLineaPendiente.push(estacion.nombre);

        console.log(
            "Primera estación de la línea:",
            estacion.nombre
        );

        return;
    }

    /* Comprueba que ambas estaciones sean diferentes
    guarda el tramo y la estación y limpia la variable temporal de tramo pendiente */
    if (tramosLineaPendiente.length === 0) {

        if (estacion.nombre === estacionTramoPendiente.nombre) {
            return;
        }

        if (
            tramoYaExisteGuardado(
                estacionTramoPendiente.nombre,
                estacion.nombre
            )
        ) {
            alert("Ya existe un tramo entre estas estaciones");
            return;
        }

        tramosLineaPendiente.push({
            estacionA: estacionTramoPendiente.nombre,
            estacionB: estacion.nombre
        });

        estacionesLineaPendiente.push(estacion.nombre);

        dibujarTramo(
            escena,
            estacionTramoPendiente,
            estacion
        );

        marcarExtremosLinea();

        console.log(
            "Primer tramo creado:",
            estacionTramoPendiente.nombre,
            "-",
            estacion.nombre
        );

        estacionTramoPendiente = null;

        return;
    }

    // A partir del segundo tramo, primero se debe elegir un extremo
    if (estacionTramoPendiente === null) {

        const extremos = obtenerExtremosLinea(
            tramosLineaPendiente
        );

        if (!extremos.includes(estacion.nombre)) {
            return;
        }

        estacionTramoPendiente = estacion;

        console.log(
            "Extremo seleccionado:",
            estacion.nombre
        );

        return;
    }

    // La segunda estación del nuevo tramo debe ser nueva
    if (estacionesLineaPendiente.includes(estacion.nombre)) {
        return;
    }

    if (
        tramoYaExisteGuardado(
            estacionTramoPendiente.nombre,
            estacion.nombre
        )
    ) {
        alert("Ya existe un tramo entre estas estaciones");
        return;
    }

    tramosLineaPendiente.push({
        estacionA: estacionTramoPendiente.nombre,
        estacionB: estacion.nombre
    });

    estacionesLineaPendiente.push(estacion.nombre);

    dibujarTramo(
        escena,
        estacionTramoPendiente,
        estacion
    );

    marcarExtremosLinea();

    console.log(
        "Nuevo tramo creado:",
        estacionTramoPendiente.nombre,
        "-",
        estacion.nombre
    );

    estacionTramoPendiente = null;
}

function obtenerExtremosLinea(tramos) {
    const cantidadConexiones = {};

    for (const tramo of tramos) {
        cantidadConexiones[tramo.estacionA] =
            (cantidadConexiones[tramo.estacionA] || 0) + 1;

        cantidadConexiones[tramo.estacionB] =
            (cantidadConexiones[tramo.estacionB] || 0) + 1;
    }

    return Object.keys(cantidadConexiones).filter(
        nombreEstacion => cantidadConexiones[nombreEstacion] === 1
    );
}

function tramoYaExisteGuardado(nombreA, nombreB) {

    return tramosGuardados.some(tramo => {

        return (
            (tramo.estacionA === nombreA && tramo.estacionB === nombreB) ||
            (tramo.estacionA === nombreB && tramo.estacionB === nombreA)
        );
    });
}

// --------
//  VISUAL
// --------

// Estaciones

function dibujarEstacion(escena, estacion) {
    const circulo = escena.add.circle(
        estacion.posicionX,
        estacion.posicionY,
        10,
        0xffffff
    );

    estacion.circulo = circulo;

    estacionesCargadas.push(estacion);

    const texto = escena.add.text(
        estacion.posicionX + 15,
        estacion.posicionY - 8,
        estacion.nombre
    );

    texto.setVisible(false);

    estacion.texto = texto;

    circulo.setInteractive();

    circulo.on("pointerover", function() {
        texto.setVisible(true);
    });

    circulo.on("pointerout", function() {
        texto.setVisible(false);
    });

    circulo.on("pointerdown", function(pointer) {

        if (modoActual === "crearLinea") {
            seleccionarEstacionParaLinea(escena, estacion);
            return;
        }

        estacionSeleccionada = estacion;

        const menuEstacion =
            document.getElementById("menuEstacion");

        menuEstacion.hidden = false;

        menuEstacion.style.position = "absolute";
        menuEstacion.style.left = `${pointer.event.clientX}px`;
        menuEstacion.style.top = `${pointer.event.clientY}px`;

        console.log("Estación seleccionada:", estacion);
    });
}

// Lineas

function marcarExtremosLinea() {

    const extremos = obtenerExtremosLinea(
        tramosLineaPendiente
    );

    estacionesCargadas.forEach(estacion => {

        if (extremos.includes(estacion.nombre)) {
            estacion.circulo.setFillStyle(0xffff00);
        } else {
            estacion.circulo.setFillStyle(0xffffff);
        }
    });
}

function dibujarTramo(
    escena,
    estacionA,
    estacionB,
    pendiente = true
) {

    const linea = escena.add.line(
        0,
        0,
        estacionA.posicionX,
        estacionA.posicionY,
        estacionB.posicionX,
        estacionB.posicionY,
        0xffffff
    );

    linea.setOrigin(0, 0);

    if (pendiente) {
        dibujosTramosPendientes.push(linea);
    }

    return linea;
}

function actualizarSeleccionLinea(nombreLinea) {

    dibujosLineasGuardadas.forEach(item => {

        if (item.nombreLinea === nombreLinea) {
            item.dibujo.setStrokeStyle(2, 0xffff00);
        } else {
            item.dibujo.setStrokeStyle(1, 0xffffff);
        }
    });

    const menuLinea = document.getElementById("menuLinea");

    if (nombreLinea === null) {
        menuLinea.hidden = true;
    } else {
        menuLinea.hidden = false;
    }
}

// ---------
//  BACKEND
// ---------

// Estaciones

function guardarEstacion(escena, estacion) {
    fetch("http://localhost:8080/estaciones", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(estacion)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Error al guardar la estación");
        }

        return response.json();
    })
    .then(estacionGuardada => {
        console.log("Estación guardada:", estacionGuardada);
        dibujarEstacion(escena, estacionGuardada);
    })
    .catch(error => {
        console.error("No se pudo crear la estación:", error);
    });
}

function actualizarEstacion(estacion) {
    fetch("http://localhost:8080/estaciones", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(estacion)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Error al actualizar la estación");
        }

        return response.json();
    })
    .then(estacionActualizada => {
        console.log("Estación actualizada:", estacionActualizada);
    })
    .catch(error => {
        console.error("No se pudo actualizar la estación:", error);
    });
}

function eliminarEstacion(estacion) {
    fetch(
        `http://localhost:8080/estaciones/${estacion.idEstacion}`,
        {
            method: "DELETE"
        }
    )
    .then(response => {
        if (!response.ok) {
            throw new Error("Error al eliminar la estación");
        }

        estacion.circulo.destroy();
        estacion.texto.destroy();

        console.log(
            "Estación eliminada:",
            estacion.idEstacion,
            estacion.nombre
        );
    })
    .catch(error => {
        console.error("No se pudo eliminar la estación:", error);
    });
}

function cargarEstaciones(escena, elementos) {
    fetch(
        `http://localhost:8080/estaciones?idDiseno=${idDisenoActual}`
    )
    .then(response => {
        if (!response.ok) {
            throw new Error("Error al cargar las estaciones");
        }

        return response.json();
    })
    .then(estaciones => {
        estaciones.forEach(estacion => {
            dibujarEstacion(escena, estacion);
        });

        cargarLineas(escena, elementos);
    })
    .catch(error => {
        console.error("No se pudieron cargar las estaciones:", error);
    });
}

// Lineas

function guardarLinea(linea) {

    return fetch("http://localhost:8080/lineas", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(linea)
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(mensaje => {
                throw new Error(mensaje);
            });
        }

        return response.text();
    });
}

function eliminarLinea(nombreLinea) {

    return fetch(
        `http://localhost:8080/lineas/${idDisenoActual}/${encodeURIComponent(nombreLinea)}`,
        {
            method: "DELETE"
        }
    )
    .then(response => {

        console.log("Respuesta DELETE:", response.status);

        if (!response.ok) {
            throw new Error("Error al eliminar la línea");
        }

        console.log("Línea eliminada:", nombreLinea);
    });
}

function cambiarNombreLinea(nombreActual, nuevoNombre) {

    return fetch(
        `http://localhost:8080/lineas/${idDisenoActual}/${encodeURIComponent(nombreActual)}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "text/plain"
            },
            body: nuevoNombre
        }
    )
    .then(response => {
        if (!response.ok) {
            return response.text().then(mensaje => {
                throw new Error(mensaje);
            });
        }

        return response.text();
    });
}

function cargarLineas(escena, elementos) {

    fetch(
        `http://localhost:8080/lineas/diseno/${idDisenoActual}`
    )
    .then(response => {
        if (!response.ok) {
            throw new Error("Error al cargar las líneas");
        }

        return response.json();
    })
    .then(lineas => {

        lineas.forEach(linea => {

            fetch(
                `http://localhost:8080/lineas/diseno/${idDisenoActual}/${encodeURIComponent(linea.nombre)}/tramos`
            )
            .then(response => {
                if (!response.ok) {
                    throw new Error("Error al cargar los tramos");
                }

                return response.json();
            })
            .then(tramos => {

                tramosGuardados.push(...tramos);

                tramos.forEach(tramo => {

                    const estacionA = estacionesCargadas.find(
                        e => e.idEstacion === tramo.idEstacionA
                    );

                    const estacionB = estacionesCargadas.find(
                        e => e.idEstacion === tramo.idEstacionB
                    );

                    if (estacionA && estacionB) {

                        const dibujo = dibujarTramo(
                            escena,
                            estacionA,
                            estacionB,
                            false
                        );

                        const xMedio =
                            (estacionA.posicionX + estacionB.posicionX) / 2;

                        const yMedio =
                            (estacionA.posicionY + estacionB.posicionY) / 2;

                        const distancia = Phaser.Math.Distance.Between(
                            estacionA.posicionX,
                            estacionA.posicionY,
                            estacionB.posicionX,
                            estacionB.posicionY
                        );

                        const angulo = Phaser.Math.Angle.Between(
                            estacionA.posicionX,
                            estacionA.posicionY,
                            estacionB.posicionX,
                            estacionB.posicionY
                        );

                        const zonaClick = escena.add.zone(
                            xMedio,
                            yMedio,
                            distancia,
                            20
                        );

                        zonaClick.setRotation(angulo);
                        zonaClick.setInteractive();

                        const textoLinea = escena.add.text(
                            xMedio + 15,
                            yMedio - 8,
                            linea.nombre
                        );

                        textoLinea.setVisible(false);

                        zonaClick.on("pointerover", function() {

                            const registroLinea = dibujosLineasGuardadas.find(
                                item => item.zonaClick === zonaClick
                            );

                            if (registroLinea) {
                                textoLinea.setText(registroLinea.nombreLinea);
                            }

                            textoLinea.setVisible(true);
                        });

                        zonaClick.on("pointerout", function() {
                            textoLinea.setVisible(false);
                        });

                        zonaClick.on("pointerdown", function(pointer) {

                            const registroLinea = dibujosLineasGuardadas.find(
                                item => item.zonaClick === zonaClick
                            );

                            lineaSeleccionada = registroLinea.nombreLinea;

                            actualizarSeleccionLinea(lineaSeleccionada);

                            elementos.menuLinea.style.position = "absolute";
                            elementos.menuLinea.style.left = `${pointer.event.clientX}px`;
                            elementos.menuLinea.style.top = `${pointer.event.clientY}px`;

                            console.log(
                                "Línea seleccionada:",
                                lineaSeleccionada
                            );
                        });

                        dibujosLineasGuardadas.push({
                            nombreLinea: linea.nombre,
                            tramo: tramo,
                            dibujo: dibujo,
                            zonaClick: zonaClick
                        });
                    }
                });
            });
        });
    })
    .catch(error => {
        console.error(
            "No se pudieron cargar las líneas:",
            error
        );
    });
}

function actualizarTramosDeEstacion(escena, estacion) {

    dibujosLineasGuardadas.forEach(item => {

        const tramo = item.tramo;

        if (
            tramo.idEstacionA !== estacion.idEstacion &&
            tramo.idEstacionB !== estacion.idEstacion
        ) {
            return;
        }

        const estacionA = estacionesCargadas.find(
            e => e.idEstacion === tramo.idEstacionA
        );

        const estacionB = estacionesCargadas.find(
            e => e.idEstacion === tramo.idEstacionB
        );

        if (!estacionA || !estacionB) {
            return;
        }

        // Redibujar la línea
        item.dibujo.destroy();

        item.dibujo = dibujarTramo(
            escena,
            estacionA,
            estacionB,
            false
        );

        // Reposicionar la zona clickeable
        const xMedio =
            (estacionA.posicionX + estacionB.posicionX) / 2;

        const yMedio =
            (estacionA.posicionY + estacionB.posicionY) / 2;

        const distancia = Phaser.Math.Distance.Between(
            estacionA.posicionX,
            estacionA.posicionY,
            estacionB.posicionX,
            estacionB.posicionY
        );

        const angulo = Phaser.Math.Angle.Between(
            estacionA.posicionX,
            estacionA.posicionY,
            estacionB.posicionX,
            estacionB.posicionY
        );

        item.zonaClick.setPosition(xMedio, yMedio);
        item.zonaClick.setSize(distancia, 20);
        item.zonaClick.setRotation(angulo);
    });
}

// --------------------
// INTERFAZ - CREACIÓN
// --------------------

// Estaciones

function configurarCreacionEstacion(escena, elementos) {

    function continuarCreacionEstacion() {
        if (elementos.nombreEstacion.value.trim() === "") {
            alert("Ingresá un nombre para la estación");
            return;
        }

        nombreEstacionPendiente =
            elementos.nombreEstacion.value.trim();

        elementos.formEstacion.hidden = true;
        modoActual = "crearEstacion";

        console.log(
            "Estación a crear:",
            nombreEstacionPendiente
        );
    }

    elementos.botonCrearEstacion.addEventListener(
        "click",
        function() {
            elementos.formEstacion.hidden = false;
            elementos.nombreEstacion.focus();
        }
    );

    elementos.botonCancelarEstacion.addEventListener(
        "click",
        function() {
            elementos.formEstacion.hidden = true;
            elementos.nombreEstacion.value = "";
        }
    );

    elementos.botonContinuarEstacion.addEventListener(
        "click",
        continuarCreacionEstacion
    );

    elementos.nombreEstacion.addEventListener(
        "keydown",
        function(evento) {
            if (evento.key === "Enter") {
                continuarCreacionEstacion();
            }
        }
    );

    escena.input.on("pointerdown", function(pointer) {

        if (modoActual === "moverEstacion") {

            estacionSeleccionada.posicionX = pointer.x;
            estacionSeleccionada.posicionY = pointer.y;

            estacionSeleccionada.circulo.setPosition(
                pointer.x,
                pointer.y
            );

            estacionSeleccionada.texto.setPosition(
                pointer.x,
                pointer.y - 20
            );

            actualizarTramosDeEstacion(
                escena,
                estacionSeleccionada
            );

            actualizarEstacion(estacionSeleccionada);

            modoActual = "normal";
            estacionSeleccionada = null;

            return;
        }

        if (modoActual !== "crearEstacion") {
            return;
        }

        const estacion = {
            idDiseno: idDisenoActual,
            nombre: nombreEstacionPendiente,
            posicionX: pointer.x,
            posicionY: pointer.y,
            transbordo: false,
            modificable: true
        };

        console.log(estacion);

        guardarEstacion(escena, estacion);

        modoActual = "normal";
        nombreEstacionPendiente = "";
        elementos.nombreEstacion.value = "";
    });
}

// Lineas

function configurarCreacionLinea(escena, elementos) {

    function continuarCreacionLinea() {

        if (elementos.nombreLinea.value.trim() === "") {
            alert("Ingresá un nombre para la línea");
            return;
        }

        nombreLineaPendiente =
            elementos.nombreLinea.value.trim();

        elementos.formLinea.hidden = true;

        elementos.controlesLinea.hidden = false;

        modoActual = "crearLinea";

        console.log(
            "Línea a crear:",
            nombreLineaPendiente
        );
    }

    elementos.botonCrearLinea.addEventListener(
        "click",
        function() {
            elementos.formLinea.hidden = false;
            elementos.nombreLinea.focus();
        }
    );

    elementos.botonCancelarLinea.addEventListener(
        "click",
        function() {
            elementos.formLinea.hidden = true;
            elementos.nombreLinea.value = "";
        }
    );

    elementos.botonContinuarLinea.addEventListener(
        "click",
        continuarCreacionLinea
    );

    elementos.nombreLinea.addEventListener(
        "keydown",
        function(evento) {
            if (evento.key === "Enter") {
                continuarCreacionLinea();
            }
        }
    );

    elementos.nuevoNombreLinea.addEventListener(
        "keydown",
        function(evento) {

            if (evento.key === "Enter") {
                elementos.botonGuardarNombreLinea.click();
            }
        }
    );

    elementos.botonCancelarCreacionLinea.addEventListener(
        "click",
        function() {

            dibujosTramosPendientes.forEach(linea => {
                linea.destroy();
            });

            estacionesLineaPendiente.forEach(nombreEstacion => {

                const estacion = estacionesCargadas.find(
                    estacion => estacion.nombre === nombreEstacion
                );

                if (estacion) {
                    estacion.circulo.setFillStyle(0xffffff);
                }
            });

            dibujosTramosPendientes = [];
            nombreLineaPendiente = "";
            tramosLineaPendiente = [];
            estacionTramoPendiente = null;
            estacionesLineaPendiente = [];

            modoActual = "normal";

            elementos.controlesLinea.hidden = true;
            elementos.nombreLinea.value = "";

            console.log("Creación de línea cancelada");
        }
    );

    elementos.botonGuardarLinea.addEventListener(
        "click",
        function() {

            if (tramosLineaPendiente.length === 0) {
                alert("La línea debe tener al menos un tramo");
                return;
            }

            const linea = {
                idDiseno: idDisenoActual,
                nombre: nombreLineaPendiente,
                tramos: tramosLineaPendiente
            };

            guardarLinea(linea)
                .then(mensaje => {

                    console.log(mensaje);

                    const nombreLineaGuardada = nombreLineaPendiente;

                    tramosGuardados.push(...tramosLineaPendiente);

                    tramosLineaPendiente.forEach((tramo, indice) => {

                        const dibujo = dibujosTramosPendientes[indice];

                        const estacionA = estacionesCargadas.find(
                            estacion => estacion.nombre === tramo.estacionA
                        );

                        const estacionB = estacionesCargadas.find(
                            estacion => estacion.nombre === tramo.estacionB
                        );

                        if (!estacionA || !estacionB || !dibujo) {
                            return;
                        }

                        const xMedio =
                            (estacionA.posicionX + estacionB.posicionX) / 2;

                        const yMedio =
                            (estacionA.posicionY + estacionB.posicionY) / 2;

                        const distancia = Phaser.Math.Distance.Between(
                            estacionA.posicionX,
                            estacionA.posicionY,
                            estacionB.posicionX,
                            estacionB.posicionY
                        );

                        const angulo = Phaser.Math.Angle.Between(
                            estacionA.posicionX,
                            estacionA.posicionY,
                            estacionB.posicionX,
                            estacionB.posicionY
                        );

                        const zonaClick = escena.add.zone(
                            xMedio,
                            yMedio,
                            distancia,
                            20
                        );

                        zonaClick.setRotation(angulo);
                        zonaClick.setInteractive();

                        const textoLinea = escena.add.text(
                            xMedio + 15,
                            yMedio - 8,
                            nombreLineaGuardada
                        );

                        textoLinea.setVisible(false);

                        zonaClick.on("pointerover", function() {

                            const registroLinea = dibujosLineasGuardadas.find(
                                item => item.zonaClick === zonaClick
                            );

                            if (registroLinea) {
                                textoLinea.setText(registroLinea.nombreLinea);
                            }

                            textoLinea.setVisible(true);
                        });

                        zonaClick.on("pointerout", function() {
                            textoLinea.setVisible(false);
                        });

                        zonaClick.on("pointerdown", function(pointer) {

                            const registroLinea = dibujosLineasGuardadas.find(
                                item => item.zonaClick === zonaClick
                            );

                            lineaSeleccionada = registroLinea.nombreLinea;

                            actualizarSeleccionLinea(lineaSeleccionada);

                            elementos.menuLinea.style.position = "absolute";
                            elementos.menuLinea.style.left = `${pointer.event.clientX}px`;
                            elementos.menuLinea.style.top = `${pointer.event.clientY}px`;

                            console.log(
                                "Línea seleccionada:",
                                lineaSeleccionada
                            );
                        });

                        dibujosLineasGuardadas.push({
                            nombreLinea: nombreLineaGuardada,
                            tramo: tramo,
                            dibujo: dibujo,
                            zonaClick: zonaClick
                        });
                    });

                    // Devuelve las estaciones de la línea al color normal
                    estacionesLineaPendiente.forEach(nombreEstacion => {

                        const estacion = estacionesCargadas.find(
                            estacion => estacion.nombre === nombreEstacion
                        );

                        if (estacion) {
                            estacion.circulo.setFillStyle(0xffffff);
                        }
                    });

                    dibujosTramosPendientes = [];

                    // Limpia las variables temporales de creación
                    nombreLineaPendiente = "";
                    tramosLineaPendiente = [];
                    estacionTramoPendiente = null;
                    estacionesLineaPendiente = [];

                    // Sale del modo creación de línea
                    modoActual = "normal";

                    // Oculta los controles y limpia el input
                    elementos.controlesLinea.hidden = true;
                    elementos.nombreLinea.value = "";
                })
                .catch(error => {
                    console.error(
                        "No se pudo guardar la línea:",
                        error
                    );
                });
        }
    );
}

// --------------------
// INTERFAZ - EDICIÓN
// --------------------

function configurarEdicionEstaciones(elementos) {

    

    elementos.botonCancelarEditarEstacion.addEventListener(
        "click",
        function() {
            elementos.formEditarEstacion.hidden = true;
            elementos.nombreEstacionEditar.value = "";
            estacionSeleccionada = null;
        }
    );

    elementos.botonGuardarEstacion.addEventListener(
        "click",
        function() {
            if (estacionSeleccionada === null) {
                return;
            }

            const nuevoNombre =
                elementos.nombreEstacionEditar.value.trim();

            if (nuevoNombre === "") {
                alert("Ingresá un nombre para la estación");
                return;
            }

            estacionSeleccionada.nombre = nuevoNombre;

            estacionSeleccionada.texto.setText(
                nuevoNombre
            );

            //TEMPORAL
            console.log("Estación enviada al PUT:", estacionSeleccionada);

            actualizarEstacion(estacionSeleccionada);

            elementos.formEditarEstacion.hidden = true;
            estacionSeleccionada = null;
        }
    );

    elementos.botonEliminarEstacion.addEventListener(
        "click",
        function() {
            if (estacionSeleccionada === null) {
                return;
            }

            eliminarEstacion(estacionSeleccionada);

            elementos.formEditarEstacion.hidden = true;
            elementos.nombreEstacionEditar.value = "";
            estacionSeleccionada = null;
        }
    );

    elementos.nombreEstacionEditar.addEventListener(
        "keydown",
        function(evento) {
            if (evento.key === "Enter") {
                elementos.botonGuardarEstacion.click();
            }
        }
    );

    document.addEventListener("pointerdown", function(evento) {

        // Cerrar menú de estación al clickear afuera
        if (
            !elementos.menuEstacion.hidden &&
            !elementos.menuEstacion.contains(evento.target)
        ) {
            elementos.menuEstacion.hidden = true;
            estacionSeleccionada = null;
        }

        // Cerrar menú de línea y deseleccionarla al clickear afuera
        if (
            !elementos.menuLinea.hidden &&
            !elementos.menuLinea.contains(evento.target) &&
            !elementos.confirmarEliminarLinea.contains(evento.target)
        ) {
            elementos.menuLinea.hidden = true;

            lineaSeleccionada = null;
            actualizarSeleccionLinea(lineaSeleccionada);
        }
    });

    //Botones menú desplegable estación
    elementos.botonMoverEstacion.addEventListener(
        "click",
        function() {

            elementos.menuEstacion.hidden = true;

            modoActual = "moverEstacion";

            console.log(
                "Moviendo estación:",
                estacionSeleccionada.nombre
            );
        }
    );

    elementos.botonCambiarNombreEstacion.addEventListener(
        "click",
        function() {

            elementos.menuEstacion.hidden = true;

            elementos.nombreEstacionEditar.value =
                estacionSeleccionada.nombre;
    
            elementos.formEditarEstacion.hidden = false;
            elementos.nombreEstacionEditar.focus();
        }
    );

    //eliminar estacion
    //------------------------------------------------------------
    elementos.botonEliminarEstacionMenu.addEventListener(
        "click",
        function() {

            elementos.menuEstacion.hidden = true;
            elementos.confirmarEliminarEstacion.hidden = false;
        }
    );

    elementos.botonCancelarEliminarEstacion.addEventListener(
        "click",
        function() {
            elementos.confirmarEliminarEstacion.hidden = true;
        }
    );

    elementos.botonConfirmarEliminarEstacion.addEventListener(
        "click",
        function() {

            if (estacionSeleccionada === null) {
                return;
            }

            eliminarEstacion(estacionSeleccionada);

            elementos.confirmarEliminarEstacion.hidden = true;
            estacionSeleccionada = null;
        }
    );
    //------------------------------------------------------------
}

function configurarEdicionLineas(elementos) {

    elementos.botonCambiarNombreLinea.addEventListener(
        "click",
        function() {

            if (lineaSeleccionada === null) {
                return;
            }

            elementos.nuevoNombreLinea.value = lineaSeleccionada;

            elementos.menuLinea.hidden = true;
            elementos.formCambiarNombreLinea.hidden = false;
        }
    );

    elementos.botonCancelarCambiarNombreLinea.addEventListener(
        "click",
        function() {
            elementos.formCambiarNombreLinea.hidden = true;
            elementos.nuevoNombreLinea.value = "";
        }
    );

    elementos.botonGuardarNombreLinea.addEventListener(
        "click",
        function() {

            if (lineaSeleccionada === null) {
                return;
            }

            const nombreActual = lineaSeleccionada;
            const nuevoNombre =
                elementos.nuevoNombreLinea.value.trim();

            if (nuevoNombre === "") {
                return;
            }

            cambiarNombreLinea(nombreActual, nuevoNombre)
                .then(() => {

                    dibujosLineasGuardadas.forEach(item => {
                        if (item.nombreLinea === nombreActual) {
                            item.nombreLinea = nuevoNombre;
                        }
                    });

                    lineaSeleccionada = nuevoNombre;
                    actualizarSeleccionLinea(lineaSeleccionada);

                    elementos.formCambiarNombreLinea.hidden = true;
                    elementos.nuevoNombreLinea.value = "";

                    console.log(
                        "Línea renombrada:",
                        nombreActual,
                        "→",
                        nuevoNombre
                    );
                })
                .catch(error => {
                    console.error(
                        "No se pudo cambiar el nombre de la línea:",
                        error
                    );
                });
        }
    );

    elementos.botonEliminarLinea.addEventListener(
        "click",
        function() {
            elementos.confirmarEliminarLinea.hidden = false;
        }
    );

    elementos.botonCancelarEliminarLinea.addEventListener(
        "click",
        function() {
            elementos.confirmarEliminarLinea.hidden = true;
        }
    );

    elementos.botonConfirmarEliminarLinea.addEventListener(
        "click",
        function() {

            if (lineaSeleccionada === null) {
                return;
            }

            eliminarLinea(lineaSeleccionada)
                .then(() => {

                    console.log("Línea a quitar visualmente:", lineaSeleccionada);
                    console.log("Dibujos guardados:", dibujosLineasGuardadas);

                    dibujosLineasGuardadas
                        .filter(item =>
                            item.nombreLinea === lineaSeleccionada
                        )
                        .forEach(item => {
                            item.dibujo.destroy();
                            item.zonaClick.destroy();
                        });

                    dibujosLineasGuardadas =
                        dibujosLineasGuardadas.filter(
                            item =>
                                item.nombreLinea !== lineaSeleccionada
                        );

                    tramosGuardados =
                        tramosGuardados.filter(
                            tramo =>
                                tramo.nombreLinea !== lineaSeleccionada
                        );

                    lineaSeleccionada = null;

                    elementos.confirmarEliminarLinea.hidden = true;
                    elementos.menuLinea.hidden = true;
                })
                .catch(error => {
                    console.error(
                        "No se pudo eliminar la línea:",
                        error
                    );
                });
        }
    );
}

// --------------------
// ELEMENTOS HTML
// --------------------

function obtenerElementos() {
    return {

        // Estaciones

        botonCrearEstacion:
            document.getElementById("btnCrearEstacion"),

        formEstacion:
            document.getElementById("formEstacion"),

        nombreEstacion:
            document.getElementById("nombreEstacion"),

        botonCancelarEstacion:
            document.getElementById("btnCancelarEstacion"),

        botonContinuarEstacion:
            document.getElementById("btnContinuarEstacion"),

        formEditarEstacion:
            document.getElementById("formEditarEstacion"),

        nombreEstacionEditar:
            document.getElementById("nombreEstacionEditar"),

        botonEliminarEstacion:
            document.getElementById("btnEliminarEstacion"),

        botonCancelarEditarEstacion:
            document.getElementById(
                "btnCancelarEditarEstacion"
            ),

        confirmarEliminarEstacion:
            document.getElementById("confirmarEliminarEstacion"),

        botonConfirmarEliminarEstacion:
            document.getElementById("btnConfirmarEliminarEstacion"),

        botonCancelarEliminarEstacion:
            document.getElementById("btnCancelarEliminarEstacion"),

        botonGuardarEstacion:
            document.getElementById("btnGuardarEstacion"),
        

        //Menú desplegable de opciones click estación
        menuEstacion:
            document.getElementById("menuEstacion"),

        botonCambiarNombreEstacion:
            document.getElementById("btnCambiarNombreEstacion"),

        botonMoverEstacion:
            document.getElementById("btnMoverEstacion"),

        botonEliminarEstacionMenu:
            document.getElementById("btnEliminarEstacionMenu"),

        // Lineas

        botonCrearLinea:
            document.getElementById("btnCrearLinea"),

        formLinea:
            document.getElementById("formLinea"),

        nombreLinea:
            document.getElementById("nombreLinea"),

        botonCancelarLinea:
            document.getElementById("btnCancelarLinea"),

        botonContinuarLinea:
            document.getElementById("btnContinuarLinea"),

        controlesLinea:
            document.getElementById("controlesLinea"),

        botonCancelarCreacionLinea:
            document.getElementById("btnCancelarCreacionLinea"),

        botonGuardarLinea:
            document.getElementById("btnGuardarLinea"),

        confirmarEliminarLinea:
            document.getElementById("confirmarEliminarLinea"),

        botonConfirmarEliminarLinea:
            document.getElementById("btnConfirmarEliminarLinea"),

        botonCancelarEliminarLinea:
        document.getElementById("btnCancelarEliminarLinea"),

        //Menú desplegable de opciones click linea
        menuLinea:
            document.getElementById("menuLinea"),

        botonCambiarNombreLinea:
            document.getElementById("btnCambiarNombreLinea"),

        botonEliminarLinea:
            document.getElementById("btnEliminarLinea"),

        //formulario de cambio de nombre
        formCambiarNombreLinea:
            document.getElementById("formCambiarNombreLinea"),

        nuevoNombreLinea:
            document.getElementById("nuevoNombreLinea"),

        botonCancelarCambiarNombreLinea:
            document.getElementById("btnCancelarCambiarNombreLinea"),

        botonGuardarNombreLinea:
            document.getElementById("btnGuardarNombreLinea"),
    };
}

// --------------------
// ESCENA PHASER
// --------------------

function crear() {
    const elementos = obtenerElementos();

    configurarCreacionEstacion(this, elementos);
    configurarEdicionEstaciones(elementos);
    configurarCreacionLinea(this, elementos);
    configurarEdicionLineas(elementos);

    cargarEstaciones(this, elementos);
}

// --------------------
// CONFIGURACIÓN PHASER
// --------------------

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: "juego",
    scene: {
        create: crear
    }
};

const juego = new Phaser.Game(config);