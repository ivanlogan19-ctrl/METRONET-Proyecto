import Phaser from 'phaser';
import '../estilos/territorio.css';
import { COLORES_INTERFAZ_MAPA } from '../configuracion/ColoresMapa.js';

export default class CapaTerritorial {
  constructor(escena, { territorio, capaBarrios }) {
    this.escena = escena;
    this.territorio = territorio;
    this.capaBarrios = capaBarrios;
    this.grafico = escena.add.graphics().setDepth(3);
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-territorio';
    this.lista = document.createElement('ul');
    this.lista.setAttribute('aria-label', 'Áreas territoriales del nivel');
    this.elemento.append(this.lista);
    this.dibujar();
  }

  dibujar() {
    this.grafico.clear();
    const transformacion = this.capaBarrios.calcularEscalaMapa();
    if (!transformacion) return;
    const convertir = p => this.capaBarrios.convertirCoordenada(p, transformacion);
    this.lista.replaceChildren();
    for (const area of this.territorio.areas) {
      const restringida = area.prohibirEstaciones || area.prohibirTramos;
      const item = document.createElement('li');
      item.className = restringida ? 'es-restriccion' : 'es-referencia';
      const prohibiciones = [area.prohibirEstaciones && 'estaciones', area.prohibirTramos && 'tramos'].filter(Boolean).join(' ni ');
      item.textContent = restringida ? `${area.nombre}: sin ${prohibiciones}.` : `${area.nombre}: referencia, permite construir.`;
      this.lista.append(item);
      // Las áreas de la consigna no son parques: conservan su propia geometría y reglas.
      const color = restringida ? 0xe79b72 : COLORES_INTERFAZ_MAPA.BORDE_ACTIVO;
      for (const geometria of area.geometrias) {
        const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
        for (const anillos of poligonos) {
          const vertices = [], huecos = [];
          anillos.forEach((anillo, indice) => {
            if (indice > 0) huecos.push(vertices.length / 2);
            for (const coord of anillo.slice(0, -1)) { const p = convertir(coord); vertices.push(p.x, p.y); }
          });
          const triangulos = Phaser.Geom.Polygon.Earcut(vertices, huecos, 2);
          this.grafico.fillStyle(color, restringida ? 0.16 : 0.07);
          for (let i = 0; i < triangulos.length; i += 3) {
            const [a, b, c] = triangulos.slice(i, i + 3).map(n => n * 2);
            this.grafico.fillTriangle(vertices[a], vertices[a + 1], vertices[b], vertices[b + 1], vertices[c], vertices[c + 1]);
          }
          this.grafico.lineStyle(1.5, color, 0.65);
          for (const anillo of anillos) this.grafico.strokePoints(anillo.map(convertir), true);
        }
      }
    }
    for (const error of this.territorio.errores) {
      const item = document.createElement('li'); item.className = 'es-restriccion'; item.textContent = error; this.lista.append(item);
    }
    this.lista.hidden = !this.lista.childElementCount;
    this.elemento.hidden = this.lista.hidden;
  }

  eliminar() { this.grafico.destroy(); this.elemento.remove(); }
}
