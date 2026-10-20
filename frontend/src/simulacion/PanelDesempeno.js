import { prepararMenuLineas } from '../mapa/controles/MenuLineasConfiguracion.js';
import { normalizarSeleccion, seleccionarUnidades, representantesLineas, desplazarValorVinculado, valorVisible } from './VinculoUvUtLibre.js';
import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';
import { coloresDeLineas, nombreVisibleLinea } from '../mapa/configuracion/PaletaRed.js';
import { numeroMetroEnRed } from '../mapa/controles/NombresRed.js';

// Un único editor de velocidad didáctica; el multiplicador visual vive fuera de él.
export function renderizarDesempeno(contenedor, diseno, desempeno, guardar, opciones = {}) {
  contenedor.limpiarSelectorMetro?.();
  contenedor.innerHTML = `
    <section class="simulacion-grupo-metros">
      <h3 class="simulacion-seccion-titulo">${opciones.vinculoLibre ? 'Línea a configurar' : 'Metros'}</h3>
      <details class="simulacion-selector-metros">
        <summary aria-expanded="false">${iconoRetro('metros')}<span data-seleccion-metro></span></summary>
        <select id="unidadCirculacion" aria-label="Metro" aria-hidden="true" tabindex="-1"></select>
        <div class="simulacion-selector-metros__opciones" role="group" aria-label="Elegir metro"></div>
      </details>
    </section>
    <section class="simulacion-grupo-velocidad">
    <h3 class="simulacion-seccion-titulo">Velocidad · UV</h3>
    <form class="simulacion-parametro-velocidad">
      <fieldset data-controles-circulacion>
        <div class="simulacion-parametro-titulo">${iconoRetro('velocidad')}<span>Velocidad</span></div>
        <div class="simulacion-parametro-valor">
          <button type="button" data-paso-uv="-1" aria-label="Reducir velocidad">−</button><input id="velocidadUnidad" type="number" min="0.01" max="9999.99" step="0.01" required aria-label="Velocidad en UV" />
          <span>UV</span><button type="button" data-paso-uv="1" aria-label="Aumentar velocidad">+</button><button type="submit"></button>
        </div>
      </fieldset>
    </form>
    </section>`;
  const unidades = diseno.unidadesMetro ?? [];
  const colores = coloresDeLineas(diseno.lineas ?? []);
  const seleccionables = opciones.vinculoLibre ? representantesLineas(unidades) : unidades;
  const etiquetaVacia = opciones.vinculoLibre ? 'Sin líneas con metros' : 'Todos los metros';
  const selector = contenedor.querySelector('select'), input = contenedor.querySelector('input');
  if (opciones.vinculoLibre) {
    input.step = 'any'; input.min = '0';
    selector.setAttribute('aria-label','Línea');
    contenedor.querySelector('.simulacion-selector-metros__opciones').setAttribute('aria-label','Elegir línea');
  }
  input.addEventListener('input', () => {
    if (opciones.vinculoLibre && input.value !== '' && Number(input.value) !== Number(valorVisible(input.value))) input.value = valorVisible(input.value);
    opciones.alCambiarVelocidad?.(Number(input.value));
  });
  const boton = contenedor.querySelector('button[type="submit"]'), campo = contenedor.querySelector('fieldset');
  const nombreMetro = metro => `Metro ${numeroMetroEnRed(metro.idTren, unidades) ?? '—'}`;
  selector.replaceChildren(new Option(opciones.vinculoLibre ? 'Todas' : etiquetaVacia, 'todas'), ...seleccionables.map(u => new Option(opciones.vinculoLibre ? nombreVisibleLinea(colores.get(u.nombreLinea)) : `${nombreMetro(u)} · ${u.nombreLinea}`, String(u.idTren))));
  const desplegable = contenedor.querySelector('.simulacion-selector-metros');
  const acceso = desplegable.querySelector('summary');
  desplegable.classList.toggle('simulacion-selector-lineas', Boolean(opciones.vinculoLibre));
  const lista = desplegable.querySelector('.simulacion-selector-metros__opciones');
  const opcionesMetro = [...selector.options].map(opcion => {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = opcion.textContent;
    control.dataset.metro = opcion.value;
    control.addEventListener('click', () => {
      selector.value = opcion.value;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      desplegable.open = false;
      acceso.focus({ preventScroll: true });
    });
    lista.append(control);
    return control;
  });
  const menuLibre = opciones.vinculoLibre ? prepararMenuLineas(lista, opcionesMetro, diseno, acceso) : null;
  function actualizarMenu() {
    acceso.querySelector('[data-seleccion-metro]').textContent = selector.selectedOptions[0]?.textContent ?? etiquetaVacia;
    opcionesMetro.forEach(control => control.setAttribute('aria-pressed', String(control.dataset.metro === selector.value)));
    if (menuLibre) {
      acceso.querySelector('.simulacion-color-linea')?.remove();
      const muestra = opcionesMetro.find(control => control.dataset.metro === selector.value)?.querySelector('.simulacion-color-linea');
      if (muestra) acceso.querySelector('[data-seleccion-metro]').before(muestra.cloneNode(true));
    }
  }
  function posicionarMenu() {
    if (!desplegable.open) return;
    if (menuLibre) { menuLibre.posicionar(); return; }
    const panel = desplegable.closest('#instrumentosSimulacion').getBoundingClientRect();
    const accesoRect = acceso.getBoundingClientRect();
    const debajo = panel.bottom - accesoRect.bottom - 8;
    const encima = accesoRect.top - panel.top - 8;
    const altoCompleto = lista.scrollHeight + lista.offsetHeight - lista.clientHeight;
    const abrirArriba = debajo < altoCompleto && encima > debajo;
    desplegable.classList.toggle('simulacion-selector-metros--arriba', abrirArriba);
    lista.style.maxHeight = `${Math.max(40, Math.min(altoCompleto, abrirArriba ? encima : debajo))}px`;
  }
  desplegable.addEventListener('toggle', () => {
    acceso.setAttribute('aria-expanded', String(desplegable.open));
    posicionarMenu();
  });
  desplegable.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && desplegable.open) {
      evento.preventDefault();
      desplegable.open = false;
      acceso.focus({ preventScroll: true });
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) return;
    evento.preventDefault();
    desplegable.open = true;
    const indiceActual = opcionesMetro.indexOf(document.activeElement);
    const indice = evento.key === 'Home' ? 0 : evento.key === 'End' ? opcionesMetro.length - 1
      : indiceActual < 0 ? Math.max(0, opcionesMetro.findIndex(control => control.dataset.metro === selector.value))
        : (indiceActual + (evento.key === 'ArrowDown' ? 1 : -1) + opcionesMetro.length) % opcionesMetro.length;
    menuLibre?.mostrarIndice(indice);
    opcionesMetro[indice]?.focus({ preventScroll: true });
    if (!menuLibre) opcionesMetro[indice]?.scrollIntoView({ block: 'nearest' });
  });
  const escucha = new AbortController();
  document.addEventListener('pointerdown', evento => {
    if (!desplegable.contains(evento.target)) desplegable.open = false;
  }, { signal: escucha.signal });
  window.addEventListener('resize', posicionarMenu, { signal: escucha.signal });
  contenedor.limpiarSelectorMetro = () => escucha.abort();
  // Los objetivos pendientes no bloquean experimentar. El estado del motor y
  // mantenimiento gobiernan la edición; Play aplica el preflight estructural.
  const permitidas = unidades.length > 0;
  input.disabled = boton.disabled = !permitidas;
  campo.disabled = opciones.bloqueado === true;
  configurarBotonIcono(boton, 'guardar', 'Aplicar velocidad');
  const elegidas = () => seleccionarUnidades(unidades, selector.value, opciones.vinculoLibre, true);
  function seleccionar(id) {
    selector.value = normalizarSeleccion(unidades, id, opciones.vinculoLibre, true);
    actualizarMenu();
    const velocidades = [...new Set(elegidas().map(u => Number(u.velocidadPromedio)))];
    const valorMixto = velocidades.length > 1;
    input.value = velocidades.length === 1 ? (opciones.vinculoLibre ? valorVisible(velocidades[0]) : String(velocidades[0])) : '';
    input.placeholder = valorMixto ? 'Por línea' : '—';
    input.required = !opciones.vinculoLibre || !valorMixto;
  }
  seleccionar(opciones.seleccion);
  contenedor.querySelectorAll('[data-paso-uv]').forEach(control => {
    control.disabled = !permitidas;
    control.addEventListener('click', () => {
      // Un clic explícito propone 1 como valor común; no promedia líneas distintas.
      const siguiente = opciones.vinculoLibre
        ? input.value === '' ? 1 : desplazarValorVinculado(Number(input.value), Number(control.dataset.pasoUv))
        : Math.max(0.01, Math.round((Number(input.value) + Number(control.dataset.pasoUv)) * 100) / 100);
      if (siguiente == null) return;
      input.value = String(Math.min(9999.99, siguiente));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  selector.addEventListener('change', () => {
    // El coordinador puede guardar el cálculo pendiente de la línea anterior
    // antes de reemplazar los valores visibles por los de la nueva selección.
    if (opciones.alSeleccionar) opciones.alSeleccionar(selector.value);
    else seleccionar(selector.value);
  });
  let guardando = false;
  contenedor.querySelector('form').addEventListener('submit', async evento => {
    evento.preventDefault();
    if (guardando || campo.disabled || !permitidas || !input.reportValidity()) return;
    const valor = Number(input.value);
    if ((!Number.isFinite(valor) || valor <= 0) && !opciones.vinculoLibre) return;
    // El coordinador controla el bloqueo durante guardado, simulación y mantenimiento.
    // No restaurar opciones.bloqueado: puede pertenecer a una recarga anterior.
    guardando = true;
    try { await guardar(elegidas(), valor); }
    finally { guardando = false; }
  });
  return { seleccionar };
}
