import { normalizarBarrio, obtenerZona } from '../utilidades/ClasificadorZonas.js';

export default class CapaBarrios {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    this.datos = opciones.datos ?? null;

    this.barrios = [];

    this.graficos = [];

    this.fondoMapa = null;

    this.zonasSeleccionadas = [];

    this.barriosSeleccionados = [];

    this.transformacion = null;

    if (this.datos) {
      this.extraerBarrios();

      this.calcularTransformacion();
    }
  }

  establecerDatos(datos) {
    this.datos = datos;

    this.extraerBarrios();

    this.calcularTransformacion();

    this.dibujar();
  }

  extraerBarrios() {
    if (!this.datos || !Array.isArray(this.datos.features)) {
      this.barrios = [];

      return;
    }

    this.barrios = this.datos.features
      .map((feature) => {
        const propiedades = feature.properties ?? {};

        const nombre = propiedades.BARRIO ?? propiedades.barrio ?? propiedades.nombre ?? '';

        return {
          feature,

          nombre,

          nombreNormalizado: normalizarBarrio(nombre),

          zona: obtenerZona(nombre),
        };
      })
      .filter((barrio) => barrio.nombre);
  }

  obtenerBarrios() {
    return [...this.barrios];
  }

  obtenerNombres() {
    return this.barrios.map((barrio) => barrio.nombre);
  }

  calcularTransformacion() {
    if (this.barrios.length === 0) {
      this.transformacion = null;

      return;
    }

    let minX = Infinity;

    let maxX = -Infinity;

    let minY = Infinity;

    let maxY = -Infinity;

    for (const barrio of this.barrios) {
      const coordenadas = this.obtenerTodasLasCoordenadas(barrio.feature.geometry);

      for (const coordenada of coordenadas) {
        if (!Array.isArray(coordenada) || coordenada.length < 2) {
          continue;
        }

        const x = Number(coordenada[0]);

        const y = Number(coordenada[1]);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          continue;
        }

        minX = Math.min(minX, x);

        maxX = Math.max(maxX, x);

        minY = Math.min(minY, y);

        maxY = Math.max(maxY, y);
      }
    }

    this.transformacion = {
      minX,

      maxX,

      minY,

      maxY,
    };
  }

  obtenerTodasLasCoordenadas(geometria) {
    if (!geometria) {
      return [];
    }

    const coordenadas = [];

    if (geometria.type === 'Polygon') {
      for (const anillo of geometria.coordinates) {
        for (const coordenada of anillo) {
          coordenadas.push(coordenada);
        }
      }
    }

    if (geometria.type === 'MultiPolygon') {
      for (const poligono of geometria.coordinates) {
        for (const anillo of poligono) {
          for (const coordenada of anillo) {
            coordenadas.push(coordenada);
          }
        }
      }
    }

    return coordenadas;
  }

  obtenerDimensionesMapa() {
    const anchoPantalla = this.escena.scale.width;

    const altoPantalla = this.escena.scale.height;

    const pantallaAngosta = anchoPantalla < 520;

    /* El logo y los controles viven fuera del área útil del mapa. */
    const margenHorizontal = pantallaAngosta ? 18 : 32;

    const margenSuperior = pantallaAngosta ? 24 : 32;

    const margenInferior = pantallaAngosta ? 28 : 32;

    const anchoDisponible = Math.max(anchoPantalla - margenHorizontal * 2, 300);

    const altoDisponible = Math.max(altoPantalla - margenSuperior - margenInferior, 300);

    return {
      anchoPantalla,

      altoPantalla,

      margenIzquierdo: margenHorizontal,

      margenDerecho: margenHorizontal,

      margenSuperior,

      margenInferior,

      anchoDisponible,

      altoDisponible,
    };
  }

  calcularEscalaMapa() {
    if (!this.transformacion) {
      return null;
    }

    const dimensiones = this.obtenerDimensionesMapa();

    const anchoGeografico = this.transformacion.maxX - this.transformacion.minX;

    const altoGeografico = this.transformacion.maxY - this.transformacion.minY;

    if (anchoGeografico <= 0 || altoGeografico <= 0) {
      return null;
    }

    const escalaX = dimensiones.anchoDisponible / anchoGeografico;

    const escalaY = dimensiones.altoDisponible / altoGeografico;

    const escala = Math.min(escalaX, escalaY);

    const anchoMapa = anchoGeografico * escala;

    const altoMapa = altoGeografico * escala;

    const offsetX = (dimensiones.anchoPantalla - anchoMapa) / 2;

    const areaVertical =
      dimensiones.altoPantalla - dimensiones.margenSuperior - dimensiones.margenInferior;

    const offsetY = dimensiones.margenSuperior + (areaVertical - altoMapa) / 2;

    return {
      escala,

      offsetX,

      offsetY,

      anchoMapa,

      altoMapa,
    };
  }

  convertirCoordenada(coordenada, transformacionMapa) {
    if (!this.transformacion || !transformacionMapa) {
      return {
        x: 0,

        y: 0,
      };
    }

    const longitud = Number(coordenada[0]);

    const latitud = Number(coordenada[1]);

    const x =
      transformacionMapa.offsetX +
      (longitud - this.transformacion.minX) * transformacionMapa.escala;

    const y =
      transformacionMapa.offsetY + (this.transformacion.maxY - latitud) * transformacionMapa.escala;

    return {
      x,

      y,
    };
  }

  dibujar() {
    this.eliminarGraficos();

    if (this.barrios.length === 0) {
      return this;
    }

    const transformacionMapa = this.calcularEscalaMapa();

    if (!transformacionMapa) {
      return this;
    }

    /*
     * Primero dibujamos el fondo blanco
     * siguiendo exactamente la geometría
     * del mapa.
     *
     * Todo lo que quede fuera de esta
     * geometría permanece negro.
     */
    this.dibujarFondoMapa(transformacionMapa);

    /*
     * Después dibujamos los barrios
     * y sus límites.
     */
    for (const barrio of this.barrios) {
      const grafico = this.crearGraficoBarrio(barrio, transformacionMapa);

      if (grafico) {
        this.graficos.push({
          barrio,

          grafico,
        });
      }
    }

    return this;
  }

  dibujarFondoMapa(transformacionMapa) {
    this.fondoMapa = this.escena.add.graphics();

    /*
     * Base azul petróleo del mapa.
     */
    this.fondoMapa.fillStyle(0x111820, 1);

    /*
     * Borde exterior azul METRONET.
     */
    this.fondoMapa.lineStyle(2, 0x3b78c8, 0.9);

    for (const barrio of this.barrios) {
      const geometria = barrio.feature.geometry;

      if (!geometria) {
        continue;
      }

      if (geometria.type === 'Polygon') {
        this.dibujarPoligonoFondo(
          this.fondoMapa,

          geometria.coordinates,

          transformacionMapa,
        );
      }

      if (geometria.type === 'MultiPolygon') {
        for (const poligono of geometria.coordinates) {
          this.dibujarPoligonoFondo(
            this.fondoMapa,

            poligono,

            transformacionMapa,
          );
        }
      }
    }
  }

  dibujarPoligonoFondo(grafico, poligono, transformacionMapa) {
    if (!Array.isArray(poligono) || poligono.length === 0) {
      return;
    }

    const anilloExterior = poligono[0];

    if (!Array.isArray(anilloExterior) || anilloExterior.length < 3) {
      return;
    }

    const puntos = anilloExterior.map((coordenada) =>
      this.convertirCoordenada(coordenada, transformacionMapa),
    );

    grafico.beginPath();

    grafico.moveTo(puntos[0].x, puntos[0].y);

    for (let i = 1; i < puntos.length; i++) {
      grafico.lineTo(puntos[i].x, puntos[i].y);
    }

    grafico.closePath();

    grafico.fillPath();

    grafico.strokePath();
  }

  crearGraficoBarrio(barrio, transformacionMapa) {
    const geometria = barrio.feature.geometry;

    if (!geometria) {
      return null;
    }

    const grafico = this.escena.add.graphics();

    this.dibujarGeometria(
      grafico,

      geometria,

      barrio,

      transformacionMapa,
    );

    return grafico;
  }

  dibujarGeometria(grafico, geometria, barrio, transformacionMapa) {
    if (!geometria) {
      return;
    }

    const barrioSeleccionado = this.esBarrioSeleccionado(barrio);

    const zonaSeleccionada = this.esZonaSeleccionada(barrio);

    let colorRelleno = 0x111820;

    let transparencia = 0;

    /* La zona elegida usa un azul claro que no se confunde con el mapa base. */
    if (zonaSeleccionada) {
      colorRelleno = 0x3b78c8;

      transparencia = 0.72;
    }

    /*
     * Barrio seleccionado.
     */
    if (barrioSeleccionado) {
      colorRelleno = 0x568fdb;

      transparencia = 0.9;
    }

    /*
     * Bordes internos de los barrios.
     */
    grafico.lineStyle(
      barrioSeleccionado || zonaSeleccionada ? 3 : 1,

      barrioSeleccionado ? 0xf4f7fa : zonaSeleccionada ? 0xaab7c4 : 0x263240,

      barrioSeleccionado || zonaSeleccionada ? 1 : 0.85,
    );

    if (transparencia > 0) {
      grafico.fillStyle(
        colorRelleno,

        transparencia,
      );
    }

    if (geometria.type === 'Polygon') {
      this.dibujarPoligono(
        grafico,

        geometria.coordinates,

        transformacionMapa,

        transparencia > 0,
      );
    }

    if (geometria.type === 'MultiPolygon') {
      for (const poligono of geometria.coordinates) {
        this.dibujarPoligono(
          grafico,

          poligono,

          transformacionMapa,

          transparencia > 0,
        );
      }
    }
  }

  dibujarPoligono(grafico, poligono, transformacionMapa, rellenar) {
    if (!Array.isArray(poligono) || poligono.length === 0) {
      return;
    }

    const anilloExterior = poligono[0];

    if (!Array.isArray(anilloExterior) || anilloExterior.length < 3) {
      return;
    }

    const puntos = anilloExterior.map((coordenada) =>
      this.convertirCoordenada(coordenada, transformacionMapa),
    );

    grafico.beginPath();

    grafico.moveTo(
      puntos[0].x,

      puntos[0].y,
    );

    for (let i = 1; i < puntos.length; i++) {
      grafico.lineTo(
        puntos[i].x,

        puntos[i].y,
      );
    }

    grafico.closePath();

    if (rellenar) {
      grafico.fillPath();
    }

    grafico.strokePath();
  }

  obtenerColorZona(zona) {
    /* Paleta violeta-azul METRONET. */
    switch (zona) {
      case 'ZONA CENTRO':
        return 0x9bc8ff;

      case 'ZONA ESTE':
        return 0x3b78c8;

      case 'ZONA NORTE':
        return 0x3b78c8;

      case 'ZONA OESTE':
        return 0x1a2340;

      case 'ZONA OESTE-COSTA':
        return 0x1a2340;

      case 'ZONA NOROESTE':
        return 0x9bc8ff;

      default:
        return 0x1a2340;
    }
  }

  establecerZonasSeleccionadas(zonas) {
    this.zonasSeleccionadas = Array.isArray(zonas) ? [...zonas] : [];

    this.dibujar();
  }

  establecerBarriosSeleccionados(barrios) {
    if (!Array.isArray(barrios)) {
      this.barriosSeleccionados = [];
    } else {
      this.barriosSeleccionados = [...barrios];
    }

    this.dibujar();
  }

  establecerBarrioSeleccionado(barrio) {
    if (!barrio) {
      this.barriosSeleccionados = [];
    } else {
      this.barriosSeleccionados = [barrio];
    }

    this.dibujar();
  }

  esBarrioSeleccionado(barrio) {
    if (this.barriosSeleccionados.length === 0) {
      return false;
    }

    return this.barriosSeleccionados.some(
      (barrioSeleccionado) =>
        normalizarBarrio(barrio.nombre) === normalizarBarrio(barrioSeleccionado),
    );
  }

  esZonaSeleccionada(barrio) {
    if (this.zonasSeleccionadas.length === 0) {
      return false;
    }

    return this.zonasSeleccionadas.includes(barrio.zona);
  }

  actualizarColores() {
    this.dibujar();
  }

  ajustarMapa(anchoPantalla, altoPantalla) {
    this.dibujar();
  }

  eliminarGraficos() {
    if (this.fondoMapa) {
      this.fondoMapa.destroy();

      this.fondoMapa = null;
    }

    for (const elemento of this.graficos) {
      if (elemento.grafico) {
        elemento.grafico.destroy();
      }
    }

    this.graficos = [];
  }

  eliminar() {
    this.eliminarGraficos();

    this.barrios = [];

    this.zonasSeleccionadas = [];

    this.barriosSeleccionados = [];

    this.datos = null;

    this.transformacion = null;
  }
}
