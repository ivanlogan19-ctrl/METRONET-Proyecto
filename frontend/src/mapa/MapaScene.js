import Phaser from 'phaser';

export default class MapaScene extends Phaser.Scene {

    constructor() {
        super('MapaScene');
    }

    preload() {
        this.load.json(
            'barriosMontevideo',
            '/src/mapa/datos/barrios_wgs84.geojson'
        );
    }

    create() {
        this.barrios = this.cache.json.get('barriosMontevideo');

        this.nombreBarrio = null;

        this.dibujarMapa();
    }

    obtenerTransformacion() {

        const coordenadas = [];

        this.barrios.features.forEach((feature) => {

            const geometria = feature.geometry;

            if (geometria.type === 'Polygon') {

                geometria.coordinates.forEach((anillo) => {

                    anillo.forEach((coordenada) => {
                        coordenadas.push(coordenada);
                    });

                });

            }

            if (geometria.type === 'MultiPolygon') {

                geometria.coordinates.forEach((poligonos) => {

                    poligonos.forEach((anillos) => {

                        anillos.forEach((anillo) => {

                            anillo.forEach((coordenada) => {
                                coordenadas.push(coordenada);
                            });

                        });

                    });

                });

            }

        });

        const longitudes = coordenadas.map(
            (coordenada) => coordenada[0]
        );

        const latitudes = coordenadas.map(
            (coordenada) => coordenada[1]
        );

        const minLongitud = Math.min(...longitudes);
        const maxLongitud = Math.max(...longitudes);

        const minLatitud = Math.min(...latitudes);
        const maxLatitud = Math.max(...latitudes);

        const anchoMapa =
            maxLongitud - minLongitud;

        const altoMapa =
            maxLatitud - minLatitud;

        const margen = 40;

        const escalaX =
            (this.scale.width - margen * 2) /
            anchoMapa;

        const escalaY =
            (this.scale.height - margen * 2) /
            altoMapa;

        const escala =
            Math.min(escalaX, escalaY);

        const anchoFinal =
            anchoMapa * escala;

        const altoFinal =
            altoMapa * escala;

        const desplazamientoX =
            (this.scale.width - anchoFinal) / 2;

        const desplazamientoY =
            (this.scale.height - altoFinal) / 2;

        return {
            minLongitud,
            maxLatitud,
            escala,
            desplazamientoX,
            desplazamientoY
        };
    }

    convertirCoordenadas(
        longitud,
        latitud,
        transformacion
    ) {

        const x =
            (longitud - transformacion.minLongitud) *
            transformacion.escala +
            transformacion.desplazamientoX;

        const y =
            (transformacion.maxLatitud - latitud) *
            transformacion.escala +
            transformacion.desplazamientoY;

        return {
            x,
            y
        };
    }

    dibujarMapa() {

        const transformacion =
            this.obtenerTransformacion();

        this.barrios.features.forEach((feature) => {

            const geometria = feature.geometry;

            if (geometria.type === 'Polygon') {

                this.dibujarBarrio(
                    feature,
                    geometria.coordinates,
                    transformacion
                );
            }

            if (geometria.type === 'MultiPolygon') {

                geometria.coordinates.forEach((poligono) => {

                    this.dibujarBarrio(
                        feature,
                        poligono,
                        transformacion
                    );

                });
            }

        });
    }

    dibujarBarrio(
        feature,
        poligono,
        transformacion
    ) {

        const anilloExterior = poligono[0];

        const puntos = anilloExterior.map(
            (coordenada) => {

                return this.convertirCoordenadas(
                    coordenada[0],
                    coordenada[1],
                    transformacion
                );

            }
        );

        // Dibujar el barrio
        const grafico =
            this.add.graphics();

        grafico.fillStyle(
            0x1674C8,
            0.35
        );

        grafico.lineStyle(
            1,
            0xffffff,
            0.8
        );

        grafico.beginPath();

        puntos.forEach((punto, indice) => {

            if (indice === 0) {

                grafico.moveTo(
                    punto.x,
                    punto.y
                );

            } else {

                grafico.lineTo(
                    punto.x,
                    punto.y
                );

            }

        });

        grafico.closePath();

        grafico.fillPath();
        grafico.strokePath();

        // Crear zona invisible para hacer clic
        const zona =
            this.add.polygon(
                0,
                0,
                puntos.map((punto) => [
                    punto.x,
                    punto.y
                ])
            );

        zona.setInteractive(
            new Phaser.Geom.Polygon(
                puntos.map((punto) => [
                    punto.x,
                    punto.y
                ])
            ),
            Phaser.Geom.Polygon.Contains
        );

        // La zona sigue siendo interactiva,
        // pero no se ve.
        zona.alpha = 0;

        zona.on('pointerdown', () => {

            this.mostrarNombreBarrio(
                feature,
                puntos
            );

        });
    }

    mostrarNombreBarrio(
        feature,
        puntos
    ) {

        if (this.nombreBarrio) {

            this.nombreBarrio.destroy();

            this.nombreBarrio = null;
        }

        let nombre =
            feature.properties.BARRIO;

        nombre =
            this.quitarTildes(nombre);

        let sumaX = 0;
        let sumaY = 0;

        puntos.forEach((punto) => {

            sumaX += punto.x;
            sumaY += punto.y;

        });

        const centroX =
            sumaX / puntos.length;

        const centroY =
            sumaY / puntos.length;

        this.nombreBarrio =
            this.add.text(
                centroX,
                centroY,
                nombre,
                {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: '#ffffff',
                    backgroundColor: '#0B2545',
                    padding: {
                        left: 5,
                        right: 5,
                        top: 3,
                        bottom: 3
                    }
                }
            );

        this.nombreBarrio.setOrigin(0.5);

        this.nombreBarrio.setDepth(1000);
    }

    quitarTildes(texto) {

        if (!texto) {
            return '';
        }

        return texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }
}