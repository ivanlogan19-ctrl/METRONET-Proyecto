import { gestorMusica } from './GestorMusica.js';
import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import './audio.css';

export function crearControlMusica({ integrado = false } = {}) {
  const elemento = document.createElement(integrado ? 'section' : 'details');
  elemento.className = `metronet-audio${integrado ? ' metronet-audio--integrado' : ''}`;
  elemento.dataset.controlMusica = '';
  elemento.innerHTML = ` ${integrado ? '' : '<summary aria-expanded="false"></summary>'}
    <div class="metronet-audio__panel" ${integrado ? '' : 'popover="manual"'}>
      <label><input type="checkbox" data-silencio-musica> Silenciar música</label>
      <label>Volumen de música <span data-valor-volumen>35 %</span>
        <input type="range" min="0" max="100" step="1" aria-label="Volumen de música">
      </label>
      <p data-estado-musica></p>
      <button type="button" data-activar-musica hidden>Activar música</button>
    </div>`;
  const silencio = elemento.querySelector('[data-silencio-musica]');
  const acceso = elemento.querySelector('summary');
  if (acceso) configurarBotonIcono(acceso, 'musica', 'Música');
  const panel = elemento.querySelector('.metronet-audio__panel');
  const posicionar = () => {
    const cabecera = elemento.closest('header');
    const borde = cabecera?.getBoundingClientRect().bottom ?? elemento.getBoundingClientRect().bottom;
    panel.style.setProperty('--audio-panel-superior', `${Math.max(8, borde + 6)}px`);
    if (elemento.classList.contains('metronet-audio--autenticacion')) {
      const r = elemento.getBoundingClientRect();
      panel.style.left = `${Math.max(12, Math.min(r.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 12))}px`;
      panel.style.right = 'auto';
    }
  };
  if (!integrado) elemento.addEventListener('toggle', () => {
    if (!elemento.isConnected) return;
    acceso.setAttribute('aria-expanded', String(elemento.open));
    acceso.setAttribute('aria-pressed', String(elemento.open));
    if (elemento.open) { panel.showPopover(); posicionar(); }
    else if (panel.matches(':popover-open')) panel.hidePopover();
  });
  if (!integrado) window.addEventListener('resize', posicionar);
  if (!integrado) window.addEventListener('scroll', posicionar, true);
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
      : datos.error ? 'Música no disponible. Podés continuar.'
      : datos.silenciado || datos.volumen === 0 ? 'Música silenciada.'
      : datos.esperandoGesto ? 'Activá la música cuando quieras.'
      : datos.reproduciendo ? 'Música en reproducción.' : 'Música en pausa.';
  });
  const cerrarFuera = evento => { if (!elemento.contains(evento.target)) elemento.open = false; };
  const cerrarEscape = evento => {
    if (evento.key === 'Escape' && elemento.open) { elemento.open = false; elemento.querySelector('summary').focus(); }
  };
  if (!integrado) document.addEventListener('click', cerrarFuera);
  elemento.addEventListener('keydown', cerrarEscape);
  return { elemento, eliminar() {
    desuscribir(); document.removeEventListener('click', cerrarFuera);
    window.removeEventListener('resize', posicionar);
    window.removeEventListener('scroll', posicionar, true);
    if (panel.matches(':popover-open')) panel.hidePopover();
    elemento.remove();
  } };
}
