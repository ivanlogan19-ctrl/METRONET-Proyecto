import { gestorMusica } from './GestorMusica.js';
import './audio.css';

export function crearControlMusica() {
  const elemento = document.createElement('details');
  elemento.className = 'metronet-audio';
  elemento.dataset.controlMusica = '';
  elemento.innerHTML = `<summary aria-label="Controles de música">Audio</summary>
    <div class="metronet-audio__panel" popover="manual">
      <label><input type="checkbox" data-silencio-musica> Silenciar música</label>
      <label>Volumen de música <span data-valor-volumen>35 %</span>
        <input type="range" min="0" max="100" step="1" aria-label="Volumen de música">
      </label>
      <p data-estado-musica></p>
      <button type="button" data-activar-musica hidden>Activar música</button>
    </div>`;
  const silencio = elemento.querySelector('[data-silencio-musica]');
  const panel = elemento.querySelector('.metronet-audio__panel');
  const posicionar = () => {
    const cabecera = elemento.closest('header');
    const borde = cabecera?.getBoundingClientRect().bottom ?? elemento.getBoundingClientRect().bottom;
    panel.style.setProperty('--audio-panel-superior', `${Math.max(8, borde + 6)}px`);
  };
  elemento.addEventListener('toggle', () => {
    if (!elemento.isConnected) return;
    if (elemento.open) { posicionar(); panel.showPopover(); }
    else if (panel.matches(':popover-open')) panel.hidePopover();
  });
  window.addEventListener('resize', posicionar);
  const volumen = elemento.querySelector('input[type="range"]');
  const estado = elemento.querySelector('[data-estado-musica]');
  const activar = elemento.querySelector('[data-activar-musica]');
  silencio.addEventListener('change', () => gestorMusica.establecerSilencio(silencio.checked));
  volumen.addEventListener('input', () => gestorMusica.establecerVolumen(Number(volumen.value) / 100));
  activar.addEventListener('click', () => gestorMusica.activar());
  const desuscribir = gestorMusica.suscribir(datos => {
    silencio.checked = datos.silenciado;
    volumen.value = String(Math.round(datos.volumen * 100));
    elemento.querySelector('[data-valor-volumen]').textContent = `${volumen.value} %`;
    activar.hidden = !datos.esperandoGesto || !datos.disponible || datos.silenciado || datos.volumen === 0;
    estado.textContent = !datos.disponible ? 'Sin pista asignada a esta sección.'
      : datos.error ? 'Música no disponible. Podés seguir jugando.'
      : datos.silenciado || datos.volumen === 0 ? 'Música silenciada.'
      : datos.esperandoGesto ? 'Activá la música cuando quieras.'
      : datos.reproduciendo ? 'Música de juego en reproducción.' : 'Música en pausa.';
  });
  const cerrarFuera = evento => { if (!elemento.contains(evento.target)) elemento.open = false; };
  const cerrarEscape = evento => {
    if (evento.key === 'Escape' && elemento.open) { elemento.open = false; elemento.querySelector('summary').focus(); }
  };
  document.addEventListener('click', cerrarFuera);
  elemento.addEventListener('keydown', cerrarEscape);
  return { elemento, eliminar() {
    desuscribir(); document.removeEventListener('click', cerrarFuera);
    window.removeEventListener('resize', posicionar);
    if (panel.matches(':popover-open')) panel.hidePopover();
    elemento.remove();
  } };
}
