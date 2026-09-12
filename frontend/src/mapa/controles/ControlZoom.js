export default class ControlZoom {

    constructor(
        escena,
        opciones = {}
    ) {

        this.escena =
            escena;

        this.capaBarrios =
            opciones.capaBarrios || null;

        this.factorZoom =
            opciones.factorZoom ?? 1.5;

        this.zoomMinimo =
            opciones.zoomMinimo ?? 1;

        this.zoomMaximo =
            opciones.zoomMaximo ?? 8;

        this.zoomActual =
            1;

        this.centroSeleccion =
            null;

        this.contenedor =
            null;

        this.botonAcercar =
            null;

        this.botonAlejar =
            null;

        this.botonRestaurar =
            null;

        this.crearEstilos();

    }

    establecerCapaBarrios(
        capaBarrios
    ) {

        this.capaBarrios =
            capaBarrios;

    }

    crear() {

        this.eliminar();

        this.contenedor =
            document.createElement(
                'div'
            );

        this.contenedor.className =
            'metronet-control-zoom';

        this.botonAcercar =
            document.createElement(
                'button'
            );

        this.botonAcercar.type =
            'button';

        this.botonAcercar.textContent =
            '+';

        this.botonAcercar.className =
            'metronet-control-zoom-boton';

        this.botonAlejar =
            document.createElement(
                'button'
            );

        this.botonAlejar.type =
            'button';

        this.botonAlejar.textContent =
            '−';

        this.botonAlejar.className =
            'metronet-control-zoom-boton';

        this.botonRestaurar =
            document.createElement(
                'button'
            );

        this.botonRestaurar.type =
            'button';

        this.botonRestaurar.textContent =
            '⌂';

        this.botonRestaurar.className =
            'metronet-control-zoom-boton';

        this.botonAcercar.addEventListener(
            'click',
            () => {

                this.acercar();

            }
        );

        this.botonAlejar.addEventListener(
            'click',
            () => {

                this.alejar();

            }
        );

        this.botonRestaurar.addEventListener(
            'click',
            () => {

                this.restaurar();

            }
        );

        this.contenedor.appendChild(
            this.botonAcercar
        );

        this.contenedor.appendChild(
            this.botonAlejar
        );

        this.contenedor.appendChild(
            this.botonRestaurar
        );

        document.body.appendChild(
            this.contenedor
        );

        this.actualizarBotones();

    }

    obtenerCamara() {

        if (
            !this.escena ||
            !this.escena.cameras
        ) {

            return null;

        }

        return this.escena.cameras.main;

    }

    acercar() {

        const nuevoZoom =
            Math.min(

                this.zoomActual *
                this.factorZoom,

                this.zoomMaximo

            );

        this.establecerZoom(
            nuevoZoom
        );

    }

    alejar() {

        const nuevoZoom =
            Math.max(

                this.zoomActual /
                this.factorZoom,

                this.zoomMinimo

            );

        this.establecerZoom(
            nuevoZoom
        );

    }

    establecerZoom(
        zoom
    ) {

        const nuevoZoom =
            this.normalizar(
                zoom
            );

        const camara =
            this.obtenerCamara();

        if (
            !camara
        ) {

            return;

        }

        this.zoomActual =
            nuevoZoom;

        camara.setZoom(
            nuevoZoom
        );

        if (
            this.centroSeleccion
        ) {

            camara.centerOn(

                this.centroSeleccion.x,

                this.centroSeleccion.y

            );

        } else {

            const centroMapa =
                this.obtenerCentroMapa();

            camara.centerOn(

                centroMapa.x,

                centroMapa.y

            );

        }

        this.actualizarBotones();

    }

    enfocarBarrios(
        nombresBarrios = []
    ) {

        if (
            !this.capaBarrios ||
            !Array.isArray(
                nombresBarrios
            ) ||
            nombresBarrios.length === 0
        ) {

            this.restaurar();

            return;

        }

        const nombresNormalizados =
            nombresBarrios.map(

                nombre =>

                    String(
                        nombre
                    )
                        .trim()
                        .toUpperCase()

            );

        const barrios =
            this.capaBarrios
                .obtenerBarrios()
                .filter(

                    barrio => {

                        const nombre =
                            String(
                                barrio.nombre
                            )
                                .trim()
                                .toUpperCase();

                        return nombresNormalizados.includes(
                            nombre
                        );

                    }

                );

        if (
            barrios.length === 0
        ) {

            this.restaurar();

            return;

        }

        this.centroSeleccion =
            this.obtenerCentroBarrio(
                barrios
            );

        const camara =
            this.obtenerCamara();

        if (
            camara &&
            this.centroSeleccion
        ) {

            camara.setZoom(
                1
            );

            this.zoomActual =
                1;

            camara.centerOn(

                this.centroSeleccion.x,

                this.centroSeleccion.y

            );

        }

        this.actualizarBotones();

    }

    enfocarZonas(
        zonas = []
    ) {

        if (
            !this.capaBarrios ||
            !Array.isArray(
                zonas
            ) ||
            zonas.length === 0
        ) {

            this.restaurar();

            return;

        }

        const barrios =
            this.capaBarrios
                .obtenerBarrios()
                .filter(

                    barrio => {

                        return zonas.includes(
                            barrio.zona
                        );

                    }

                );

        if (
            barrios.length === 0
        ) {

            this.restaurar();

            return;

        }

        this.centroSeleccion =
            this.obtenerCentroBarrio(
                barrios
            );

        const camara =
            this.obtenerCamara();

        if (
            camara &&
            this.centroSeleccion
        ) {

            camara.setZoom(
                1
            );

            this.zoomActual =
                1;

            camara.centerOn(

                this.centroSeleccion.x,

                this.centroSeleccion.y

            );

        }

        this.actualizarBotones();

    }

    obtenerCentroBarrio(
        barrios
    ) {

        const puntos =
            [];

        for (
            const barrio of barrios
        ) {

            if (
                !barrio ||
                !barrio.feature ||
                !barrio.feature.geometry
            ) {

                continue;

            }

            const geometria =
                barrio.feature.geometry;

            const coordenadas =
                this.obtenerTodasLasCoordenadas(

                    geometria

                );

            for (
                const coordenada of coordenadas
            ) {

                const punto =
                    this.convertirCoordenada(

                        coordenada

                    );

                if (
                    punto
                ) {

                    puntos.push(
                        punto
                    );

                }

            }

        }

        if (
            puntos.length === 0
        ) {

            return this.obtenerCentroMapa();

        }

        let minimoX =
            Infinity;

        let maximoX =
            -Infinity;

        let minimoY =
            Infinity;

        let maximoY =
            -Infinity;

        for (
            const punto of puntos
        ) {

            minimoX =
                Math.min(
                    minimoX,
                    punto.x
                );

            maximoX =
                Math.max(
                    maximoX,
                    punto.x
                );

            minimoY =
                Math.min(
                    minimoY,
                    punto.y
                );

            maximoY =
                Math.max(
                    maximoY,
                    punto.y
                );

        }

        return {

            x:
                (
                    minimoX +
                    maximoX
                ) / 2,

            y:
                (
                    minimoY +
                    maximoY
                ) / 2

        };

    }

    obtenerTodasLasCoordenadas(
        geometria
    ) {

        if (
            !geometria ||
            !geometria.coordinates
        ) {

            return [];

        }

        const resultado =
            [];

        this.extraerCoordenadasRecursivas(

            geometria.coordinates,

            resultado

        );

        return resultado;

    }

    extraerCoordenadasRecursivas(
        datos,
        resultado
    ) {

        if (
            !Array.isArray(
                datos
            )
        ) {

            return;

        }

        if (
            datos.length >= 2 &&
            typeof datos[0] === 'number' &&
            typeof datos[1] === 'number'
        ) {

            resultado.push(
                datos
            );

            return;

        }

        for (
            const elemento of datos
        ) {

            this.extraerCoordenadasRecursivas(

                elemento,

                resultado

            );

        }

    }

    convertirCoordenada(
        coordenada
    ) {

        if (
            !this.capaBarrios
        ) {

            return null;

        }

        const transformacion =
            this.capaBarrios
                .calcularEscalaMapa();

        if (
            !transformacion
        ) {

            return null;

        }

        return this.capaBarrios
            .convertirCoordenada(

                coordenada,

                transformacion

            );

    }

    obtenerCentroMapa() {

        if (
            this.capaBarrios &&
            this.capaBarrios.transformacion
        ) {

            const transformacion =
                this.capaBarrios
                    .transformacion;

            const coordenadaCentro = [

                (
                    transformacion.minX +
                    transformacion.maxX
                ) / 2,

                (
                    transformacion.minY +
                    transformacion.maxY
                ) / 2

            ];

            const transformacionMapa =
                this.capaBarrios
                    .calcularEscalaMapa();

            if (
                transformacionMapa
            ) {

                return this.capaBarrios
                    .convertirCoordenada(

                        coordenadaCentro,

                        transformacionMapa

                    );

            }

        }

        return {

            x:
                this.escena.scale.width / 2,

            y:
                this.escena.scale.height / 2

        };

    }

    restaurar() {

        this.centroSeleccion =
            null;

        this.zoomActual =
            1;

        const camara =
            this.obtenerCamara();

        if (
            camara
        ) {

            camara.setZoom(
                1
            );

            const centroMapa =
                this.obtenerCentroMapa();

            camara.centerOn(

                centroMapa.x,

                centroMapa.y

            );

        }

        this.actualizarBotones();

    }

    actualizar() {

        if (
            this.centroSeleccion
        ) {

            const camara =
                this.obtenerCamara();

            if (
                camara
            ) {

                camara.centerOn(

                    this.centroSeleccion.x,

                    this.centroSeleccion.y

                );

            }

        }

    }

    actualizarBotones() {

        if (
            !this.botonAcercar ||
            !this.botonAlejar
        ) {

            return;

        }

        this.botonAcercar.disabled =
            this.zoomActual >=
            this.zoomMaximo;

        this.botonAlejar.disabled =
            this.zoomActual <=
            this.zoomMinimo;

    }

    normalizar(
        zoom
    ) {

        const numero =
            Number(
                zoom
            );

        if (
            !Number.isFinite(
                numero
            )
        ) {

            return 1;

        }

        return Math.min(

            Math.max(

                numero,

                this.zoomMinimo

            ),

            this.zoomMaximo

        );

    }

    mostrar() {

        if (
            this.contenedor
        ) {

            this.contenedor.style.display =
                'flex';

        }

    }

    ocultar() {

        if (
            this.contenedor
        ) {

            this.contenedor.style.display =
                'none';

        }

    }

    eliminar() {

        if (
            this.contenedor
        ) {

            this.contenedor.remove();

        }

        this.contenedor =
            null;

        this.botonAcercar =
            null;

        this.botonAlejar =
            null;

        this.botonRestaurar =
            null;

    }

    crearEstilos() {

        const id =
            'metronet-control-zoom-estilos';

        if (
            document.getElementById(
                id
            )
        ) {

            return;

        }

        const estilos =
            document.createElement(
                'style'
            );

        estilos.id =
            id;

        estilos.textContent = `

            .metronet-control-zoom {

                position: fixed;

                right: 12px;

                bottom: 12px;

                z-index: 3000;

                display: flex;

                flex-direction: row;

                gap: 4px;

                padding: 4px;

                background: rgba(
                    0,
                    0,
                    0,
                    0.70
                );

                border-radius: 6px;

                box-shadow:
                    0 1px 5px
                    rgba(
                        0,
                        0,
                        0,
                        0.35
                    );

            }

            .metronet-control-zoom-boton {

                width: 30px;

                height: 30px;

                padding: 0;

                border: 1px solid
                    rgba(
                        255,
                        255,
                        255,
                        0.25
                    );

                border-radius: 5px;

                background: #ffffff;

                color: #000000;

                font-family:
                    Arial,
                    sans-serif;

                font-size: 17px;

                font-weight: 600;

                line-height: 28px;

                text-align: center;

                cursor: pointer;

                user-select: none;

                transition:
                    background 0.12s ease,
                    transform 0.12s ease;

            }

            .metronet-control-zoom-boton:hover {

                background: #eeeeee;

            }

            .metronet-control-zoom-boton:active {

                background: #dddddd;

                transform:
                    scale(0.94);

            }

            .metronet-control-zoom-boton:disabled {

                opacity: 0.35;

                cursor: default;

                transform: none;

            }

        `;

        document.head.appendChild(
            estilos
        );

    }

}