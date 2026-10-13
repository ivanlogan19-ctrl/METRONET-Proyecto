import { configurarBotonIcono, iconoRetro } from '../../interfaz/IconosRetro.js';

export default class PanelTrafico {
  constructor(capa, panel) {
    this.capa = capa;
    this.boton = document.createElement('button'); this.boton.type = 'button';
    this.boton.dataset.traficoVisible = '';
    panel.querySelector('.metronet-calles__botones').append(this.boton);
    this.elemento = document.createElement('div');
    this.elemento.id = 'horario-trafico'; this.elemento.className = 'metronet-trafico';
    this.elemento.innerHTML = `<div class="metronet-trafico__hora">
      <span aria-hidden="true">${iconoRetro('relojTrafico')}</span>
      <button type="button" data-hora-anterior></button>
      <output aria-label="Hora de las capas históricas">08:00</output>
      <button type="button" data-hora-siguiente></button>
      <button type="button" data-hora-reproducir></button>
    </div>
    <input type="range" min="0" max="23" step="1" value="8" aria-label="Hora de las capas históricas">
    <div class="metronet-trafico__horas" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    <div class="metronet-trafico__leyenda" aria-label="Intensidad histórica relativa">
      <span class="trafico-baja" role="img" aria-label="Intensidad baja" title="Baja: hasta un tercio del máximo horario de este tramo"></span>
      <span class="trafico-media" role="img" aria-label="Intensidad media" title="Media: hasta dos tercios del máximo horario de este tramo"></span>
      <span class="trafico-alta" role="img" aria-label="Intensidad alta" title="Alta: más de dos tercios del máximo horario de este tramo; no indica congestión"></span>
      <span class="trafico-sin-datos" role="img" aria-label="Sin datos" title="Sin mediciones suficientes"></span>
    </div>
    <p role="status" class="metronet-trafico__error" hidden></p>`;
    panel.querySelector('.metronet-calles__opacidad').after(this.elemento);
    const buscar = s => this.elemento.querySelector(s);
    this.error = buscar('[role="status"]');
    this.rango = buscar('input'); this.salida = buscar('output'); this.play = buscar('[data-hora-reproducir]');
    configurarBotonIcono(buscar('[data-hora-anterior]'), 'horaAnterior', 'Hora anterior');
    configurarBotonIcono(buscar('[data-hora-siguiente]'), 'horaSiguiente', 'Hora siguiente');
    this.boton.addEventListener('click', () => capa.alternar());
    buscar('[data-hora-anterior]').addEventListener('click', () => { capa.pausar(); capa.cambiarHora(capa.hora - 1); });
    buscar('[data-hora-siguiente]').addEventListener('click', () => { capa.pausar(); capa.cambiarHora(capa.hora + 1); });
    this.rango.addEventListener('input', () => {
      const horaElegida = this.rango.value;
      capa.pausar(); capa.cambiarHora(horaElegida);
    });
    this.play.addEventListener('click', () => capa.reproducir());
    capa.alCambiar = () => this.actualizar();
    this.desuscribir = capa.reloj.suscribir(() => this.actualizar()); this.actualizar();
  }

  actualizar() {
    const { estado, visible, hora } = this.capa;
    const listo = estado === 'lista' && visible;
    configurarBotonIcono(this.boton, 'trafico', estado === 'error' ? 'Reintentar carga de tráfico histórico'
      : visible ? 'Ocultar tráfico histórico' : 'Mostrar tráfico histórico');
    this.boton.disabled = estado === 'cargando'; this.boton.setAttribute('aria-pressed', String(listo));
    for (const elemento of this.elemento.querySelectorAll('.metronet-trafico__hora button, input')) elemento.disabled = !this.capa.reloj.capas.size;
    const texto = `${String(hora).padStart(2, '0')}:00`;
    this.salida.value = texto; this.rango.value = hora; this.rango.setAttribute('aria-valuetext', texto);
    configurarBotonIcono(this.play, this.capa.temporizador ? 'pausa' : 'play', this.capa.temporizador ? 'Pausar horario' : 'Reproducir horario');
    const error = this.error;
    error.hidden = estado !== 'error'; error.textContent = 'No se pudo cargar el tráfico. Podés seguir construyendo y reintentar con el icono.';
  }

  eliminar() {
    this.capa.alCambiar = () => {};
    this.desuscribir();
    this.boton.remove(); this.elemento.remove();
  }
}
