import Phaser from 'phaser';
import '../estilos/territorio.css';

export default class CapaTerritorial {
  constructor(escena, { territorio, capaBarrios, puntos = [], referenciasVisibles = () => true }) {
    this.escena = escena;
    this.territorio = territorio;
    this.capaBarrios = capaBarrios;
    this.puntos = puntos;
    this.referenciasVisibles = referenciasVisibles;
    this.grafico = escena.add.graphics().setDepth(3);
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-territorio';
    const ayuda = document.createElement('p');
    ayuda.textContent = 'POI · Verde: parques y espacios verdes del catálogo. Son referencias y no prohíben construir.';
    this.lista = document.createElement('ul');
    this.lista.setAttribute('aria-label', 'Áreas territoriales del escenario');
    this.elemento.append(ayuda, this.lista);
    this.dibujar();
  }

  get mostrarReferencias() { return this.referenciasVisibles(); }

  dibujar() {
    this.grafico.clear();
    const transformacion = this.capaBarrios.calcularEscalaMapa();
    if (!transformacion) return;
    const convertir = p => this.capaBarrios.convertirCoordenada(p, transformacion);
    if (this.mostrarReferencias) {
      for (const punto of this.puntos) {
        if (!/parque|plaza|jard[ií]n|bot[aá]nico|espacio verde/i.test(punto.tipo ?? '')) continue;
        if (!Number.isFinite(punto.longitud) || !Number.isFinite(punto.latitud)) continue;
        const p = convertir([punto.longitud, punto.latitud]);
        this.grafico.fillStyle(0x75b49c, 0.16).fillCircle(p.x, p.y, 6);
        this.grafico.lineStyle(1, 0x75b49c, 0.5).strokeCircle(p.x, p.y, 6);
      }
    }
    this.lista.replaceChildren();
    for (const area of this.territorio.areas) {
      const restringida = area.prohibirEstaciones || area.prohibirTramos;
      const item = document.createElement('li');
      item.className = restringida ? 'es-restriccion' : 'es-referencia';
      const prohibiciones = [area.prohibirEstaciones && 'estaciones', area.prohibirTramos && 'tramos'].filter(Boolean).join(' ni ');
      item.textContent = restringida ? `${area.nombre}: sin ${prohibiciones}.` : `${area.nombre}: referencia, permite construir.`;
      this.lista.append(item);
      if (!restringida && !this.mostrarReferencias) continue;
      const color = restringida ? 0xe79b72 : 0x75b49c;
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
  }

  eliminar() { this.grafico.destroy(); this.elemento.remove(); }
}
