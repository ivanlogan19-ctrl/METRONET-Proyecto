import GeometriaTerritorial from './GeometriaTerritorial.js';
import { normalizarBarrio, obtenerBarriosDeZona } from './ClasificadorZonas.js';

export default class TerritorioMapa {
  constructor(capaBarrios) {
    this.capaBarrios = capaBarrios;
    this.territorio = new GeometriaTerritorial(capaBarrios.obtenerBarrios().map(b => b.feature.geometry));
    this.configurar();
  }

  configurar(configuracion = {}) {
    this.errores = [...(configuracion?.errores ?? [])];
    this.areas = (configuracion?.areas ?? []).map(area => {
      const nombres = area.tipo === 'zona' ? obtenerBarriosDeZona(normalizarBarrio(area.nombre)) : area.tipo === 'barrio' ? [area.nombre] : [];
      const barrios = nombres.map(nombre => this.capaBarrios.obtenerBarrios().find(b => b.nombreNormalizado === normalizarBarrio(nombre)));
      if (!barrios.length || barrios.some(b => !b)) this.errores.push(`Área territorial sin geometría: ${area.nombre}`);
      const geometrias = barrios.filter(Boolean).map(b => b.feature.geometry);
      return { ...area, geometrias, geometria: new GeometriaTerritorial(geometrias) };
    });
  }

  coordenada(posicion) {
    const x = posicion?.posicionX, y = posicion?.posicionY, t = this.capaBarrios.transformacion;
    if (x == null || y == null || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y)) || !t) return null;
    return [t.minX + Number(x) / 1000 * (t.maxX - t.minX), t.maxY - Number(y) / 620 * (t.maxY - t.minY)];
  }

  errorEstacion(posicion) {
    if (this.errores.length) return this.errores[0];
    const p = this.coordenada(posicion);
    if (!this.territorio.contiene(p)) return 'La estación debe quedar dentro del territorio de Montevideo representado en el mapa.';
    const area = this.areas.find(a => a.prohibirEstaciones && a.geometria.contiene(p));
    return area ? `No se permiten estaciones en ${area.nombre} según la consigna.` : null;
  }

  errorTramo(origen, destino) {
    if (this.errores.length) return this.errores[0];
    const a = this.coordenada(origen), b = this.coordenada(destino);
    if (!this.territorio.contieneSegmento(a, b)) return 'La conexión sale del territorio válido del mapa. Elegí otras estaciones o agregá una estación intermedia dentro del territorio.';
    const area = this.areas.find(area => area.prohibirTramos && area.geometria.intersectaSegmento(a, b));
    return area ? `La conexión atraviesa ${area.nombre}, donde la consigna prohíbe tramos.` : null;
  }

  errorMovimiento(posicion, nombre, diseno) {
    const error = this.errorEstacion(posicion);
    if (error || !nombre) return error;
    for (const tramo of diseno?.tramos ?? []) {
      const vecino = tramo.estacionA === nombre ? tramo.estacionB : tramo.estacionB === nombre ? tramo.estacionA : null;
      if (!vecino) continue;
      const otro = diseno.estaciones.find(e => e.nombre === vecino);
      const errorTramo = this.errorTramo(posicion, otro);
      if (errorTramo) return errorTramo;
    }
    return null;
  }

  errorRecorrido(nombres, diseno) {
    const estaciones = new Map((diseno?.estaciones ?? []).map(e => [e.nombre, e]));
    for (let i = 1; i < nombres.length; i++) {
      const error = this.errorTramo(estaciones.get(nombres[i - 1]), estaciones.get(nombres[i]));
      if (error) return error;
    }
    return null;
  }
}
