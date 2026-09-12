import Phaser from 'phaser';

import CapaMapaBase from './capas/CapaMapaBase.js';
import CapaBarrios from './capas/CapaBarrios.js';
import CapaZonas from './capas/CapaZonas.js';

import SelectorZonas from './controles/SelectorZonas.js';
import SelectorBarrios from './controles/SelectorBarrios.js';

import {
    obtenerZona
} from './utilidades/ClasificadorZonas.js';

export default class MapaScene extends Phaser.Scene {

    constructor() {

        super({
            key: 'MapaScene'
        });

        this.datosBarrios = null;

        this.capaMapaBase = null;
        this.capaBarrios = null;
        this.capaZonas = null;

        this.selectorZonas = null;
        this.selectorBarrios = null;

        this.logo = null;
    }

    preload() {

        this.load.json(
            'barriosMontevideo',
            new URL(
                './datos/barrios_wgs84.geojson',
                import.meta.url
            ).href
        );
    }

    create() {

        this.datosBarrios =
            this.cache.json.get(
                'barriosMontevideo'
            );

        this.crearCapaMapaBase();

        this.crearCapaBarrios();

        this.crearCapaZonas();

        this.crearControles();

        this.crearLogo();

        this.ajustarMapa();

        this.scale.on(
            'resize',
            () => {
                this.actualizarTamano();
            }
        );

        this.events.once(
            'shutdown',
            () => {
                this.limpiar();
            }
        );
    }

    crearCapaMapaBase() {

        this.capaMapaBase =
            new CapaMapaBase(
                this,
                {
                    colorFondo:
                        0x000000,

                    colorAgua:
                        0x000000
                }
            );

        this.capaMapaBase.crear();
    }

    crearCapaBarrios() {

        this.capaBarrios =
            new CapaBarrios(
                this,
                {
                    datos:
                        this.datosBarrios
                }
            );

        this.capaBarrios.dibujar();
    }

    crearCapaZonas() {

        this.capaZonas =
            new CapaZonas(
                this,
                {
                    capaBarrios:
                        this.capaBarrios
                }
            );
    }

    crearControles() {

        this.crearSelectorZonas();

        this.crearSelectorBarrios();
    }

    crearSelectorZonas() {

        this.selectorZonas =
            new SelectorZonas({

                id:
                    'metronet-selector-zonas',

                titulo:
                    'Seleccionar zonas',

                ancho:
                    130,

                posicion: {
                    top:
                        55,

                    right:
                        148
                },

                onCambio:
                    (zonas) => {

                        this.capaZonas
                            .establecerZonasSeleccionadas(
                                zonas
                            );

                        this.actualizarBarriosSegunZonas(
                            zonas
                        );
                    }
            });

        this.selectorZonas.crear();
    }

    crearSelectorBarrios() {

        const barrios =
            this.capaBarrios
                .obtenerNombres();

        this.selectorBarrios =
            new SelectorBarrios({

                id:
                    'metronet-selector-barrios',

                titulo:
                    'Seleccionar barrios',

                ancho:
                    130,

                posicion: {
                    top:
                        55,

                    right:
                        8
                },

                onCambio:
                    (barrios) => {

                        this.capaBarrios
                            .establecerBarriosSeleccionados(
                                barrios
                            );
                    }
            });

        this.selectorBarrios
            .crear(barrios);
    }

    actualizarBarriosSegunZonas(
        zonas
    ) {

        if (
            !this.selectorBarrios ||
            !this.capaBarrios
        ) {
            return;
        }

        if (
            !Array.isArray(zonas) ||
            zonas.length === 0
        ) {

            const todosLosBarrios =
                this.capaBarrios
                    .obtenerNombres();

            this.selectorBarrios
                .establecerBarrios(
                    todosLosBarrios
                );

            return;
        }

        const barrios =
            this.capaBarrios
                .obtenerBarrios();

        const barriosFiltrados =
            barrios
                .filter(
                    barrio => {

                        const zonaBarrio =
                            obtenerZona(
                                barrio.nombre
                            );

                        return zonas.includes(
                            zonaBarrio
                        );
                    }
                )
                .map(
                    barrio =>
                        barrio.nombre
                );

        this.selectorBarrios
            .establecerBarrios(
                barriosFiltrados
            );
    }

    crearLogo() {

        this.logo =
            document.createElement(
                'img'
            );

        this.logo.src =
            '/assets/logoMETRONET.png';

        this.logo.alt =
            'METRONET';

        this.logo.id =
            'metronet-logo';

        Object.assign(
            this.logo.style,
            {

                position:
                    'fixed',

                top:
                    '10px',

                left:
                    '50%',

                transform:
                    'translateX(-50%)',

                width:
                    '150px',

                height:
                    'auto',

                zIndex:
                    '2000',

                pointerEvents:
                    'none',

                userSelect:
                    'none',

                display:
                    'block'
            }
        );

        document.body.appendChild(
            this.logo
        );
    }

    ajustarTamanoLogo() {

        if (!this.logo) {
            return;
        }

        const ancho =
            Math.min(
                150,
                this.scale.width * 0.18
            );

        this.logo.style.width =
            `${ancho}px`;
    }

    ajustarMapa() {

        if (!this.capaBarrios) {
            return;
        }

        this.capaBarrios.ajustarMapa(
            this.scale.width,
            this.scale.height
        );
    }

    actualizarTamano() {

        if (this.capaMapaBase) {

            this.capaMapaBase.actualizar();
        }

        this.ajustarMapa();

        this.ajustarTamanoLogo();
    }

    limpiar() {

        if (this.selectorZonas) {

            this.selectorZonas.eliminar();

            this.selectorZonas =
                null;
        }

        if (this.selectorBarrios) {

            this.selectorBarrios.eliminar();

            this.selectorBarrios =
                null;
        }

        if (this.capaZonas) {

            this.capaZonas.eliminar();

            this.capaZonas =
                null;
        }

        if (this.capaBarrios) {

            this.capaBarrios.eliminar();

            this.capaBarrios =
                null;
        }

        if (this.capaMapaBase) {

            this.capaMapaBase.eliminar();

            this.capaMapaBase =
                null;
        }

        if (this.logo) {

            this.logo.remove();

            this.logo =
                null;
        }
    }
}