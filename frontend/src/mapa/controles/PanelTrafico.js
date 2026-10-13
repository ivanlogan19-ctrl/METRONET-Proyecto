import { configurarBotonIcono, iconoRetro } from '../../interfaz/IconosRetro.js';

export default class PanelTrafico {
  constructor(capa, panel) {
    this.capa = capa;
    this.boton = document.createElement('button'); this.boton.type = 'button';
    this.boton.dataset.traficoVisible = '';
    this.reloj = document.createElement('button'); this.reloj.type = 'button';
    this.reloj.dataset.traficoReloj = '';
    this.reloj.setAttribute('aria-expanded', 'true'); this.reloj.setAttribute('aria-controls', 'horario-trafico');
    configurarBotonIcono(this.reloj, 'relojTrafico', 'Mostrar u ocultar horario del tráfico histórico');
    const fuente = panel.querySelector('.metronet-calles__fuente');
    fuente.before(this.boton, this.reloj);
    this.elemento = document.createElement('div');
    this.elemento.id = 'horario-trafico'; this.elemento.className = 'metronet-trafico';
    this.elemento.innerHTML = `<div class="metronet-trafico__hora">
      <span aria-hidden="true">${iconoRetro('relojTrafico')}</span>
      <button type="button" data-hora-anterior></button>
      <output aria-label="Hora del tráfico histórico">08:00</output>
      <button type="button" data-hora-siguiente></button>
      <button type="button" data-hora-reproducir></button>
    </div>
    <input type="range" min="0" max="23" step="1" value="8" aria-label="Hora del tráfico histórico">
    <div class="metronet-trafico__horas" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    <div class="metronet-trafico__leyenda" aria-label="Intensidad histórica relativa">
      <span class="trafico-baja" role="img" aria-label="Intensidad baja" title="Baja: hasta un tercio del máximo horario de este tramo"></span>
      <span class="trafico-media" role="img" aria-label="Intensidad media" title="Media: hasta dos tercios del máximo horario de este tramo"></span>
      <span class="trafico-alta" role="img" aria-label="Intensidad alta" title="Alta: más de dos tercios del máximo horario de este tramo; no indica congestión"></span>
      <span class="trafico-sin-datos" role="img" aria-label="Sin datos" title="Sin mediciones suficientes"></span>
      <time title="Período de los datos históricos">—</time>
      <button type="button" data-trafico-info aria-expanded="false" aria-controls="fuente-trafico"></button>
    </div>
    <div id="fuente-trafico" class="metronet-trafico__info" hidden>
      <strong>Tráfico histórico</strong>
      <p data-trafico-cobertura>Activá el tráfico para consultar el período y su cobertura.</p>
      <p>La fuente se comprueba mensualmente. Si falla o todavía no publicó el mes completo, se conserva el último período válido. Al volver a activar la capa se consulta la versión disponible.</p>
      <p>Promedio horario de todos los días del período. Los colores comparan cada tramo con su propio máximo: no indican atascos, velocidad ni tráfico en vivo. Gris: sin datos suficientes. No se extienden mediciones a toda una avenida.</p>
      <a href="https://ckan.montevideo.gub.uy/dataset/conteo-vehicular-en-las-principales-avenidas-de-montevideo" target="_blank" rel="noopener noreferrer">Intendencia de Montevideo · DAG-UY</a>
    </div>
    <p role="status" class="metronet-trafico__error" hidden></p>`;
    panel.querySelector('.metronet-calles__opacidad').after(this.elemento);
    const buscar = s => this.elemento.querySelector(s);
    this.rango = buscar('input'); this.salida = buscar('output'); this.play = buscar('[data-hora-reproducir]');
    this.info = buscar('[data-trafico-info]');
    configurarBotonIcono(buscar('[data-hora-anterior]'), 'horaAnterior', 'Hora anterior');
    configurarBotonIcono(buscar('[data-hora-siguiente]'), 'horaSiguiente', 'Hora siguiente');
    configurarBotonIcono(this.info, 'informacion', 'Fuente y significado del tráfico histórico');
    this.boton.addEventListener('click', () => capa.alternar());
    this.reloj.addEventListener('click', () => {
      this.elemento.hidden = !this.elemento.hidden;
      this.reloj.setAttribute('aria-expanded', String(!this.elemento.hidden));
      if (this.elemento.hidden) capa.pausar();
    });
    buscar('[data-hora-anterior]').addEventListener('click', () => { capa.pausar(); capa.cambiarHora(capa.hora - 1); });
    buscar('[data-hora-siguiente]').addEventListener('click', () => { capa.pausar(); capa.cambiarHora(capa.hora + 1); });
    this.rango.addEventListener('input', () => {
      const horaElegida = this.rango.value;
      capa.pausar(); capa.cambiarHora(horaElegida);
    });
    this.play.addEventListener('click', () => capa.reproducir());
    this.info.addEventListener('click', () => this.mostrarInfo(this.info.getAttribute('aria-expanded') !== 'true'));
    this.cerrarFuera = e => { if (!buscar('#fuente-trafico').contains(e.target) && !this.info.contains(e.target)) this.mostrarInfo(false); };
    this.cerrarEscape = e => { if (e.key === 'Escape') this.mostrarInfo(false); };
    document.addEventListener('pointerdown', this.cerrarFuera);
    document.addEventListener('keydown', this.cerrarEscape);
    capa.alCambiar = () => this.actualizar(); this.actualizar();
  }

  mostrarInfo(visible) {
    this.elemento.querySelector('#fuente-trafico').hidden = !visible;
    this.info.setAttribute('aria-expanded', String(visible));
  }

  actualizar() {
    const { estado, visible, hora, datos } = this.capa;
    const listo = estado === 'lista' && visible;
    configurarBotonIcono(this.boton, 'trafico', estado === 'error' ? 'Reintentar carga de tráfico histórico'
      : visible ? 'Ocultar tráfico histórico' : 'Mostrar tráfico histórico');
    this.boton.disabled = estado === 'cargando'; this.boton.setAttribute('aria-pressed', String(listo));
    for (const elemento of this.elemento.querySelectorAll('.metronet-trafico__hora button, input')) elemento.disabled = !listo;
    const texto = `${String(hora).padStart(2, '0')}:00`;
    this.salida.value = texto; this.rango.value = hora; this.rango.setAttribute('aria-valuetext', texto);
    configurarBotonIcono(this.play, this.capa.temporizador ? 'pausa' : 'play', this.capa.temporizador ? 'Pausar horario' : 'Reproducir horario');
    const error = this.elemento.querySelector('[role="status"]');
    error.hidden = estado !== 'error'; error.textContent = 'No se pudo cargar el tráfico. Podés seguir construyendo y reintentar con el icono.';
    if (datos) {
      const [anio, mes] = datos.periodo.split('-');
      this.elemento.querySelector('time').textContent = `${mes}/${anio}`;
      this.elemento.querySelector('time').dateTime = datos.periodo;
      this.elemento.querySelector('[data-trafico-cobertura]').textContent = `${mes}/${anio} · ${datos.tramos.length} tramos con sensores asociados. Mínimo 36 muestras en 3 días por hora y carril. Los sentidos se reúnen en el mismo tramo.`;
    }
  }

  eliminar() {
    this.capa.alCambiar = () => {};
    document.removeEventListener('pointerdown', this.cerrarFuera);
    document.removeEventListener('keydown', this.cerrarEscape);
    this.boton.remove(); this.reloj.remove(); this.elemento.remove();
  }
}
