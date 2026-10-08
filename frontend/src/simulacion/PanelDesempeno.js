import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';
import { formatearVelocidad } from './EscalaSimulacion.js';
import { numeroMetroEnRed } from '../mapa/controles/NombresRed.js';

// Un único editor de velocidad didáctica; el multiplicador visual vive fuera de él.
export function renderizarDesempeno(contenedor, diseno, desempeno, guardar, opciones = {}) {
  contenedor.limpiarSelectorMetro?.();
  contenedor.innerHTML = `
    <section class="simulacion-grupo-metros">
      <h3 class="simulacion-seccion-titulo">Metro</h3>
      <details class="simulacion-selector-metros">
        <summary aria-expanded="false"><span data-seleccion-metro></span></summary>
        <select id="unidadCirculacion" aria-label="Metro" aria-hidden="true" tabindex="-1"></select>
        <div class="simulacion-selector-metros__opciones" role="group" aria-label="Elegir metro"></div>
      </details>
    </section>
    <section class="simulacion-configuracion-metros" aria-labelledby="tituloConfiguracionMetros">
      <h3 id="tituloConfiguracionMetros" class="simulacion-seccion-titulo">UT / UV por Metro</h3>
      <details class="simulacion-configuracion-metros__desplegable">
        <summary aria-label="Ver UT y UV por metro">Ver por metro</summary>
        <div class="simulacion-configuracion-metros__lista">
          <p data-nivel-configuracion></p>
          <ul></ul>
        </div>
      </details>
    </section>
    <section class="simulacion-grupo-velocidad">
    <h3 class="simulacion-seccion-titulo">Unidad de velocidad</h3>
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
  const selector = contenedor.querySelector('select'), input = contenedor.querySelector('input');
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
  function actualizarTiempo(duracionGlobal, unidadTiempo = 'UT') {
    const unidad = unidadTiempo === 'UT' ? 'UT' : 'h';
    const tiempo = Number.isInteger(Number(duracionGlobal)) && Number(duracionGlobal) > 0
      ? `${duracionGlobal} ${unidad}` : `— ${unidad}`;
    listaResumen.replaceChildren(...unidades.map(metro => {
      const fila = document.createElement('li');
      fila.dataset.metro = String(metro.idTren);
      const nombre = document.createElement('strong');
      nombre.textContent = nombreMetro(metro);
      const linea = document.createElement('p');
      linea.dataset.lineaMetro = '';
      const nombreLinea = metro.nombreLinea?.trim();
      linea.textContent = !nombreLinea ? 'Sin línea'
        : /^l[ií]nea(?:\s|$)/i.test(nombreLinea) ? nombreLinea : `Línea ${nombreLinea}`;
      const valores = document.createElement('dl');
      const velocidad = Number(metro.velocidadPromedio);
      for (const [etiqueta, valor] of [
        ['UV actual', Number.isFinite(velocidad) ? formatearVelocidad(velocidad) : '— UV'],
        ['UT actual', tiempo],
      ]) {
        const termino = document.createElement('dt');
        const dato = document.createElement('dd');
        termino.textContent = etiqueta;
        dato.textContent = valor;
        if (etiqueta === 'UT actual') dato.title = 'Duración aplicada a todas las unidades de esta red';
        valores.append(termino, dato);
      }
      fila.append(nombre, linea, valores);
      return fila;
    }));
    listaResumen.querySelectorAll('li').forEach(fila => {
      fila.classList.toggle('es-seleccionado', selector.value !== 'todas' && fila.dataset.metro === selector.value);
    });
  }
  selector.replaceChildren(new Option('Todos los metros', 'todas'), ...unidades.map(u => new Option(`${nombreMetro(u)} · ${u.nombreLinea}`, String(u.idTren))));
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
    acceso.querySelector('[data-seleccion-metro]').textContent = selector.selectedOptions[0]?.textContent ?? 'Todos los metros';
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
  const permitidas = unidades.length > 0 && (!Number.isFinite(desempeno?.puntajeMaximo) || desempeno.redResuelta);
  input.disabled = boton.disabled = !permitidas;
  campo.disabled = opciones.bloqueado === true;
  configurarBotonIcono(boton, 'guardar', 'Aplicar velocidad');
  const elegidas = () => selector.value === 'todas' ? unidades : unidades.filter(u => String(u.idTren) === selector.value);
  function seleccionar(id) {
    selector.value = unidades.some(u => String(u.idTren) === id) ? id : 'todas';
    actualizarMenu();
    listaResumen.querySelectorAll('li').forEach(fila => {
      fila.classList.toggle('es-seleccionado', selector.value !== 'todas' && fila.dataset.metro === selector.value);
    });
    const velocidades = [...new Set(elegidas().map(u => Number(u.velocidadPromedio)))];
    const valorMixto = velocidades.length > 1;
    input.value = velocidades.length === 1 ? String(velocidades[0]) : '';
    input.placeholder = valorMixto ? 'Mixto' : '—';
    mixto.hidden = !valorMixto;
  }
  actualizarTiempo(opciones.duracionGlobal, opciones.unidadTiempo);
  seleccionar(opciones.seleccion);
  contenedor.querySelectorAll('[data-paso-uv]').forEach(control => {
    control.disabled = !permitidas;
    control.addEventListener('click', () => {
      // MIXTO no se reemplaza por un promedio inventado.
      if (input.value === '') { input.focus(); return; }
      input.value = String(Math.min(9999.99, Math.max(0.01, Math.round((Number(input.value) + Number(control.dataset.pasoUv)) * 100) / 100)));
    });
  });
  selector.addEventListener('change', () => { seleccionar(selector.value); opciones.alSeleccionar?.(selector.value); });
  let guardando = false;
  contenedor.querySelector('form').addEventListener('submit', async evento => {
    evento.preventDefault();
    if (guardando || campo.disabled || !permitidas || !input.reportValidity()) return;
    const valor = Number(input.value);
    if (!Number.isFinite(valor) || valor <= 0) return;
    guardando = true; campo.disabled = true;
    try { await guardar(elegidas(), valor); }
    finally { guardando = false; if (campo.isConnected) campo.disabled = opciones.bloqueado === true; }
  });
  return { seleccionar, actualizarTiempo, actualizarNivel };
}
