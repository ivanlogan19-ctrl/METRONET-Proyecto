import { seleccionarUnidades, representantesLineas, desplazarValorVinculado } from './VinculoUvUtLibre.js';
import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';
import { formatearVelocidad } from './EscalaSimulacion.js';
import { numeroMetroEnRed } from '../mapa/controles/NombresRed.js';

// Un único editor de velocidad didáctica; el multiplicador visual vive fuera de él.
export function renderizarDesempeno(contenedor, diseno, desempeno, guardar, opciones = {}) {
  contenedor.limpiarSelectorMetro?.();
  contenedor.innerHTML = `
    <section class="simulacion-grupo-metros">
      <h3 class="simulacion-seccion-titulo">${opciones.vinculoLibre ? 'Líneas' : 'Metros'}</h3>
      <details class="simulacion-selector-metros">
        <summary aria-expanded="false">${iconoRetro('metros')}<span data-seleccion-metro></span></summary>
        <select id="unidadCirculacion" aria-label="Metro" aria-hidden="true" tabindex="-1"></select>
        <div class="simulacion-selector-metros__opciones" role="group" aria-label="Elegir metro"></div>
      </details>
    <section class="simulacion-configuracion-metros" aria-labelledby="tituloConfiguracionMetros">
      <details class="simulacion-configuracion-metros__desplegable">
        <summary title="Consultar la velocidad y duración de cada ${opciones.vinculoLibre ? 'línea' : 'metro'}">${iconoRetro('metros')}<span id="tituloConfiguracionMetros">Detalle de ${opciones.vinculoLibre ? 'líneas' : 'metros'}</span></summary>
        <div class="simulacion-configuracion-metros__lista">
          <p data-nivel-configuracion></p>
          <ul></ul>
        </div>
      </details>
    </section>
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
        <span data-velocidad-mixta hidden>MIXTO</span>
      </fieldset>
    </form>
    </section>`;
  const unidades = diseno.unidadesMetro ?? [];
  const seleccionables = opciones.vinculoLibre ? representantesLineas(unidades) : unidades;
  const etiquetaTodas = opciones.vinculoLibre ? 'Todas las líneas' : 'Todos los metros';
  const selector = contenedor.querySelector('select'), input = contenedor.querySelector('input');
  if (opciones.vinculoLibre) {
    input.step = 'any'; input.min = '0.00000001';
    selector.setAttribute('aria-label','Línea');
    contenedor.querySelector('.simulacion-selector-metros__opciones').setAttribute('aria-label','Elegir línea');
  }
  input.addEventListener('input', () => opciones.alCambiarVelocidad?.(Number(input.value)));
  const boton = contenedor.querySelector('button[type="submit"]'), campo = contenedor.querySelector('fieldset');
  const mixto = contenedor.querySelector('[data-velocidad-mixta]');
  const resumen = contenedor.querySelector('.simulacion-configuracion-metros');
  const desplegableResumen = resumen.querySelector('details');
  const listaResumen = resumen.querySelector('ul');
  const nombreMetro = metro => `Metro ${numeroMetroEnRed(metro.idTren, unidades) ?? '—'}`;
  function actualizarNivel(nivel) {
    resumen.querySelector('[data-nivel-configuracion]').textContent = nivel || 'Red actual';
  }
  actualizarNivel(opciones.nivel);
  resumen.hidden = unidades.length === 0;
  function actualizarTiempo(duracionGlobal) {
    const unidad = 'UT';
    const tiempo = Number.isFinite(Number(duracionGlobal)) && Number(duracionGlobal) > 0
      ? `${duracionGlobal} ${unidad}` : `— ${unidad}`;
    listaResumen.replaceChildren(...seleccionables.map(metro => {
      const fila = document.createElement('li');
      fila.dataset.metro = String(metro.idTren);
      const nombre = document.createElement('strong');
      nombre.textContent = opciones.vinculoLibre ? metro.nombreLinea : nombreMetro(metro);
      const linea = document.createElement('p');
      linea.dataset.lineaMetro = '';
      const nombreLinea = metro.nombreLinea?.trim();
      linea.textContent = !nombreLinea ? 'Sin línea'
        : /^l[ií]nea(?:\s|$)/i.test(nombreLinea) ? nombreLinea : `Línea ${nombreLinea}`;
      if (opciones.vinculoLibre) {
        const cantidad = unidades.filter(u => u.nombreLinea === metro.nombreLinea).length;
        linea.textContent = `${cantidad} ${cantidad === 1 ? 'metro' : 'metros'}`;
      }
      const valores = document.createElement('dl');
      const velocidad = Number(metro.velocidadPromedio);
      for (const [etiqueta, valor] of [
        ['UV actual', Number.isFinite(velocidad) ? formatearVelocidad(velocidad) : '— UV'],
        ['UT actual', metro.duracionUt != null ? `${metro.duracionUt} UT` : opciones.vinculoLibre ? '— UT' : tiempo],
      ]) {
        const termino = document.createElement('dt');
        const dato = document.createElement('dd');
        termino.textContent = etiqueta;
        dato.textContent = valor;
        if (etiqueta === 'UT actual') dato.title = opciones.vinculoLibre ? 'Duración compartida por los metros de esta línea' : 'Duración aplicada a este metro';
        valores.append(termino, dato);
      }
      fila.append(nombre, linea, valores);
      return fila;
    }));
    listaResumen.querySelectorAll('li').forEach(fila => {
      fila.classList.toggle('es-seleccionado', selector.value !== 'todas' && seleccionarUnidades(unidades, selector.value, opciones.vinculoLibre).some(u => String(u.idTren) === fila.dataset.metro));
    });
  }
  selector.replaceChildren(new Option(etiquetaTodas, 'todas'), ...seleccionables.map(u => new Option(opciones.vinculoLibre ? u.nombreLinea : `${nombreMetro(u)} · ${u.nombreLinea}`, String(u.idTren))));
  const desplegable = contenedor.querySelector('.simulacion-selector-metros');
  const acceso = desplegable.querySelector('summary');
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
  function actualizarMenu() {
    acceso.querySelector('[data-seleccion-metro]').textContent = selector.selectedOptions[0]?.textContent ?? etiquetaTodas;
    opcionesMetro.forEach(control => control.setAttribute('aria-pressed', String(control.dataset.metro === selector.value)));
  }
  function posicionarMenu() {
    if (!desplegable.open) return;
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
    opcionesMetro[indice]?.focus({ preventScroll: true });
    opcionesMetro[indice]?.scrollIntoView({ block: 'nearest' });
  });
  const escucha = new AbortController();
  document.addEventListener('pointerdown', evento => {
    if (!desplegable.contains(evento.target)) desplegable.open = false;
    if (!desplegableResumen.contains(evento.target)) desplegableResumen.open = false;
  }, { signal: escucha.signal });
  desplegableResumen.addEventListener('keydown', evento => {
    if (evento.key !== 'Escape' || !desplegableResumen.open) return;
    evento.preventDefault();
    desplegableResumen.open = false;
    desplegableResumen.querySelector('summary').focus({ preventScroll: true });
  });
  window.addEventListener('resize', posicionarMenu, { signal: escucha.signal });
  contenedor.limpiarSelectorMetro = () => escucha.abort();
  // Los objetivos pendientes no bloquean experimentar. El estado del motor y
  // mantenimiento gobiernan la edición; Play aplica el preflight estructural.
  const permitidas = unidades.length > 0;
  input.disabled = boton.disabled = !permitidas;
  campo.disabled = opciones.bloqueado === true;
  configurarBotonIcono(boton, 'guardar', 'Aplicar velocidad');
  const elegidas = () => seleccionarUnidades(unidades, selector.value, opciones.vinculoLibre);
  function seleccionar(id) {
    const elegida = seleccionarUnidades(unidades, id, opciones.vinculoLibre)[0];
    selector.value = id !== 'todas' && elegida ? String(elegida.idTren) : 'todas';
    actualizarMenu();
    listaResumen.querySelectorAll('li').forEach(fila => {
      fila.classList.toggle('es-seleccionado', selector.value !== 'todas' && seleccionarUnidades(unidades, selector.value, opciones.vinculoLibre).some(u => String(u.idTren) === fila.dataset.metro));
    });
    const velocidades = [...new Set(elegidas().map(u => Number(u.velocidadPromedio)))];
    const valorMixto = velocidades.length > 1;
    input.value = velocidades.length === 1 ? String(velocidades[0]) : '';
    input.placeholder = valorMixto ? 'Mixto' : '—';
    input.required = !opciones.vinculoLibre || !valorMixto;
    mixto.hidden = !valorMixto;
  }
  actualizarTiempo(opciones.duracionGlobal);
  seleccionar(opciones.seleccion);
  contenedor.querySelectorAll('[data-paso-uv]').forEach(control => {
    control.disabled = !permitidas;
    control.addEventListener('click', () => {
      // MIXTO no se reemplaza por un promedio inventado.
      if (input.value === '') { input.focus(); return; }
      const siguiente = opciones.vinculoLibre
        ? desplazarValorVinculado(Number(input.value), Number(control.dataset.pasoUv))
        : Math.max(0.01, Math.round((Number(input.value) + Number(control.dataset.pasoUv)) * 100) / 100);
      if (siguiente == null) return;
      input.value = String(Math.min(9999.99, siguiente));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  selector.addEventListener('change', () => { seleccionar(selector.value); opciones.alSeleccionar?.(selector.value); });
  let guardando = false;
  contenedor.querySelector('form').addEventListener('submit', async evento => {
    evento.preventDefault();
    if (guardando || campo.disabled || !permitidas || !input.reportValidity()) return;
    const valor = Number(input.value);
    if ((!Number.isFinite(valor) || valor <= 0) && !(opciones.vinculoLibre && !input.required && input.value === '')) return;
    guardando = true; campo.disabled = true;
    try { await guardar(elegidas(), valor); }
    finally { guardando = false; if (campo.isConnected) campo.disabled = opciones.bloqueado === true; }
  });
  return { seleccionar, actualizarTiempo, actualizarNivel };
}
