import { ZONAS, obtenerZona, normalizarBarrio } from '../utilidades/ClasificadorZonas.js';

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
      'ZONA CENTRO': 0x9bc8ff,

      'ZONA ESTE': 0x3b78c8,

      'ZONA NORTE': 0x3b78c8,

      'ZONA OESTE': 0x1a2340,

      'ZONA OESTE-COSTA': 0x1a2340,

      'ZONA NOROESTE': 0x9bc8ff,
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
    return this.colores[zona] ?? 0x1a2340;
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
