import { fondoRecorrido } from '../configuracion/RecorridosRed.js';
import { coloresDeLineas } from '../configuracion/PaletaRed.js';
import '../estilos/menu-lineas.css';
const colorDeLineaCss = (colores, nombre) => `#${(colores.get(nombre) ?? 0x3983ff).toString(16).padStart(6, '0')}`;
const valorVisible = valor => String(Number(Number(valor).toFixed(2)));

// El menú flota sobre el mapa: nunca aumenta el alto del panel ni necesita scroll.
export function prepararMenuLineas(lista, controles, diseno, acceso) {
  lista.classList.add('metronet-menu-lineas');
  const colores = coloresDeLineas(diseno.lineas ?? []);
  for (const control of controles) {
    const unidad = (diseno.unidadesMetro ?? []).find(u => String(u.idTren) === control.dataset.metro);
    const muestra = document.createElement('b');
    muestra.className = 'simulacion-color-linea';
    muestra.setAttribute('aria-hidden', 'true');
    const nombreLinea = control.dataset.nombreLinea ?? unidad?.nombreLinea;
    const tonos = nombreLinea ? [colorDeLineaCss(colores, nombreLinea)]
      : [...colores.keys()].map(nombre => colorDeLineaCss(colores, nombre));
    muestra.style.background = nombreLinea ? fondoRecorrido(diseno, nombreLinea) : tonos.length > 1
      ? `linear-gradient(90deg, ${tonos.map((color, i) => `${color} ${i * 100 / tonos.length}% ${(i + 1) * 100 / tonos.length}%`).join(',')})`
      : tonos[0] ?? 'transparent';
    const nombre = document.createElement('span'); nombre.textContent = control.textContent;
    control.replaceChildren(muestra, nombre);
    if (unidad) {
      const valores = document.createElement('small');
      control.append(valores);
    }
  }
  function actualizarValores(red) {
    for (const control of controles) {
      const unidad = (red.unidadesMetro ?? []).find(u => String(u.idTren) === control.dataset.metro);
      const valores = control.querySelector('small');
      if (unidad && valores) valores.textContent = `${valorVisible(unidad.velocidadPromedio)} UV · ${valorVisible(unidad.duracionUt)} UT`;
    }
  }
  actualizarValores(diseno);
  let pagina = 0, porPagina = 5;
  const navegacion = document.createElement('nav');
  navegacion.className = 'simulacion-lineas-paginas';
  navegacion.setAttribute('aria-label', 'Páginas de líneas a configurar');
  navegacion.innerHTML = '<button type="button" aria-label="Opciones anteriores">◀</button><output></output><button type="button" aria-label="Opciones siguientes">▶</button>';
  lista.append(navegacion);
  const [anterior, siguiente] = navegacion.querySelectorAll('button');
  function mostrarPagina() {
    const paginas = Math.max(1, Math.ceil(controles.length / porPagina));
    pagina = Math.max(0, Math.min(pagina, paginas - 1));
    controles.forEach((boton, i) => { boton.hidden = Math.floor(i / porPagina) !== pagina; });
    navegacion.hidden = paginas === 1;
    navegacion.querySelector('output').textContent = `${pagina + 1} / ${paginas}`;
    anterior.disabled = pagina === 0; siguiente.disabled = pagina === paginas - 1;
  }
  function posicionar() {
    const rect = acceso.getBoundingClientRect();
    const mapa = document.querySelector('.simulacion-lienzo-contenedor, #metronet-mapa').getBoundingClientRect();
    const margen = 8;
    const ancho = Math.min(240, Math.max(180, rect.left - margen * 2));
    const juntoAlMapa = rect.left >= mapa.right;
    const limiteSuperior = juntoAlMapa ? Math.max(margen, mapa.top) : margen;
    const limiteInferior = juntoAlMapa ? Math.min(innerHeight - margen, mapa.bottom) : innerHeight - margen;
    porPagina = Math.max(1, Math.min(5, Math.floor((limiteInferior - limiteSuperior - 62) / 46)));
    mostrarPagina();
    lista.style.width = `${ancho}px`;
    lista.style.left = `${Math.max(margen, rect.left - ancho - margen)}px`;
    lista.style.top = `${Math.max(limiteSuperior, Math.min(rect.top, limiteInferior - lista.offsetHeight))}px`;
  }
  anterior.addEventListener('click', () => { pagina--; posicionar(); });
  siguiente.addEventListener('click', () => { pagina++; posicionar(); });
  return {
    posicionar, actualizarValores,
    mostrarIndice(indice) { pagina = Math.floor(indice / porPagina); posicionar(); },
  };
}
