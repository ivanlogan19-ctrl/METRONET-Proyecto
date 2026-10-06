import Phaser from 'phaser';
import { observarTamanoMapa } from '../mapa/ObservarTamanoMapa.js';

import CapaBarrios from '../mapa/capas/CapaBarrios.js';
import CapaMapaBase from '../mapa/capas/CapaMapaBase.js';
import CapaPuntosInteres from '../mapa/capas/CapaPuntosInteres.js';
import CapaRedMetro from '../mapa/capas/CapaRedMetro.js';
import CapaTerritorial from '../mapa/capas/CapaTerritorial.js';
import TerritorioMapa from '../mapa/utilidades/TerritorioMapa.js';
import { COLORES_INTERFAZ_MAPA, FUENTES_INTERFAZ_MAPA } from '../mapa/configuracion/ColoresMapa.js';
import ControlZoom from '../mapa/controles/ControlZoom.js';
import ReferenciasGeograficas from '../mapa/controles/ReferenciasGeograficas.js';
import MotorSimulacion from './MotorSimulacion.js';

const PROFUNDIDAD_CONTEXTO = 30;
const INTERVALO_NOTIFICACION_ESTADO = 120;
const COLOR_FONDO = convertirColorAHex(COLORES_INTERFAZ_MAPA.FONDO);
const COLOR_TEXTO = convertirColorAHex(COLORES_INTERFAZ_MAPA.TEXTO);
const COLOR_TEXTO_SECUNDARIO = convertirColorAHex(COLORES_INTERFAZ_MAPA.TEXTO_SECUNDARIO);

class EscenaSimulacion extends Phaser.Scene {
  constructor(opciones = {}) {
    super({ key: 'EscenaSimulacion' });
    this.capaMapaBase = null;
    this.capaBarrios = null;
    this.capaPuntosInteres = null;
    this.capaRedMetro = null;
    this.controlZoom = null;
    this.disenoActual = null;
    this.motorSimulacion = null;
    this.marcoVisor = null;
    this.indicadorActividad = null;
    this.etiquetaEstado = null;
    this.etiquetaRed = null;
    this.etiquetaSeleccion = null;
    this.tweenActividad = null;
    this.estadoVisual = 'RED LISTA';
    this.estadoMotorAnterior = null;
    this.ultimoAvisoEstado = 0;
    this.seguimientoMetroActivo = false;
    this.alActualizarEstado = opciones.alActualizarEstado ?? (() => {});
    this.alSeleccionarUnidad = opciones.alSeleccionarUnidad ?? (() => {});
    this.idUnidadSeleccionada = null;
    this.vistaGeograficaPendiente = null;
  }

  preload() {
    this.load.json('barriosMontevideoSimulacion', new URL('../mapa/datos/barrios_wgs84.geojson', import.meta.url).href);
    this.load.json('puntosInteresSimulacion', new URL('../mapa/datos/puntos-interes.json', import.meta.url).href);
  }

  create() {
    this.capaMapaBase = new CapaMapaBase(this, { colorFondo: COLORES_INTERFAZ_MAPA.FONDO });
    this.capaMapaBase.crear();
    this.capaBarrios = new CapaBarrios(this, { datos: this.cache.json.get('barriosMontevideoSimulacion') });
    this.capaBarrios.dibujar();
    this.capaPuntosInteres = new CapaPuntosInteres(this, {
      datos: this.cache.json.get('puntosInteresSimulacion'),
      onActualizarPuntos: resumen => this.referenciasGeograficas?.actualizar(resumen),
      capaBarrios: this.capaBarrios,
    });
    this.capaPuntosInteres.establecerDatos(this.cache.json.get('puntosInteresSimulacion'));
    this.territorioMapa = new TerritorioMapa(this.capaBarrios);
    this.capaTerritorial = new CapaTerritorial(this, { territorio: this.territorioMapa, capaBarrios: this.capaBarrios, puntos: this.capaPuntosInteres.puntos });
    this.capaRedMetro = new CapaRedMetro(this, {
      capaBarrios: this.capaBarrios,
      alSeleccionar: (elemento) => this.seleccionarElementoRed(elemento),
    });
    this.capaRedMetro.crear();
    this.referenciasGeograficas = new ReferenciasGeograficas(this, {
      contenedor: document.querySelector('[data-contenedor-referencias]'),
      mapa: document.getElementById('visorSimulacion'),
    });
    this.crearControlZoom();
    this.cameras.main.roundPixels = true;
    this.crearContextoVisual();
    this.liberarTamano = observarTamanoMapa(this, this.game.canvas.parentElement, () => this.actualizarTamano());
    const liberar = () => {
      this.events.off('shutdown', liberar);
      this.events.off('destroy', liberar);
      this.eliminar();
    };
    this.events.once('shutdown', liberar);
    this.events.once('destroy', liberar);
  }

  update(tiempo, diferencia) {
    if (this.motorSimulacion?.estado !== 'EN_CURSO') return;
    const estado = this.motorSimulacion.actualizar(tiempo);
    if (estado.estado !== 'DETENIDA') this.capaRedMetro.actualizarRepresentacionSimulacion(estado.unidades);
    this.actualizarSeguimientoMetro(estado, diferencia);
    this.sincronizarEstadoMotor(estado);
  }

  establecerDiseno(diseno) {
    const cambiaDiseno = !this.disenoActual || this.disenoActual.simulacion?.idDiseno !== diseno.simulacion?.idDiseno;
    if (cambiaDiseno) this.vistaGeograficaPendiente = null;
    this.disenoActual = diseno;
    this.territorioMapa?.configurar(diseno.territorio);
    this.capaTerritorial?.dibujar();
    this.motorSimulacion = new MotorSimulacion(diseno);
    this.capaRedMetro.establecerDiseno(diseno);
    this.capaPuntosInteres?.establecerPuntosObjetivo(this.obtenerPuntosInteresObjetivo());
    this.capaPuntosInteres?.establecerEstacionesReferencia(diseno.estaciones ?? []);
    this.seguimientoMetroActivo = false;
    this.estadoVisual = 'RED LISTA';
    this.estadoMotorAnterior = null;
    this.detenerPulsoActividad();
    this.actualizarContextoVisual();
    this.sincronizarEstadoMotor(this.motorSimulacion.obtenerEstado(), true);
    // Recargar resultados o métricas del mismo diseño no es una solicitud de reencuadre.
    if (cambiaDiseno) this.controlZoom?.ajustarRed();
  }

  iniciarAnimacion(velocidad, duracion) {
    if (!this.motorSimulacion) return null;
    const estado = this.motorSimulacion.iniciar({ velocidad, duracion, ahora: this.time.now });
    this.capaRedMetro.iniciarRepresentacionSimulacion(estado.unidades);
    this.actualizarEstadosPuntosInteres();
    this.sincronizarEstadoMotor(estado, true);
    return estado;
  }

  pausarAnimacion() {
    if (!this.motorSimulacion) return null;
    const estado = this.motorSimulacion.pausar(this.time.now);
    this.capaRedMetro.actualizarRepresentacionSimulacion(estado.unidades);
    this.sincronizarEstadoMotor(estado, true);
    return estado;
  }

  reanudarAnimacion(ahora = this.time.now) {
    if (!this.motorSimulacion) return null;
    const estado = this.motorSimulacion.reanudar(ahora);
    this.capaRedMetro.actualizarRepresentacionSimulacion(estado.unidades);
    this.sincronizarEstadoMotor(estado, true);
    return estado;
  }

  detenerAnimacion() {
    if (!this.motorSimulacion) {
      this.capaRedMetro?.detenerAnimacion();
      return null;
    }
    const estado = this.motorSimulacion.detener();
    this.capaRedMetro.iniciarRepresentacionSimulacion(estado.unidades);
    this.actualizarEstadosPuntosInteres();
    this.sincronizarEstadoMotor(estado, true);
    return estado;
  }

  reiniciarAnimacion() {
    if (!this.motorSimulacion) return null;
    const estado = this.motorSimulacion.reiniciar(this.time.now);
    this.capaRedMetro.iniciarRepresentacionSimulacion(estado.unidades);
    this.actualizarEstadosPuntosInteres();
    this.sincronizarEstadoMotor(estado, true);
    return estado;
  }

  establecerVelocidadAnimacion(velocidad) {
    if (!this.motorSimulacion) return null;
    const estado = this.motorSimulacion.establecerVelocidad(velocidad, this.time.now);
    this.sincronizarEstadoMotor(estado, true);
    return estado;
  }

  establecerSeguimientoMetro(activo) {
    this.seguimientoMetroActivo = Boolean(activo);
    return this.seguimientoMetroActivo;
  }

  localizarReferencia(identificador) {
    return this.capaPuntosInteres?.seleccionarPunto(identificador, {
      enfocar: true,
      mostrarInformacion: false,
    });
  }

  seleccionarElementoRed(elemento) {
    if (!elemento || !this.capaRedMetro) return;
    this.capaRedMetro.establecerElementoSeleccionado(elemento);
    this.actualizarSeleccionVisual(elemento);
    if (elemento.tipo === 'unidad') this.alSeleccionarUnidad(elemento.valor.idTren);
  }

  establecerUnidadSeleccionada(id) {
    this.idUnidadSeleccionada = id === 'todas' ? null : Number(id);
    const unidad = this.disenoActual?.unidadesMetro?.find(u => u.idTren === this.idUnidadSeleccionada);
    const elemento = unidad ? { tipo: 'unidad', valor: unidad } : null;
    this.capaRedMetro?.establecerElementoSeleccionado(elemento);
    this.actualizarSeleccionVisual(elemento);
  }

  actualizarSeleccionVisual(elemento = null) {
    if (!this.etiquetaSeleccion) return;
    this.etiquetaSeleccion.setText(this.obtenerTextoSeleccion(elemento)).setVisible(false);
  }

  obtenerTextoSeleccion(elemento) {
    if (!elemento?.valor) return '';
    const valor = elemento.valor;
    if (elemento.tipo === 'estacion') return `ESTACIÓN · ${valor.nombre}${this.capaRedMetro?.esTransbordo(valor) ? ' · TRANSBORDO' : ''}`;
    if (elemento.tipo === 'linea') return `LÍNEA · ${valor.nombre}`;
    if (elemento.tipo === 'tramo') return `CONEXIÓN · ${valor.estacionA} — ${valor.estacionB}`;
    if (elemento.tipo === 'unidad') return `METRO · M-${valor.idTren ?? '—'} · ${valor.nombreLinea ?? 'SIN LÍNEA'}`;
    return '';
  }

  obtenerPuntosInteresObjetivo() {
    const objetivos = this.disenoActual?.simulacion?.puntosInteresObjetivo;
    return Array.isArray(objetivos) ? objetivos : [];
  }

  actualizarEstadosPuntosInteres(finalizada = false) {
    const objetivos = this.obtenerPuntosInteresObjetivo();
    if (!this.capaPuntosInteres || !objetivos.length) return;
    objetivos.forEach((objetivo) => {
      const identificador = objetivo.idPunto ?? objetivo.id ?? objetivo.nombre;
      if (identificador === undefined || identificador === null) return;
      const cubierto = this.estacionCubrePuntoObjetivo(objetivo);
      const estado = finalizada && cubierto
        ? 'COMPLETADO'
        : (cubierto ? 'ATENDIDO' : 'PENDIENTE');
      this.capaPuntosInteres.actualizarEstadoPuntoObjetivo(identificador, estado);
    });
  }

  estacionCubrePuntoObjetivo(objetivo) {
    const posicionX = Number(objetivo.posicionX);
    const posicionY = Number(objetivo.posicionY);
    const radioCobertura = Number(objetivo.radioCobertura);
    if (objetivo.posicionX == null || objetivo.posicionY == null ||
      !Number.isFinite(posicionX) || !Number.isFinite(posicionY) ||
      !Number.isFinite(radioCobertura) || radioCobertura <= 0) return false;
    return (this.disenoActual?.estaciones ?? []).some((estacion) => {
      return Math.hypot(Number(estacion.posicionX) - posicionX, Number(estacion.posicionY) - posicionY) <= radioCobertura;
    });
  }

  actualizarSeguimientoMetro(estado, diferencia) {
    if (estado.estado !== 'EN_CURSO') return;
    const metro = this.obtenerMetroParaSeguimiento(estado);
    if (!this.seguimientoMetroActivo || !metro?.transitable) return;
    const ruta = this.capaRedMetro.obtenerRuta(metro.nombreLinea);
    const punto = this.capaRedMetro.obtenerPuntoEnRuta(ruta, metro.progresoRuta);
    if (!punto) return;
    const camara = this.cameras.main;
    const objetivoX = punto.x - camara.width / (2 * camara.zoom);
    const objetivoY = punto.y - camara.height / (2 * camara.zoom);
    const suavizado = Phaser.Math.Clamp(diferencia * 0.004, 0, 0.18);
    camara.scrollX = Phaser.Math.Linear(camara.scrollX, objetivoX, suavizado);
    camara.scrollY = Phaser.Math.Linear(camara.scrollY, objetivoY, suavizado);
    this.controlZoom?.restringirCamara();
  }

  obtenerMetroParaSeguimiento(estado) {
    const unidadSeleccionada = this.capaRedMetro?.obtenerUnidadSeleccionada?.();
    const unidadEnRecorrido = estado.unidades?.find((unidad) => {
      return unidad.transitable && String(unidad.idTren) === String(unidadSeleccionada?.idTren);
    });
    return estado.unidades?.find(u => u.idTren === this.idUnidadSeleccionada && u.transitable) ?? unidadEnRecorrido ?? estado.metroActivo ?? null;
  }

  sincronizarEstadoMotor(estado, forzar = false) {
    const cambioEstado = estado.estado !== this.estadoMotorAnterior;
    if (cambioEstado) {
      this.estadoMotorAnterior = estado.estado;
      this.estadoVisual = obtenerEtiquetaEstado(estado.estado);
      this.actualizarContextoVisual(obtenerColorEstado(estado.estado));
      if (estado.estado === 'EN_CURSO') this.iniciarPulsoActividad();
      else this.detenerPulsoActividad();
      if (estado.estado === 'FINALIZADA') this.actualizarEstadosPuntosInteres(true);
    }
    const debeNotificar = forzar || cambioEstado || this.time.now - this.ultimoAvisoEstado >= INTERVALO_NOTIFICACION_ESTADO;
    if (!debeNotificar) return;
    this.ultimoAvisoEstado = this.time.now;
    this.alActualizarEstado(estado);
  }

  actualizarTamano() {
    const vistaAnterior = this.controlZoom?.capturarVista();
    this.capaMapaBase?.actualizar();
    this.capaBarrios?.ajustarMapa(this.scale.width, this.scale.height);
    this.capaPuntosInteres?.dibujar();
    this.capaTerritorial?.dibujar();
    this.capaRedMetro?.actualizarTamano();
    this.controlZoom?.restaurarVistaTrasRedimension(vistaAnterior, this.obtenerLimitesRed());
    this.aplicarVistaGeograficaPendiente();
    this.dibujarMarcoVisor();
    this.actualizarContextoVisual();
  }

  solicitarVistaGeografica(vista) {
    this.vistaGeograficaPendiente = vista;
    this.aplicarVistaGeograficaPendiente();
  }

  aplicarVistaGeograficaPendiente() {
    if (!this.vistaGeograficaPendiente || !this.game.canvas.width || !this.game.canvas.height) return;
    if (this.controlZoom?.aplicarVistaGeografica(this.vistaGeograficaPendiente)) {
      this.vistaGeograficaPendiente = null;
    }
  }

  crearControlZoom() {
    const contenedorPadre = document.querySelector('[data-mandos-camara]');
    if (!contenedorPadre) return;
    this.controlZoom = new ControlZoom(this, {
      capaBarrios: this.capaBarrios,
      factorZoom: 1.5,
      zoomMinimo: 0.8,
      zoomMaximo: 4,
      obtenerLimitesAjuste: () => this.obtenerLimitesRed(),
      permitirPan: () => true,
      permitirArrastre: () => !this.seguimientoMetroActivo,
      permitirArrastrePrimario: () => !this.seguimientoMetroActivo,
      etiquetaAjustar: 'Ajustar red',
      mostrarAyudaNavegacion: false,
      contenedorPadre,
      integrado: true,
      mostrarOrientacion: true,
    });
    this.controlZoom.crear();
  }

  obtenerLimitesRed() {
    return this.capaRedMetro?.obtenerLimitesEstaciones?.() ?? null;
  }

  crearContextoVisual() {
    this.marcoVisor = this.add.graphics().setDepth(PROFUNDIDAD_CONTEXTO).setScrollFactor(0);
    this.indicadorActividad = this.add.circle(0, 0, 4, COLORES_INTERFAZ_MAPA.ACTIVO)
      .setDepth(PROFUNDIDAD_CONTEXTO + 1)
      .setScrollFactor(0).setVisible(false);
    this.etiquetaEstado = this.add.text(0, 0, '', {
      color: COLOR_TEXTO,
      fontFamily: FUENTES_INTERFAZ_MAPA.SISTEMA,
      fontSize: '11px',
      fontStyle: '700',
      letterSpacing: 0.7,
    }).setDepth(PROFUNDIDAD_CONTEXTO + 1).setScrollFactor(0).setVisible(false);
    this.etiquetaRed = this.add.text(0, 0, '', {
      color: COLOR_TEXTO_SECUNDARIO,
      fontFamily: FUENTES_INTERFAZ_MAPA.SISTEMA,
      fontSize: '10px',
      fontStyle: '600',
      letterSpacing: 0.4,
    }).setDepth(PROFUNDIDAD_CONTEXTO + 1).setScrollFactor(0).setOrigin(1, 0).setVisible(false);
    this.etiquetaSeleccion = this.add.text(0, 0, '', {
      color: COLOR_TEXTO,
      fontFamily: FUENTES_INTERFAZ_MAPA.SISTEMA,
      fontSize: '10px',
      fontStyle: '700',
      letterSpacing: 0.45,
    }).setDepth(PROFUNDIDAD_CONTEXTO + 1).setScrollFactor(0).setOrigin(1, 1).setVisible(false);
    this.dibujarMarcoVisor();
    this.actualizarContextoVisual();
  }

  dibujarMarcoVisor() {
    if (!this.marcoVisor) return;
    const ancho = this.scale.width;
    const alto = this.scale.height;
    const margen = 14;
    const largoEsquina = Math.min(30, Math.max(18, ancho * 0.045));
    this.marcoVisor.clear();
    this.marcoVisor.lineStyle(1, COLORES_INTERFAZ_MAPA.BORDE, 0.8);
    this.marcoVisor.beginPath();
    this.marcoVisor.moveTo(margen, margen + largoEsquina);
    this.marcoVisor.lineTo(margen, margen);
    this.marcoVisor.lineTo(margen + largoEsquina, margen);
    this.marcoVisor.moveTo(ancho - margen - largoEsquina, margen);
    this.marcoVisor.lineTo(ancho - margen, margen);
    this.marcoVisor.lineTo(ancho - margen, margen + largoEsquina);
    this.marcoVisor.moveTo(margen, alto - margen - largoEsquina);
    this.marcoVisor.lineTo(margen, alto - margen);
    this.marcoVisor.lineTo(margen + largoEsquina, alto - margen);
    this.marcoVisor.moveTo(ancho - margen - largoEsquina, alto - margen);
    this.marcoVisor.lineTo(ancho - margen, alto - margen);
    this.marcoVisor.lineTo(ancho - margen, alto - margen - largoEsquina);
    this.marcoVisor.strokePath();
  }

  actualizarContextoVisual(colorActividad = COLORES_INTERFAZ_MAPA.ACTIVO) {
    if (!this.indicadorActividad || !this.etiquetaEstado || !this.etiquetaRed || !this.etiquetaSeleccion) return;
    const compacto = this.scale.width < 500;
    const estaciones = this.disenoActual?.estaciones?.length ?? 0;
    const lineas = this.disenoActual?.lineas?.length ?? 0;
    const unidades = this.disenoActual?.unidadesMetro?.length ?? 0;
    this.indicadorActividad.setPosition(30, 31).setFillStyle(colorActividad, 1);
    this.etiquetaEstado.setPosition(42, 23).setText(this.estadoVisual);
    this.etiquetaRed
      .setPosition(this.scale.width - 30, 23)
      .setText(`${estaciones} EST. · ${lineas} LÍN. · ${unidades} METRO${unidades === 1 ? '' : 'S'}`)
      .setVisible(false);
    this.etiquetaSeleccion.setPosition(this.scale.width - 30, this.scale.height - 28);
  }

  iniciarPulsoActividad() {
    this.detenerPulsoActividad();
    if (!this.indicadorActividad?.visible) return;
    this.tweenActividad = this.tweens.add({
      targets: this.indicadorActividad,
      alpha: { from: 1, to: 0.35 },
      duration: 620,
      ease: 'Sine.easeInOut',
      repeat: -1,
      yoyo: true,
    });
  }

  detenerPulsoActividad() {
    this.tweenActividad?.stop();
    this.tweenActividad = null;
    this.indicadorActividad?.setAlpha(1);
  }

  eliminar() {
    this.liberarTamano?.();
    this.liberarTamano = null;
    this.detenerPulsoActividad();
    this.marcoVisor?.destroy();
    this.indicadorActividad?.destroy();
    this.etiquetaEstado?.destroy();
    this.etiquetaRed?.destroy();
    this.etiquetaSeleccion?.destroy();
    this.controlZoom?.eliminar();
    this.referenciasGeograficas?.eliminar();
    this.capaTerritorial?.eliminar();
    this.capaRedMetro?.eliminar();
    this.capaPuntosInteres?.eliminar();
    this.capaBarrios?.eliminar();
    this.capaMapaBase?.eliminar();
    this.motorSimulacion = null;
  }
}

export function crearVisorSimulacion(contenedor, opciones = {}) {
  return new Promise((resolver) => {
    let juego = null;
    const destruir = () => {
      if (!juego) return;
      juego.destroy(true);
      juego = null;
    };
    class EscenaLista extends EscenaSimulacion {
      constructor() { super(opciones); }

      create() {
        super.create();
        resolver({ escena: this, destruir });
      }
    }
    juego = new Phaser.Game({
      type: Phaser.AUTO,
      parent: contenedor.id,
      backgroundColor: COLOR_FONDO,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: [EscenaLista],
    });
  });
}

function obtenerEtiquetaEstado(estado) {
  return ({
    DETENIDA: 'SIMULACIÓN DETENIDA',
    EN_CURSO: 'SIMULACIÓN EN CURSO',
    PAUSADA: 'SIMULACIÓN PAUSADA',
    FINALIZADA: 'SIMULACIÓN FINALIZADA',
  })[estado] ?? 'RED LISTA';
}

function obtenerColorEstado(estado) {
  return ({
    EN_CURSO: COLORES_INTERFAZ_MAPA.EXITO,
    PAUSADA: COLORES_INTERFAZ_MAPA.ADVERTENCIA,
    FINALIZADA: COLORES_INTERFAZ_MAPA.EXITO,
    DETENIDA: COLORES_INTERFAZ_MAPA.PELIGRO,
  })[estado] ?? COLORES_INTERFAZ_MAPA.ACTIVO;
}

function convertirColorAHex(color) {
  return `#${Number(color).toString(16).padStart(6, '0')}`;
}
