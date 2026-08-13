import Phaser from "phaser";

let modoActual = "normal";
let nombreEstacionPendiente = "";
let estacionSeleccionada = null;

const idDisenoActual = 1;

// --------------------
// ESTACIONES - VISUAL
// --------------------

function dibujarEstacion(escena, estacion) {
    const circulo = escena.add.circle(
        estacion.posicionX,
        estacion.posicionY,
        10,
        0xffffff
    );

    estacion.circulo = circulo;

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

    circulo.on("pointerdown", function() {
        if (modoActual === "editarEstacion") {
            estacionSeleccionada = estacion;

            const formEditarEstacion =
                document.getElementById("formEditarEstacion");

            const nombreEstacionEditar =
                document.getElementById("nombreEstacionEditar");

            nombreEstacionEditar.value = estacion.nombre;
            formEditarEstacion.hidden = false;
            nombreEstacionEditar.focus();

            console.log("Estación seleccionada:", estacion);
        }
    });
}

// --------------------
// ESTACIONES - BACKEND
// --------------------

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

function cargarEstaciones(escena) {
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
    })
    .catch(error => {
        console.error("No se pudieron cargar las estaciones:", error);
    });
}

// --------------------
// INTERFAZ - CREACIÓN
// --------------------

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

// --------------------
// INTERFAZ - EDICIÓN
// --------------------

function configurarEdicionEstaciones(elementos) {

    elementos.botonEditarEstaciones.addEventListener(
        "click",
        function() {
            modoActual = "editarEstacion";
            console.log(
                "Modo editar estaciones activado"
            );
        }
    );

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
}

// --------------------
// ELEMENTOS HTML
// --------------------

function obtenerElementos() {
    return {
        botonCrearEstacion:
            document.getElementById("btnCrearEstacion"),

        botonEditarEstaciones:
            document.getElementById("btnEditarEstaciones"),

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

        botonGuardarEstacion:
            document.getElementById("btnGuardarEstacion")
    };
}

// --------------------
// ESCENA PHASER
// --------------------

function crear() {
    const elementos = obtenerElementos();

    configurarCreacionEstacion(this, elementos);
    configurarEdicionEstaciones(elementos);

    cargarEstaciones(this);
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