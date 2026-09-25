import { CATEGORIAS_REFERENCIAS } from '../configuracion/CategoriasReferencias.js';

// Controles e indicadores comparten el estado de la capa; no consultan ni guardan datos.
export default class PanelReferenciasTerritoriales {
  constructor({ contenedor, mapa, alCambiarCategorias }) {
    this.contenedor = contenedor;
    this.mapa = mapa;
    this.alCambiarCategorias = alCambiarCategorias;
    this.categorias = [];
    this.controles = new Map();
    this.indicadores = new Map();
  }

  crear() {
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-referencias-territoriales';
    this.elemento.setAttribute('aria-label', 'Referencias territoriales');
    const titulo = document.createElement('h2');
    titulo.textContent = 'Referencias territoriales';
    const controles = document.createElement('div');
    controles.className = 'metronet-referencias-controles';
    controles.setAttribute('role', 'group');
    controles.setAttribute('aria-label', 'Capas territoriales');
    this.estado = document.createElement('div');
    this.estado.className = 'metronet-capas-activas';
    this.estado.setAttribute('role', 'group');
    this.estado.setAttribute('aria-label', 'Capas activas');
    for (const [categoria, datos] of Object.entries(CATEGORIAS_REFERENCIAS)) {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'metronet-boton--compacto';
      control.dataset.categoria = categoria;
      control.title = datos.descripcion;
      control.setAttribute('aria-label', datos.etiqueta);
      const simbolo = document.createElement('span');
      simbolo.className = 'metronet-referencia-simbolo';
      simbolo.setAttribute('aria-hidden', 'true');
      simbolo.textContent = datos.simbolo;
      control.append(simbolo, document.createTextNode(datos.etiqueta));
      control.addEventListener('click', () => {
        const visibles = new Set(this.categorias);
        if (visibles.has(categoria)) visibles.delete(categoria);
        else visibles.add(categoria);
        this.alCambiarCategorias([...visibles]);
      });
      this.controles.set(categoria, control);
      controles.append(control);
      const indicador = document.createElement('span');
      indicador.dataset.categoria = categoria;
      indicador.append(simbolo.cloneNode(true), document.createTextNode(datos.etiqueta));
      this.indicadores.set(categoria, indicador);
      this.estado.append(indicador);
    }
    this.elemento.append(titulo, controles);
    this.contenedor.append(this.elemento);
    this.mapa.append(this.estado);
  }

  actualizar(categorias = []) {
    this.categorias = categorias;
    for (const [categoria, control] of this.controles) {
      const activa = categorias.includes(categoria);
      control.setAttribute('aria-pressed', String(activa));
      this.indicadores.get(categoria).hidden = !activa;
    }
    this.estado.hidden = !categorias.length;
  }

  eliminar() {
    this.elemento?.remove();
    this.estado?.remove();
    this.controles.clear();
    this.indicadores.clear();
  }
}
