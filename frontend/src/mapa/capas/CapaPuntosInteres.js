import Phaser from 'phaser';

import '../estilos/puntos-interes.css';

import { COLORES_INTERFAZ_MAPA } from '../configuracion/ColoresMapa.js';

import { ZONAS, obtenerZona } from '../utilidades/ClasificadorZonas.js';

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

export const ESTADOS_PUNTOS_INTERES = Object.freeze({
  OBJETIVO: 'OBJETIVO',
  PENDIENTE: 'PENDIENTE',
  ATENDIDO: 'ATENDIDO',
  COMPLETADO: 'COMPLETADO',
  REFERENCIA: 'REFERENCIA',
});

const RADIO_REFERENCIA_RED_NORMALIZADO = 82;
const MARGEN_VIEWPORT_MINIMO = 36;
const MARGEN_VIEWPORT_RELATIVO = 0.14;
const DESPLAZAMIENTO_VIEWPORT_RELATIVO = 0.1;
const DESPLAZAMIENTO_VIEWPORT_MINIMO = 28;
const DIFERENCIA_ZOOM_SIGNIFICATIVA = 0.04;
const UMBRAL_ZOOM_CONTEXTO_ENTRADA = 1.72;
const UMBRAL_ZOOM_CONTEXTO_SALIDA = 1.52;
const UMBRAL_ZOOM_LOCAL_ENTRADA = 2.48;
const UMBRAL_ZOOM_LOCAL_SALIDA = 2.26;
const MAXIMO_REFERENCIAS_POR_GRUPO = 12;
const MAXIMO_ETIQUETAS_LOCALES = 8;
const ZOOM_ENFOQUE_REFERENCIA = 2.1;
const ZOOM_ENFOQUE_REFERENCIA_MINIMO = 1.65;
const ZOOM_ENFOQUE_REFERENCIA_MAXIMO = 2.35;
const NIVELES_DETALLE_REFERENCIAS = Object.freeze({
  GENERAL: 'GENERAL',
  CONTEXTO: 'CONTEXTO',
  LOCAL: 'LOCAL',
});
const MAXIMO_MARCADORES_POR_NIVEL = Object.freeze({
  [NIVELES_DETALLE_REFERENCIAS.GENERAL]: 8,
  [NIVELES_DETALLE_REFERENCIAS.CONTEXTO]: 14,
  [NIVELES_DETALLE_REFERENCIAS.LOCAL]: 22,
});

export default class CapaPuntosInteres {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    this.capaBarrios = opciones.capaBarrios || null;

    this.datos = opciones.datos || null;

    this.puntos = [];

    this.estacionesReferencia = [];

    this.contextoRedPorPunto = new Map();

    this.referenciasVisibles = [];

    this.referenciasCercaRed = [];

    this.referenciasAreaVisible = [];

    this.vistaAnterior = null;

    this.nivelDetalleAnterior = NIVELES_DETALLE_REFERENCIAS.GENERAL;

    this.objetivos = [];

    this.puntoSeleccionado = null;

    this.elementos = [];

    this.representaciones = [];

    this.limitesEtiquetas = [];

    this.panelInformacion = null;

    this.manejadorClicFueraInformacion = null;

    this.retrasoCierreInformacion = null;

    this.onCambioSeleccion = opciones.onCambioSeleccion ?? null;

    this.onActualizarPuntos = opciones.onActualizarPuntos ?? null;

    this.onSeleccionarPunto = opciones.onSeleccionarPunto ?? null;

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

  establecerEstacionesReferencia(estaciones) {
    const estacionesNormalizadas = (Array.isArray(estaciones) ? estaciones : [])
      .map((estacion, indice) => this.normalizarEstacionReferencia(estacion, indice))
      .filter(Boolean);

    if (this.sonIgualesLasEstacionesReferencia(estacionesNormalizadas)) {
      return;
    }

    this.estacionesReferencia = estacionesNormalizadas;

    this.recalcularContextoRed();

    this.actualizarVisibilidad(this.obtenerZoomActual());
  }

  normalizarEstacionReferencia(estacion, indice) {
    const posicionX = Number(estacion?.posicionX);
    const posicionY = Number(estacion?.posicionY);

    if (!Number.isFinite(posicionX) || !Number.isFinite(posicionY)) {
      return null;
    }

    return {
      ...estacion,
      posicionX,
      posicionY,
      clave: String(estacion?.id ?? estacion?.nombre ?? indice) + `|${posicionX}|${posicionY}`,
    };
  }

  sonIgualesLasEstacionesReferencia(estaciones) {
    if (this.estacionesReferencia.length !== estaciones.length) {
      return false;
    }

    return this.estacionesReferencia.every((estacion, indice) => {
      return estacion.clave === estaciones[indice]?.clave;
    });
  }

  obtenerReferenciasVisibles() {
    return this.referenciasVisibles.map((punto) => this.resumirPunto(punto));
  }

  obtenerEstacionMasCercana(identificador) {
    const punto = this.encontrarPunto(identificador);

    if (!punto) {
      return null;
    }

    const contexto = this.contextoRedPorPunto.get(this.clavePunto(punto));

    if (!contexto?.estacion) {
      return null;
    }

    return {
      ...contexto.estacion,
      distanciaNormalizada: contexto.distanciaNormalizada,
    };
  }

  establecerZonasSeleccionadas(zonas) {
    const zonasSeleccionadas = Array.isArray(zonas) ? [...zonas] : [];
    const cambioSeleccion = this.cambioEnSeleccionGeografica(
      this.zonasSeleccionadas,
      zonasSeleccionadas,
    );

    if (cambioSeleccion) {
      this.limpiarPuntoSeleccionado();
    }

    this.zonasSeleccionadas = zonasSeleccionadas;

    if (cambioSeleccion) {
      this.dibujar();
    } else {
      this.actualizarVisibilidad(this.obtenerZoomActual());
    }
  }

  establecerBarriosSeleccionados(barrios) {
    const barriosSeleccionados = Array.isArray(barrios) ? [...barrios] : [];
    const cambioSeleccion = this.cambioEnSeleccionGeografica(
      this.barriosSeleccionados,
      barriosSeleccionados,
    );

    if (cambioSeleccion) {
      this.limpiarPuntoSeleccionado();
    }

    this.barriosSeleccionados = barriosSeleccionados;

    if (cambioSeleccion) {
      this.dibujar();
    } else {
      this.actualizarVisibilidad(this.obtenerZoomActual());
    }
  }

  cambioEnSeleccionGeografica(seleccionActual, seleccionNueva) {
    if (seleccionActual.length !== seleccionNueva.length) {
      return true;
    }

    const nombresActuales = seleccionActual
      .map((nombre) => this.normalizarNombre(nombre))
      .sort();

    const nombresNuevos = seleccionNueva
      .map((nombre) => this.normalizarNombre(nombre))
      .sort();

    return nombresActuales.some((nombre, indice) => nombre !== nombresNuevos[indice]);
  }

  limpiarPuntoSeleccionado() {
    this.puntoSeleccionado = null;

    this.ocultarInformacion();
  }

  establecerPuntosObjetivo(objetivos) {
    const lista = Array.isArray(objetivos) ? objetivos : objetivos ? [objetivos] : [];

    this.objetivos = lista
      .map((objetivo) => this.normalizarObjetivo(objetivo))
      .filter(Boolean);

    this.dibujar();
  }

  actualizarEstadoPuntoObjetivo(identificador, estado) {
    const punto = this.encontrarPunto(identificador);

    if (!punto) {
      return false;
    }

    const objetivo = this.obtenerObjetivoPunto(punto);

    if (!objetivo) {
      return false;
    }

    objetivo.estado = this.normalizarEstado(estado, objetivo.estado);

    this.dibujar();

    return true;
  }

  seleccionarPunto(identificador, opciones = {}) {
    const punto = this.encontrarPunto(identificador);

    if (!punto) {
      return null;
    }

    this.puntoSeleccionado = this.clavePunto(punto);

    this.dibujar();

    if (opciones.enfocar) {
      this.enfocarPunto(punto, opciones.duracion);
    }

    const resumen = this.resumirPunto(punto);

    if (opciones.mostrarInformacion !== false) {
      this.mostrarInformacion(resumen);
    }

    if (typeof this.onSeleccionarPunto === 'function') {
      this.onSeleccionarPunto(resumen);
    }

    return resumen;
  }

  enfocarPunto(identificador, duracion = 360) {
    const punto = this.encontrarPunto(identificador);

    const posicion = punto
      ? this.convertirCoordenada(punto.longitud, punto.latitud)
      : null;

    const camara = this.escena?.cameras?.main;

    if (!posicion || !camara) {
      return null;
    }

    this.aplicarZoomEnfoqueReferencia();

    const duracionPan = this.prefiereMovimientoReducido()
      ? 0
      : Math.max(0, Number(duracion) || 0);

    camara.pan(
      posicion.x,
      posicion.y,
      duracionPan,
      'Sine.easeOut',
    );

    return posicion;
  }

  prefiereMovimientoReducido() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  aplicarZoomEnfoqueReferencia() {
    const controlZoom = this.escena?.controlZoom;
    const zoomMaximoControlado = Number(
      controlZoom?.zoomMaximoEnfoquePuntual ?? controlZoom?.zoomMaximo,
    );
    const zoomMaximo = Number.isFinite(zoomMaximoControlado)
      ? Math.min(ZOOM_ENFOQUE_REFERENCIA_MAXIMO, zoomMaximoControlado)
      : ZOOM_ENFOQUE_REFERENCIA_MAXIMO;
    const zoomObjetivo = Phaser.Math.Clamp(
      ZOOM_ENFOQUE_REFERENCIA,
      ZOOM_ENFOQUE_REFERENCIA_MINIMO,
      Math.max(ZOOM_ENFOQUE_REFERENCIA_MINIMO, zoomMaximo),
    );

    if (controlZoom?.establecerZoom) {
      controlZoom.establecerZoom(zoomObjetivo, 'enfoque-referencia');
      return;
    }

    const camara = this.escena?.cameras?.main;

    if (camara) {
      camara.setZoom(zoomObjetivo);
    }
  }

  obtenerPuntosRelevantes() {
    return this.puntos
      .filter((punto) => this.puntoEsRelevante(punto))
      .map((punto) => this.resumirPunto(punto));
  }

  obtenerPuntosObjetivo() {
    return this.puntos
      .filter((punto) => Boolean(this.obtenerObjetivoPunto(punto)))
      .map((punto) => this.resumirPunto(punto));
  }

  obtenerLimitesRelevantes() {
    const posiciones = this.puntos
      .filter((punto) => this.puntoEsRelevante(punto))
      .map((punto) => this.convertirCoordenada(punto.longitud, punto.latitud))
      .filter(Boolean);

    if (!posiciones.length) {
      return null;
    }

    return {
      minimoX: Math.min(...posiciones.map((posicion) => posicion.x)),
      maximoX: Math.max(...posiciones.map((posicion) => posicion.x)),
      minimoY: Math.min(...posiciones.map((posicion) => posicion.y)),
      maximoY: Math.max(...posiciones.map((posicion) => posicion.y)),
    };
  }

  obtenerResumenPuntos() {
    const puntos = this.obtenerPuntosRelevantes();
    const puntoSeleccionado = this.puntos.find((punto) => {
      return this.clavePunto(punto) === this.puntoSeleccionado;
    });

    return {
      haySeleccion: this.zonasSeleccionadas.length > 0 || this.barriosSeleccionados.length > 0,
      cantidadPuntos: puntos.length,
      cantidadObjetivos: puntos.filter((punto) => {
        return this.esObjetivoActivo(this.obtenerObjetivoPunto(punto));
      }).length,
      puntos,
      puntosBusqueda: this.puntos.map((punto) => this.resumirPunto(punto)),
      puntosCercaRed: this.referenciasCercaRed.map((punto) => this.resumirPunto(punto)),
      puntosAreaVisible: this.referenciasAreaVisible.map((punto) => this.resumirPunto(punto)),
      referenciasVisibles: this.obtenerReferenciasVisibles(),
      cantidadReferenciasVisibles: this.referenciasVisibles.length,
      puntoSeleccionado: puntoSeleccionado ? this.resumirPunto(puntoSeleccionado) : null,
    };
  }

  ajustarZoomVisibleAlMaximo(zoomMaximo) {
    const zoom = Number(zoomMaximo);

    if (!Number.isFinite(zoom)) {
      this.restablecerZoomMinimoVisible();

      return;
    }

    const todasLasZonasSeleccionadas = ZONAS.every((zona) => this.zonasSeleccionadas.includes(zona));

    /*
     * Elegir todas las zonas equivale a ver el mapa completo: los puntos
     * no deben saturarlo hasta que la persona haga zoom de forma explícita.
     */
    this.zoomMinimoVisible = todasLasZonasSeleccionadas
      ? Math.max(1.01, zoom)
      : Math.max(1, zoom);

    this.actualizarVisibilidad(this.obtenerZoomActual());
  }

  restablecerZoomMinimoVisible() {
    this.zoomMinimoVisible = this.zoomMinimoVisibleBase;

    this.actualizarVisibilidad(this.obtenerZoomActual());
  }

  extraerPuntos() {
    this.puntos = [];

    this.contextoRedPorPunto.clear();

    this.referenciasVisibles = [];

    this.referenciasCercaRed = [];

    this.referenciasAreaVisible = [];

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

    this.recalcularContextoRed();
  }

  recalcularContextoRed() {
    this.contextoRedPorPunto.clear();

    if (!this.estacionesReferencia.length || !this.puntos.length) {
      return;
    }

    this.puntos.forEach((punto) => {
      const contexto = this.calcularContextoRedPunto(punto);

      if (contexto) {
        this.contextoRedPorPunto.set(this.clavePunto(punto), contexto);
      }
    });
  }

  calcularContextoRedPunto(punto) {
    const coordenada = this.obtenerCoordenadaNormalizadaPunto(punto);

    if (!coordenada) {
      return null;
    }

    let estacionMasCercana = null;
    let distanciaMinima = Number.POSITIVE_INFINITY;

    this.estacionesReferencia.forEach((estacion) => {
      const distanciaNormalizada = Math.hypot(
        estacion.posicionX - coordenada.posicionX,
        estacion.posicionY - coordenada.posicionY,
      );

      if (distanciaNormalizada < distanciaMinima) {
        distanciaMinima = distanciaNormalizada;
        estacionMasCercana = estacion;
      }
    });

    if (!estacionMasCercana) {
      return null;
    }

    return {
      estacion: estacionMasCercana,
      distanciaNormalizada: distanciaMinima,
      cercaRed: distanciaMinima <= RADIO_REFERENCIA_RED_NORMALIZADO,
    };
  }

  obtenerCoordenadaNormalizadaPunto(punto) {
    const transformacion = this.capaBarrios?.calcularEscalaMapa?.();
    const posicion = this.convertirCoordenada(punto?.longitud, punto?.latitud);

    if (
      !transformacion ||
      !posicion ||
      !Number.isFinite(transformacion.anchoMapa) ||
      !Number.isFinite(transformacion.altoMapa) ||
      transformacion.anchoMapa === 0 ||
      transformacion.altoMapa === 0
    ) {
      return null;
    }

    return {
      posicionX: ((posicion.x - transformacion.offsetX) / transformacion.anchoMapa) * 1000,
      posicionY: ((posicion.y - transformacion.offsetY) / transformacion.altoMapa) * 620,
    };
  }

  obtenerContextoRedPunto(punto) {
    return this.contextoRedPorPunto.get(this.clavePunto(punto)) ?? null;
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

  normalizarObjetivo(objetivo) {
    if (typeof objetivo === 'string') {
      return { nombre: objetivo, estado: ESTADOS_PUNTOS_INTERES.OBJETIVO, etiqueta: null };
    }

    if (typeof objetivo === 'number') {
      return { id: objetivo, estado: ESTADOS_PUNTOS_INTERES.OBJETIVO, etiqueta: null };
    }

    if (!objetivo || typeof objetivo !== 'object') {
      return null;
    }

    const id = objetivo.idPunto ?? objetivo.puntoId ?? objetivo.id ?? null;
    const nombre = objetivo.nombrePunto ?? objetivo.nombre ?? null;

    if (id === null && !nombre) {
      return null;
    }

    return {
      id,
      nombre,
      estado: this.normalizarEstado(objetivo.estado, ESTADOS_PUNTOS_INTERES.OBJETIVO),
      etiqueta: objetivo.etiqueta ?? null,
    };
  }

  normalizarEstado(estado, estadoPredeterminado = ESTADOS_PUNTOS_INTERES.REFERENCIA) {
    const valor = this.normalizarNombre(estado);

    return Object.values(ESTADOS_PUNTOS_INTERES).includes(valor)
      ? valor
      : estadoPredeterminado;
  }

  obtenerObjetivoPunto(punto) {
    return this.objetivos.find((objetivo) => {
      const coincideId =
        objetivo.id !== null &&
        objetivo.id !== undefined &&
        String(objetivo.id) === String(punto.id);

      const coincideNombre =
        objetivo.nombre &&
        this.normalizarNombre(objetivo.nombre) === this.normalizarNombre(punto.nombre);

      return coincideId || coincideNombre;
    }) ?? null;
  }

  puntoEsRelevante(punto) {
    return (
      this.esObjetivoActivo(this.obtenerObjetivoPunto(punto)) ||
      this.puntoPerteneceASeleccion(punto)
    );
  }

  esObjetivoActivo(objetivo) {
    return [
      ESTADOS_PUNTOS_INTERES.OBJETIVO,
      ESTADOS_PUNTOS_INTERES.PENDIENTE,
      ESTADOS_PUNTOS_INTERES.ATENDIDO,
    ].includes(objetivo?.estado);
  }

  clavePunto(punto) {
    if (punto?.id !== null && punto?.id !== undefined) {
      return `id:${punto.id}`;
    }

    return `${this.normalizarNombre(punto?.nombre)}|${Number(punto?.longitud).toFixed(6)}|${Number(punto?.latitud).toFixed(6)}`;
  }

  encontrarPunto(identificador) {
    const referencia = this.normalizarReferenciaPunto(identificador);

    if (!referencia) return null;

    const puntoPorId = referencia.id === null
      ? null
      : this.puntos.find((punto) => String(punto.id) === String(referencia.id));

    if (puntoPorId) return puntoPorId;

    if (!referencia.nombre) return null;

    const coincidenciasPorNombre = this.puntos.filter((punto) => {
      return this.normalizarNombre(punto.nombre) === referencia.nombre;
    });

    return coincidenciasPorNombre.length === 1 ? coincidenciasPorNombre[0] : null;
  }

  normalizarReferenciaPunto(referencia) {
    if (referencia === null || referencia === undefined) return null;

    const esObjeto = typeof referencia === 'object';
    const id = esObjeto
      ? referencia.idPunto ?? referencia.puntoId ?? referencia.id ?? null
      : referencia;
    const nombre = esObjeto
      ? referencia.nombrePunto ?? referencia.nombre ?? ''
      : referencia;

    const idNormalizado = id === '' || id === null || id === undefined ? null : id;
    const nombreNormalizado = this.normalizarNombre(nombre);

    if (idNormalizado === null && !nombreNormalizado) return null;

    return { id: idNormalizado, nombre: nombreNormalizado };
  }

  resumirPunto(punto) {
    const objetivo = this.obtenerObjetivoPunto(punto);
    const estacionMasCercana = this.obtenerEstacionMasCercana(punto);

    return {
      ...punto,
      estado: objetivo?.estado ?? ESTADOS_PUNTOS_INTERES.REFERENCIA,
      objetivo: Boolean(objetivo),
      etiqueta: objetivo?.etiqueta ?? null,
      seleccionado: this.clavePunto(punto) === this.puntoSeleccionado,
      cercaRed: Boolean(this.obtenerContextoRedPunto(punto)?.cercaRed),
      estacionMasCercana,
    };
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

    this.limitesEtiquetas = [];

    this.recalcularContextoRed();

    const puntos = this.puntos
      .sort((primero, segundo) => {
        return this.obtenerPrioridadReferencia(segundo) - this.obtenerPrioridadReferencia(primero);
      });

    puntos.forEach((punto, indice) => this.dibujarPunto(punto, indice));

    this.actualizarVisibilidad(this.obtenerZoomActual(), { notificar: false });
    this.actualizarTamanoIconos();
    this.zoomAnterior = this.obtenerZoomActual();

    this.notificarCambioSeleccion();
  }

  notificarCambioSeleccion() {
    const resumen = this.obtenerResumenPuntos();

    if (typeof this.onCambioSeleccion === 'function') {
      this.onCambioSeleccion(resumen);
    }

    if (typeof this.onActualizarPuntos === 'function') {
      this.onActualizarPuntos(resumen);
    }
  }

  dibujarPunto(punto, indice) {
    const posicion = this.convertirCoordenada(
      punto.longitud,
      punto.latitud,
    );

    if (!posicion) return;

    const objetivo = this.obtenerObjetivoPunto(punto);

    const estado = objetivo?.estado ?? ESTADOS_PUNTOS_INTERES.REFERENCIA;

    const seleccionado = this.clavePunto(punto) === this.puntoSeleccionado;

    const colorCategoria = this.obtenerColorMarcador(punto);

    const colorEstado = this.obtenerColorEstado(estado);

    const marcador = this.escena.add.graphics();

    if (seleccionado || estado !== ESTADOS_PUNTOS_INTERES.REFERENCIA) {
      marcador.fillStyle(colorEstado, seleccionado ? 0.2 : 0.12);
      marcador.fillCircle(0, 0, seleccionado ? 18 : 16);
      marcador.lineStyle(1.5, colorEstado, 0.92);
      marcador.strokeCircle(0, 0, seleccionado ? 16 : 14);
    }

    marcador.fillStyle(COLORES_INTERFAZ_MAPA.PANEL_ELEVADO, 0.98);
    marcador.fillCircle(0, 0, 10);
    marcador.lineStyle(2, colorCategoria, 1);
    marcador.strokeCircle(0, 0, 10);

    this.dibujarFormaMarcador(marcador, this.obtenerFormaMarcador(punto), colorCategoria);

    this.dibujarIndicadorEstado(marcador, estado, colorEstado);

    if (seleccionado) {
      marcador.lineStyle(2, COLORES_INTERFAZ_MAPA.ACTIVO, 1);
      marcador.strokeCircle(0, 0, 20);
    }

    const etiqueta = this.crearEtiquetaPunto(punto, objetivo, estado, posicion, indice);

    const elementosContenedor = etiqueta ? [marcador, etiqueta] : [marcador];

    const contenedor = this.escena.add.container(posicion.x, posicion.y, elementosContenedor);

    contenedor.setDepth(100).setName(`punto-interes-${punto.id}`);

    const areaInteraccion = this.escena.add.zone(posicion.x, posicion.y, 36, 36);

    areaInteraccion.setOrigin(0.5, 0.5);
    areaInteraccion.setDepth(101);
    areaInteraccion.setInteractive({ useHandCursor: true });

    areaInteraccion.on('pointerdown', () => {
      this.seleccionarPunto(punto, { mostrarInformacion: true });
    });

    areaInteraccion.on('pointerover', () => {
      contenedor.setAlpha(0.8);
    });

    areaInteraccion.on('pointerout', () => {
      contenedor.setAlpha(1);
    });

    this.elementos.push(contenedor, areaInteraccion);

    this.representaciones.push({
      punto,
      objetivo,
      estado,
      contenedor,
      etiqueta,
      areaInteraccion,
      posicion,
    });
  }

  obtenerFormaMarcador(punto) {
    const tipo = this.normalizarNombre(punto.tipo);

    if (tipo.includes('HOSPITAL') || tipo.includes('SALUD')) return 'cruz';
    if (tipo.includes('ESTADIO') || tipo.includes('TERMINAL') || tipo.includes('PUERTO')) return 'triangulo';
    if (tipo.includes('MUSEO') || tipo.includes('PATRIMONIO') || tipo.includes('HISTORIC') || tipo.includes('MONUMENTO')) return 'rombo';
    if (tipo.includes('UNIVERSIDAD') || tipo.includes('FACULTAD') || tipo.includes('BIBLIOTECA')) return 'cuadrado';
    if (tipo.includes('PLAZA') || tipo.includes('PARQUE')) return 'hexagono';
    return 'circulo';
  }

  dibujarFormaMarcador(grafico, forma, color) {
    if (forma === 'cruz') {
      grafico.fillStyle(color, 1);
      grafico.fillRect(-2, -6, 4, 12);
      grafico.fillRect(-6, -2, 12, 4);
      return;
    }

    if (forma === 'circulo') {
      grafico.fillStyle(color, 1);
      grafico.fillCircle(0, 0, 4);
      return;
    }

    const puntos = forma === 'triangulo'
      ? [{ x: 0, y: -6 }, { x: 6, y: 5 }, { x: -6, y: 5 }]
      : forma === 'rombo'
        ? [{ x: 0, y: -7 }, { x: 7, y: 0 }, { x: 0, y: 7 }, { x: -7, y: 0 }]
        : forma === 'cuadrado'
          ? [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }]
          : this.crearPoligonoRegular(6, 6, Math.PI / 6);

    this.dibujarPoligono(grafico, puntos, color, true);
  }

  dibujarIndicadorEstado(grafico, estado, color) {
    if (estado === ESTADOS_PUNTOS_INTERES.OBJETIVO) {
      this.dibujarPoligono(grafico, this.crearEstrella(5, 8, 3.5), color, false);
      return;
    }

    if (estado === ESTADOS_PUNTOS_INTERES.PENDIENTE) {
      this.dibujarPoligono(grafico, [{ x: 0, y: -12 }, { x: 12, y: 0 }, { x: 0, y: 12 }, { x: -12, y: 0 }], color, false);
      return;
    }

    if (estado === ESTADOS_PUNTOS_INTERES.ATENDIDO) {
      grafico.lineStyle(2, color, 1);
      grafico.lineBetween(7, -8, 12, -3);
      grafico.lineBetween(12, -3, 7, 2);
      return;
    }

    if (estado === ESTADOS_PUNTOS_INTERES.COMPLETADO) {
      grafico.lineStyle(2.5, color, 1);
      grafico.lineBetween(-5, 1, -1, 5);
      grafico.lineBetween(-1, 5, 7, -5);
    }
  }

  crearEtiquetaPunto(punto, objetivo, estado, posicion, indice) {
    const etiqueta = objetivo?.etiqueta || this.obtenerTextoEtiqueta(punto, estado);

    const texto = this.escena.add.text(0, 0, etiqueta, {
      color: `#${COLORES_INTERFAZ_MAPA.TEXTO.toString(16).padStart(6, '0')}`,
      fontFamily: '"IBM Plex Mono", "Roboto Mono", monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      resolution: 2,
    }).setOrigin(0.5);

    const ancho = Phaser.Math.Clamp(texto.width + 16, 64, 188);

    const alto = 21;

    const desplazamiento = this.calcularPosicionEtiqueta(posicion, ancho, alto, indice);

    if (!desplazamiento) {
      texto.destroy();
      return null;
    }

    const fondo = this.escena.add.rectangle(
      0,
      0,
      ancho,
      alto,
      COLORES_INTERFAZ_MAPA.PANEL,
      0.96,
    ).setStrokeStyle(
      1,
      this.obtenerColorEstado(estado),
      estado === ESTADOS_PUNTOS_INTERES.REFERENCIA ? 0.46 : 0.88,
    );

    return this.escena.add.container(desplazamiento.x, desplazamiento.y, [fondo, texto]);
  }

  obtenerTextoEtiqueta(punto, estado) {
    const nombre = String(punto.nombre || '').trim().toLocaleUpperCase('es-UY');

    const reducido = nombre.length > 26 ? `${nombre.slice(0, 23)}…` : nombre;

    const prefijo = ({ OBJETIVO: 'OBJ', PENDIENTE: 'PEND', ATENDIDO: 'ATEND', COMPLETADO: 'OK' })[estado];

    return prefijo ? `${prefijo} · ${reducido}` : reducido;
  }

  calcularPosicionEtiqueta(posicion, ancho, alto, indice) {
    const distancia = 27;

    const candidatos = [
      { x: 0, y: -(distancia + alto / 2) },
      { x: distancia + ancho / 2, y: 0 },
      { x: 0, y: distancia + alto / 2 },
      { x: -(distancia + ancho / 2), y: 0 },
    ];

    const ordenados = candidatos.map((_, indiceCandidato) => {
      return candidatos[(indiceCandidato + indice) % candidatos.length];
    });

    const elegido = ordenados.find((desplazamiento) => {
      return !this.etiquetaSeSuperpone(
        posicion.x + desplazamiento.x - ancho / 2,
        posicion.y + desplazamiento.y - alto / 2,
        ancho,
        alto,
      );
    });

    if (!elegido) {
      return null;
    }

    this.limitesEtiquetas.push({
      x: posicion.x + elegido.x - ancho / 2,
      y: posicion.y + elegido.y - alto / 2,
      ancho,
      alto,
    });

    return elegido;
  }

  etiquetaSeSuperpone(x, y, ancho, alto) {
    const margen = 5;

    return this.limitesEtiquetas.some((limite) => {
      return (
        x < limite.x + limite.ancho + margen &&
        x + ancho + margen > limite.x &&
        y < limite.y + limite.alto + margen &&
        y + alto + margen > limite.y
      );
    });
  }

  crearPoligonoRegular(lados, radio, rotacion = 0) {
    return Array.from({ length: lados }, (_, indice) => {
      const angulo = rotacion + (Math.PI * 2 * indice) / lados;

      return { x: Math.cos(angulo) * radio, y: Math.sin(angulo) * radio };
    });
  }

  crearEstrella(puntas, radioExterior, radioInterior) {
    return Array.from({ length: puntas * 2 }, (_, indice) => {
      const radio = indice % 2 === 0 ? radioExterior : radioInterior;

      const angulo = -Math.PI / 2 + (Math.PI * indice) / puntas;

      return { x: Math.cos(angulo) * radio, y: Math.sin(angulo) * radio };
    });
  }

  dibujarPoligono(grafico, puntos, color, rellenar) {
    grafico.lineStyle(1.6, color, 1);

    if (rellenar) {
      grafico.fillStyle(color, 1);
    }

    grafico.beginPath();
    grafico.moveTo(puntos[0].x, puntos[0].y);

    puntos.slice(1).forEach((punto) => grafico.lineTo(punto.x, punto.y));

    grafico.closePath();

    if (rellenar) {
      grafico.fillPath();
    }

    grafico.strokePath();
  }

  obtenerColorEstado(estado) {
    return ({
      OBJETIVO: COLORES_INTERFAZ_MAPA.ADVERTENCIA,
      PENDIENTE: COLORES_INTERFAZ_MAPA.ADVERTENCIA,
      ATENDIDO: COLORES_INTERFAZ_MAPA.ACTIVO,
      COMPLETADO: COLORES_INTERFAZ_MAPA.EXITO,
      REFERENCIA: COLORES_INTERFAZ_MAPA.BORDE_ACTIVO,
    })[estado] ?? COLORES_INTERFAZ_MAPA.BORDE_ACTIVO;
  }

  actualizar() {
    const vista = this.obtenerVistaActual();

    if (!vista || !this.vistaCambioSignificativo(vista)) {
      return;
    }

    this.actualizarVisibilidad(vista.zoom, { vista });

    this.actualizarTamanoIconos();

    this.zoomAnterior = vista.zoom;
  }

  obtenerVistaActual() {
    const camara = this.escena?.cameras?.main;

    if (!camara) {
      return null;
    }

    const zoom = Math.max(0.01, Number(camara.zoom) || 1);
    const vistaCamara = camara.worldView;
    const ancho = Number.isFinite(vistaCamara?.width)
      ? vistaCamara.width
      : camara.width / zoom;
    const alto = Number.isFinite(vistaCamara?.height)
      ? vistaCamara.height
      : camara.height / zoom;
    const x = Number.isFinite(vistaCamara?.x) ? vistaCamara.x : camara.scrollX;
    const y = Number.isFinite(vistaCamara?.y) ? vistaCamara.y : camara.scrollY;
    const margenX = Math.max(MARGEN_VIEWPORT_MINIMO, ancho * MARGEN_VIEWPORT_RELATIVO);
    const margenY = Math.max(MARGEN_VIEWPORT_MINIMO, alto * MARGEN_VIEWPORT_RELATIVO);

    return {
      minimoX: x - margenX,
      maximoX: x + ancho + margenX,
      minimoY: y - margenY,
      maximoY: y + alto + margenY,
      centroX: x + ancho / 2,
      centroY: y + alto / 2,
      ancho,
      alto,
      zoom,
    };
  }

  vistaCambioSignificativo(vista) {
    if (!this.vistaAnterior) {
      return true;
    }

    if (Math.abs(vista.zoom - this.vistaAnterior.zoom) >= DIFERENCIA_ZOOM_SIGNIFICATIVA) {
      return true;
    }

    if (this.obtenerNivelDetalle(vista.zoom) !== this.nivelDetalleAnterior) {
      return true;
    }

    const desplazamientoMinimoX = Math.max(
      DESPLAZAMIENTO_VIEWPORT_MINIMO,
      vista.ancho * DESPLAZAMIENTO_VIEWPORT_RELATIVO,
    );
    const desplazamientoMinimoY = Math.max(
      DESPLAZAMIENTO_VIEWPORT_MINIMO,
      vista.alto * DESPLAZAMIENTO_VIEWPORT_RELATIVO,
    );

    return (
      Math.abs(vista.centroX - this.vistaAnterior.centroX) >= desplazamientoMinimoX ||
      Math.abs(vista.centroY - this.vistaAnterior.centroY) >= desplazamientoMinimoY
    );
  }

  obtenerNivelDetalle(zoom) {
    const nivelAnterior = this.nivelDetalleAnterior;

    if (nivelAnterior === NIVELES_DETALLE_REFERENCIAS.LOCAL) {
      if (zoom >= UMBRAL_ZOOM_LOCAL_SALIDA) {
        return NIVELES_DETALLE_REFERENCIAS.LOCAL;
      }

      return zoom >= UMBRAL_ZOOM_CONTEXTO_SALIDA
        ? NIVELES_DETALLE_REFERENCIAS.CONTEXTO
        : NIVELES_DETALLE_REFERENCIAS.GENERAL;
    }

    if (nivelAnterior === NIVELES_DETALLE_REFERENCIAS.CONTEXTO) {
      if (zoom >= UMBRAL_ZOOM_LOCAL_ENTRADA) {
        return NIVELES_DETALLE_REFERENCIAS.LOCAL;
      }

      return zoom >= UMBRAL_ZOOM_CONTEXTO_SALIDA
        ? NIVELES_DETALLE_REFERENCIAS.CONTEXTO
        : NIVELES_DETALLE_REFERENCIAS.GENERAL;
    }

    if (zoom >= UMBRAL_ZOOM_LOCAL_ENTRADA) {
      return NIVELES_DETALLE_REFERENCIAS.LOCAL;
    }

    return zoom >= UMBRAL_ZOOM_CONTEXTO_ENTRADA
      ? NIVELES_DETALLE_REFERENCIAS.CONTEXTO
      : NIVELES_DETALLE_REFERENCIAS.GENERAL;
  }

  actualizarTamanoIconos() {
    const zoom = this.obtenerZoomActual();

    const escala = Phaser.Math.Clamp(1 / Math.max(zoom, 0.01), 0.16, 1);

    for (const elemento of this.elementos) {
      if (!elemento) {
        continue;
      }

      elemento.setScale(escala);
    }
  }

  actualizarVisibilidad(zoom = this.obtenerZoomActual(), opciones = {}) {
    const vista = opciones.vista ?? this.obtenerVistaActual();

    if (!vista) {
      return;
    }

    const nivelDetalle = this.obtenerNivelDetalle(zoom);
    const contextos = this.representaciones.map((representacion) => {
      return this.obtenerContextoVisual(representacion, vista, zoom, nivelDetalle);
    });
    const contextosMarcadores = contextos
      .filter((contexto) => contexto.mostrarMarcador)
      .sort((primero, segundo) => this.compararContextosReferencia(primero, segundo));
    const clavesMarcadoresVisibles = this.obtenerClavesMarcadoresVisibles(
      contextosMarcadores,
      nivelDetalle,
    );
    const referenciasVisibles = contextosMarcadores.filter((contexto) => {
      return clavesMarcadoresVisibles.has(this.clavePunto(contexto.representacion.punto));
    });
    const referenciasCercaRed = contextos
      .filter((contexto) => contexto.cercaRed && (contexto.enAreaVisible || contexto.esObjetivoActivo))
      .sort((primero, segundo) => this.compararContextosReferencia(primero, segundo));
    const referenciasAreaVisible = contextos
      .filter((contexto) => contexto.enAreaVisible && contexto.esCandidataArea)
      .sort((primero, segundo) => this.compararContextosReferencia(primero, segundo));
    const clavesEtiquetas = this.obtenerClavesEtiquetas(referenciasVisibles, nivelDetalle);

    contextos.forEach((contexto) => {
      const { representacion } = contexto;
      const mostrarMarcador = contexto.mostrarMarcador && clavesMarcadoresVisibles.has(
        this.clavePunto(representacion.punto),
      );
      const mostrarEtiqueta = mostrarMarcador && clavesEtiquetas.has(
        this.clavePunto(representacion.punto),
      );

      representacion.contenedor.setVisible(mostrarMarcador);
      representacion.areaInteraccion.setVisible(mostrarMarcador);
      representacion.etiqueta?.setVisible(mostrarEtiqueta);

      if (representacion.areaInteraccion.input) {
        representacion.areaInteraccion.input.enabled = mostrarMarcador;
      }
    });

    this.referenciasVisibles = referenciasVisibles.map((contexto) => contexto.representacion.punto);
    this.referenciasCercaRed = this.limitarReferencias(referenciasCercaRed);
    this.referenciasAreaVisible = this.limitarReferencias(referenciasAreaVisible);
    this.vistaAnterior = vista;
    this.nivelDetalleAnterior = nivelDetalle;
    this.zoomAnterior = zoom;

    if (opciones.notificar !== false) {
      this.notificarCambioSeleccion();
    }
  }

  obtenerClavesMarcadoresVisibles(contextos, nivelDetalle) {
    const claves = new Set();
    contextos
      .filter((contexto) => contexto.esSeleccionado || contexto.esObjetivoActivo)
      .forEach((contexto) => claves.add(this.clavePunto(contexto.representacion.punto)));
    const limite = MAXIMO_MARCADORES_POR_NIVEL[nivelDetalle] ?? MAXIMO_MARCADORES_POR_NIVEL.GENERAL;
    contextos
      .filter((contexto) => !claves.has(this.clavePunto(contexto.representacion.punto)))
      .slice(0, limite)
      .forEach((contexto) => claves.add(this.clavePunto(contexto.representacion.punto)));
    return claves;
  }

  obtenerContextoVisual(representacion, vista, zoom, nivelDetalle) {
    const { punto, objetivo, posicion } = representacion;
    const contextoRed = this.obtenerContextoRedPunto(punto);
    const esObjetivoActivo = this.esObjetivoActivo(objetivo);
    const esSeleccionado = this.clavePunto(punto) === this.puntoSeleccionado;
    const perteneceSeleccion = this.puntoPerteneceASeleccion(punto);
    const enAreaVisible = this.posicionEstaEnVista(posicion, vista);
    const cercaRed = Boolean(contextoRed?.cercaRed);
    const cumpleZoomSeleccion = zoom + 0.001 >= this.zoomMinimoVisible;
    const esCandidataArea = (
      esObjetivoActivo ||
      esSeleccionado ||
      perteneceSeleccion ||
      cercaRed ||
      nivelDetalle === NIVELES_DETALLE_REFERENCIAS.LOCAL
    );

    return {
      representacion,
      esObjetivoActivo,
      esSeleccionado,
      perteneceSeleccion,
      cercaRed,
      enAreaVisible,
      esCandidataArea,
      mostrarMarcador: this.debeMostrarMarcador({
        esObjetivoActivo,
        esSeleccionado,
        perteneceSeleccion,
        cercaRed,
        enAreaVisible,
        cumpleZoomSeleccion,
        nivelDetalle,
      }),
    };
  }

  debeMostrarMarcador(contexto) {
    if (contexto.esSeleccionado || contexto.esObjetivoActivo) {
      return true;
    }

    if (!contexto.enAreaVisible) {
      return false;
    }

    if (contexto.perteneceSeleccion) {
      return contexto.cumpleZoomSeleccion;
    }

    if (contexto.cercaRed) {
      if (this.haySeleccionGeografica()) {
        return contexto.cumpleZoomSeleccion && (
          contexto.nivelDetalle !== NIVELES_DETALLE_REFERENCIAS.GENERAL
        );
      }

      return contexto.nivelDetalle !== NIVELES_DETALLE_REFERENCIAS.GENERAL;
    }

    return (
      contexto.nivelDetalle === NIVELES_DETALLE_REFERENCIAS.LOCAL &&
      (!this.haySeleccionGeografica() || contexto.cumpleZoomSeleccion)
    );
  }

  haySeleccionGeografica() {
    return this.zonasSeleccionadas.length > 0 || this.barriosSeleccionados.length > 0;
  }

  posicionEstaEnVista(posicion, vista) {
    if (!posicion || !vista) {
      return false;
    }

    return (
      posicion.x >= vista.minimoX &&
      posicion.x <= vista.maximoX &&
      posicion.y >= vista.minimoY &&
      posicion.y <= vista.maximoY
    );
  }

  obtenerClavesEtiquetas(contextosVisibles, nivelDetalle) {
    const claves = new Set();

    contextosVisibles.forEach((contexto) => {
      if (contexto.esObjetivoActivo || contexto.esSeleccionado) {
        claves.add(this.clavePunto(contexto.representacion.punto));
      }
    });

    if (nivelDetalle !== NIVELES_DETALLE_REFERENCIAS.LOCAL) {
      return claves;
    }

    contextosVisibles
      .filter((contexto) => contexto.enAreaVisible)
      .slice(0, MAXIMO_ETIQUETAS_LOCALES)
      .forEach((contexto) => claves.add(this.clavePunto(contexto.representacion.punto)));

    return claves;
  }

  limitarReferencias(contextos) {
    return contextos
      .slice(0, MAXIMO_REFERENCIAS_POR_GRUPO)
      .map((contexto) => contexto.representacion.punto);
  }

  compararContextosReferencia(primero, segundo) {
    const diferenciaPrioridad = this.obtenerPrioridadReferencia(segundo.representacion.punto) -
      this.obtenerPrioridadReferencia(primero.representacion.punto);

    if (diferenciaPrioridad !== 0) {
      return diferenciaPrioridad;
    }

    return this.normalizarNombre(primero.representacion.punto.nombre)
      .localeCompare(this.normalizarNombre(segundo.representacion.punto.nombre), 'es');
  }

  obtenerPrioridadReferencia(punto) {
    const objetivo = this.obtenerObjetivoPunto(punto);
    const contextoRed = this.obtenerContextoRedPunto(punto);
    let prioridad = 0;

    if (this.clavePunto(punto) === this.puntoSeleccionado) {
      prioridad += 10000;
    }

    if (this.esObjetivoActivo(objetivo)) {
      prioridad += 8000;
    }

    if (contextoRed?.cercaRed) {
      prioridad += 4000;
    }

    if (this.puntoPerteneceASeleccion(punto)) {
      prioridad += 2000;
    }

    return prioridad;
  }

  mostrarInformacion(punto) {
    this.ocultarInformacion();

    this.panelInformacion = document.createElement('section');

    this.panelInformacion.className = 'metronet-punto-interes-panel';

    this.panelInformacion.setAttribute('role', 'dialog');

    this.panelInformacion.setAttribute('aria-label', `Información de ${punto.nombre}`);

    const cabecera = document.createElement('div');

    cabecera.className = 'metronet-punto-interes-panel-cabecera';

    const titulo = document.createElement('h2');

    titulo.className = 'metronet-punto-interes-panel-titulo';

    titulo.textContent = punto.nombre;

    const botonCerrar = document.createElement('button');

    botonCerrar.type = 'button';

    botonCerrar.className = 'metronet-punto-interes-panel-cerrar';

    botonCerrar.setAttribute('aria-label', 'Cerrar información');

    botonCerrar.textContent = '×';

    botonCerrar.addEventListener('click', () => this.ocultarInformacion());

    cabecera.append(titulo, botonCerrar);

    const estado = document.createElement('p');

    estado.className = 'metronet-punto-interes-estado';

    estado.textContent = this.obtenerEtiquetaEstado(punto.estado);

    const tipo = document.createElement('p');

    tipo.className = 'metronet-punto-interes-panel-tipo';

    tipo.textContent = punto.tipo || 'Punto de interés';

    const descripcion = document.createElement('p');

    descripcion.className = 'metronet-punto-interes-panel-descripcion';

    descripcion.textContent = punto.descripcion || 'Sin descripción disponible.';

    const barrio = document.createElement('p');

    barrio.className = 'metronet-punto-interes-panel-barrio';

    barrio.textContent = `Barrio: ${punto.barrio}`;

    const estacionMasCercana = punto.estacionMasCercana ?? this.obtenerEstacionMasCercana(punto);

    const elementos = [cabecera, estado, tipo, descripcion, barrio];

    if (estacionMasCercana?.nombre) {
      const estacion = document.createElement('p');

      estacion.className = 'metronet-punto-interes-panel-estacion';

      estacion.textContent = `Estación más cercana: ${estacionMasCercana.nombre}`;

      elementos.push(estacion);
    }

    const acciones = document.createElement('div');

    acciones.className = 'metronet-punto-interes-panel-acciones';

    const botonCentrar = document.createElement('button');

    botonCentrar.type = 'button';

    botonCentrar.className = 'metronet-punto-interes-panel-accion';

    botonCentrar.textContent = 'Centrar';

    botonCentrar.addEventListener('click', () => this.enfocarPunto(punto));

    const botonCerrarAccion = document.createElement('button');

    botonCerrarAccion.type = 'button';

    botonCerrarAccion.className = 'metronet-punto-interes-panel-accion';

    botonCerrarAccion.textContent = 'Cerrar';

    botonCerrarAccion.addEventListener('click', () => this.ocultarInformacion());

    acciones.append(botonCentrar, botonCerrarAccion);

    elementos.push(acciones);

    this.panelInformacion.append(...elementos);

    this.obtenerContenedorInformacion().appendChild(this.panelInformacion);

    this.programarCierreInformacionAlClicFuera();
  }

  obtenerContenedorInformacion() {
    const lienzo = this.escena?.game?.canvas;
    const contenedorMapa = lienzo?.closest?.('#metronet-mapa') ?? document.getElementById('metronet-mapa');

    return contenedorMapa ?? document.body;
  }

  obtenerEtiquetaEstado(estado) {
    return ({
      OBJETIVO: 'Objetivo',
      PENDIENTE: 'Pendiente',
      ATENDIDO: 'Atendido',
      COMPLETADO: 'Completado',
    })[estado] ?? 'Referencia';
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

    this.representaciones = [];
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

    this.estacionesReferencia = [];

    this.contextoRedPorPunto.clear();

    this.referenciasVisibles = [];

    this.referenciasCercaRed = [];

    this.referenciasAreaVisible = [];

    this.vistaAnterior = null;

    this.objetivos = [];

    this.puntoSeleccionado = null;

    this.datos = null;

    this.zonasSeleccionadas = [];

    this.barriosSeleccionados = [];

    this.capaBarrios = null;

    this.escena = null;
  }

}
