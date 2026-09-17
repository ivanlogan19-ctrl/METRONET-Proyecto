import '../estilos/control-zoom.css';

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

    this.zoomActual = this.zoomMinimo;

    this.obtenerLimitesAjuste = opciones.obtenerLimitesAjuste ?? null;

    this.permitirPan = opciones.permitirPan ?? (() => true);

    this.permitirArrastre = opciones.permitirArrastre ?? this.permitirPan;

    this.permitirArrastrePrimario = opciones.permitirArrastrePrimario ?? (() => false);

    this.etiquetaAjustar = opciones.etiquetaAjustar ?? 'Ajustar red';

    this.zoomMaximoEnfoquePuntual = Math.min(
      opciones.zoomMaximoEnfoquePuntual ?? ZOOM_MAXIMO_ENFOQUE_PUNTUAL,
      this.zoomMaximo,
    );

    this.estadoVista = 'mapa';

    this.limitesAjustados = null;

    this.barriosEnfocados = [];

    this.limitesSeleccion = null;

    this.limitesCamara = null;

    this.contenedorPadre = opciones.contenedorPadre ?? document.body;

    this.integrado = Boolean(opciones.integrado);

    this.ancladoAlMapa = Boolean(opciones.ancladoAlMapa);

    this.mostrarControles = opciones.mostrarControles ?? true;

    this.contenedor = null;

    this.botonAcercar = null;

    this.botonAlejar = null;

    this.botonRestaurar = null;

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

    this.actualizarBotones();
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

    this.contenedorPadre.appendChild(this.contenedor);
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

    const puntoAntes = camara.getWorldPoint(xPantalla, yPantalla);

    camara.setZoom(this.normalizar(zoom));

    const puntoDespues = camara.getWorldPoint(xPantalla, yPantalla);

    camara.scrollX += puntoAntes.x - puntoDespues.x;

    camara.scrollY += puntoAntes.y - puntoDespues.y;

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

    this.actualizarBotones();
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
    const zoom = this.normalizar(Math.min(anchoDisponible / ancho, altoDisponible / alto));
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
    return this.zoomMaximo;
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

  actualizarLimitesCamara() {
    const camara = this.obtenerCamara();

    const limitesMapa = this.obtenerLimitesMapa();

    if (!camara || !limitesMapa) {
      this.limitesCamara = null;

      return;
    }

    const margen = Math.max(28, Math.min(this.escena.scale.width, this.escena.scale.height) * 0.08);

    this.limitesCamara = {
      minimoX: limitesMapa.minimoX - margen,

      maximoX: limitesMapa.maximoX + margen,

      minimoY: limitesMapa.minimoY - margen,

      maximoY: limitesMapa.maximoY + margen,
    };

    camara.setBounds(
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

    const anchoVisible = this.escena.scale.width / camara.zoom;

    const altoVisible = this.escena.scale.height / camara.zoom;

    const anchoLimites = this.limitesCamara.maximoX - this.limitesCamara.minimoX;

    const altoLimites = this.limitesCamara.maximoY - this.limitesCamara.minimoY;

    const maximoX = this.limitesCamara.maximoX - anchoVisible;

    const maximoY = this.limitesCamara.maximoY - altoVisible;

    camara.scrollX = anchoVisible >= anchoLimites
      ? this.limitesCamara.minimoX + (anchoLimites - anchoVisible) / 2
      : Math.min(Math.max(camara.scrollX, this.limitesCamara.minimoX), maximoX);

    camara.scrollY = altoVisible >= altoLimites
      ? this.limitesCamara.minimoY + (altoLimites - altoVisible) / 2
      : Math.min(Math.max(camara.scrollY, this.limitesCamara.minimoY), maximoY);
  }

  marcarVistaManual() {
    this.estadoVista = 'manual';
    this.limitesAjustados = null;
  }

  capturarVista() {
    const camara = this.obtenerCamara();
    const limitesMapa = this.obtenerLimitesMapa();
    if (!camara || !limitesMapa) return null;
    const anchoMapa = limitesMapa.maximoX - limitesMapa.minimoX;
    const altoMapa = limitesMapa.maximoY - limitesMapa.minimoY;
    return {
      estadoVista: this.estadoVista,
      zoom: camara.zoom,
      proporcionX: anchoMapa ? (camara.midPoint.x - limitesMapa.minimoX) / anchoMapa : 0.5,
      proporcionY: altoMapa ? (camara.midPoint.y - limitesMapa.minimoY) / altoMapa : 0.5,
    };
  }

  restaurarVistaTrasRedimension(vista, limitesRed = null) {
    this.actualizarLimitesCamara();
    if (!vista || vista.estadoVista === 'mapa') {
      this.restaurar();
      return;
    }
    if (vista.estadoVista === 'ajustada' && limitesRed) {
      this.ajustarArea(limitesRed, { estadoVista: 'ajustada' });
      return;
    }
    if (vista.estadoVista === 'seleccion' && this.limitesSeleccion) {
      this.limitesSeleccion = this.obtenerLimitesBarrios(this.barriosEnfocados);
      this.ajustarArea(this.limitesSeleccion, { estadoVista: 'seleccion' });
      return;
    }
    const camara = this.obtenerCamara();
    const limitesMapa = this.obtenerLimitesMapa();
    if (!camara || !limitesMapa) return;
    camara.setZoom(this.normalizar(vista.zoom));
    camara.centerOn(
      limitesMapa.minimoX + (limitesMapa.maximoX - limitesMapa.minimoX) * vista.proporcionX,
      limitesMapa.minimoY + (limitesMapa.maximoY - limitesMapa.minimoY) * vista.proporcionY,
    );
    this.estadoVista = 'manual';
    this.restringirCamara();
    this.actualizarBotones();
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
      this.actualizarLimitesCamara();

      camara.setZoom(this.zoomMinimo);

      const centroMapa = this.obtenerCentroMapa();

      camara.centerOn(
        centroMapa.x,

        centroMapa.y,
      );

      this.restringirCamara();
    }

    this.escena.actualizarVisibilidadLogo?.(true);

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

    this.botonAlejar.disabled = zoom <= this.zoomMinimo + 0.01;
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

      lienzo.title = 'Usá la rueda para acercar. Arrastrá el mapa cuando la herramienta activa lo permita.';
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

    camara.scrollX -= (posicion.x - this.arrastre.x) / camara.zoom;

    camara.scrollY -= (posicion.y - this.arrastre.y) / camara.zoom;

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

    this.contenedor = null;

    this.botonAcercar = null;

    this.botonAlejar = null;

    this.botonRestaurar = null;
  }

}
