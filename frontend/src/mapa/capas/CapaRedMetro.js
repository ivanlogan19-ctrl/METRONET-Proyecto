import { tramosDeRecorridos } from '../configuracion/RecorridosRed.js';
import { calcularCrucesLineas } from '../utilidades/CrucesLineas.mjs';
import { PALETA_RED, coloresDeLineas } from '../configuracion/PaletaRed.js';
import GestosRed from '../controles/GestosRed.js';
import { numeroMetroEnRed } from '../controles/NombresRed.js';
import Phaser from 'phaser';
import MedicionDistancias from '../controles/MedicionDistancias.js';

import { COLORES_INTERFAZ_MAPA, FUENTES_INTERFAZ_MAPA } from '../configuracion/ColoresMapa.js';

const PROFUNDIDAD_RED = 8;
const PROFUNDIDAD_ESTACIONES = 10;
const PROFUNDIDAD_ETIQUETAS = 12;
const PROFUNDIDAD_METROS = 16;
const RADIO_NODO_FUNCIONAL = 4;
const RADIO_NODO_VISIBLE = RADIO_NODO_FUNCIONAL + 2;
const ANCHO_VIA = 5;
// El cuerpo y su borde ocupan el ancho exterior de la vía (10 px del mapa).
const ESCALA_METRO = 0.5;
const ANCHO_VIA_SELECCIONADA = 6;
const DESPLAZAMIENTO_MARCADOR_ESTACION = 17;
const ANCHO_MARCADOR_ESTACION = 18;
const ALTO_MARCADOR_ESTACION = 16;
const ALCANCE_MARCADOR_ESTACION = DESPLAZAMIENTO_MARCADOR_ESTACION + ALTO_MARCADOR_ESTACION / 2;
const ESCALA_MINIMA_MARCADOR = 0.125;
// Píxeles de pantalla: el zoom no cambia la precisión exigida al jugador.
const TOLERANCIA_SELECCION = Object.freeze({ estacion: 18, marcador: 4, tramo: 11, ambiguedad: 2 });
const FUENTE_ETIQUETA = FUENTES_INTERFAZ_MAPA.SISTEMA;
const COLOR_TEXTO = convertirColorAHex(COLORES_INTERFAZ_MAPA.TEXTO);
const COLOR_FONDO = convertirColorAHex(COLORES_INTERFAZ_MAPA.FONDO);

export default class CapaRedMetro {
  constructor(escena, opciones = {}) {
    this.escena = escena;
    this.capaBarrios = opciones.capaBarrios;
    this.alSeleccionar = opciones.alSeleccionar ?? (() => {});
    this.alUbicarEstacion = opciones.alUbicarEstacion ?? (() => {});
    this.editable = opciones.editable ?? typeof opciones.alUbicarEstacion === 'function';
    this.mostrarTextoEnMapa = false;
    this.coloresLineas = new Map();
    this.diseno = null;
    this.rutasPorLinea = new Map();
    this.trazadosPorRuta = new WeakMap();
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.grafico = null;
    this.etiquetasEstaciones = [];
    this.texturasMarcos = new Map();
    this.marcadoresEstaciones = [];
    this.marcadoresCruces = [];
    this.unidadesEstaticas = [];
    this.lineasPorEstacion = new Map();
    this.puntosEstaciones = [];
    this.limitesEtiquetas = [];
    this.unidadesSimulacion = new Map();
    this.estadoUnidadesSimulacion = [];
    this.mostrarUnidadesEstaticas = true;
    this.zoomElementosGraficos = null;
    this.rotacionElementosGraficos = null;
    this.manejadorPostUpdate = () => this.actualizarEscalaElementosGraficos();
  }

  crear() {
    this.grafico = this.escena.add.graphics().setDepth(PROFUNDIDAD_RED);
    this.previsualizacion = this.escena.add.graphics().setDepth(PROFUNDIDAD_RED + 1);
    this.lineaActiva = '';
    this.gestos = new GestosRed(this);
    this.medicionDistancias = new MedicionDistancias(this);
    this.escena.events.on('postupdate', this.manejadorPostUpdate);
  }

  establecerDiseno(diseno) {
    this.previsualizacion?.clear();
    this.detenerAnimacion(false);
    this.diseno = diseno;
    this.coloresLineas = coloresDeLineas(diseno?.lineas, diseno?.tramos);
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.mostrarUnidadesEstaticas = true;
    this.dibujar();
    this.medicionDistancias?.actualizar(diseno);
  }

  establecerModo(modo) {
    this.previsualizacion?.clear();
    this.modo = modo;
    this.gestos?.cancelar();
    if (this.gestos?.cursor) this.gestos.cursor.hidden = true;
    this.elementoSeleccionado = null;
    this.dibujar();
  }

  establecerEstacionesSeleccionadas(nombres) {
    this.previsualizacion?.clear();
    this.estacionesSeleccionadas = Array.isArray(nombres) ? nombres : [];
    this.dibujar();
  }

  establecerElementoSeleccionado(elemento) {
    // Sin cambio de selección no hay cambio visual. El panel de unidades puede
    // confirmar la selección actual al recibir datos, sin reconstruir la red.
    if (this.elementoSeleccionado === elemento
      || (this.elementoSeleccionado?.tipo === elemento?.tipo
        && this.elementoSeleccionado?.valor === elemento?.valor)) return;
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
      posicionX: Number((((punto.x - transformacion.offsetX) / transformacion.anchoMapa) * 1000).toFixed(2)),
      posicionY: Number((((punto.y - transformacion.offsetY) / transformacion.altoMapa) * 620).toFixed(2)),
      punto,
    };
  }

  dibujar() {
    if (!this.grafico) return;
    // La geometría solo cambia con la red o el tamaño real del mapa. La cámara
    // transforma estas coordenadas por su cuenta al hacer zoom o pan.
    this.rutasPorLinea.clear();
    this.trazadosPorRuta = new WeakMap();
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
    this.dibujarCruces(estaciones);
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
    const seleccionado = this.esTramoSeleccionado(tramo) ||
      (this.modo === 'crearTramo' && this.lineaActiva === tramo.nombreLinea);
    this.dibujarVia(desde, hasta, [this.colorLinea(tramo.nombreLinea)], seleccionado);
  }

  dibujarVia(desde, hasta, colores, seleccionada) {
    const longitud = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
    if (!longitud) return;
    const dx = (hasta.x - desde.x) / longitud, dy = (hasta.y - desde.y) / longitud;
    if (seleccionada) {
      this.grafico.lineStyle(16, COLORES_INTERFAZ_MAPA.ACTIVO, 0.22);
      this.grafico.lineBetween(desde.x, desde.y, hasta.x, hasta.y);
    }
    this.grafico.lineStyle(seleccionada ? 12 : 10, COLORES_INTERFAZ_MAPA.FONDO_SECUNDARIO, 0.92);
    this.grafico.lineBetween(desde.x, desde.y, hasta.x, hasta.y);
    // Durmientes y rieles usan coordenadas del mapa: escalan y giran con la red.
    for (let distancia = 4; distancia < longitud; distancia += 8) {
      const x = desde.x + dx * distancia, y = desde.y + dy * distancia;
      const color = colores[Math.min(colores.length - 1, Math.floor(distancia / longitud * colores.length))];
      this.grafico.lineStyle(2, color, 0.8);
      this.grafico.lineBetween(x - dy * 4, y + dx * 4, x + dy * 4, y - dx * 4);
    }
    const separacion = (seleccionada ? ANCHO_VIA_SELECCIONADA : ANCHO_VIA) / 2;
    colores.forEach((color, indice) => {
      const inicio = longitud * indice / colores.length, fin = longitud * (indice + 1) / colores.length;
      for (const lado of [-1, 1]) {
        const x = -dy * separacion * lado, y = dx * separacion * lado;
        this.grafico.lineStyle(1.5, color, 1);
        this.grafico.lineBetween(desde.x + dx * inicio + x, desde.y + dy * inicio + y,
          desde.x + dx * fin + x, desde.y + dy * fin + y);
      }
    });
  }

  dibujarCruces(estaciones) {
    for (const cruce of calcularCrucesLineas(estaciones, this.obtenerTramos())) {
      const punto = this.convertirPosicion(cruce.posicionX, cruce.posicionY);
      const marcador = this.escena.add.graphics().setPosition(punto.x, punto.y).setDepth(PROFUNDIDAD_ESTACIONES - 1);
      const rombo = [{ x: 0, y: -5 }, { x: 5, y: 0 }, { x: 0, y: 5 }, { x: -5, y: 0 }];
      marcador.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 1);
      marcador.fillPoints(rombo, true);
      marcador.lineStyle(4, COLORES_INTERFAZ_MAPA.FONDO, 1);
      marcador.strokePoints(rombo, true);
      marcador.lineStyle(2, PALETA_RED.estaciones.seleccionada, 1);
      marcador.strokePoints(rombo, true);
      this.marcadoresCruces.push(marcador);
    }
  }

  dibujarEstacion(estacion, indice) {
    const punto = this.convertirPosicion(estacion.posicionX, estacion.posicionY);
    const seleccionada = this.estacionesSeleccionadas.includes(estacion.nombre);
    const activa = this.elementoSeleccionado?.tipo === 'estacion' && this.elementoSeleccionado.valor.nombre === estacion.nombre;
    const destacada = seleccionada || activa;
    const transbordo = this.esTransbordo(estacion);
    const nombres = new Set(this.lineasPorEstacion.get(estacion.nombre) ?? []);
    const colores = [...nombres].map(nombre => this.colorLinea(nombre));
    const color = colores[0] ?? PALETA_RED.estaciones.normal;
    if (transbordo) this.dibujarEstacionCompartida(punto, colores, destacada);
    else {
      this.dibujarNodoFuncional(punto, destacada, false, color);
      this.marcadoresEstaciones.push(this.crearMarcadorEstacion(punto, destacada, false, color, colores));
    }
    this.crearEtiquetaEstacion(estacion, punto, indice, ALCANCE_MARCADOR_ESTACION);
  }

  dibujarEstacionCompartida(punto, colores, destacada) {
    const radio = RADIO_NODO_VISIBLE * 1.6;
    const contorno = this.contornoEstacionCompartida(punto.x, punto.y, radio, radio);
    this.grafico.lineStyle(destacada ? 5 : 3, destacada ? COLORES_INTERFAZ_MAPA.ACTIVO : COLORES_INTERFAZ_MAPA.FONDO, 1);
    this.grafico.strokePoints(contorno, true);
    // Sectores del propio nodo, sin carteles ni un segundo marcador sobre la estación.
    const centro = { x: punto.x, y: punto.y };
    for (let i = 0; i < contorno.length; i++) {
      this.grafico.fillStyle(colores[Math.floor(i * colores.length / contorno.length)] ?? PALETA_RED.transbordo, 1);
      this.grafico.fillPoints([centro, contorno[i], contorno[(i + 1) % contorno.length]], true);
    }
    this.grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 1);
    this.grafico.fillPoints(this.contornoEstacionCompartida(punto.x, punto.y, radio * 0.55, radio * 0.55), true);
  }

  dibujarNodoFuncional(punto, destacada, transbordo, colorNodo) {
    if (destacada) {
      this.grafico.fillStyle(COLORES_INTERFAZ_MAPA.ACTIVO, 0.16);
      this.grafico.fillCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL + 9);
      this.grafico.lineStyle(2, COLORES_INTERFAZ_MAPA.ACTIVO, 0.94);
      this.grafico.strokeCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL + 7);
    }
    this.grafico.fillStyle(COLORES_INTERFAZ_MAPA.PANEL_ELEVADO, 1);
    if (transbordo) {
      const contorno = this.contornoEstacionCompartida(punto.x, punto.y, RADIO_NODO_VISIBLE, RADIO_NODO_VISIBLE);
      this.grafico.fillPoints(contorno, true);
      this.grafico.lineStyle(2, PALETA_RED.transbordo, 1);
      this.grafico.strokePoints(contorno, true);
      return;
    }
    this.grafico.fillCircle(punto.x, punto.y, RADIO_NODO_VISIBLE);
    this.grafico.lineStyle(2, colorNodo, 1);
    this.grafico.strokeCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL + 1);
    this.grafico.fillStyle(colorNodo, 1);
    this.grafico.fillCircle(punto.x, punto.y, RADIO_NODO_FUNCIONAL - 1);
  }

  crearMarcadorEstacion(punto, destacada, transbordo, color, colores) {
    const contenedor = this.escena.add.container(punto.x, punto.y).setDepth(PROFUNDIDAD_ESTACIONES);
    const grafico = this.escena.add.graphics();
    const centroY = -DESPLAZAMIENTO_MARCADOR_ESTACION;
    const superior = centroY - ALTO_MARCADOR_ESTACION / 2;
    const colorMarcador = transbordo ? PALETA_RED.transbordo : color;
    this.dibujarEnlaceNodoMarcador(grafico, centroY, colorMarcador);
    if (destacada) this.dibujarHaloMarcadorEstacion(grafico, centroY);
    this.dibujarCuerpoMarcadorEstacion(grafico, superior, colorMarcador, transbordo, colores);
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

  contornoEstacionCompartida(x, y, ancho, alto) {
    return [[-0.5, -1], [0.5, -1], [1, -0.5], [1, 0.5], [0.5, 1], [-0.5, 1], [-1, 0.5], [-1, -0.5]]
      .map(([dx, dy]) => ({ x: x + dx * ancho, y: y + dy * alto }));
  }

  dibujarCuerpoMarcadorEstacion(grafico, superior, colorMarcador, transbordo, colores) {
    const izquierda = -ANCHO_MARCADOR_ESTACION / 2;
    const centroY = superior + ALTO_MARCADOR_ESTACION / 2;
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 0.56);
    grafico.fillEllipse(0, centroY + 10, ANCHO_MARCADOR_ESTACION + 7, 5);
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.PANEL_ELEVADO, 1);
    grafico.lineStyle(2, colorMarcador, 1);
    if (transbordo) {
      const contorno = this.contornoEstacionCompartida(0, centroY, ANCHO_MARCADOR_ESTACION / 2, ALTO_MARCADOR_ESTACION / 2);
      grafico.fillPoints(contorno, true);
      grafico.strokePoints(contorno, true);
      colores.forEach((color, indice) => {
        grafico.fillStyle(color, 1);
        grafico.fillRect(-5 + indice * 10 / colores.length, centroY - 4, 10 / colores.length, 7);
      });
      return;
    }
    grafico.fillRect(izquierda, superior, ANCHO_MARCADOR_ESTACION, ALTO_MARCADOR_ESTACION);
    grafico.strokeRect(izquierda, superior, ANCHO_MARCADOR_ESTACION, ALTO_MARCADOR_ESTACION);
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO_SECUNDARIO, 1);
    grafico.fillRect(-5, centroY - 5, 10, 6);
    grafico.lineStyle(1, COLORES_INTERFAZ_MAPA.BORDE_ACTIVO, 0.9);
    grafico.lineBetween(-4, centroY + 4, -4, centroY + 8);
    grafico.lineBetween(4, centroY + 4, 4, centroY + 8);
    grafico.lineStyle(2, colorMarcador, 0.96);
    grafico.lineBetween(-6, centroY + 4, 6, centroY + 4);
    grafico.fillStyle(colorMarcador, 1);
    grafico.fillCircle(-5, centroY + 4, 1.3);
    grafico.fillCircle(5, centroY + 4, 1.3);
  }

  dibujarUnidad(unidad, indice) {
    const ruta = this.obtenerRuta(unidad.nombreLinea);
    if (ruta.length < 2) return;
    const punto = this.obtenerPuntoEnRuta(ruta, this.obtenerProgresoUnidad(indice));
    if (!punto) return;
    const seleccionada = this.elementoSeleccionado?.tipo === 'unidad' && this.elementoSeleccionado.valor.idTren === unidad.idTren;
    this.unidadesEstaticas.push(this.crearRepresentacionMetro(punto, this.coloresMetro(unidad), seleccionada, unidad.idTren));
  }

  crearEtiquetaEstacion(estacion, punto, indice, radio) {
    // Las etiquetas sobre el lienzo se omiten también en Edición.
    // La estación sigue siendo seleccionable mediante su marcador.
    if (!this.mostrarTextoEnMapa) return;
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
    const fondo = this.escena.add.image(0, 0, this.obtenerTexturaMarco(ancho, alto)).setDisplaySize(ancho + 2, alto + 2);
    const contenedor = this.escena.add.container(posicion.x, posicion.y, [fondo, texto]).setDepth(PROFUNDIDAD_ETIQUETAS);
    this.etiquetasEstaciones.push(contenedor);
    this.limitesEtiquetas.push({ x: posicion.x - ancho / 2, y: posicion.y - alto / 2, ancho, alto, nombre: estacion.nombre });
  }

  obtenerTexturaMarco(ancho, alto) {
    const clave = `marco-etiqueta-${this.escena.sys.settings.key}-${ancho}-${alto}`;
    if (this.texturasMarcos.has(clave)) return this.texturasMarcos.get(clave);
    // Fondo y texto comparten el render de texturas. Alternar Rectangle/Text
    // por estación obliga a vaciar el lote WebGL dos veces por etiqueta.
    const textura = this.escena.textures.createCanvas(clave, (ancho + 2) * 2, (alto + 2) * 2);
    const contexto = textura.getContext();
    contexto.scale(2, 2);
    contexto.fillStyle = convertirColorAHex(COLORES_INTERFAZ_MAPA.PANEL);
    contexto.globalAlpha = 0.96;
    contexto.fillRect(1, 1, ancho, alto);
    contexto.strokeStyle = convertirColorAHex(COLORES_INTERFAZ_MAPA.BORDE);
    contexto.globalAlpha = 0.95;
    contexto.lineWidth = 1;
    contexto.strokeRect(1, 1, ancho, alto);
    textura.refresh();
    this.texturasMarcos.set(clave, clave);
    return clave;
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
    grafico.strokeEllipse(0, 0, 48, 30);
  }

  dibujarSombraMetro(grafico) {
    grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 0.52);
    grafico.fillEllipse(0, 12, 44, 9);
  }

  dibujarCuerpoMetro(grafico, colores) {
    grafico.fillStyle(0xbfc7cb, 1);
    grafico.fillRect(-20, -9, 40, 18);
    grafico.lineStyle(2, COLORES_INTERFAZ_MAPA.FONDO, 1);
    grafico.strokeRect(-20, -9, 40, 18);
    grafico.fillStyle(0xe0dfd4, 1);
    grafico.fillRect(-18, -7, 36, 12);
    colores.forEach((color, indice) => {
      grafico.fillStyle(color, 1);
      grafico.fillRect(-18 + indice * 36 / colores.length, 5, 36 / colores.length, 3);
      grafico.fillRect(-18 + indice * 36 / colores.length, -8, 36 / colores.length, 2);
    });
    // Equipamiento del techo y juntas rectas conservan el detalle pixelado.
    for (const x of [-7, 3]) {
      grafico.fillStyle(0x647180, 1);
      grafico.fillRect(x, -4, 5, 6);
      grafico.fillStyle(0x263447, 1);
      grafico.fillRect(x + 1, -3, 1, 4);
      grafico.fillRect(x + 3, -3, 1, 4);
    }
  }

  dibujarCabinaMetro(grafico) {
    for (const x of [-18, 14]) {
      grafico.fillStyle(0x142439, 1);
      grafico.fillRect(x, -5, 4, 8);
      grafico.fillStyle(0x7d9ba9, 1);
      grafico.fillRect(x + 1, -4, 2, 2);
      grafico.fillStyle(0xffe5a4, 1);
      grafico.fillRect(x, 4, 3, 1);
    }
  }

  coloresMetro(unidad) {
    return [this.colorLinea(unidad.nombreLinea)];
  }

  dibujarRuedasMetro(grafico) {
    [-10, 10].forEach((posicionX) => {
      grafico.fillStyle(COLORES_INTERFAZ_MAPA.FONDO, 1);
      grafico.fillRect(posicionX - 3, 8, 6, 5);
      grafico.fillStyle(COLORES_INTERFAZ_MAPA.BORDE_ACTIVO, 1);
      grafico.fillRect(posicionX - 1, 9, 2, 2);
    });
  }

  crearIdentificadorMetro(idTren) {
    // El número permanece disponible en los controles, no sobre el mapa.
    if (!this.mostrarTextoEnMapa) return null;
    if (idTren === null || idTren === undefined) return null;
    return this.escena.add.text(-13, -4, String(numeroMetroEnRed(idTren, this.obtenerUnidadesMetro()) ?? '—'), {
      color: COLOR_FONDO,
      fontFamily: FUENTE_ETIQUETA,
      fontSize: '8px',
      fontStyle: 'bold',
      resolution: 2,
    }).setOrigin(0, 0.5);
  }

  orientarMetro(contenedor, punto = null) {
    if (punto) {
      contenedor.anguloRecorrido = Number.isFinite(punto.angulo) ? punto.angulo : 0;
      contenedor.setPosition(punto.x, punto.y);
    }
    const rotacionCamara = this.escena.cameras?.main?.rotation ?? 0;
    const angulo = (contenedor.anguloRecorrido ?? 0) + rotacionCamara;
    let anguloVisible = Math.atan2(Math.sin(angulo), Math.cos(angulo));
    // Mantener el dibujo paralelo al tramo, con las ruedas abajo en pantalla.
    // El ángulo del recorrido se conserva para los próximos giros de cámara.
    if (anguloVisible > Math.PI / 2) anguloVisible -= Math.PI;
    if (anguloVisible < -Math.PI / 2) anguloVisible += Math.PI;
    contenedor.setRotation(anguloVisible - rotacionCamara);
  }

  // Guía temporal: nunca agrega tramos al diseño ni decide su validez de negocio.
  previsualizarRecorrido(puntero) {
    this.previsualizacion?.clear();
    if (!['crearLinea', 'crearTramo'].includes(this.modo) || this.estacionesSeleccionadas.length !== 1) return;
    const origen = this.obtenerEstaciones().find(e => e.nombre === this.estacionesSeleccionadas[0]);
    const destino = this.convertirPuntero(puntero);
    if (!origen || !destino) return;
    const desde = this.convertirPosicion(origen.posicionX, origen.posicionY);
    const hasta = destino.punto;
    const color = this.modo === 'crearTramo' ? this.colorLinea(this.lineaActiva) : PALETA_RED.estaciones.seleccionada;
    const zoom = this.escena.cameras.main.zoom;
    const distancia = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
    const paso = 12 / zoom;
    this.previsualizacion.lineStyle(2 / zoom, color, .8);
    for (let i = 0; i < distancia; i += paso) {
      const a = i / distancia, b = Math.min(i + paso * .55, distancia) / distancia;
      this.previsualizacion.lineBetween(desde.x+(hasta.x-desde.x)*a, desde.y+(hasta.y-desde.y)*a, desde.x+(hasta.x-desde.x)*b, desde.y+(hasta.y-desde.y)*b);
    }
  }

  indicarPosicionInvalida(posicion) {
    const {x,y} = this.convertirPosicion(posicion.posicionX, posicion.posicionY), radio = 7 / this.escena.cameras.main.zoom;
    this.previsualizacion.clear().lineStyle(3 / this.escena.cameras.main.zoom, PALETA_RED.estaciones.invalida, 1);
    this.previsualizacion.lineBetween(x-radio,y-radio,x+radio,y+radio);
    this.previsualizacion.lineBetween(x-radio,y+radio,x+radio,y-radio);
  }

  procesarPuntero(puntero) {
    const evento = puntero.event ?? {};

    if (evento.shiftKey || evento.button === 1 || evento.button === 2 || puntero.middleButtonDown?.() || puntero.rightButtonDown?.()) {
      return;
    }

    const convertido = this.convertirPuntero(puntero);
    if (!this.diseno || !convertido) return;
    if (this.modo === 'crearEstacion' || this.modo === 'reubicarEstacion') {
      this.alUbicarEstacion(convertido, this.modo);
      return;
    }
    if (!convertido) return;
    if (['crearLinea', 'crearTramo'].includes(this.modo)) {
      const estacion = this.obtenerEstacionCercana(convertido.punto);
      if (estacion) this.alSeleccionar({tipo:'estacion',valor:estacion});
      else {
        const tramo = this.obtenerTramoCercano(convertido.punto);
        if (tramo) this.alSeleccionar(this.modo === 'crearLinea'
          ? { tipo: 'linea', valor: { nombre: tramo.nombreLinea } }
          : { tipo: 'tramo', valor: tramo });
      }
      return;
    }
    if (this.modo === 'crearMetro') {
      const tramos = this.obtenerTramosCercanos(convertido.punto);
      this.alSeleccionar(tramos.length ? {tipo:'tramos',valor:tramos} : null);
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
    const zoom = this.escena.cameras.main.zoom;
    const escala = Phaser.Math.Clamp(1 / Math.max(zoom, 0.01), ESCALA_MINIMA_MARCADOR, 1);
    return this.obtenerEstaciones().map(estacion => {
      const posicion = this.convertirPosicion(estacion.posicionX, estacion.posicionY);
      const dx = punto.x - posicion.x, dy = punto.y - posicion.y;
      const distancia = Math.hypot(dx, dy) * zoom;
      // El marcador se dibuja por encima del nodo: su caja visible también es seleccionable.
      const alMarcador = Math.hypot(
        Math.max(0, Math.abs(dx) - ANCHO_MARCADOR_ESTACION * escala / 2),
        Math.max(0, Math.abs(dy + DESPLAZAMIENTO_MARCADOR_ESTACION * escala) - ALTO_MARCADOR_ESTACION * escala / 2),
      ) * zoom;
      const radioSeleccion = Math.max(TOLERANCIA_SELECCION.estacion, RADIO_NODO_VISIBLE * zoom);
      return { estacion, distancia, seleccionable: distancia <= radioSeleccion || alMarcador <= TOLERANCIA_SELECCION.marcador };
    }).filter(candidato => candidato.seleccionable)
      .sort((a, b) => a.distancia - b.distancia || a.estacion.nombre.localeCompare(b.estacion.nombre))[0]?.estacion ?? null;
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
      const radioSeleccion = Math.max(18, 18 / this.escena.cameras.main.zoom);
      return Phaser.Math.Distance.Between(punto.x, punto.y, posicion.x, posicion.y) <= radioSeleccion;
    })?.unidad ?? null;
  }



  obtenerTramoCercano(punto) { return this.obtenerTramosCercanos(punto)[0] ?? null; }

  obtenerTramosCercanos(punto) {
    const estaciones = new Map(this.obtenerEstaciones().map((estacion) => [estacion.nombre, estacion]));
    const candidatos = this.obtenerTramos().flatMap((tramo) => {
      const origen = estaciones.get(tramo.estacionA);
      const destino = estaciones.get(tramo.estacionB);
      if (!origen || !destino) return [];
      const desde = this.convertirPosicion(origen.posicionX, origen.posicionY);
      const hasta = this.convertirPosicion(destino.posicionX, destino.posicionY);
      const distancia = this.distanciaPuntoTramo(punto, desde, hasta) * this.escena.cameras.main.zoom;
      const seleccionada = this.esTramoSeleccionado(tramo) || (this.modo === 'crearTramo' && this.lineaActiva === tramo.nombreLinea);
      const ancho = seleccionada ? ANCHO_VIA_SELECCIONADA : ANCHO_VIA;
      const tolerancia = Math.max(TOLERANCIA_SELECCION.tramo, ancho * this.escena.cameras.main.zoom / 2);
      return distancia <= tolerancia ? [{ tramo, distancia }] : [];
    }).sort((a, b) => a.distancia - b.distancia || a.tramo.nombreLinea.localeCompare(b.tramo.nombreLinea));
    const distanciaMinima = candidatos[0]?.distancia;
    return candidatos.filter(c => c.distancia <= distanciaMinima + TOLERANCIA_SELECCION.ambiguedad)
      .map(c => c.tramo);
  }

  obtenerRuta(nombreLinea) {
    if (this.rutasPorLinea.has(nombreLinea)) return this.rutasPorLinea.get(nombreLinea);
    const estaciones = new Map(this.obtenerEstaciones().map((estacion) => [estacion.nombre, estacion]));
    const tramos = tramosDeRecorridos(this.diseno).filter((tramo) => tramo.nombreLinea === nombreLinea);
    if (!tramos.length) return [];
    const adyacencias = new Map();
    tramos.forEach((tramo, indice) => {
      this.agregarAdyacencia(adyacencias, tramo.estacionA, { nombre: tramo.estacionB, indice });
      this.agregarAdyacencia(adyacencias, tramo.estacionB, { nombre: tramo.estacionA, indice });
    });
    const inicio = [...adyacencias.entries()].find(([, conexiones]) => conexiones.length === 1)?.[0] ?? tramos[0].estacionA;
    const visitados = new Set();
    const nombresRuta = [inicio];
    const distanciasRuta = [0];
    let actual = inicio;
    while (visitados.size < tramos.length) {
      const siguiente = (adyacencias.get(actual) ?? []).find((conexion) => !visitados.has(conexion.indice));
      if (!siguiente) break;
      visitados.add(siguiente.indice);
      actual = siguiente.nombre;
      nombresRuta.push(actual);
      distanciasRuta.push(Number(tramos[siguiente.indice].distanciaKm));
    }
    const ruta = nombresRuta.map((nombre, indice) => {
      const estacion = estaciones.get(nombre);
      return estacion ? { ...estacion, distanciaDesdeAnteriorKm: distanciasRuta[indice] } : null;
    }).filter(Boolean);
    this.rutasPorLinea.set(nombreLinea, ruta);
    return ruta;
  }

  agregarAdyacencia(adyacencias, origen, destino) {
    const conexiones = adyacencias.get(origen) ?? [];
    conexiones.push(destino);
    adyacencias.set(origen, conexiones);
  }

  obtenerPuntoEnRuta(ruta, progreso) {
    if (!ruta?.length) return null;
    let trazado = this.trazadosPorRuta.get(ruta);
    if (!trazado) {
      trazado = this.crearTrazado(ruta);
      this.trazadosPorRuta.set(ruta, trazado);
    }
    const { puntos, segmentos, longitudTotal } = trazado;
    if (puntos.length === 1) return { ...puntos[0], angulo: 0 };
    if (longitudTotal === 0) return { ...puntos[0], angulo: 0 };
    let distanciaPendiente = Phaser.Math.Clamp(progreso, 0, 1) * longitudTotal;
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

  crearTrazado(ruta) {
    const puntos = ruta.map(estacion => this.convertirPosicion(estacion.posicionX, estacion.posicionY));
    const segmentos = [];
    let longitudTotal = 0;
    // El motor y el dibujo deben repartir el avance con los mismos kilómetros.
    // En edición puede faltar aún la distancia: conservar entonces el reparto visual.
    const usarKilometros = ruta.slice(1).every(estacion =>
      Number.isFinite(estacion.distanciaDesdeAnteriorKm) && estacion.distanciaDesdeAnteriorKm >= 0);
    for (let indice = 0; indice < puntos.length - 1; indice += 1) {
      const origen = puntos[indice], destino = puntos[indice + 1];
      const longitud = usarKilometros ? ruta[indice + 1].distanciaDesdeAnteriorKm
        : Phaser.Math.Distance.Between(origen.x, origen.y, destino.x, destino.y);
      segmentos.push({ origen, destino, longitud });
      longitudTotal += longitud;
    }
    return { puntos, segmentos, longitudTotal };
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
        tren = this.crearRepresentacionMetro(punto, this.coloresMetro(unidad), seleccionada, unidad.idTren);
        this.unidadesSimulacion.set(clave, tren);
        requiereActualizarEscala = true;
      }
      if (!tren.aroMovimiento) {
        tren.aroMovimiento = this.escena.add.graphics();
        tren.aroMovimiento.lineStyle(2, COLORES_INTERFAZ_MAPA.EXITO, 0.95);
        tren.aroMovimiento.strokeEllipse(0, 0, 48, 30);
        tren.add(tren.aroMovimiento);
      }
      tren.aroMovimiento.setVisible(estado.enMovimiento === true);
      this.orientarMetro(tren, punto);
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
    const rotacion = this.escena.cameras?.main?.rotation ?? 0;
    if (!forzar && this.zoomElementosGraficos === zoom && this.rotacionElementosGraficos === rotacion) return;
    const escala = Phaser.Math.Clamp(1 / Math.max(zoom, 0.01), 0.125, 1);
    this.marcadoresCruces.forEach(marcador => marcador.setScale(escala));
    this.etiquetasEstaciones.forEach((etiqueta) => etiqueta.setScale(escala));
    this.marcadoresEstaciones.forEach((marcador) => marcador.setScale(Phaser.Math.Clamp(escala, ESCALA_MINIMA_MARCADOR, 1)));
    const actualizarMetro = (unidad) => {
      // La cámara escala el metro junto con la vía; no compensar su zoom.
      unidad.setScale(ESCALA_METRO);
      this.orientarMetro(unidad);
    };
    this.unidadesEstaticas.forEach(actualizarMetro);
    this.unidadesSimulacion.forEach(actualizarMetro);
    this.zoomElementosGraficos = zoom;
    this.rotacionElementosGraficos = rotacion;
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
    return (this.diseno?.conexionesLineas ?? []).some(c => c.estacionA === estacion.nombre && c.estacionB === estacion.nombre);
  }

  esTramoSeleccionado(tramo) {
    return (
      this.elementoSeleccionado?.tipo === 'tramo' && this.esMismoTramo(this.elementoSeleccionado.valor, tramo)
    ) || (
      this.elementoSeleccionado?.tipo === 'linea' && this.elementoSeleccionado.valor.nombre === tramo.nombreLinea
    );
  }

  colorLinea(nombre) {
    return this.coloresLineas.get(nombre) ?? PALETA_RED.lineas[0];
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
    this.marcadoresCruces.forEach(marcador => marcador.destroy());
    this.unidadesEstaticas.forEach((unidad) => unidad.destroy());
    this.etiquetasEstaciones = [];
    this.marcadoresEstaciones = [];
    this.marcadoresCruces = [];
    this.unidadesEstaticas = [];
    this.zoomElementosGraficos = null;
    this.rotacionElementosGraficos = null;
  }

  eliminarUnidadesSimulacion() {
    this.unidadesSimulacion.forEach((unidad) => unidad.destroy());
    this.unidadesSimulacion.clear();
  }

  eliminar() {
    this.detenerAnimacion(false);
    this.gestos?.eliminar();
    this.medicionDistancias?.eliminar();
    this.previsualizacion?.destroy();
    this.escena.events.off('postupdate', this.manejadorPostUpdate);
    this.eliminarElementosEstaticos();
    for (const clave of this.texturasMarcos.values()) this.escena.textures.remove(clave);
    this.texturasMarcos.clear();
    this.grafico?.destroy();
    this.grafico = null;
  }
}

function convertirColorAHex(color) {
  return `#${Number(color).toString(16).padStart(6, '0')}`;
}
