import Phaser from 'phaser';

import { COLORES_INTERFAZ_MAPA } from '../configuracion/ColoresMapa.js';

const COLORES_LINEAS = [0x55c3e7, 0xf3ca62, 0x9ed49c, 0xd7a9f4, 0xff9e92];
const PROFUNDIDAD_RED = 8;
const PROFUNDIDAD_ESTACIONES = 10;
const PROFUNDIDAD_ETIQUETAS = 12;
const PROFUNDIDAD_METROS = 16;
const RADIO_NODO_FUNCIONAL = 4;
const DESPLAZAMIENTO_MARCADOR_ESTACION = 17;
const ANCHO_MARCADOR_ESTACION = 18;
const ALTO_MARCADOR_ESTACION = 16;
const ALCANCE_MARCADOR_ESTACION = DESPLAZAMIENTO_MARCADOR_ESTACION + ALTO_MARCADOR_ESTACION / 2;
const ESCALA_MINIMA_MARCADOR = 0.125;
const FUENTE_ETIQUETA = '"IBM Plex Mono", "Roboto Mono", monospace';
const COLOR_TEXTO = convertirColorAHex(COLORES_INTERFAZ_MAPA.TEXTO);
const COLOR_FONDO = convertirColorAHex(COLORES_INTERFAZ_MAPA.FONDO);

export default class CapaRedMetro {
  constructor(escena, opciones = {}) {
    this.escena = escena;
    this.capaBarrios = opciones.capaBarrios;
    this.alSeleccionar = opciones.alSeleccionar ?? (() => {});
    this.alUbicarEstacion = opciones.alUbicarEstacion ?? (() => {});
    this.diseno = null;
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.grafico = null;
    this.etiquetasEstaciones = [];
    this.marcadoresEstaciones = [];
    this.unidadesEstaticas = [];
    this.lineasPorEstacion = new Map();
    this.puntosEstaciones = [];
    this.limitesEtiquetas = [];
    this.unidadesSimulacion = new Map();
    this.estadoUnidadesSimulacion = [];
    this.mostrarUnidadesEstaticas = true;
    this.zoomElementosGraficos = null;
    this.manejadorPointer = (puntero) => this.procesarPuntero(puntero);
    this.manejadorPostUpdate = () => this.actualizarEscalaElementosGraficos();
  }

  crear() {
    this.grafico = this.escena.add.graphics().setDepth(PROFUNDIDAD_RED);
    this.escena.input.on('pointerdown', this.manejadorPointer);
    this.escena.events.on('postupdate', this.manejadorPostUpdate);
  }

  establecerDiseno(diseno) {
    this.detenerAnimacion(false);
    this.diseno = diseno;
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.mostrarUnidadesEstaticas = true;
    this.dibujar();
  }

  establecerModo(modo) {
    this.modo = modo;
    this.elementoSeleccionado = null;
    this.dibujar();
  }

  establecerEstacionesSeleccionadas(nombres) {
    this.estacionesSeleccionadas = Array.isArray(nombres) ? nombres : [];
    this.dibujar();
  }

  establecerElementoSeleccionado(elemento) {
    this.elementoSeleccionado = elemento;
    this.dibujar();
    if (this.estadoUnidadesSimulacion.length) {
      const unidades = [...this.estadoUnidadesSimulacion];
      this.eliminarUnidadesSimulacion();
      this.actualizarRepresentacionSimulacion(unidades);
    }
  }

  obtenerUnidadSeleccionada() {
    return this.elementoSeleccionado?.tipo === 'unidad' ? this.elementoSeleccionado.valor : null;
  }

  actualizarTamano() {
    this.dibujar();
    if (this.estadoUnidadesSimulacion.length) this.actualizarRepresentacionSimulacion(this.estadoUnidadesSimulacion);
  }

  obtenerTransformacion() {
    return this.capaBarrios?.calcularEscalaMapa?.() ?? null;
  }

  convertirPosicion(posicionX, posicionY) {
    const transformacion = this.obtenerTransformacion();
    if (!transformacion) return { x: 0, y: 0 };
    return {
      x: transformacion.offsetX + (Number(posicionX) / 1000) * transformacion.anchoMapa,
      y: transformacion.offsetY + (Number(posicionY) / 620) * transformacion.altoMapa,
    };
  }

  convertirPuntero(puntero) {
    const transformacion = this.obtenerTransformacion();
    if (!transformacion) return null;
    const punto = puntero.positionToCamera(this.escena.cameras.main);
    if (
      punto.x < transformacion.offsetX || punto.x > transformacion.offsetX + transformacion.anchoMapa ||
      punto.y < transformacion.offsetY || punto.y > transformacion.offsetY + transformacion.altoMapa
    ) return null;
    return {
      posicionX: Math.round(((punto.x - transformacion.offsetX) / transformacion.anchoMapa) * 1000),
      posicionY: Math.round(((punto.y - transformacion.offsetY) / transformacion.altoMapa) * 620),
      punto,
    };
  }

  dibujar() {
    if (!this.grafico) return;
    this.grafico.clear();
    this.eliminarElementosEstaticos();
    if (!this.diseno) return;
    const estaciones = this.obtenerEstaciones();
    const estacionesPorNombre = new Map(estaciones.map((estacion) => [estacion.nombre, estacion]));
    this.lineasPorEstacion = this.crearLineasPorEstacion();
    this.puntosEstaciones = estaciones.map((estacion) => ({
      nombre: estacion.nombre,
      ...this.convertirPosicion(estacion.posicionX, estacion.posicionY),
    }));
    this.limitesEtiquetas = [];
    this.obtenerTramos().forEach((tramo) => this.dibujarTramo(tramo, estacionesPorNombre));
    estaciones.forEach((estacion, indice) => this.dibujarEstacion(estacion, indice));
    if (this.mostrarUnidadesEstaticas) this.obtenerUnidadesMetro().forEach((unidad, indice) => this.dibujarUnidad(unidad, indice));
    this.actualizarEscalaElementosGraficos(true);
  }

  dibujarTramo(tramo, estaciones) {
    const origen = estaciones.get(tramo.estacionA);
    const destino = estaciones.get(tramo.estacionB);
    if (!origen || !destino) return;
    const desde = this.convertirPosicion(origen.posicionX, origen.posicionY);
    const hasta = this.convertirPosicion(destino.posicionX, destino.posicionY);
    const seleccionado = this.esTramoSeleccionado(tramo);
    const color = this.colorLinea(tramo.nombreLinea);
    if (seleccionado) {
      this.grafico.lineStyle(16, COLORES_INTERFAZ_MAPA.ACTIVO, 0.22);
      this.grafico.lineBetween(desde.x, desde.y, hasta.x, hasta.y);
    }
    this.grafico.lineStyle(seleccionado ? 12 : 10, COLORES_INTERFAZ_MAPA.FONDO_SECUNDARIO, 0.92);
    this.grafico.lineBetween(desde.x, desde.y, hasta.x, hasta.y);
    this.grafico.lineStyle(seleccionado ? 6 : 5, color, 1);
    this.grafico.lineBetween(desde.x, desde.y, hasta.x, hasta.y);
    this.grafico.lineStyle(1, COLORES_INTERFAZ_MAPA.TEXTO, seleccionado ? 0.62 : 0.24);
    this.grafico.lineBetween(desde.x, desde.y, hasta.x, hasta.y);
  }

  dibujarEstacion(estacion, indice) {
    const punto = this.convertirPosicion(estacion.posicionX, estacion.posicionY);
    const seleccionada = this.estacionesSeleccionadas.includes(estacion.nombre);
    const activa = this.elementoSeleccionado?.tipo === 'estacion' && this.elementoSeleccionado.valor.nombre === estacion.nombre;
    const destacada = seleccionada || activa;
    const transbordo = this.esTransbordo(estacion);
    this.dibujarNodoFuncional(punto, destacada, transbordo);
    this.marcadoresEstaciones.push(this.crearMarcadorEstacion(punto, destacada, transbordo));
    this.crearEtiquetaEstacion(estacion, punto, indice, ALCANCE_MARCADOR_ESTACION);
  }

  dibujarNodoFuncional(punto, destacada, transbordo) {
    const colorNodo = destacada
      ? COLORES_INTERFAZ_MAPA.ACTIVO
      : transbordo
        ? COLORES_INTERFAZ_MAPA.ADVERTENCIA
        : COLORES_INTERFAZ_MAPA.TEXTO;
    if (destacada) {
      this.grafico.fillStyle(COLORES_INTERFAZ_MAPA.ACTIVO, 0.16);
      this.grafico.fillCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL + 9);
      this.grafico.lineStyle(2, COLORES_INTERFAZ_MAPA.ACTIVO, 0.94);
      this.grafico.strokeCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL + 7);
    }
    this.grafico.fillStyle(COLORES_INTERFAZ_MAPA.PANEL_ELEVADO, 1);
    this.grafico.fillCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL + 2);
    this.grafico.lineStyle(2, colorNodo, 1);
    this.grafico.strokeCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL + 1);
    this.grafico.fillStyle(colorNodo, 1);
    this.grafico.fillCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL - 1);
  }

  crearMarcadorEstacion(punto, destacada, transbordo) {
    const contenedor = this.escena.add.container(punto.x, punto.y).setDepth(PROFUNDIDAD_ESTACIONES);
    const grafico = this.escena.add.graphics();
    const centroY = -DESPLAZAMIENTO_MARCADOR_ESTACION;
    const superior = centroY - ALTO_MARCADOR_ESTACION / 2;
    const colorMarcador = transbordo
      ? COLORES_INTERFAZ_MAPA.ADVERTENCIA
      : destacada
        ? COLORES_INTERFAZ_MAPA.ACTIVO
        : COLORES_INTERFAZ_MAPA.TEXTO;
    this.dibujarEnlaceNodoMarcador(grafico, centroY, colorMarcador);
    if (destacada) this.dibujarHaloMarcadorEstacion(grafico, centroY);
    this.dibujarCuerpoMarcadorEstacion(grafico, superior, colorMarcador, transbordo);
    contenedor.add(grafico);
    return contenedor;
  }

  dibujarEnlaceNodoMarcador(grafico, centroY, colorMarcador) {
    grafico.lineStyle(2, colorMarcador, 0.7);
    grafico.lineBetween(0, -RADIO_NODO_FUNCIONAL, 0, centroY + ALTO_MARCADOR_ESTACION / 2);
  }

  dibujarHaloMarcadorEstacion(grafico, centroY) {
    grafico.lineStyle(2, COLORES_INTERFAZ_MAPA.ACTIVO, 0.92);
    grafico.strokeCircle(0, centroY, 13);
  }

  dibujarCuerpoMarcadorEstacion(grafico, superior, colorMarcador, transbordo) {
    const izquierda = -ANCHO_MARCADOR_ESTACION / 2;
    const centroY = superior + ALTO_MARCADOR_ESTACION / 2;
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 0.56);
    grafico.fillEllipse(0, centroY + 10, ANCHO_MARCADOR_ESTACION + 7, 5);
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.PANEL_ELEVADO, 1);
    grafico.fillRoundedRect(izquierda, superior, ANCHO_MARCADOR_ESTACION, ALTO_MARCADOR_ESTACION, 4);
    grafico.lineStyle(2, colorMarcador, 1);
    grafico.strokeRoundedRect(izquierda, superior, ANCHO_MARCADOR_ESTACION, ALTO_MARCADOR_ESTACION, 4);
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO_SECUNDARIO, 1);
    grafico.fillRoundedRect(-5, centroY - 5, 10, 6, 1);
    grafico.lineStyle(1, COLORES_INTERFAZ_MAPA.BORDE_ACTIVO, 0.9);
    grafico.lineBetween(-4, centroY + 4, -4, centroY + 8);
    grafico.lineBetween(4, centroY + 4, 4, centroY + 8);
    grafico.lineStyle(2, colorMarcador, 0.96);
    grafico.lineBetween(-6, centroY + 4, 6, centroY + 4);
    grafico.fillStyle(colorMarcador, 1);
    grafico.fillCircle(-5, centroY + 4, 1.3);
    grafico.fillCircle(5, centroY + 4, 1.3);
    if (transbordo) {
      grafico.lineStyle(1.5, COLORES_INTERFAZ_MAPA.ADVERTENCIA, 1);
      grafico.strokeCircle(0, centroY - 1, 3);
    }
  }

  dibujarUnidad(unidad, indice) {
    const ruta = this.obtenerRuta(unidad.nombreLinea);
    if (ruta.length < 2) return;
    const punto = this.obtenerPuntoEnRuta(ruta, this.obtenerProgresoUnidad(indice));
    if (!punto) return;
    const seleccionada = this.elementoSeleccionado?.tipo === 'unidad' && this.elementoSeleccionado.valor.idTren === unidad.idTren;
    this.unidadesEstaticas.push(this.crearRepresentacionMetro(punto, this.colorLinea(unidad.nombreLinea), seleccionada, unidad.idTren));
  }

  crearEtiquetaEstacion(estacion, punto, indice, radio) {
    const nombre = String(estacion.nombre ?? '').trim().toLocaleUpperCase('es-UY');
    if (!nombre) return;
    const texto = this.escena.add.text(0, 0, nombre, {
      color: COLOR_TEXTO,
      fontFamily: FUENTE_ETIQUETA,
      fontSize: '11px',
      fontStyle: 'bold',
      resolution: 2,
    }).setOrigin(0.5);
    const ancho = Phaser.Math.Clamp(texto.width + 20, 74, 180);
    const alto = 24;
    const posicion = this.calcularPosicionEtiqueta(punto, ancho, alto, radio, indice, estacion.nombre);
    const fondo = this.escena.add.rectangle(0, 0, ancho, alto, COLORES_INTERFAZ_MAPA.PANEL, 0.96)
      .setStrokeStyle(1, COLORES_INTERFAZ_MAPA.BORDE, 0.95);
    const contenedor = this.escena.add.container(posicion.x, posicion.y, [fondo, texto]).setDepth(PROFUNDIDAD_ETIQUETAS);
    this.etiquetasEstaciones.push(contenedor);
    this.limitesEtiquetas.push({ x: posicion.x - ancho / 2, y: posicion.y - alto / 2, ancho, alto, nombre: estacion.nombre });
  }

  calcularPosicionEtiqueta(punto, ancho, alto, radio, indice, nombreEstacion) {
    const distancia = radio + 12;
    const candidatos = [
      { x: 0, y: -(distancia + alto / 2) },
      { x: 0, y: distancia + alto / 2 },
      { x: distancia + ancho / 2, y: 0 },
      { x: -(distancia + ancho / 2), y: 0 },
    ];
    const ordenados = candidatos.map((_, posicion) => candidatos[(posicion + indice) % candidatos.length]);
    const candidato = ordenados.find((desplazamiento) => {
      const limite = {
        x: punto.x + desplazamiento.x - ancho / 2,
        y: punto.y + desplazamiento.y - alto / 2,
        ancho,
        alto,
      };
      return !this.limitesEtiquetas.some((existente) => this.seSuperponen(limite, existente)) && !this.tapaOtraEstacion(limite, nombreEstacion);
    }) ?? ordenados[0];
    return { x: punto.x + candidato.x, y: punto.y + candidato.y };
  }

  seSuperponen(primero, segundo) {
    const margen = 6;
    return primero.x < segundo.x + segundo.ancho + margen && primero.x + primero.ancho + margen > segundo.x && primero.y < segundo.y + segundo.alto + margen && primero.y + primero.alto + margen > segundo.y;
  }

  tapaOtraEstacion(limite, nombreEstacion) {
    return this.puntosEstaciones.some((estacion) => {
      if (estacion.nombre === nombreEstacion) return false;
      return estacion.x >= limite.x - 4 && estacion.x <= limite.x + limite.ancho + 4 && estacion.y >= limite.y - 4 && estacion.y <= limite.y + limite.alto + 4;
    });
  }

  crearRepresentacionMetro(punto, color, seleccionada = false, idTren = null) {
    const contenedor = this.escena.add.container(punto.x, punto.y).setDepth(PROFUNDIDAD_METROS);
    const grafico = this.escena.add.graphics();
    this.dibujarHaloMetro(grafico, seleccionada);
    this.dibujarSombraMetro(grafico);
    this.dibujarCuerpoMetro(grafico, color);
    this.dibujarCabinaMetro(grafico, color);
    this.dibujarRuedasMetro(grafico);
    contenedor.add(grafico);
    const identificador = this.crearIdentificadorMetro(idTren);
    if (identificador) contenedor.add(identificador);
    this.orientarMetro(contenedor, punto);
    return contenedor;
  }

  dibujarHaloMetro(grafico, seleccionada) {
    if (!seleccionada) return;
    grafico.lineStyle(3, COLORES_INTERFAZ_MAPA.ACTIVO, 0.96);
    grafico.strokeCircle(0, 0, 19);
  }

  dibujarSombraMetro(grafico) {
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 0.52);
    grafico.fillEllipse(0, 12, 38, 9);
  }

  dibujarCuerpoMetro(grafico, color) {
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO_SECUNDARIO, 1);
    grafico.fillRoundedRect(-17, -9, 34, 18, 5);
    grafico.lineStyle(2, COLORES_INTERFAZ_MAPA.TEXTO, 0.86);
    grafico.strokeRoundedRect(-17, -9, 34, 18, 5);
    grafico.fillStyle(color, 1);
    grafico.fillRoundedRect(-15, -7, 30, 6, 3);
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.PANEL_ELEVADO, 1);
    grafico.fillRoundedRect(-15, 1, 30, 6, 2);
    grafico.lineStyle(1, COLORES_INTERFAZ_MAPA.BORDE_ACTIVO, 0.75);
    grafico.lineBetween(-14, 8, 14, 8);
  }

  dibujarCabinaMetro(grafico, color) {
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.PANEL, 1);
    grafico.fillRoundedRect(-11, -5, 8, 5, 1);
    grafico.fillRoundedRect(3, -5, 8, 5, 1);
    grafico.lineStyle(1, COLORES_INTERFAZ_MAPA.TEXTO_SECUNDARIO, 0.8);
    grafico.lineBetween(0, -5, 0, 0);
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.TEXTO, 0.94);
    grafico.fillRect(13, -3, 2, 5);
    grafico.fillStyle(color, 1);
    grafico.fillCircle(14, 4, 1.7);
  }

  dibujarRuedasMetro(grafico) {
    [-10, 10].forEach((posicionX) => {
      grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 1);
      grafico.fillCircle(posicionX, 10, 3);
      grafico.fillStyle(COLORES_INTERFAZ_MAPA.BORDE_ACTIVO, 1);
      grafico.fillCircle(posicionX, 10, 1.4);
    });
  }

  crearIdentificadorMetro(idTren) {
    if (idTren === null || idTren === undefined) return null;
    return this.escena.add.text(-13, -4, String(idTren), {
      color: COLOR_FONDO,
      fontFamily: FUENTE_ETIQUETA,
      fontSize: '8px',
      fontStyle: 'bold',
      resolution: 2,
    }).setOrigin(0, 0.5);
  }

  orientarMetro(contenedor, punto) {
    const angulo = Number.isFinite(punto?.angulo) ? punto.angulo : 0;
    contenedor.setPosition(punto.x, punto.y);
    contenedor.setRotation(angulo);
  }

  procesarPuntero(puntero) {
    const evento = puntero.event ?? {};

    if (evento.shiftKey || evento.button === 1 || evento.button === 2 || puntero.middleButtonDown?.() || puntero.rightButtonDown?.()) {
      return;
    }

    const convertido = this.convertirPuntero(puntero);
    if (!convertido || !this.diseno) return;
    if (this.modo === 'crearEstacion' || this.modo === 'reubicarEstacion') {
      this.alUbicarEstacion(convertido, this.modo);
      return;
    }
    const unidad = this.obtenerUnidadCercana(convertido.punto);
    if (unidad) {
      this.alSeleccionar({ tipo: 'unidad', valor: unidad });
      return;
    }
    const estacion = this.obtenerEstacionCercana(convertido.punto);
    if (estacion) {
      this.alSeleccionar({ tipo: 'estacion', valor: estacion });
      return;
    }
    const tramo = this.obtenerTramoCercano(convertido.punto);
    if (tramo) this.alSeleccionar({ tipo: 'tramo', valor: tramo });
  }

  obtenerEstacionCercana(punto) {
    return this.obtenerEstaciones().find((estacion) => {
      const posicion = this.convertirPosicion(estacion.posicionX, estacion.posicionY);
      return Phaser.Math.Distance.Between(punto.x, punto.y, posicion.x, posicion.y) <= 18 / this.escena.cameras.main.zoom;
    }) ?? null;
  }

  obtenerUnidadCercana(punto) {
    const estados = this.estadoUnidadesSimulacion.length
      ? this.estadoUnidadesSimulacion
      : this.obtenerUnidadesMetro().map((unidad, indice) => ({
        ...unidad,
        progresoRuta: this.obtenerProgresoUnidad(indice),
      }));
    return estados.map((estado, indice) => ({
      estado,
      unidad: this.obtenerUnidadesMetro().find((unidad) => String(unidad.idTren) === String(estado.idTren)) ?? estado,
      indice,
    })).find(({ estado, unidad, indice }) => {
      const ruta = this.obtenerRuta(unidad.nombreLinea);
      const posicion = this.obtenerPuntoEnRuta(ruta, estado.progresoRuta ?? this.obtenerProgresoUnidad(indice));
      if (!posicion) return false;
      return Phaser.Math.Distance.Between(punto.x, punto.y, posicion.x, posicion.y) <= 18 / this.escena.cameras.main.zoom;
    })?.unidad ?? null;
  }

  obtenerTramoCercano(punto) {
    const estaciones = new Map(this.obtenerEstaciones().map((estacion) => [estacion.nombre, estacion]));
    return this.obtenerTramos().find((tramo) => {
      const origen = estaciones.get(tramo.estacionA);
      const destino = estaciones.get(tramo.estacionB);
      if (!origen || !destino) return false;
      const desde = this.convertirPosicion(origen.posicionX, origen.posicionY);
      const hasta = this.convertirPosicion(destino.posicionX, destino.posicionY);
      return this.distanciaPuntoTramo(punto, desde, hasta) <= 11 / this.escena.cameras.main.zoom;
    }) ?? null;
  }

  obtenerRuta(nombreLinea) {
    const estaciones = new Map(this.obtenerEstaciones().map((estacion) => [estacion.nombre, estacion]));
    const tramos = this.obtenerTramos().filter((tramo) => tramo.nombreLinea === nombreLinea);
    if (!tramos.length) return [];
    const adyacencias = new Map();
    tramos.forEach((tramo, indice) => {
      this.agregarAdyacencia(adyacencias, tramo.estacionA, { nombre: tramo.estacionB, indice });
      this.agregarAdyacencia(adyacencias, tramo.estacionB, { nombre: tramo.estacionA, indice });
    });
    const inicio = [...adyacencias.entries()].find(([, conexiones]) => conexiones.length === 1)?.[0] ?? tramos[0].estacionA;
    const visitados = new Set();
    const nombresRuta = [inicio];
    let actual = inicio;
    while (visitados.size < tramos.length) {
      const siguiente = (adyacencias.get(actual) ?? []).find((conexion) => !visitados.has(conexion.indice));
      if (!siguiente) break;
      visitados.add(siguiente.indice);
      actual = siguiente.nombre;
      nombresRuta.push(actual);
    }
    return nombresRuta.map((nombre) => estaciones.get(nombre)).filter(Boolean);
  }

  agregarAdyacencia(adyacencias, origen, destino) {
    const conexiones = adyacencias.get(origen) ?? [];
    conexiones.push(destino);
    adyacencias.set(origen, conexiones);
  }

  obtenerPuntoEnRuta(ruta, progreso) {
    if (!ruta?.length) return null;
    const puntos = ruta.map((estacion) => this.convertirPosicion(estacion.posicionX, estacion.posicionY));
    if (puntos.length === 1) return { ...puntos[0], angulo: 0 };
    const segmentos = [];
    let longitudTotal = 0;
    for (let indice = 0; indice < puntos.length - 1; indice += 1) {
      const origen = puntos[indice];
      const destino = puntos[indice + 1];
      const longitud = Phaser.Math.Distance.Between(origen.x, origen.y, destino.x, destino.y);
      segmentos.push({ origen, destino, longitud });
      longitudTotal += longitud;
    }
    if (longitudTotal === 0) return { ...puntos[0], angulo: 0 };
    let distanciaPendiente = Phaser.Math.Clamp(progreso, 0, 0.999999) * longitudTotal;
    for (const segmento of segmentos) {
      if (distanciaPendiente <= segmento.longitud) {
        const avance = segmento.longitud === 0 ? 0 : distanciaPendiente / segmento.longitud;
        return {
          x: Phaser.Math.Linear(segmento.origen.x, segmento.destino.x, avance),
          y: Phaser.Math.Linear(segmento.origen.y, segmento.destino.y, avance),
          angulo: Phaser.Math.Angle.Between(segmento.origen.x, segmento.origen.y, segmento.destino.x, segmento.destino.y),
        };
      }
      distanciaPendiente -= segmento.longitud;
    }
    const ultimo = segmentos[segmentos.length - 1];
    return {
      ...ultimo.destino,
      angulo: Phaser.Math.Angle.Between(ultimo.origen.x, ultimo.origen.y, ultimo.destino.x, ultimo.destino.y),
    };
  }

  obtenerProgresoUnidad(indice) {
    const cantidad = Math.max(this.obtenerUnidadesMetro().length, 1);
    return (indice + 1) / (cantidad + 1);
  }

  distanciaPuntoTramo(punto, desde, hasta) {
    const diferenciaX = hasta.x - desde.x;
    const diferenciaY = hasta.y - desde.y;
    const longitudCuadrada = diferenciaX * diferenciaX + diferenciaY * diferenciaY;
    if (longitudCuadrada === 0) return Phaser.Math.Distance.Between(punto.x, punto.y, desde.x, desde.y);
    const proyeccion = Phaser.Math.Clamp(
      ((punto.x - desde.x) * diferenciaX + (punto.y - desde.y) * diferenciaY) / longitudCuadrada,
      0,
      1,
    );
    return Phaser.Math.Distance.Between(punto.x, punto.y, desde.x + proyeccion * diferenciaX, desde.y + proyeccion * diferenciaY);
  }

  iniciarRepresentacionSimulacion(unidades) {
    this.detenerAnimacion(false);
    this.mostrarUnidadesEstaticas = false;
    this.dibujar();
    this.actualizarRepresentacionSimulacion(unidades);
  }

  actualizarRepresentacionSimulacion(unidades) {
    if (!Array.isArray(unidades)) return;
    if (this.mostrarUnidadesEstaticas) {
      this.iniciarRepresentacionSimulacion(unidades);
      return;
    }
    this.estadoUnidadesSimulacion = unidades;
    const unidadesPorId = new Map(this.obtenerUnidadesMetro().map((unidad) => [String(unidad.idTren), unidad]));
    const clavesVigentes = new Set();
    let requiereActualizarEscala = false;
    unidades.forEach((estado, indice) => {
      if (!estado.transitable) return;
      const clave = String(estado.idTren ?? `${estado.nombreLinea}-${indice}`);
      const unidad = unidadesPorId.get(String(estado.idTren)) ?? this.obtenerUnidadesMetro().find((candidata) => candidata.nombreLinea === estado.nombreLinea);
      const ruta = this.obtenerRuta(estado.nombreLinea);
      const punto = this.obtenerPuntoEnRuta(ruta, estado.progresoRuta);
      if (!unidad || !punto) return;
      clavesVigentes.add(clave);
      let tren = this.unidadesSimulacion.get(clave);
      if (!tren) {
        const seleccionada = this.elementoSeleccionado?.tipo === 'unidad' && String(this.elementoSeleccionado.valor.idTren) === String(unidad.idTren);
        tren = this.crearRepresentacionMetro(punto, this.colorLinea(estado.nombreLinea), seleccionada, unidad.idTren);
        this.unidadesSimulacion.set(clave, tren);
        requiereActualizarEscala = true;
      }
      tren.setPosition(punto.x, punto.y);
      tren.setRotation(punto.angulo);
    });
    this.unidadesSimulacion.forEach((tren, clave) => {
      if (clavesVigentes.has(clave)) return;
      tren.destroy();
      this.unidadesSimulacion.delete(clave);
    });
    this.actualizarEscalaElementosGraficos(requiereActualizarEscala);
  }

  limpiarRepresentacionSimulacion(restaurarVista = true) {
    this.eliminarUnidadesSimulacion();
    this.estadoUnidadesSimulacion = [];
    this.mostrarUnidadesEstaticas = true;
    if (restaurarVista && this.grafico && this.diseno) this.dibujar();
  }

  detenerAnimacion(restaurarVista = true) {
    this.eliminarUnidadesSimulacion();
    this.estadoUnidadesSimulacion = [];
    this.mostrarUnidadesEstaticas = true;
    if (restaurarVista && this.grafico && this.diseno) this.dibujar();
  }

  actualizarEscalaElementosGraficos(forzar = false) {
    const zoom = this.escena.cameras?.main?.zoom ?? 1;
    if (!forzar && this.zoomElementosGraficos === zoom) return;
    const escala = Phaser.Math.Clamp(1 / Math.max(zoom, 0.01), 0.125, 1);
    const escalaMetro = Phaser.Math.Clamp(1 / Math.max(zoom, 0.01), 0.2, 1);
    this.etiquetasEstaciones.forEach((etiqueta) => etiqueta.setScale(escala));
    this.marcadoresEstaciones.forEach((marcador) => marcador.setScale(Phaser.Math.Clamp(escala, ESCALA_MINIMA_MARCADOR, 1)));
    this.unidadesEstaticas.forEach((unidad) => unidad.setScale(escalaMetro));
    this.unidadesSimulacion.forEach((unidad) => unidad.setScale(escalaMetro));
    this.zoomElementosGraficos = zoom;
  }

  crearLineasPorEstacion() {
    const lineas = new Map();
    this.obtenerTramos().forEach((tramo) => {
      [tramo.estacionA, tramo.estacionB].forEach((nombreEstacion) => {
        const nombres = lineas.get(nombreEstacion) ?? new Set();
        nombres.add(tramo.nombreLinea);
        lineas.set(nombreEstacion, nombres);
      });
    });
    return lineas;
  }

  esTransbordo(estacion) {
    return Boolean(estacion.transbordo) || (this.lineasPorEstacion.get(estacion.nombre)?.size ?? 0) > 1;
  }

  esTramoSeleccionado(tramo) {
    return (
      this.elementoSeleccionado?.tipo === 'tramo' && this.esMismoTramo(this.elementoSeleccionado.valor, tramo)
    ) || (
      this.elementoSeleccionado?.tipo === 'linea' && this.elementoSeleccionado.valor.nombre === tramo.nombreLinea
    );
  }

  colorLinea(nombre) {
    const valor = String(nombre ?? '').split('').reduce((total, caracter) => total + caracter.charCodeAt(0), 0);
    return COLORES_LINEAS[valor % COLORES_LINEAS.length];
  }

  esMismoTramo(primero, segundo) {
    return primero.nombreLinea === segundo.nombreLinea && primero.estacionA === segundo.estacionA && primero.estacionB === segundo.estacionB;
  }

  obtenerEstaciones() { return this.diseno?.estaciones ?? []; }
  obtenerTramos() { return this.diseno?.tramos ?? []; }
  obtenerUnidadesMetro() { return this.diseno?.unidadesMetro ?? []; }

  obtenerLimitesEstaciones() {
    const posiciones = this.obtenerEstaciones()
      .map((estacion) => this.convertirPosicion(estacion.posicionX, estacion.posicionY))
      .filter((posicion) => Number.isFinite(posicion.x) && Number.isFinite(posicion.y));
    if (!posiciones.length) return null;
    return {
      minimoX: Math.min(...posiciones.map((posicion) => posicion.x)),
      maximoX: Math.max(...posiciones.map((posicion) => posicion.x)),
      minimoY: Math.min(...posiciones.map((posicion) => posicion.y)),
      maximoY: Math.max(...posiciones.map((posicion) => posicion.y)),
    };
  }

  eliminarElementosEstaticos() {
    this.etiquetasEstaciones.forEach((etiqueta) => etiqueta.destroy());
    this.marcadoresEstaciones.forEach((marcador) => marcador.destroy());
    this.unidadesEstaticas.forEach((unidad) => unidad.destroy());
    this.etiquetasEstaciones = [];
    this.marcadoresEstaciones = [];
    this.unidadesEstaticas = [];
    this.zoomElementosGraficos = null;
  }

  eliminarUnidadesSimulacion() {
    this.unidadesSimulacion.forEach((unidad) => unidad.destroy());
    this.unidadesSimulacion.clear();
  }

  eliminar() {
    this.detenerAnimacion(false);
    this.escena.input.off('pointerdown', this.manejadorPointer);
    this.escena.events.off('postupdate', this.manejadorPostUpdate);
    this.eliminarElementosEstaticos();
    this.grafico?.destroy();
    this.grafico = null;
  }
}

function convertirColorAHex(color) {
  return `#${Number(color).toString(16).padStart(6, '0')}`;
}
