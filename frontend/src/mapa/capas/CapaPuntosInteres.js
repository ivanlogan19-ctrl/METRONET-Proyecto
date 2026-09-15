import Phaser from 'phaser';

import { obtenerZona } from '../utilidades/ClasificadorZonas.js';

export const COLORES_PUNTOS_INTERES = Object.freeze({
  PATRIMONIO: 0xf3c86b,
  NATURALEZA: 0x69cf9a,
  CULTURA: 0xdc82c4,
  MOVILIDAD: 0x7ba8ff,
  SALUD: 0xf07878,
  EDUCACION: 0xb99cff,
  COMERCIO: 0xffaa67,
  COSTA: 0x6cd7f7,
  OTROS: 0x49c3f2,
});

export default class CapaPuntosInteres {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    this.capaBarrios = opciones.capaBarrios || null;

    this.datos = opciones.datos || null;

    this.puntos = [];

    this.elementos = [];

    this.panelInformacion = null;

    this.manejadorClicFueraInformacion = null;

    this.retrasoCierreInformacion = null;

    /*
     * Los puntos aparecen solamente al llegar
     * al máximo de zoom seguro de la selección.
     */
    this.zoomMinimoVisibleBase = 2;

    this.zoomMinimoVisible = this.zoomMinimoVisibleBase;

    this.zonasSeleccionadas = [];

    this.barriosSeleccionados = [];

    this.zoomAnterior = null;

    /*
     * Escuchamos las actualizaciones de Phaser.
     *
     * Esto permite detectar el cambio de zoom
     * aunque ControlZoom no llame directamente
     * a esta capa.
     */
    if (this.escena && this.escena.events) {
      this.escena.events.on(Phaser.Scenes.Events.UPDATE, this.actualizar, this);
    }

    this.crearEstilos();
  }

  establecerDatos(datos) {
    this.datos = datos;

    this.extraerPuntos();

    this.dibujar();
  }

  establecerCapaBarrios(capaBarrios) {
    this.capaBarrios = capaBarrios;

    this.extraerPuntos();

    this.dibujar();
  }

  establecerZonasSeleccionadas(zonas) {
    this.zonasSeleccionadas = Array.isArray(zonas) ? [...zonas] : [];

    this.dibujar();
  }

  establecerBarriosSeleccionados(barrios) {
    this.barriosSeleccionados = Array.isArray(barrios) ? [...barrios] : [];

    this.dibujar();
  }

  ajustarZoomVisibleAlMaximo(zoomMaximo) {
    const zoom = Number(zoomMaximo);

    if (!Number.isFinite(zoom)) {
      this.restablecerZoomMinimoVisible();

      return;
    }

    this.zoomMinimoVisible = Math.max(1, zoom);

    this.actualizarVisibilidad(this.obtenerZoomActual());
  }

  restablecerZoomMinimoVisible() {
    this.zoomMinimoVisible = this.zoomMinimoVisibleBase;

    this.actualizarVisibilidad(this.obtenerZoomActual());
  }

  extraerPuntos() {
    this.puntos = [];

    if (!this.datos || !this.datos.barrios) {
      return;
    }

    const puntosUnicos = new Map();

    let siguienteId = 1;

    for (const nombreBarrio of Object.keys(this.datos.barrios)) {
      const datosBarrio = this.datos.barrios[nombreBarrio];

      if (!datosBarrio || !Array.isArray(datosBarrio.puntos)) {
        continue;
      }

      for (const punto of datosBarrio.puntos) {
        if (!punto) {
          continue;
        }

        const longitud = Number(punto.longitud);

        const latitud = Number(punto.latitud);

        if (!Number.isFinite(longitud) || !Number.isFinite(latitud)) {
          continue;
        }

        const clave =
          this.normalizarNombre(nombreBarrio) +
          '|' +
          this.normalizarNombre(punto.nombre) +
          '|' +
          longitud.toFixed(6) +
          '|' +
          latitud.toFixed(6);

        if (puntosUnicos.has(clave)) {
          continue;
        }

        const ubicacionGeografica = this.obtenerUbicacionGeografica(longitud, latitud);

        puntosUnicos.set(clave, {
          ...punto,

          id: punto.id ?? siguienteId,

          barrio: nombreBarrio,

          barrioGeografico: ubicacionGeografica?.nombre ?? null,

          zonaGeografica: ubicacionGeografica?.zona ?? obtenerZona(nombreBarrio),

          longitud: longitud,

          latitud: latitud,
        });

        siguienteId++;
      }
    }

    this.puntos = Array.from(puntosUnicos.values());
  }

  obtenerUbicacionGeografica(longitud, latitud) {
    if (!this.capaBarrios) {
      return null;
    }

    const punto = [longitud, latitud];

    for (const barrio of this.capaBarrios.obtenerBarrios()) {
      if (this.puntoEstaEnGeometria(punto, barrio.feature?.geometry)) {
        return barrio;
      }
    }

    return null;
  }

  puntoEstaEnGeometria(punto, geometria) {
    if (!geometria) {
      return false;
    }

    if (geometria.type === 'Polygon') {
      return this.puntoEstaEnPoligono(punto, geometria.coordinates);
    }

    if (geometria.type === 'MultiPolygon') {
      return geometria.coordinates.some((poligono) => this.puntoEstaEnPoligono(punto, poligono));
    }

    return false;
  }

  puntoEstaEnPoligono(punto, anillos) {
    if (!Array.isArray(anillos) || anillos.length === 0) {
      return false;
    }

    const [anilloExterior, ...huecos] = anillos;

    return (
      this.puntoEstaEnAnillo(punto, anilloExterior) &&
      !huecos.some((anillo) => this.puntoEstaEnAnillo(punto, anillo))
    );
  }

  puntoEstaEnAnillo([x, y], anillo) {
    if (!Array.isArray(anillo) || anillo.length < 3) {
      return false;
    }

    let estaDentro = false;

    for (
      let indice = 0, anterior = anillo.length - 1;
      indice < anillo.length;
      anterior = indice++
    ) {
      const [xActual, yActual] = anillo[indice];

      const [xAnterior, yAnterior] = anillo[anterior];

      const intersecta =
        yActual > y !== yAnterior > y &&
        x < ((xAnterior - xActual) * (y - yActual)) / (yAnterior - yActual) + xActual;

      if (intersecta) {
        estaDentro = !estaDentro;
      }
    }

    return estaDentro;
  }

  normalizarNombre(nombre) {
    return String(nombre || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  puntoPerteneceASeleccion(punto) {
    const barrioPunto = this.normalizarNombre(punto.barrioGeografico);

    const perteneceABarrio = this.barriosSeleccionados.some((barrio) => {
      return this.normalizarNombre(barrio) === barrioPunto;
    });

    const perteneceAZona = this.zonasSeleccionadas.some((zonaSeleccionada) => {
      return (
        this.normalizarNombre(zonaSeleccionada) === this.normalizarNombre(punto.zonaGeografica)
      );
    });

    /*
     * Un punto pertenece a la selección si su
     * barrio o su zona fueron seleccionados.
     */
    return perteneceABarrio || perteneceAZona;
  }

  obtenerZoomActual() {
    if (!this.escena || !this.escena.cameras || !this.escena.cameras.main) {
      return 1;
    }

    return this.escena.cameras.main.zoom || 1;
  }

  obtenerColorMarcador(punto) {
    const tipo = this.normalizarNombre(punto.tipo);

    if (
      tipo.includes('MONUMENTO') ||
      tipo.includes('HISTORICO') ||
      tipo.includes('HISTORICA') ||
      tipo.includes('PATRIMONIO')
    ) {
      return COLORES_PUNTOS_INTERES.PATRIMONIO;
    }

    if (
      tipo.includes('PLAZA') ||
      tipo.includes('PARQUE') ||
      tipo.includes('JARDIN') ||
      tipo.includes('ESPACIO VERDE')
    ) {
      return COLORES_PUNTOS_INTERES.NATURALEZA;
    }

    if (tipo.includes('TEATRO')) {
      return COLORES_PUNTOS_INTERES.CULTURA;
    }

    if (tipo.includes('MUSEO')) {
      return COLORES_PUNTOS_INTERES.PATRIMONIO;
    }

    if (tipo.includes('ESTADIO') || tipo.includes('ARENA')) {
      return COLORES_PUNTOS_INTERES.MOVILIDAD;
    }

    if (tipo.includes('HOSPITAL')) {
      return COLORES_PUNTOS_INTERES.SALUD;
    }

    if (tipo.includes('UNIVERSIDAD') || tipo.includes('EDUCACION') || tipo.includes('FACULTAD')) {
      return COLORES_PUNTOS_INTERES.EDUCACION;
    }

    if (tipo.includes('BIBLIOTECA')) {
      return COLORES_PUNTOS_INTERES.EDUCACION;
    }

    if (tipo.includes('IGLESIA') || tipo.includes('CAPILLA')) {
      return COLORES_PUNTOS_INTERES.PATRIMONIO;
    }

    if (tipo.includes('MERCADO')) {
      return COLORES_PUNTOS_INTERES.COMERCIO;
    }

    if (tipo.includes('FERIA')) {
      return COLORES_PUNTOS_INTERES.COMERCIO;
    }

    if (tipo.includes('PLAYA')) {
      return COLORES_PUNTOS_INTERES.COSTA;
    }

    if (tipo.includes('RAMBLA')) {
      return COLORES_PUNTOS_INTERES.COSTA;
    }

    if (tipo.includes('PUERTO')) {
      return COLORES_PUNTOS_INTERES.COSTA;
    }

    if (tipo.includes('FARO')) {
      return COLORES_PUNTOS_INTERES.PATRIMONIO;
    }

    if (tipo.includes('MIRADOR')) {
      return COLORES_PUNTOS_INTERES.PATRIMONIO;
    }

    if (tipo.includes('TERMINAL')) {
      return COLORES_PUNTOS_INTERES.MOVILIDAD;
    }

    if (tipo.includes('ESTACION')) {
      return COLORES_PUNTOS_INTERES.MOVILIDAD;
    }

    if (tipo.includes('FERROVIARIO')) {
      return COLORES_PUNTOS_INTERES.MOVILIDAD;
    }

    if (tipo.includes('HIPODROMO')) {
      return COLORES_PUNTOS_INTERES.MOVILIDAD;
    }

    if (tipo.includes('DEPORTIVO') || tipo.includes('DEPORTE')) {
      return COLORES_PUNTOS_INTERES.MOVILIDAD;
    }

    if (tipo.includes('CULTURAL')) {
      return COLORES_PUNTOS_INTERES.CULTURA;
    }

    if (tipo.includes('BODEGA')) {
      return COLORES_PUNTOS_INTERES.CULTURA;
    }

    if (tipo.includes('COMERCIAL')) {
      return COLORES_PUNTOS_INTERES.COMERCIO;
    }

    if (tipo.includes('EDIFICIO') || tipo.includes('COMPLEJO')) {
      return COLORES_PUNTOS_INTERES.PATRIMONIO;
    }

    if (tipo.includes('LAGO')) {
      return COLORES_PUNTOS_INTERES.COSTA;
    }

    /*
     * Si aparece un tipo nuevo que todavía
     * no tenemos clasificado, usamos este
     * marcador genérico.
     */
    return COLORES_PUNTOS_INTERES.OTROS;
  }

  convertirCoordenada(longitud, latitud) {
    if (!this.capaBarrios) {
      return null;
    }

    const transformacion = this.capaBarrios.calcularEscalaMapa();

    if (!transformacion) {
      return null;
    }

    return this.capaBarrios.convertirCoordenada(
      [longitud, latitud],

      transformacion,
    );
  }

  dibujar() {
    this.eliminarElementos();

    for (const punto of this.puntos) {
      if (!this.puntoPerteneceASeleccion(punto)) {
        continue;
      }

      this.dibujarPunto(punto);
    }

    /*
     * Aplicamos inmediatamente la visibilidad
     * correspondiente al zoom actual.
     */
    this.actualizarVisibilidad(this.obtenerZoomActual());

    this.actualizarTamanoIconos();

    this.zoomAnterior = this.obtenerZoomActual();
  }

  dibujarPunto(punto) {
    /*
     * IMPORTANTE:
     *
     * Usamos directamente la longitud
     * y latitud del JSON.
     *
     * No desplazamos el punto.
     */
    const posicion = this.convertirCoordenada(
      punto.longitud,

      punto.latitud,
    );

    if (!posicion) {
      return;
    }

    const color = this.obtenerColorMarcador(punto);

    const marcador = this.escena.add.graphics();

    marcador.fillStyle(0x061d32, 0.96);
    marcador.fillCircle(0, 0, 10);
    marcador.lineStyle(2, 0xe8f8ff, 0.9);
    marcador.strokeCircle(0, 0, 10);
    marcador.fillStyle(color, 1);
    marcador.fillCircle(0, 0, 4);
    marcador.lineStyle(1, color, 0.95);
    marcador.strokeCircle(0, 0, 6);

    const contenedor = this.escena.add.container(posicion.x, posicion.y, [marcador]);

    contenedor.setDepth(100);

    const areaInteraccion = this.escena.add.zone(posicion.x, posicion.y, 28, 28);

    areaInteraccion.setOrigin(0.5, 0.5);
    areaInteraccion.setDepth(101);
    areaInteraccion.setInteractive({ useHandCursor: true });

    areaInteraccion.on('pointerdown', () => {
      this.mostrarInformacion(punto);
    });

    areaInteraccion.on('pointerover', () => {
      contenedor.setAlpha(0.8);
    });

    areaInteraccion.on('pointerout', () => {
      contenedor.setAlpha(1);
    });

    this.elementos.push(contenedor, areaInteraccion);
  }

  actualizar() {
    const zoom = this.obtenerZoomActual();

    /*
     * Solamente hacemos trabajo cuando
     * realmente cambió el zoom.
     */
    if (this.zoomAnterior === zoom) {
      return;
    }

    this.actualizarVisibilidad(zoom);

    this.actualizarTamanoIconos();

    this.zoomAnterior = zoom;
  }

  actualizarTamanoIconos() {
    const zoom = this.obtenerZoomActual();

    /*
     * Compensamos el zoom de la cámara
     * para mantener el icono estable.
     */
    const escala = 1 / zoom;

    for (const elemento of this.elementos) {
      if (!elemento) {
        continue;
      }

      elemento.setScale(escala);
    }
  }

  actualizarVisibilidad(zoom) {
    /*
     * Mostramos los puntos al llegar al máximo
     * de zoom seguro de la selección activa.
     */
    const mostrar = zoom + 0.001 >= this.zoomMinimoVisible;

    for (const elemento of this.elementos) {
      if (!elemento) {
        continue;
      }

      elemento.setVisible(mostrar);
    }
  }

  mostrarInformacion(punto) {
    this.ocultarInformacion();

    this.panelInformacion = document.createElement('div');

    this.panelInformacion.className = 'metronet-punto-interes-panel';

    const titulo = document.createElement('div');

    titulo.className = 'metronet-punto-interes-titulo';

    titulo.textContent = punto.nombre;

    const tipo = document.createElement('div');

    tipo.className = 'metronet-punto-interes-tipo';

    tipo.textContent = punto.tipo || 'Punto de interés';

    const descripcion = document.createElement('div');

    descripcion.className = 'metronet-punto-interes-descripcion';

    descripcion.textContent = punto.descripcion || 'Sin descripción disponible.';

    const barrio = document.createElement('div');

    barrio.className = 'metronet-punto-interes-barrio';

    barrio.textContent = `Barrio: ${punto.barrio}`;

    const botonCerrar = document.createElement('button');

    botonCerrar.type = 'button';

    botonCerrar.className = 'metronet-punto-interes-cerrar';

    botonCerrar.textContent = '×';

    botonCerrar.addEventListener('click', () => {
      this.ocultarInformacion();
    });

    this.panelInformacion.appendChild(botonCerrar);

    this.panelInformacion.appendChild(titulo);

    this.panelInformacion.appendChild(tipo);

    this.panelInformacion.appendChild(descripcion);

    this.panelInformacion.appendChild(barrio);

    document.body.appendChild(this.panelInformacion);

    this.programarCierreInformacionAlClicFuera();
  }

  programarCierreInformacionAlClicFuera() {
    this.cancelarCierreInformacionAlClicFuera();

    this.manejadorClicFueraInformacion = (evento) => {
      if (this.panelInformacion && !this.panelInformacion.contains(evento.target)) {
        this.ocultarInformacion();
      }
    };

    this.retrasoCierreInformacion = window.setTimeout(() => {
      if (this.panelInformacion && this.manejadorClicFueraInformacion) {
        document.addEventListener('pointerdown', this.manejadorClicFueraInformacion, true);
      }

      this.retrasoCierreInformacion = null;
    }, 0);
  }

  cancelarCierreInformacionAlClicFuera() {
    if (this.retrasoCierreInformacion !== null) {
      window.clearTimeout(this.retrasoCierreInformacion);

      this.retrasoCierreInformacion = null;
    }

    if (this.manejadorClicFueraInformacion) {
      document.removeEventListener('pointerdown', this.manejadorClicFueraInformacion, true);

      this.manejadorClicFueraInformacion = null;
    }
  }

  ocultarInformacion() {
    this.cancelarCierreInformacionAlClicFuera();

    if (this.panelInformacion) {
      this.panelInformacion.remove();

      this.panelInformacion = null;
    }
  }

  eliminarElementos() {
    for (const elemento of this.elementos) {
      if (elemento) {
        elemento.destroy();
      }
    }

    this.elementos = [];
  }

  eliminar() {
    /*
     * Dejamos de escuchar las actualizaciones
     * de Phaser antes de eliminar la escena.
     */
    if (this.escena && this.escena.events) {
      this.escena.events.off(Phaser.Scenes.Events.UPDATE, this.actualizar, this);
    }

    this.ocultarInformacion();

    this.eliminarElementos();

    this.puntos = [];

    this.datos = null;

    this.zonasSeleccionadas = [];

    this.barriosSeleccionados = [];

    this.capaBarrios = null;

    this.escena = null;
  }

  crearEstilos() {
    const id = 'metronet-puntos-interes-estilos';

    if (document.getElementById(id)) {
      return;
    }

    const estilos = document.createElement('style');

    estilos.id = id;

    estilos.textContent = `

            .metronet-punto-interes-panel {

                position:
                    fixed;

                top:
                    50%;

                left:
                    50%;

                transform:
                    translate(
                        -50%,
                        -50%
                    );

                z-index:
                    4000;

                width:
                    280px;

                padding:
                    18px;

                background:
                    rgba(
                        0,
                        0,
                        0,
                        0.92
                    );

                border:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        0.25
                    );

                border-radius:
                    8px;

                box-shadow:
                    0 4px 18px
                    rgba(
                        0,
                        0,
                        0,
                        0.45
                    );

                color:
                    #FFFFFF;

                font-family:
                    Arial,
                    sans-serif;

            }

            .metronet-punto-interes-titulo {

                margin-bottom:
                    6px;

                font-size:
                    18px;

                font-weight:
                    600;

            }

            .metronet-punto-interes-tipo {

                margin-bottom:
                    10px;

                font-size:
                    13px;

                opacity:
                    0.7;

            }

            .metronet-punto-interes-descripcion {

                margin-bottom:
                    12px;

                font-size:
                    14px;

                line-height:
                    1.4;

            }

            .metronet-punto-interes-barrio {

                font-size:
                    13px;

                opacity:
                    0.8;

            }

            .metronet-punto-interes-cerrar {

                position:
                    absolute;

                top:
                    6px;

                right:
                    8px;

                width:
                    26px;

                height:
                    26px;

                padding:
                    0;

                border:
                    none;

                background:
                    transparent;

                color:
                    #FFFFFF;

                font-size:
                    22px;

                cursor:
                    pointer;

            }

            .metronet-punto-interes-cerrar:hover {

                opacity:
                    0.7;

            }

        `;

    document.head.appendChild(estilos);
  }
}
