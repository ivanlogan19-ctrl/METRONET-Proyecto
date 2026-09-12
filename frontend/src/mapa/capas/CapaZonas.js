import {
    ZONAS,
    obtenerZona,
    normalizarBarrio
} from '../utilidades/ClasificadorZonas.js';


export default class CapaZonas {

    constructor(escena, opciones = {}) {

        this.escena =
            escena;

        this.capaBarrios =
            opciones.capaBarrios ??
            null;

        this.zonasSeleccionadas =
            [];

        this.colores =
            {
                'ZONA CENTRO':
                    0xD95D39,

                'ZONA ESTE':
                    0x4CAF50,

                'ZONA NORTE':
                    0xF2C14E,

                'ZONA OESTE':
                    0x7E57C2,

                'ZONA OESTE-COSTA':
                    0xE76F51,

                'ZONA NOROESTE':
                    0x2A9D8F
            };
    }


    establecerCapaBarrios(
        capaBarrios
    ) {

        this.capaBarrios =
            capaBarrios;
    }


    establecerZonasSeleccionadas(
        zonas
    ) {

        if (
            !Array.isArray(zonas)
        ) {

            this.zonasSeleccionadas =
                [];

            return;
        }


        this.zonasSeleccionadas =
            zonas.filter(
                (zona) =>
                    ZONAS.includes(
                        zona
                    )
            );


        this.actualizar();
    }


    agregarZona(
        zona
    ) {

        if (
            !ZONAS.includes(zona)
        ) {
            return;
        }


        if (
            !this.zonasSeleccionadas.includes(
                zona
            )
        ) {

            this.zonasSeleccionadas.push(
                zona
            );
        }


        this.actualizar();
    }


    quitarZona(
        zona
    ) {

        this.zonasSeleccionadas =
            this.zonasSeleccionadas.filter(
                (zonaSeleccionada) =>
                    zonaSeleccionada !==
                    zona
            );


        this.actualizar();
    }


    limpiar() {

        this.zonasSeleccionadas =
            [];

        this.actualizar();
    }


    obtenerZonasSeleccionadas() {

        return [
            ...this.zonasSeleccionadas
        ];
    }


    estaSeleccionada(
        zona
    ) {

        return this.zonasSeleccionadas.includes(
            zona
        );
    }


    obtenerColor(
        zona
    ) {

        return (
            this.colores[zona] ??
            0x2E4057
        );
    }


    obtenerBarriosDeZonasSeleccionadas() {

        if (
            !this.capaBarrios
        ) {

            return [];
        }


        const barrios =
            this.capaBarrios.obtenerBarrios();


        return barrios.filter(
            (barrio) =>
                this.zonasSeleccionadas.includes(
                    obtenerZona(
                        barrio.nombre
                    )
                )
        );
    }


    obtenerZonaDeBarrio(
        nombreBarrio
    ) {

        return obtenerZona(
            normalizarBarrio(
                nombreBarrio
            )
        );
    }


    actualizar() {

        if (
            !this.capaBarrios
        ) {
            return;
        }


        this.capaBarrios.establecerZonasSeleccionadas(
            this.zonasSeleccionadas
        );
    }


    eliminar() {

        this.zonasSeleccionadas =
            [];

        this.capaBarrios =
            null;
    }
}