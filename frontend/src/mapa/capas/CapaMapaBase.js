export default class CapaMapaBase {

    constructor(escena, opciones = {}) {

        this.escena =
            escena;

        this.colorFondo =
            0x000000;

        this.grafico =
            null;
    }


    crear() {

        this.eliminar();

        this.grafico =
            this.escena.add.graphics();

        this.dibujar();

        return this;
    }


    dibujar() {

        if (!this.grafico) {
            return;
        }


        const ancho =
            this.escena.scale.width;

        const alto =
            this.escena.scale.height;


        this.grafico.clear();


        /*
         * Fondo completamente negro.
         */

        this.grafico.fillStyle(
            this.colorFondo,
            1
        );


        this.grafico.fillRect(
            0,
            0,
            ancho,
            alto
        );
    }


    actualizar() {

        this.dibujar();
    }


    redibujar() {

        this.dibujar();
    }


    eliminar() {

        if (this.grafico) {

            this.grafico.destroy();

            this.grafico =
                null;
        }
    }
}