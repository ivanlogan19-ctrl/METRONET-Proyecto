export default class PanelDinamico {

    constructor(opciones = {}) {

        this.id =
            opciones.id ??
            'metronet-panel';

        this.titulo =
            opciones.titulo ??
            '';

        this.ancho =
            opciones.ancho ??
            130;

        this.posicion =
            opciones.posicion ??
            {
                top: 55,
                right: 8
            };

        this.elemento =
            null;

        this.encabezado =
            null;

        this.contenido =
            null;

        this.abierto =
            false;
    }

    crear() {

        this.eliminar();

        this.crearEstilos();

        const panel =
            document.createElement('div');

        panel.id =
            this.id;

        panel.className =
            'metronet-panel-dinamico';

        panel.style.width =
            `${this.ancho}px`;

        panel.style.top =
            `${this.posicion.top}px`;

        panel.style.right =
            `${this.posicion.right}px`;

        const encabezado =
            document.createElement('button');

        encabezado.type =
            'button';

        encabezado.className =
            'metronet-panel-encabezado';

        encabezado.textContent =
            `${this.titulo} ▼`;

        const contenido =
            document.createElement('div');

        contenido.className =
            'metronet-panel-contenido';

        panel.appendChild(
            encabezado
        );

        panel.appendChild(
            contenido
        );

        document.body.appendChild(
            panel
        );

        this.elemento =
            panel;

        this.encabezado =
            encabezado;

        this.contenido =
            contenido;

        this.contenido.style.display =
            'none';

        this.encabezado.addEventListener(
            'click',
            () => {

                this.alternarContenido();
            }
        );

        return panel;
    }

    establecerTitulo(titulo) {

        this.titulo =
            titulo;

        this.actualizarEncabezado();
    }

    actualizarEncabezado() {

        if (!this.encabezado) {
            return;
        }

        this.encabezado.textContent =
            this.abierto
                ? `${this.titulo} ▲`
                : `${this.titulo} ▼`;
    }

    establecerContenido(contenido) {

        if (!this.contenido) {
            return;
        }

        this.contenido.innerHTML =
            contenido;
    }

    agregarElemento(elemento) {

        if (!this.contenido) {
            return;
        }

        this.contenido.appendChild(
            elemento
        );
    }

    mostrar() {

        if (!this.elemento) {
            return;
        }

        this.elemento.style.display =
            'block';
    }

    ocultar() {

        if (!this.elemento) {
            return;
        }

        this.elemento.style.display =
            'none';

        this.abierto =
            false;

        this.actualizarEncabezado();
    }

    alternar() {

        if (!this.elemento) {
            return;
        }

        const oculto =
            this.elemento.style.display ===
            'none';

        if (oculto) {
            this.mostrar();
        } else {
            this.ocultar();
        }
    }

    alternarContenido() {

        if (
            !this.contenido ||
            !this.elemento
        ) {
            return;
        }

        if (this.abierto) {

            this.cerrarContenido();

            return;
        }

        this.abrirContenido();
    }

    abrirContenido() {

        if (
            !this.contenido ||
            !this.elemento
        ) {
            return;
        }

        this.cerrarOtrosPaneles();

        this.contenido.style.display =
            'block';

        this.abierto =
            true;

        this.actualizarEncabezado();

        this.ajustarPosicionPantalla();
    }

    cerrarContenido() {

        if (!this.contenido) {
            return;
        }

        this.contenido.style.display =
            'none';

        this.abierto =
            false;

        this.actualizarEncabezado();
    }

    cerrarOtrosPaneles() {

        const paneles =
            document.querySelectorAll(
                '.metronet-panel-dinamico'
            );

        paneles.forEach(
            (panel) => {

                if (
                    panel ===
                    this.elemento
                ) {
                    return;
                }

                const encabezado =
                    panel.querySelector(
                        '.metronet-panel-encabezado'
                    );

                const contenido =
                    panel.querySelector(
                        '.metronet-panel-contenido'
                    );

                if (
                    contenido &&
                    contenido.style.display !==
                    'none'
                ) {

                    contenido.style.display =
                        'none';

                    if (encabezado) {

                        encabezado.textContent =
                            encabezado.textContent
                                .replace(
                                    ' ▲',
                                    ' ▼'
                                );
                    }
                }
            }
        );
    }

    ajustarPosicionPantalla() {

        if (!this.elemento) {
            return;
        }

        const rect =
            this.elemento.getBoundingClientRect();

        const margen =
            8;

        let top =
            rect.top;

        let right =
            window.innerWidth -
            rect.right;

        if (
            rect.bottom >
            window.innerHeight -
            margen
        ) {

            top =
                window.innerHeight -
                rect.height -
                margen;
        }

        if (top < margen) {

            top =
                margen;
        }

        if (
            rect.right >
            window.innerWidth -
            margen
        ) {

            right =
                margen;
        }

        if (right < margen) {

            right =
                margen;
        }

        this.elemento.style.top =
            `${top}px`;

        this.elemento.style.right =
            `${right}px`;

        this.elemento.style.left =
            'auto';
    }

    mover(top, right) {

        this.posicion = {
            top,
            right
        };

        if (!this.elemento) {
            return;
        }

        this.elemento.style.top =
            `${top}px`;

        this.elemento.style.right =
            `${right}px`;

        this.elemento.style.left =
            'auto';
    }

    cambiarAncho(ancho) {

        this.ancho =
            ancho;

        if (!this.elemento) {
            return;
        }

        this.elemento.style.width =
            `${ancho}px`;
    }

    eliminar() {

        if (this.elemento) {

            this.elemento.remove();

            this.elemento =
                null;

            this.encabezado =
                null;

            this.contenido =
                null;

            this.abierto =
                false;
        }
    }

    crearEstilos() {

        if (
            document.getElementById(
                'metronet-panel-dinamico-styles'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'metronet-panel-dinamico-styles';

        style.textContent = `

            .metronet-panel-dinamico {

                position:
                    fixed;

                z-index:
                    1000;

                box-sizing:
                    border-box;

                width:
                    130px;

                background:
                    rgba(
                        11,
                        37,
                        69,
                        0.96
                    );

                border:
                    1px solid #6FA8DC;

                border-radius:
                    5px;

                color:
                    #FFFFFF;

                font-family:
                    Arial,
                    sans-serif;

                box-shadow:
                    0 2px 8px
                    rgba(
                        0,
                        0,
                        0,
                        0.35
                    );

                overflow:
                    visible;
            }

            .metronet-panel-encabezado {

                box-sizing:
                    border-box;

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    space-between;

                width:
                    100%;

                min-height:
                    30px;

                padding:
                    5px 7px;

                border:
                    none;

                border-radius:
                    4px;

                background:
                    #0B2545;

                color:
                    #FFFFFF;

                font-size:
                    10px;

                font-weight:
                    bold;

                text-align:
                    left;

                letter-spacing:
                    0.2px;

                cursor:
                    pointer;

                white-space:
                    nowrap;
            }

            .metronet-panel-encabezado:hover {

                background:
                    #12385F;
            }

            .metronet-panel-contenido {

                box-sizing:
                    border-box;

                width:
                    100%;

                max-height:
                    230px;

                padding:
                    6px;

                overflow-y:
                    auto;

                overflow-x:
                    hidden;

                border-top:
                    1px solid #6FA8DC;

                background:
                    rgba(
                        5,
                        18,
                        35,
                        0.98
                    );

                border-radius:
                    0 0 4px 4px;
            }

            .metronet-panel-contenido::-webkit-scrollbar {

                width:
                    4px;
            }

            .metronet-panel-contenido::-webkit-scrollbar-thumb {

                background:
                    #6FA8DC;

                border-radius:
                    4px;
            }

            @media (max-width: 700px) {

                .metronet-panel-dinamico {

                    width:
                        115px !important;

                    max-width:
                        calc(
                            50vw - 15px
                        );
                }

                .metronet-panel-contenido {

                    max-height:
                        200px;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }
}
