import '../estilos/control-zoom.css';
import { capturarVistaGeografica, proyectarVistaGeografica } from '../VistaGeografica.js';

const MARGEN_AJUSTE_MINIMO = 40;
const MARGEN_AJUSTE_MAXIMO = 96;
const PROPORCION_MINIMA_ENFOQUE = 0.16;
const ZOOM_MAXIMO_ENFOQUE_PUNTUAL = 2.6;

export default class ControlZoom {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    this.capaBarrios = opciones.capaBarrios || null;

    this.factorZoom = opciones.factorZoom ?? 1.5;

    this.zoomMinimo = opciones.zoomMinimo ?? 1;

    this.zoomMaximo = opciones.zoomMaximo ?? 8;

    this.escalaVisibleMinima = null;
    this.escalaVisibleMaxima = null;

    this.zoomActual = this.zoomMinimo;

    this.obtenerLimitesAjuste = opciones.obtenerLimitesAjuste ?? null;

    this.permitirPan = opciones.permitirPan ?? (() => true);

    this.permitirArrastre = opciones.permitirArrastre ?? this.permitirPan;

    this.permitirArrastrePrimario = opciones.permitirArrastrePrimario ?? (() => false);

    this.etiquetaAjustar = opciones.etiquetaAjustar ?? 'Ajustar red';

    this.mostrarAyudaNavegacion = opciones.mostrarAyudaNavegacion ?? true;

    this.zoomMaximoEnfoquePuntual = Math.min(
      opciones.zoomMaximoEnfoquePuntual ?? ZOOM_MAXIMO_ENFOQUE_PUNTUAL,
      this.zoomMaximo,
    );

    this.estadoVista = 'mapa';

    this.limitesAjustados = null;

    this.barriosEnfocados = [];

    this.limitesSeleccion = null;

    this.limitesCamara = null;

    this.limitesMapaVista = null;

    this.contenedorPadre = opciones.contenedorPadre ?? document.body;

    this.integrado = Boolean(opciones.integrado);
    this.mostrarOrientacion = Boolean(opciones.mostrarOrientacion);

    this.ancladoAlMapa = Boolean(opciones.ancladoAlMapa);

    this.mostrarControles = opciones.mostrarControles ?? true;

    this.contenedor = null;

    this.botonAcercar = null;

    this.botonAlejar = null;

    this.botonRestaurar = null;

    this.botonNorte = null;

    this.brujula = null;
    this.panelMapa = null;

    this.punteros = new Map();

    this.arrastre = null;

    this.distanciaPinza = null;

    this.interaccionHabilitada = false;

    this.estiloTouchAnterior = '';

    this.manejadorRueda = (puntero, objetos, desplazamientoX, desplazamientoY) => this.procesarRueda(puntero, desplazamientoY);

    this.manejadorPunteroPresionado = (puntero) => this.procesarPunteroPresionado(puntero);

    this.manejadorPunteroMovido = (puntero) => this.procesarPunteroMovido(puntero);

    this.manejadorPunteroLiberado = (puntero) => this.procesarPunteroLiberado(puntero);

  }

  establecerCapaBarrios(capaBarrios) {
    this.capaBarrios = capaBarrios;
  }

  crear() {
    this.eliminar();

    if (this.mostrarControles) {
      this.crearInterfaz();
    }

    this.habilitarInteraccion();

    this.actualizarLimitesCamara();

    if (this.escena.contenedorEditorRed) this.restaurar();
    else this.actualizarBotones();
  }

  crearInterfaz() {

    this.contenedor = document.createElement('div');

    this.contenedor.className = 'metronet-control-zoom';

    if (this.integrado) {
      this.contenedor.classList.add('metronet-control-zoom-integrado');
    }

    if (this.ancladoAlMapa) {
      this.contenedor.classList.add('metronet-control-zoom--superpuesto');
    }

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

    this.botonRestaurar.textContent = '⛶';

    this.botonRestaurar.className = 'metronet-control-zoom-boton metronet-control-zoom-restaurar';

    this.botonRestaurar.setAttribute('aria-label', this.etiquetaAjustar);

    this.botonRestaurar.title = this.etiquetaAjustar;

    this.botonAcercar.addEventListener('click', () => {
      this.acercar();
    });

    this.botonAlejar.addEventListener('click', () => {
      this.alejar();
    });

    this.botonRestaurar.addEventListener('click', () => {
      this.ajustarRed();
    });

    this.contenedor.appendChild(this.botonAcercar);

    this.contenedor.appendChild(this.botonAlejar);

    this.contenedor.appendChild(this.botonRestaurar);

    if (this.escena?.contenedorEditorRed || this.mostrarOrientacion) {
      this.brujula = document.createElement('div');
      this.brujula.className = 'metronet-control-zoom__brujula';
      const botonIzquierda = document.createElement('button');
      botonIzquierda.type = 'button';
      botonIzquierda.className = 'metronet-control-zoom-boton';
      botonIzquierda.textContent = '↶';
      botonIzquierda.setAttribute('aria-label', 'Girar mapa a la izquierda');
      botonIzquierda.addEventListener('click', () => this.girarMapa(-Math.PI / 12));
      this.botonNorte = document.createElement('button');
      this.botonNorte.type = 'button';
      this.botonNorte.className = 'metronet-control-zoom-boton metronet-control-zoom__norte';
      const rosa = document.createElement('span');
      rosa.className = 'metronet-control-zoom__rosa';
      rosa.setAttribute('aria-hidden', 'true');
      const letraNorte = document.createElement('span');
      letraNorte.className = 'metronet-control-zoom__letra-norte';
      letraNorte.textContent = 'N';
      const aguja = document.createElement('span');
      aguja.className = 'metronet-control-zoom__aguja';
      rosa.append(letraNorte, aguja);
      this.botonNorte.append(rosa);
      this.botonNorte.setAttribute('aria-label', 'Volver al norte arriba');
      this.botonNorte.addEventListener('click', () => this.girarMapa(0, true));
      const botonDerecha = document.createElement('button');
      botonDerecha.type = 'button';
      botonDerecha.className = 'metronet-control-zoom-boton';
      botonDerecha.textContent = '↷';
      botonDerecha.setAttribute('aria-label', 'Girar mapa a la derecha');
      botonDerecha.addEventListener('click', () => this.girarMapa(Math.PI / 12));
      this.brujula.append(botonIzquierda, this.botonNorte, botonDerecha);
      this.panelMapa = document.createElement('div');
      this.panelMapa.className = 'metronet-control-zoom__panel-mapa';
      this.panelMapa.setAttribute('role', 'group');
      this.panelMapa.setAttribute('aria-label', 'Zoom y orientación del mapa');
      this.panelMapa.append(this.contenedor, this.brujula);
      (this.escena.contenedorMapa?.closest('.metronet-area-mapa')?.querySelector('.metronet-mandos-mapa')
        ?? this.escena.contenedorMapa ?? this.contenedorPadre).append(this.panelMapa);
    } else {
      this.contenedorPadre.appendChild(this.contenedor);
    }
  }

  girarMapa(angulo, absoluto = false) {
    const camara = this.obtenerCamara();
    if (!camara) return;
    const nuevaRotacion = absoluto ? 0 : camara.rotation + angulo;
    camara.setRotation(Math.atan2(Math.sin(nuevaRotacion), Math.cos(nuevaRotacion)));
    this.actualizarLimitesCamara();
    this.restringirCamara();
    if (this.estadoVista === 'ajustada' && this.limitesAjustados) {
      this.ajustarArea(this.limitesAjustados, { estadoVista: 'ajustada' });
    } else if (this.estadoVista === 'mapa') {
      this.despejarMandosDeRed(this.obtenerLimitesAjuste?.());
    }
    this.marcarVistaManual();
    this.actualizarBrujula();
  }

  actualizarBrujula() {
    if (!this.botonNorte) return;
    const grados = Math.round((this.obtenerCamara()?.rotation ?? 0) * 180 / Math.PI);
    this.botonNorte.style.setProperty('--giro-brujula', `${-grados}deg`);
    this.botonNorte.title = grados ? `Norte: ${grados}° de giro; tocar para orientar` : 'Norte arriba';
  }

  obtenerCamara() {
    if (!this.escena || !this.escena.cameras) {
      return null;
    }

    return this.escena.cameras.main;
  }

  acercar() {
    const camara = this.obtenerCamara();

    if (!camara) {
      return;
    }

    this.establecerZoomEnPunto(
      camara.zoom * this.factorZoom,

      this.escena.scale.width / 2,

      this.escena.scale.height / 2,
    );
  }

  alejar() {
    const camara = this.obtenerCamara();

    if (!camara) {
      return;
    }

    this.establecerZoomEnPunto(
      camara.zoom / this.factorZoom,

      this.escena.scale.width / 2,

      this.escena.scale.height / 2,
    );
  }

  establecerZoom(zoom, origen = 'manual') {
    const nuevoZoom = this.normalizar(zoom);

    const camara = this.obtenerCamara();

    if (!camara) {
      return;
    }

    camara.setZoom(nuevoZoom);

    this.zoomActual = camara.zoom;

    if (origen === 'manual') this.marcarVistaManual();

    this.restringirCamara();

    this.actualizarBotones();
  }

  establecerZoomEnPunto(zoom, xPantalla, yPantalla, origen = 'manual') {
    const camara = this.obtenerCamara();

    if (!camara) {
      return;
    }

    const zoomAnterior = camara.zoom;
    const zoomNuevo = this.normalizar(zoom);
    const centroX = camara.x + camara.width * camara.originX;
    const centroY = camara.y + camara.height * camara.originY;
    const deltaX = xPantalla - centroX;
    const deltaY = yPantalla - centroY;
    const coseno = Math.cos(camara.rotation);
    const seno = Math.sin(camara.rotation);
    const diferenciaEscala = 1 / zoomAnterior - 1 / zoomNuevo;

    camara.setZoom(zoomNuevo);
    camara.scrollX += (deltaX * coseno + deltaY * seno) * diferenciaEscala;
    camara.scrollY += (deltaY * coseno - deltaX * seno) * diferenciaEscala;

    this.zoomActual = camara.zoom;

    if (origen === 'manual') this.marcarVistaManual();

    this.restringirCamara();

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

    this.establecerAreaEnfocada(barrios);

    this.ajustarVisibilidadPuntosInteres();

    this.ajustarArea(this.limitesSeleccion, { estadoVista: 'seleccion' });

    this.escena.actualizarVisibilidadLogo?.(true);

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

    this.establecerAreaEnfocada(barrios);

    this.ajustarVisibilidadPuntosInteres();

    this.ajustarArea(this.limitesSeleccion, { estadoVista: 'seleccion' });

    this.escena.actualizarVisibilidadLogo?.(true);

    this.actualizarBotones();
  }

  establecerAreaEnfocada(barrios) {
    this.barriosEnfocados = Array.isArray(barrios) ? [...barrios] : [];

    this.limitesSeleccion = this.obtenerLimitesBarrios(this.barriosEnfocados);

  }

  ajustarRed() {
    const limites = this.obtenerLimitesAjuste?.() ?? null;

    if (!limites) {
      this.restaurar();

      return;
    }

    this.barriosEnfocados = [];

    this.limitesSeleccion = null;

    this.escena.capaPuntosInteres?.restablecerZoomMinimoVisible();

    this.ajustarArea(limites, { estadoVista: 'ajustada' });
  }

  ajustarArea(limites, opciones = {}) {
    const camara = this.obtenerCamara();

    if (!camara || !limites) {
      this.restaurar();

      return;
    }

    const zoom = this.obtenerZoomAjustado(limites, opciones);

    camara.setZoom(zoom);

    camara.centerOn(
      (limites.minimoX + limites.maximoX) / 2,

      (limites.minimoY + limites.maximoY) / 2,
    );

    this.zoomActual = camara.zoom;

    this.estadoVista = opciones.estadoVista ?? 'ajustada';

    this.limitesAjustados = { ...limites };

    this.restringirCamara();
    this.despejarMandosDeRed(limites);

    this.actualizarBotones();
  }

  despejarMandosDeRed(limites) {
    const camara = this.obtenerCamara();
    const lienzo = this.escena.contenedorMapa?.querySelector('canvas');
    if (!camara || !limites || !lienzo || !this.panelMapa) return;
    const marco = lienzo.getBoundingClientRect();
    const mandos = this.panelMapa.getBoundingClientRect();
    const izquierdaMandos = mandos.left - marco.left;
    const arribaMandos = mandos.top - marco.top;
    const derechaMandos = mandos.right - marco.left;
    const abajoMandos = mandos.bottom - marco.top;
    const coseno = Math.cos(camara.rotation);
    const seno = Math.sin(camara.rotation);
    const margen = 30;
    const ocupar = () => {
      const puntos = [
        [limites.minimoX, limites.minimoY], [limites.minimoX, limites.maximoY],
        [limites.maximoX, limites.minimoY], [limites.maximoX, limites.maximoY],
      ].map(([x, y]) => {
        const dx = (x - camara.midPoint.x) * camara.zoom;
        const dy = (y - camara.midPoint.y) * camara.zoom;
        return { x: camara.width / 2 + dx * coseno - dy * seno,
          y: camara.height / 2 + dx * seno + dy * coseno };
      });
      return { izquierda: Math.min(...puntos.map(p => p.x)) - margen,
        derecha: Math.max(...puntos.map(p => p.x)) + margen,
        arriba: Math.min(...puntos.map(p => p.y)) - margen,
        abajo: Math.max(...puntos.map(p => p.y)) + margen };
    };
    const seSolapa = red => red.derecha > izquierdaMandos && red.abajo > arribaMandos &&
      red.izquierda < derechaMandos && red.arriba < abajoMandos;
    const desplazar = (dx, dy) => {
      camara.centerOn(
        camara.midPoint.x - (dx * coseno + dy * seno) / camara.zoom,
        camara.midPoint.y - (dy * coseno - dx * seno) / camara.zoom,
      );
      this.restringirCamara();
    };
    let red = ocupar();
    if (!seSolapa(red)) return;
    const moverArriba = arribaMandos - red.abajo;
    const moverIzquierda = izquierdaMandos - red.derecha;
    const primeroArriba = Math.abs(moverArriba) <= Math.abs(moverIzquierda);
    desplazar(primeroArriba ? 0 : moverIzquierda, primeroArriba ? moverArriba : 0);
    red = ocupar();
    if (seSolapa(red)) desplazar(primeroArriba ? izquierdaMandos - red.derecha : 0,
      primeroArriba ? 0 : arribaMandos - red.abajo);
  }

  obtenerZoomAjustado(limites, opciones = {}) {
    if (!limites) {
      return this.zoomMinimo;
    }

    const limitesMapa = this.obtenerLimitesMapa();
    const margenSolicitado = opciones.margen ?? Math.min(this.escena.scale.width, this.escena.scale.height) * 0.08;
    const margen = Math.min(Math.max(margenSolicitado, MARGEN_AJUSTE_MINIMO), MARGEN_AJUSTE_MAXIMO);
    const anchoMapa = limitesMapa ? limitesMapa.maximoX - limitesMapa.minimoX : 0;
    const altoMapa = limitesMapa ? limitesMapa.maximoY - limitesMapa.minimoY : 0;
    const anchoMinimo = Math.max(72, anchoMapa * PROPORCION_MINIMA_ENFOQUE);
    const altoMinimo = Math.max(72, altoMapa * PROPORCION_MINIMA_ENFOQUE);
    const ancho = Math.max(anchoMinimo, limites.maximoX - limites.minimoX);
    const alto = Math.max(altoMinimo, limites.maximoY - limites.minimoY);
    const anchoDisponible = Math.max(160, this.escena.scale.width - margen * 2);
    const altoDisponible = Math.max(140, this.escena.scale.height - margen * 2);
    const rotacion = this.obtenerCamara()?.rotation ?? 0;
    const coseno = Math.abs(Math.cos(rotacion));
    const seno = Math.abs(Math.sin(rotacion));
    const anchoGirado = ancho * coseno + alto * seno;
    const altoGirado = ancho * seno + alto * coseno;
    const zoom = this.normalizar(Math.min(anchoDisponible / anchoGirado, altoDisponible / altoGirado));
    const esEnfoquePuntual = limites.maximoX - limites.minimoX < 1 && limites.maximoY - limites.minimoY < 1;
    return esEnfoquePuntual ? Math.min(zoom, this.zoomMaximoEnfoquePuntual) : zoom;
  }

  obtenerLimitesBarrios(barrios) {
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
      return null;
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

    return { minimoX, maximoX, minimoY, maximoY };
  }

  obtenerZoomMaximoPermitido() {
    const escala = this.capaBarrios?.calcularEscalaMapa?.()?.escala;
    return escala > 0 && this.escalaVisibleMaxima
      ? Math.max(this.zoomMaximo, this.escalaVisibleMaxima / escala) : this.zoomMaximo;
  }

  obtenerZoomMinimoPermitido() {
    const escala = this.capaBarrios?.calcularEscalaMapa?.()?.escala;
    return escala > 0 && this.escalaVisibleMinima
      ? Math.min(this.zoomMinimo, this.escalaVisibleMinima / escala) : this.zoomMinimo;
  }

  obtenerZoomMaximoSeguroSeleccion() {
    if (!this.limitesSeleccion) {
      return this.obtenerZoomMaximoPermitido();
    }

    return this.obtenerZoomAjustado(this.limitesSeleccion);
  }

  ajustarVisibilidadPuntosInteres() {
    this.escena.capaPuntosInteres?.ajustarZoomVisibleAlMaximo(
      this.obtenerZoomMaximoSeguroSeleccion(),
    );
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

  obtenerLimitesMapa() {
    const transformacion = this.capaBarrios?.calcularEscalaMapa?.();

    if (!transformacion) {
      return null;
    }

    return {
      minimoX: transformacion.offsetX,

      maximoX: transformacion.offsetX + transformacion.anchoMapa,

      minimoY: transformacion.offsetY,

      maximoY: transformacion.offsetY + transformacion.altoMapa,
    };
  }

  actualizarLimitesCamara(vistaSolicitada = null) {
    const camara = this.obtenerCamara();

    const limitesMapa = this.obtenerLimitesMapa();

    if (!camara || !limitesMapa) {
      this.limitesCamara = null;

      return;
    }

    this.limitesMapaVista = limitesMapa;

    this.tamanoCamaraVista = { ancho: camara.width, alto: camara.height };

    const margen = Math.max(28, Math.min(this.escena.scale.width, this.escena.scale.height) * 0.08);

    this.limitesCamara = {
      minimoX: limitesMapa.minimoX - margen,

      maximoX: limitesMapa.maximoX + margen,

      minimoY: limitesMapa.minimoY - margen,

      maximoY: limitesMapa.maximoY + margen,
    };

    // Phaser fija el scroll en el borde izquierdo/superior cuando los bounds
    // son más chicos que el área visible. Incluimos la vista centrada completa.
    const centroX = (limitesMapa.minimoX + limitesMapa.maximoX) / 2;
    const centroY = (limitesMapa.minimoY + limitesMapa.maximoY) / 2;
    const cosenoCamara = Math.abs(Math.cos(camara.rotation));
    const senoCamara = Math.abs(Math.sin(camara.rotation));
    const medioAnchoVisible = (camara.width * cosenoCamara + camara.height * senoCamara) / (2 * camara.zoom);
    const medioAltoVisible = (camara.width * senoCamara + camara.height * cosenoCamara) / (2 * camara.zoom);
    this.limitesCamara.minimoX = Math.min(this.limitesCamara.minimoX, centroX - medioAnchoVisible);
    this.limitesCamara.maximoX = Math.max(this.limitesCamara.maximoX, centroX + medioAnchoVisible);
    this.limitesCamara.minimoY = Math.min(this.limitesCamara.minimoY, centroY - medioAltoVisible);
    this.limitesCamara.maximoY = Math.max(this.limitesCamara.maximoY, centroY + medioAltoVisible);

    if (vistaSolicitada) {
      const coseno = Math.abs(Math.cos(vistaSolicitada.rotacion));
      const seno = Math.abs(Math.sin(vistaSolicitada.rotacion));
      const medioAncho = (camara.width * coseno + camara.height * seno) / (2 * vistaSolicitada.zoom);
      const medioAlto = (camara.width * seno + camara.height * coseno) / (2 * vistaSolicitada.zoom);
      this.limitesCamara.minimoX = Math.min(this.limitesCamara.minimoX, vistaSolicitada.x - medioAncho);
      this.limitesCamara.maximoX = Math.max(this.limitesCamara.maximoX, vistaSolicitada.x + medioAncho);
      this.limitesCamara.minimoY = Math.min(this.limitesCamara.minimoY, vistaSolicitada.y - medioAlto);
      this.limitesCamara.maximoY = Math.max(this.limitesCamara.maximoY, vistaSolicitada.y + medioAlto);
    }

    if (Math.abs(camara.rotation) > 0.0001) camara.removeBounds();
    else camara.setBounds(
      this.limitesCamara.minimoX,
      this.limitesCamara.minimoY,
      this.limitesCamara.maximoX - this.limitesCamara.minimoX,
      this.limitesCamara.maximoY - this.limitesCamara.minimoY,
    );
  }

  restringirCamara() {
    const camara = this.obtenerCamara();

    if (!camara || !this.limitesCamara) {
      return;
    }

    // Los límites nativos incluyen el origen y el zoom de la cámara.
    // Recortar scroll contra coordenadas del mapa desplazaba la vista al redimensionar.
    if (Math.abs(camara.rotation) <= 0.0001) {
      camara.scrollX = camara.clampX(camara.scrollX);
      camara.scrollY = camara.clampY(camara.scrollY);
      return;
    }
    const coseno = Math.abs(Math.cos(camara.rotation));
    const seno = Math.abs(Math.sin(camara.rotation));
    const medioAncho = (camara.width * coseno + camara.height * seno) / (2 * camara.zoom);
    const medioAlto = (camara.width * seno + camara.height * coseno) / (2 * camara.zoom);
    const limitarCentro = (centro, minimo, maximo, semiextension) => {
      const desde = minimo + semiextension;
      const hasta = maximo - semiextension;
      return desde > hasta ? (minimo + maximo) / 2 : Math.max(desde, Math.min(hasta, centro));
    };
    camara.scrollX = limitarCentro(camara.scrollX + camara.width / 2,
      this.limitesCamara.minimoX, this.limitesCamara.maximoX, medioAncho) - camara.width / 2;
    camara.scrollY = limitarCentro(camara.scrollY + camara.height / 2,
      this.limitesCamara.minimoY, this.limitesCamara.maximoY, medioAlto) - camara.height / 2;
  }

  marcarVistaManual() {
    this.estadoVista = 'manual';
    this.limitesAjustados = null;
  }

  capturarVista() {
    const camara = this.obtenerCamara();
    // Phaser actualiza scale antes de emitir resize. El centro todavía pertenece
    // al mapa anterior: normalizarlo con los límites nuevos desplaza el encuadre.
    const limitesMapa = this.limitesMapaVista ?? this.obtenerLimitesMapa();
    if (!camara || !limitesMapa) return null;
    const anchoAnterior = this.tamanoCamaraVista?.ancho ?? camara.width;
    const altoAnterior = this.tamanoCamaraVista?.alto ?? camara.height;
    const vista = capturarVistaGeografica({
      midPoint: { x: camara.scrollX + anchoAnterior * camara.originX,
        y: camara.scrollY + altoAnterior * camara.originY },
      zoom: camara.zoom, rotation: camara.rotation,
    }, limitesMapa, this.capaBarrios?.transformacion);
    return this.agregarRangoEscalaVisible(vista, limitesMapa);
  }

  capturarVistaParaNavegacion() {
    const limites = this.obtenerLimitesMapa();
    return this.agregarRangoEscalaVisible(capturarVistaGeografica(this.obtenerCamara(), limites,
      this.capaBarrios?.transformacion), limites);
  }

  agregarRangoEscalaVisible(vista, limites) {
    const geografia = this.capaBarrios?.transformacion;
    const escala = (limites?.maximoX - limites?.minimoX) / (geografia?.maxX - geografia?.minX);
    if (!vista || !Number.isFinite(escala) || escala <= 0) return vista;
    return { ...vista,
      escalaVisibleMinima: Math.min(this.escalaVisibleMinima ?? Infinity, this.zoomMinimo * escala),
      escalaVisibleMaxima: Math.max(this.escalaVisibleMaxima ?? 0, this.zoomMaximo * escala),
    };
  }

  aplicarVistaGeografica(vista) {
    const camara = this.obtenerCamara();
    const destino = proyectarVistaGeografica(vista,
      this.capaBarrios?.calcularEscalaMapa?.(), this.capaBarrios?.transformacion);
    if (!camara || !destino || !Number.isFinite(destino.zoom) || destino.zoom <= 0) return false;
    // Una vista ya alcanzada en la otra escena nunca se recorta en silencio.
    this.escalaVisibleMinima = Math.min(this.escalaVisibleMinima ?? Infinity,
      vista.escalaVisibleMinima ?? vista.escalaVisible, vista.escalaVisible);
    this.escalaVisibleMaxima = Math.max(this.escalaVisibleMaxima ?? 0,
      vista.escalaVisibleMaxima ?? vista.escalaVisible, vista.escalaVisible);
    camara.setRotation(destino.rotacion);
    camara.setZoom(destino.zoom);
    this.actualizarLimitesCamara(destino);
    camara.centerOn(destino.x, destino.y);
    this.zoomActual = camara.zoom;
    this.marcarVistaManual();
    this.restringirCamara();
    this.actualizarBrujula();
    this.actualizarBotones();
    return true;
  }

  restaurarVistaTrasRedimension(vista, limitesRed = null) {
    if (!vista || this.estadoVista === 'mapa') {
      this.restaurar();
      return;
    }
    this.aplicarVistaGeografica(vista);
  }

  restaurar() {
    this.escena.capaPuntosInteres?.restablecerZoomMinimoVisible();

    this.barriosEnfocados = [];

    this.limitesSeleccion = null;

    this.limitesAjustados = null;

    this.estadoVista = 'mapa';

    this.zoomActual = this.zoomMinimo;

    const camara = this.obtenerCamara();

    if (camara) {
      camara.setZoom(this.zoomMinimo);
      camara.setRotation(0);

      this.actualizarLimitesCamara();

      const centroMapa = this.obtenerCentroMapa();

      camara.centerOn(
        centroMapa.x,

        centroMapa.y,
      );

      this.restringirCamara();
    }

    this.escena.actualizarVisibilidadLogo?.(true);

    this.actualizarBrujula();

    this.actualizarBotones();
  }

  actualizar() {
    this.actualizarLimitesCamara();

    if (this.limitesSeleccion && this.barriosEnfocados.length) {
      const camara = this.obtenerCamara();

      if (camara) {
        this.limitesSeleccion = this.obtenerLimitesBarrios(this.barriosEnfocados);

        this.ajustarVisibilidadPuntosInteres();

        const zoomMaximoPermitido = this.obtenerZoomMaximoPermitido();

        if (this.zoomActual > zoomMaximoPermitido) {
          this.establecerZoom(zoomMaximoPermitido);

          return;
        }
      }
    }

    this.restringirCamara();

    this.actualizarBotones();
  }

  actualizarBotones() {
    if (!this.botonAcercar || !this.botonAlejar) {
      return;
    }

    const zoom = this.obtenerCamara()?.zoom ?? this.zoomActual;

    this.zoomActual = zoom;

    this.botonAcercar.disabled = zoom >= this.obtenerZoomMaximoPermitido() - 0.01;

    this.botonAlejar.disabled = zoom <= this.obtenerZoomMinimoPermitido() + 0.01;
  }

  normalizar(zoom) {
    const numero = Number(zoom);

    if (!Number.isFinite(numero)) {
      return 1;
    }

    return Math.min(
      Math.max(
        numero,

        this.obtenerZoomMinimoPermitido(),
      ),

      this.obtenerZoomMaximoPermitido(),
    );
  }

  habilitarInteraccion() {
    if (this.interaccionHabilitada || !this.escena?.input) {
      return;
    }

    this.escena.input.addPointer(1);

    this.escena.input.on('wheel', this.manejadorRueda);

    this.escena.input.on('pointerdown', this.manejadorPunteroPresionado);

    this.escena.input.on('pointermove', this.manejadorPunteroMovido);

    this.escena.input.on('pointerup', this.manejadorPunteroLiberado);

    this.escena.input.on('pointerupoutside', this.manejadorPunteroLiberado);

    const lienzo = this.escena.game?.canvas;

    if (lienzo) {
      this.estiloTouchAnterior = lienzo.style.touchAction;

      lienzo.style.touchAction = 'none';

      if (this.mostrarAyudaNavegacion) lienzo.title = 'Usá la rueda para acercar. Arrastrá el mapa cuando la herramienta activa lo permita.';
    }

    this.interaccionHabilitada = true;
  }

  procesarRueda(puntero, desplazamientoY) {
    if (!this.permitirPan()) {
      return;
    }

    puntero.event?.preventDefault?.();

    const factor = desplazamientoY < 0 ? this.factorZoom : 1 / this.factorZoom;

    const camara = this.obtenerCamara();

    this.establecerZoomEnPunto((camara?.zoom ?? this.zoomMinimo) * factor, puntero.x, puntero.y);
  }

  procesarPunteroPresionado(puntero) {
    const id = this.obtenerIdentificadorPuntero(puntero);

    this.punteros.set(id, this.obtenerPosicionPuntero(puntero));

    if (this.obtenerPunterosTactiles().length >= 2) {
      this.arrastre = null;

      this.distanciaPinza = this.obtenerDistanciaPinza();

      return;
    }

    if (this.permiteArrastre(puntero)) {
      this.arrastre = { id, ...this.obtenerPosicionPuntero(puntero) };
    }
  }

  procesarPunteroMovido(puntero) {
    const id = this.obtenerIdentificadorPuntero(puntero);

    if (!this.punteros.has(id)) {
      return;
    }

    const posicion = this.obtenerPosicionPuntero(puntero);

    this.punteros.set(id, posicion);

    const punterosTactiles = this.obtenerPunterosTactiles();

    if (punterosTactiles.length >= 2) {
      this.procesarPinza(punterosTactiles);

      return;
    }

    if (!this.arrastre || this.arrastre.id !== id || !this.permitirPan()) {
      return;
    }

    const camara = this.obtenerCamara();

    if (!camara) {
      return;
    }

    const deltaX = posicion.x - this.arrastre.x;
    const deltaY = posicion.y - this.arrastre.y;
    const coseno = Math.cos(camara.rotation);
    const seno = Math.sin(camara.rotation);
    camara.scrollX -= (deltaX * coseno + deltaY * seno) / camara.zoom;
    camara.scrollY -= (deltaY * coseno - deltaX * seno) / camara.zoom;

    this.arrastre = { ...this.arrastre, ...posicion };

    this.marcarVistaManual();

    this.restringirCamara();
  }

  procesarPunteroLiberado(puntero) {
    const id = this.obtenerIdentificadorPuntero(puntero);

    this.punteros.delete(id);

    if (this.arrastre?.id === id) {
      this.arrastre = null;
    }

    if (this.obtenerPunterosTactiles().length < 2) {
      this.distanciaPinza = null;
    }
  }

  procesarPinza(punteros) {
    const distancia = this.obtenerDistanciaPinza(punteros);

    if (!this.distanciaPinza || !distancia || !this.permitirPan()) {
      this.distanciaPinza = distancia;

      return;
    }

    const centroX = (punteros[0].x + punteros[1].x) / 2;

    const centroY = (punteros[0].y + punteros[1].y) / 2;

    const camara = this.obtenerCamara();

    this.establecerZoomEnPunto((camara?.zoom ?? this.zoomMinimo) * (distancia / this.distanciaPinza), centroX, centroY);

    this.distanciaPinza = distancia;
  }

  obtenerPunterosTactiles() {
    return [...this.punteros.values()].filter((puntero) => puntero.tactil);
  }

  obtenerDistanciaPinza(punteros = this.obtenerPunterosTactiles()) {
    if (punteros.length < 2) {
      return null;
    }

    return Math.hypot(punteros[0].x - punteros[1].x, punteros[0].y - punteros[1].y);
  }

  permiteArrastre(puntero) {
    if (!this.permitirArrastre()) {
      return false;
    }

    const evento = puntero.event ?? {};

    const tactil = evento.pointerType === 'touch' || puntero.wasTouch;

    return tactil || this.permitirArrastrePrimario() || evento.shiftKey || evento.button === 1 || evento.button === 2 || puntero.middleButtonDown?.() || puntero.rightButtonDown?.();
  }

  obtenerIdentificadorPuntero(puntero) {
    return puntero.pointerId ?? puntero.id ?? 'principal';
  }

  obtenerPosicionPuntero(puntero) {
    const evento = puntero.event ?? {};

    return {
      x: puntero.x,

      y: puntero.y,

      tactil: evento.pointerType === 'touch' || Boolean(puntero.wasTouch),
    };
  }

  mostrar() {
    if (this.panelMapa) this.panelMapa.hidden = false;
    if (this.contenedor) {
      this.contenedor.style.display = 'flex';
    }
    if (this.brujula) this.brujula.style.display = 'flex';
  }

  ocultar() {
    if (this.panelMapa) this.panelMapa.hidden = true;
    if (this.contenedor) {
      this.contenedor.style.display = 'none';
    }
    if (this.brujula) this.brujula.style.display = 'none';
  }

  eliminar() {
    if (this.interaccionHabilitada && this.escena?.input) {
      this.escena.input.off('wheel', this.manejadorRueda);

      this.escena.input.off('pointerdown', this.manejadorPunteroPresionado);

      this.escena.input.off('pointermove', this.manejadorPunteroMovido);

      this.escena.input.off('pointerup', this.manejadorPunteroLiberado);

      this.escena.input.off('pointerupoutside', this.manejadorPunteroLiberado);
    }

    const lienzo = this.escena?.game?.canvas;

    if (lienzo) {
      lienzo.style.touchAction = this.estiloTouchAnterior;
    }

    this.interaccionHabilitada = false;

    this.punteros.clear();

    this.arrastre = null;

    this.distanciaPinza = null;

    if (this.contenedor) {
      this.contenedor.remove();
    }

    this.brujula?.remove();
    this.brujula = null;
    this.panelMapa?.remove();
    this.panelMapa = null;

    this.contenedor = null;

    this.botonAcercar = null;

    this.botonAlejar = null;

    this.botonRestaurar = null;
  }

}
