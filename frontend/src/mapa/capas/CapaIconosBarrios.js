export default class CapaIconosBarrios {

    constructor(
        escena,
        opciones = {}
    ) {

        this.escena =
            escena;

        this.capaBarrios =
            opciones.capaBarrios || null;

        this.zonasSeleccionadas =
            [];

        this.barriosSeleccionados =
            [];

        this.elementos =
            [];

        this.zoomMinimoVisible =
            2;

    }

    establecerCapaBarrios(
        capaBarrios
    ) {

        this.capaBarrios =
            capaBarrios;

        this.eliminarElementos();

    }

    establecerZonasSeleccionadas(
        zonas
    ) {

        this.zonasSeleccionadas =
            Array.isArray(zonas)
                ? [...zonas]
                : [];

        this.eliminarElementos();

    }

    establecerBarriosSeleccionados(
        barrios
    ) {

        this.barriosSeleccionados =
            Array.isArray(barrios)
                ? [...barrios]
                : [];

        this.eliminarElementos();

    }

    dibujar() {

        /*
         * Los barrios no tienen iconos propios.
         *
         * Esta capa se mantiene para conservar
         * compatibilidad con MapaScene, pero no
         * dibuja ningún elemento sobre el mapa.
         */

        this.eliminarElementos();

    }

    actualizar() {

        /*
         * No hay iconos de barrios que actualizar.
         */

    }

    eliminarElementos() {

        for (
            const elemento
            of this.elementos
        ) {

            if (
                elemento
            ) {

                elemento.destroy();

            }

        }

        this.elementos =
            [];

    }

    eliminar() {

        this.eliminarElementos();

        this.zonasSeleccionadas =
            [];

        this.barriosSeleccionados =
            [];

        this.capaBarrios =
            null;

        this.escena =
            null;

    }

}