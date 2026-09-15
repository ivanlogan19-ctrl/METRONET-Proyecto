export default class ControlZoom {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    this.capaBarrios = opciones.capaBarrios || null;

    this.factorZoom = opciones.factorZoom ?? 1.5;

    this.zoomMinimo = opciones.zoomMinimo ?? 1;

    this.zoomMaximo = opciones.zoomMaximo ?? 8;

    this.zoomActual = 1;

    this.centroSeleccion = null;

    this.contenedor = null;

    this.botonAcercar = null;

    this.botonAlejar = null;

    this.botonRestaurar = null;

    this.crearEstilos();
  }

  establecerCapaBarrios(capaBarrios) {
    this.capaBarrios = capaBarrios;
  }

  crear() {
    this.eliminar();

    this.contenedor = document.createElement('div');

    this.contenedor.className = 'metronet-control-zoom';

    this.botonAcercar = document.createElement('button');

    this.botonAcercar.type = 'button';

    this.botonAcercar.textContent = '+';

    this.botonAcercar.className = 'metronet-control-zoom-boton';

    this.botonAcercar.setAttribute('aria-label', 'Acercar mapa');

    this.botonAcercar.title = 'Acercar';

    this.botonAlejar = document.createElement('button');

    this.botonAlejar.type = 'button';

    this.botonAlejar.textContent = '−';

    this.botonAlejar.className = 'metronet-control-zoom-boton';

    this.botonAlejar.setAttribute('aria-label', 'Alejar mapa');

    this.botonAlejar.title = 'Alejar';

    this.botonRestaurar = document.createElement('button');

    this.botonRestaurar.type = 'button';

    this.botonRestaurar.textContent = '⌂';

    this.botonRestaurar.className = 'metronet-control-zoom-boton metronet-control-zoom-restaurar';

    this.botonRestaurar.setAttribute('aria-label', 'Restablecer vista del mapa');

    this.botonRestaurar.title = 'Vista general';

    this.botonAcercar.addEventListener('click', () => {
      this.acercar();
    });

    this.botonAlejar.addEventListener('click', () => {
      this.alejar();
    });

    this.botonRestaurar.addEventListener('click', () => {
      this.restaurar();
    });

    this.contenedor.appendChild(this.botonAcercar);

    this.contenedor.appendChild(this.botonAlejar);

    this.contenedor.appendChild(this.botonRestaurar);

    document.body.appendChild(this.contenedor);

    this.actualizarBotones();
  }

  obtenerCamara() {
    if (!this.escena || !this.escena.cameras) {
      return null;
    }

    return this.escena.cameras.main;
  }

  acercar() {
    const nuevoZoom = Math.min(
      this.zoomActual * this.factorZoom,

      this.zoomMaximo,
    );

    this.establecerZoom(nuevoZoom);
  }

  alejar() {
    const nuevoZoom = Math.max(
      this.zoomActual / this.factorZoom,

      this.zoomMinimo,
    );

    this.establecerZoom(nuevoZoom);
  }

  establecerZoom(zoom) {
    const nuevoZoom = this.normalizar(zoom);

    const camara = this.obtenerCamara();

    if (!camara) {
      return;
    }

    this.zoomActual = nuevoZoom;

    camara.setZoom(nuevoZoom);

    if (this.centroSeleccion) {
      this.centrarEnSeleccion(camara);
    } else {
      const centroMapa = this.obtenerCentroMapa();

      camara.centerOn(
        centroMapa.x,

        centroMapa.y,
      );
    }

    this.actualizarBotones();
  }

  enfocarBarrios(nombresBarrios = []) {
    if (!this.capaBarrios || !Array.isArray(nombresBarrios) || nombresBarrios.length === 0) {
      this.restaurar();

      return;
    }

    const nombresNormalizados = nombresBarrios.map((nombre) => String(nombre).trim().toUpperCase());

    const barrios = this.capaBarrios.obtenerBarrios().filter((barrio) => {
      const nombre = String(barrio.nombre).trim().toUpperCase();

      return nombresNormalizados.includes(nombre);
    });

    if (barrios.length === 0) {
      this.restaurar();

      return;
    }

    this.centroSeleccion = this.obtenerCentroBarrio(barrios);

    const camara = this.obtenerCamara();

    if (camara && this.centroSeleccion) {
      camara.setZoom(1);

      this.zoomActual = 1;

      this.centrarEnSeleccion(camara);
    }

    this.escena.actualizarVisibilidadLogo?.(false);

    this.actualizarBotones();
  }

  enfocarZonas(zonas = []) {
    if (!this.capaBarrios || !Array.isArray(zonas) || zonas.length === 0) {
      this.restaurar();

      return;
    }

    const barrios = this.capaBarrios.obtenerBarrios().filter((barrio) => {
      return zonas.includes(barrio.zona);
    });

    if (barrios.length === 0) {
      this.restaurar();

      return;
    }

    this.centroSeleccion = this.obtenerCentroBarrio(barrios);

    const camara = this.obtenerCamara();

    if (camara && this.centroSeleccion) {
      camara.setZoom(1);

      this.zoomActual = 1;

      this.centrarEnSeleccion(camara);
    }

    this.escena.actualizarVisibilidadLogo?.(false);

    this.actualizarBotones();
  }

  centrarEnSeleccion(camara) {
    if (!camara || !this.centroSeleccion) {
      return;
    }

    const dimensiones = this.capaBarrios?.obtenerDimensionesMapa?.();

    const desplazamientoVertical = dimensiones
      ? Math.max((dimensiones.margenSuperior - dimensiones.margenInferior) / 2, 0)
      : 0;

    /*
     * Ubicamos la selección en el centro
     * del área libre bajo logo y menús.
     */
    camara.centerOn(this.centroSeleccion.x, this.centroSeleccion.y - desplazamientoVertical);
  }

  obtenerCentroBarrio(barrios) {
    const puntos = [];

    for (const barrio of barrios) {
      if (!barrio || !barrio.feature || !barrio.feature.geometry) {
        continue;
      }

      const geometria = barrio.feature.geometry;

      const coordenadas = this.obtenerTodasLasCoordenadas(geometria);

      for (const coordenada of coordenadas) {
        const punto = this.convertirCoordenada(coordenada);

        if (punto) {
          puntos.push(punto);
        }
      }
    }

    if (puntos.length === 0) {
      return this.obtenerCentroMapa();
    }

    let minimoX = Infinity;

    let maximoX = -Infinity;

    let minimoY = Infinity;

    let maximoY = -Infinity;

    for (const punto of puntos) {
      minimoX = Math.min(minimoX, punto.x);

      maximoX = Math.max(maximoX, punto.x);

      minimoY = Math.min(minimoY, punto.y);

      maximoY = Math.max(maximoY, punto.y);
    }

    return {
      x: (minimoX + maximoX) / 2,

      y: (minimoY + maximoY) / 2,
    };
  }

  obtenerTodasLasCoordenadas(geometria) {
    if (!geometria || !geometria.coordinates) {
      return [];
    }

    const resultado = [];

    this.extraerCoordenadasRecursivas(
      geometria.coordinates,

      resultado,
    );

    return resultado;
  }

  extraerCoordenadasRecursivas(datos, resultado) {
    if (!Array.isArray(datos)) {
      return;
    }

    if (datos.length >= 2 && typeof datos[0] === 'number' && typeof datos[1] === 'number') {
      resultado.push(datos);

      return;
    }

    for (const elemento of datos) {
      this.extraerCoordenadasRecursivas(
        elemento,

        resultado,
      );
    }
  }

  convertirCoordenada(coordenada) {
    if (!this.capaBarrios) {
      return null;
    }

    const transformacion = this.capaBarrios.calcularEscalaMapa();

    if (!transformacion) {
      return null;
    }

    return this.capaBarrios.convertirCoordenada(
      coordenada,

      transformacion,
    );
  }

  obtenerCentroMapa() {
    if (this.capaBarrios && this.capaBarrios.transformacion) {
      const transformacion = this.capaBarrios.transformacion;

      const coordenadaCentro = [
        (transformacion.minX + transformacion.maxX) / 2,

        (transformacion.minY + transformacion.maxY) / 2,
      ];

      const transformacionMapa = this.capaBarrios.calcularEscalaMapa();

      if (transformacionMapa) {
        return this.capaBarrios.convertirCoordenada(
          coordenadaCentro,

          transformacionMapa,
        );
      }
    }

    return {
      x: this.escena.scale.width / 2,

      y: this.escena.scale.height / 2,
    };
  }

  restaurar() {
    this.centroSeleccion = null;

    this.zoomActual = 1;

    const camara = this.obtenerCamara();

    if (camara) {
      camara.setZoom(1);

      const centroMapa = this.obtenerCentroMapa();

      camara.centerOn(
        centroMapa.x,

        centroMapa.y,
      );
    }

    this.escena.actualizarVisibilidadLogo?.(true);

    this.actualizarBotones();
  }

  actualizar() {
    if (this.centroSeleccion) {
      const camara = this.obtenerCamara();

      if (camara) {
        this.centrarEnSeleccion(camara);
      }
    }
  }

  actualizarBotones() {
    if (!this.botonAcercar || !this.botonAlejar) {
      return;
    }

    this.botonAcercar.disabled = this.zoomActual >= this.zoomMaximo;

    this.botonAlejar.disabled = this.zoomActual <= this.zoomMinimo;
  }

  normalizar(zoom) {
    const numero = Number(zoom);

    if (!Number.isFinite(numero)) {
      return 1;
    }

    return Math.min(
      Math.max(
        numero,

        this.zoomMinimo,
      ),

      this.zoomMaximo,
    );
  }

  mostrar() {
    if (this.contenedor) {
      this.contenedor.style.display = 'flex';
    }
  }

  ocultar() {
    if (this.contenedor) {
      this.contenedor.style.display = 'none';
    }
  }

  eliminar() {
    if (this.contenedor) {
      this.contenedor.remove();
    }

    this.contenedor = null;

    this.botonAcercar = null;

    this.botonAlejar = null;

    this.botonRestaurar = null;
  }

  crearEstilos() {
    const id = 'metronet-control-zoom-estilos';

    if (document.getElementById(id)) {
      return;
    }

    const estilos = document.createElement('style');

    estilos.id = id;

    estilos.textContent = `

            .metronet-control-zoom {

                position: fixed;

                right: 18px;

                bottom: 18px;

                z-index: 3000;

                display: flex;

                flex-direction: column;

                gap: 2px;

                padding: 5px;

                background: rgba(
                    7,
                    23,
                    37,
                    0.84
                );

                border: 1px solid rgba(141, 215, 247, 0.26);

                border-radius: 16px;

                box-shadow:
                    0 14px 34px
                    rgba(
                        0,
                        0,
                        0,
                        0.30
                    ),
                    inset 0 1px 0
                    rgba(255, 255, 255, 0.08);

                backdrop-filter:
                    blur(14px)
                    saturate(130%);

            }

            .metronet-control-zoom-boton {

                width: 40px;

                height: 36px;

                padding: 0;

                border: none;

                border-radius: 11px;

                background:
                    transparent;

                color: #FFFFFF;

                font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;

                font-size: 21px;

                font-weight: 600;

                line-height: 36px;

                text-align: center;

                cursor: pointer;

                user-select: none;

                transition:
                    background 0.16s ease,
                    transform 0.16s ease,
                    color 0.16s ease;

            }

            .metronet-control-zoom-boton:hover {

                background:
                    rgba(60, 186, 239, 0.20);

                color:
                    #FFFFFF;

            }

            .metronet-control-zoom-boton:active {

                background:
                    rgba(60, 186, 239, 0.32);

                transform:
                    scale(0.94);

            }

            .metronet-control-zoom-boton:disabled {

                opacity: 0.35;

                cursor: default;

                transform: none;

            }

            .metronet-control-zoom-restaurar {

                margin-top:
                    2px;

                border-top:
                    1px solid rgba(141, 215, 247, 0.18);

                border-radius:
                    0 0 11px 11px;

                font-size:
                    19px;
            }

            @media (max-width: 700px) {

                .metronet-control-zoom {

                    right:
                        10px;

                    bottom:
                        10px;
                }

                .metronet-control-zoom-boton {

                    width:
                        36px;

                    height:
                        34px;

                    line-height:
                        34px;
                }
            }

        `;

    document.head.appendChild(estilos);
  }
}
