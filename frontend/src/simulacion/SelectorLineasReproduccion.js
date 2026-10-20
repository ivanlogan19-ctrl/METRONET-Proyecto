import { coloresDeLineas, nombreVisibleLinea } from '../mapa/configuracion/PaletaRed.js';
import { representantesLineas } from './VinculoUvUtLibre.js';

export function colorDeLineaCss(colores, nombre) {
  return `#${(colores.get(nombre) ?? 0x3983ff).toString(16).padStart(6, '0')}`;
}

// Dos líneas por página mantienen el panel estable incluso en redes grandes.
export default class SelectorLineasReproduccion {
  constructor(diseno, alCambiar) {
    this.alCambiar = alCambiar;
    this.pagina = 0;
    this.elemento = document.createElement('section');
    this.elemento.className = 'simulacion-reproduccion simulacion-territorio-panel';
    this.elemento.innerHTML = `<h3 class="simulacion-seccion-titulo">Líneas a reproducir</h3>
      <button type="button" class="simulacion-lineas-todas" aria-pressed="true"><i aria-hidden="true"></i>Todas</button>
      <div class="simulacion-reproduccion__lineas"></div>
      <nav class="simulacion-lineas-paginas" aria-label="Páginas de líneas">
        <button type="button" aria-label="Líneas anteriores">◀</button>
        <button type="button" aria-label="Líneas siguientes">▶</button>
      </nav>`;
    this.todas = this.elemento.querySelector('.simulacion-lineas-todas');
    this.todas.addEventListener('click', () => {
      this.seleccion = new Set(this.seleccion.size === this.lineas.length ? [] : this.lineas.map(l => l.nombreLinea));
      this.actualizar(); this.notificar();
    });
    this.navegacion = this.elemento.querySelector('nav');
    this.navegacion.querySelectorAll('button').forEach((boton, indice) => {
      boton.addEventListener('click', () => { this.pagina += indice ? 1 : -1; this.actualizar(); });
    });
    this.establecerDiseno(diseno);
  }

  establecerDiseno(diseno) {
    const anteriores = new Set(this.lineas?.map(l => l.nombreLinea) ?? []);
    this.lineas = representantesLineas(diseno.unidadesMetro ?? []);
    this.colores = coloresDeLineas(diseno.lineas ?? []);
    this.seleccion = new Set(this.lineas.filter(l => !anteriores.has(l.nombreLinea) || this.seleccion?.has(l.nombreLinea)).map(l => l.nombreLinea));
    this.actualizar();
  }

  notificar() { this.alCambiar([...this.seleccion]); }

  establecerBloqueado(bloqueado) {
    this.bloqueado = bloqueado;
    this.todas.disabled = bloqueado || !this.lineas.length;
    this.elemento.querySelectorAll('[data-linea-reproducir]').forEach(b => { b.disabled = bloqueado; });
  }

  actualizar() {
    const paginas = Math.max(1, Math.ceil(this.lineas.length / 2));
    this.pagina = Math.max(0, Math.min(this.pagina, paginas - 1));
    this.todas.setAttribute('aria-pressed', String(this.lineas.length > 0 && this.seleccion.size === this.lineas.length));
    const filas = this.lineas.slice(this.pagina * 2, this.pagina * 2 + 2).map(linea => {
      const boton = document.createElement('button');
      boton.type = 'button'; boton.dataset.lineaReproducir = linea.nombreLinea;
      boton.setAttribute('aria-pressed', String(this.seleccion.has(linea.nombreLinea)));
      const indicador = document.createElement('i'); indicador.setAttribute('aria-hidden', 'true');
      const nombre = document.createElement('span'); nombre.textContent = nombreVisibleLinea(this.colores.get(linea.nombreLinea));
      const muestra = document.createElement('b'); muestra.className = 'simulacion-color-linea';
      muestra.style.backgroundColor = colorDeLineaCss(this.colores, linea.nombreLinea);
      muestra.setAttribute('aria-hidden', 'true');
      boton.append(indicador, nombre, muestra);
      boton.addEventListener('click', () => {
        if (this.seleccion.has(linea.nombreLinea)) this.seleccion.delete(linea.nombreLinea);
        else this.seleccion.add(linea.nombreLinea);
        boton.setAttribute('aria-pressed', String(this.seleccion.has(linea.nombreLinea)));
        this.todas.setAttribute('aria-pressed', String(this.seleccion.size === this.lineas.length));
        this.notificar();
      });
      return boton;
    });
    this.elemento.querySelector('.simulacion-reproduccion__lineas').replaceChildren(...filas);
    this.navegacion.hidden = paginas <= 1;
    const [anterior, siguiente] = this.navegacion.querySelectorAll('button');
    anterior.disabled = this.pagina === 0; siguiente.disabled = this.pagina === paginas - 1;
    this.establecerBloqueado(this.bloqueado);
  }
}
