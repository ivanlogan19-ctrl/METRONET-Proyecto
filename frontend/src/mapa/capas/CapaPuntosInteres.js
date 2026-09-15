import Phaser from 'phaser';

import { obtenerZona } from '../utilidades/ClasificadorZonas.js';

export default class CapaPuntosInteres {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    this.capaBarrios = opciones.capaBarrios || null;

    this.datos = opciones.datos || null;

    this.puntos = [];

    this.elementos = [];

    this.panelInformacion = null;

    /*
     * Los puntos aparecen cuando
     * el mapa llega a zoom 2.
     */
    this.zoomMinimoVisible = 2;

    this.tamanoIcono = 28;

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

        puntosUnicos.set(clave, {
          ...punto,

          id: punto.id ?? siguienteId,

          barrio: nombreBarrio,

          longitud: longitud,

          latitud: latitud,
        });

        siguienteId++;
      }
    }

    this.puntos = Array.from(puntosUnicos.values());
  }

  normalizarNombre(nombre) {
    return String(nombre || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  puntoPerteneceASeleccion(punto) {
    const barrioPunto = this.normalizarNombre(punto.barrio);

    /*
     * Si hay barrios seleccionados,
     * mostramos solamente sus puntos.
     */
    if (this.barriosSeleccionados.length > 0) {
      return this.barriosSeleccionados.some((barrio) => {
        return this.normalizarNombre(barrio) === barrioPunto;
      });
    }

    /*
     * Si hay zonas seleccionadas,
     * mostramos los puntos de esas zonas.
     */
    if (this.zonasSeleccionadas.length > 0) {
      const zona = obtenerZona(punto.barrio);

      return this.zonasSeleccionadas.some((zonaSeleccionada) => {
        return this.normalizarNombre(zonaSeleccionada) === this.normalizarNombre(zona);
      });
    }

    /*
     * Sin filtros:
     * todos los puntos pueden mostrarse.
     */
    return true;
  }

  obtenerZoomActual() {
    if (!this.escena || !this.escena.cameras || !this.escena.cameras.main) {
      return 1;
    }

    return this.escena.cameras.main.zoom || 1;
  }

  obtenerIcono(punto) {
    const tipo = this.normalizarNombre(punto.tipo);

    if (
      tipo.includes('MONUMENTO') ||
      tipo.includes('HISTORICO') ||
      tipo.includes('HISTORICA') ||
      tipo.includes('PATRIMONIO')
    ) {
      return '🏛️';
    }

    if (
      tipo.includes('PLAZA') ||
      tipo.includes('PARQUE') ||
      tipo.includes('JARDIN') ||
      tipo.includes('ESPACIO VERDE')
    ) {
      return '🌳';
    }

    if (tipo.includes('TEATRO')) {
      return '🎭';
    }

    if (tipo.includes('MUSEO')) {
      return '🏛️';
    }

    if (tipo.includes('ESTADIO') || tipo.includes('ARENA')) {
      return '🏟️';
    }

    if (tipo.includes('HOSPITAL')) {
      return '🏥';
    }

    if (tipo.includes('UNIVERSIDAD') || tipo.includes('EDUCACION') || tipo.includes('FACULTAD')) {
      return '🎓';
    }

    if (tipo.includes('BIBLIOTECA')) {
      return '📚';
    }

    if (tipo.includes('IGLESIA') || tipo.includes('CAPILLA')) {
      return '⛪';
    }

    if (tipo.includes('MERCADO')) {
      return '🛒';
    }

    if (tipo.includes('FERIA')) {
      return '🛍️';
    }

    if (tipo.includes('PLAYA')) {
      return '🏖️';
    }

    if (tipo.includes('RAMBLA')) {
      return '🌊';
    }

    if (tipo.includes('PUERTO')) {
      return '⚓';
    }

    if (tipo.includes('FARO')) {
      return '🗼';
    }

    if (tipo.includes('MIRADOR')) {
      return '🔭';
    }

    if (tipo.includes('TERMINAL')) {
      return '🚌';
    }

    if (tipo.includes('ESTACION')) {
      return '🚉';
    }

    if (tipo.includes('FERROVIARIO')) {
      return '🚂';
    }

    if (tipo.includes('HIPODROMO')) {
      return '🏇';
    }

    if (tipo.includes('DEPORTIVO') || tipo.includes('DEPORTE')) {
      return '⚽';
    }

    if (tipo.includes('CULTURAL')) {
      return '🎨';
    }

    if (tipo.includes('BODEGA')) {
      return '🍇';
    }

    if (tipo.includes('COMERCIAL')) {
      return '🏬';
    }

    if (tipo.includes('EDIFICIO') || tipo.includes('COMPLEJO')) {
      return '🏢';
    }

    if (tipo.includes('LAGO')) {
      return '💧';
    }

    /*
     * Si aparece un tipo nuevo que todavía
     * no tenemos clasificado, usamos este
     * icono genérico.
     */
    return '📍';
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

    const icono = this.obtenerIcono(punto);

    const texto = this.escena.add.text(
      posicion.x,

      posicion.y,

      icono,

      {
        fontFamily: 'Arial',

        fontSize: `${this.tamanoIcono}px`,

        color: '#FFFFFF',

        stroke: '#000000',

        strokeThickness: 3,

        align: 'center',

        resolution: 2,
      },
    );

    texto.setOrigin(0.5, 0.5);

    texto.setDepth(100);

    texto.setInteractive({
      useHandCursor: true,
    });

    texto.on('pointerdown', () => {
      this.mostrarInformacion(punto);
    });

    texto.on('pointerover', () => {
      texto.setAlpha(0.75);
    });

    texto.on('pointerout', () => {
      texto.setAlpha(1);
    });

    this.elementos.push(texto);
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
     * Los puntos solamente aparecen
     * a partir de zoom 2.
     */
    const mostrar = zoom >= this.zoomMinimoVisible;

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
  }

  ocultarInformacion() {
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
