import { destacarConceptos } from '../educacion/glosario/GlosarioContextual.js';
import { CONCEPTOS_SIMULACION } from '../educacion/glosario/ContextoConceptos.js';
import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';

// Un único editor de velocidad didáctica; el multiplicador visual vive fuera de él.
export function renderizarDesempeno(contenedor, diseno, desempeno, guardar, opciones = {}) {
  contenedor.innerHTML = `
    <label for="unidadCirculacion">Unidad</label>
    <select id="unidadCirculacion" aria-label="Unidad de metro"></select>
    <form class="simulacion-parametro-velocidad">
      <fieldset data-controles-circulacion>
        <div class="simulacion-parametro-titulo" title="Velocidad">${iconoRetro('velocidad')}<span>Velocidad</span></div>
        <div class="simulacion-parametro-valor">
          <button type="button" data-paso-uv="-1" aria-label="Reducir velocidad">−</button><input id="velocidadUnidad" type="number" min="0.01" max="9999.99" step="0.01" required aria-label="Velocidad en UV" />
          <span>UV</span><button type="button" data-paso-uv="1" aria-label="Aumentar velocidad">+</button><button type="submit"></button>
        </div>
        <span data-velocidad-mixta hidden>MIXTO</span>
      </fieldset>
    </form>`;
  destacarConceptos(contenedor.querySelector('.simulacion-parametro-titulo span'), CONCEPTOS_SIMULACION);
  const unidades = diseno.unidadesMetro ?? [];
  const selector = contenedor.querySelector('select'), input = contenedor.querySelector('input');
  const boton = contenedor.querySelector('button[type="submit"]'), campo = contenedor.querySelector('fieldset');
  const mixto = contenedor.querySelector('[data-velocidad-mixta]');
  selector.replaceChildren(new Option('Todas las unidades', 'todas'), ...unidades.map(u => new Option(`Metro ${u.idTren} · ${u.nombreLinea}`, String(u.idTren))));
  const permitidas = unidades.length > 0 && (!Number.isFinite(desempeno?.puntajeMaximo) || desempeno.redResuelta);
  input.disabled = boton.disabled = !permitidas;
  campo.disabled = opciones.bloqueado === true;
  configurarBotonIcono(boton, 'guardar', 'Aplicar velocidad');
  if (!permitidas) {
    const aviso = document.createElement('p'); aviso.className = 'simulacion-texto-secundario';
    aviso.textContent = unidades.length ? 'Completá la estructura de la red para ajustar las UV.' : 'Agregá un metro desde el editor.';
    contenedor.append(aviso);
  }
  const elegidas = () => selector.value === 'todas' ? unidades : unidades.filter(u => String(u.idTren) === selector.value);
  function seleccionar(id) {
    selector.value = unidades.some(u => String(u.idTren) === id) ? id : 'todas';
    const velocidades = [...new Set(elegidas().map(u => Number(u.velocidadPromedio)))];
    const valorMixto = velocidades.length > 1;
    input.value = velocidades.length === 1 ? String(velocidades[0]) : '';
    input.placeholder = valorMixto ? 'Mixto' : '—';
    mixto.hidden = !valorMixto;
  }
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
  return { seleccionar };
}
