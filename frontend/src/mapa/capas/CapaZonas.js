import { ZONAS, obtenerZona, normalizarBarrio } from '../utilidades/ClasificadorZonas.js';
import { COLORES_INTERFAZ_MAPA } from '../configuracion/ColoresMapa.js';

export default class CapaZonas {
  constructor(escena, opciones = {}) {
    this.escena = escena;

    this.capaBarrios = opciones.capaBarrios ?? null;

    this.zonasSeleccionadas = [];

    /*
     * Paleta visual METRONET.
     *
     * Todas las zonas utilizan tonalidades
     * de azul para mantener una identidad
     * visual uniforme con el logo.
     */
    this.colores = {
      'ZONA CENTRO': COLORES_INTERFAZ_MAPA.ACTIVO,
      'ZONA ESTE': COLORES_INTERFAZ_MAPA.ACTIVO,
      'ZONA NORTE': COLORES_INTERFAZ_MAPA.ACTIVO,
      'ZONA OESTE': COLORES_INTERFAZ_MAPA.ACTIVO,
      'ZONA OESTE-COSTA': COLORES_INTERFAZ_MAPA.ACTIVO,
      'ZONA NOROESTE': COLORES_INTERFAZ_MAPA.ACTIVO,
    };
  }

  establecerCapaBarrios(capaBarrios) {
    this.capaBarrios = capaBarrios;
  }

  establecerZonasSeleccionadas(zonas) {
    if (!Array.isArray(zonas)) {
      this.zonasSeleccionadas = [];

      return;
    }

    this.zonasSeleccionadas = zonas.filter((zona) => ZONAS.includes(zona));

    this.actualizar();
  }

  agregarZona(zona) {
    if (!ZONAS.includes(zona)) {
      return;
    }

    if (!this.zonasSeleccionadas.includes(zona)) {
      this.zonasSeleccionadas.push(zona);
    }

    this.actualizar();
  }

  quitarZona(zona) {
    this.zonasSeleccionadas = this.zonasSeleccionadas.filter(
      (zonaSeleccionada) => zonaSeleccionada !== zona,
    );

    this.actualizar();
  }

  limpiar() {
    this.zonasSeleccionadas = [];

    this.actualizar();
  }

  obtenerZonasSeleccionadas() {
    return [...this.zonasSeleccionadas];
  }

  estaSeleccionada(zona) {
    return this.zonasSeleccionadas.includes(zona);
  }

  obtenerColor(zona) {
    return this.colores[zona] ?? COLORES_INTERFAZ_MAPA.ACTIVO;
  }

  obtenerBarriosDeZonasSeleccionadas() {
    if (!this.capaBarrios) {
      return [];
    }

    const barrios = this.capaBarrios.obtenerBarrios();

    return barrios.filter((barrio) => this.zonasSeleccionadas.includes(obtenerZona(barrio.nombre)));
  }

  obtenerZonaDeBarrio(nombreBarrio) {
    return obtenerZona(normalizarBarrio(nombreBarrio));
  }

  actualizar() {
    if (!this.capaBarrios) {
      return;
    }

    this.capaBarrios.establecerZonasSeleccionadas(this.zonasSeleccionadas);
  }

  eliminar() {
    this.zonasSeleccionadas = [];

    this.capaBarrios = null;
  }
}
