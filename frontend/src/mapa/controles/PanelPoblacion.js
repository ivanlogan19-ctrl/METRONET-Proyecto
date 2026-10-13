import { configurarBotonIcono, iconoRetro } from '../../interfaz/IconosRetro.js';
import { BANDAS_POBLACION, COLOR_SIN_DATOS } from '../poblacion/ModeloPoblacion.mjs';

export default class PanelPoblacion {
  constructor(capa, panel) {
    this.capa = capa;
    this.boton = document.createElement('button'); this.boton.type = 'button'; this.boton.dataset.poblacionVisible = '';
    panel.querySelector('.metronet-calles__fuente').before(this.boton);
    this.elemento = document.createElement('div'); this.elemento.className = 'metronet-poblacion';
    const bandas = [...BANDAS_POBLACION, { color: COLOR_SIN_DATOS, etiqueta: 'Sin datos válidos de población o superficie' }];
    this.elemento.innerHTML = `<div class="metronet-poblacion__opacidad">
      <span aria-hidden="true">${iconoRetro('poblacion')}</span>
      <input type="range" min="10" max="100" step="5" value="65" aria-label="Opacidad de densidad de población">
      <button type="button" data-poblacion-info aria-expanded="false" aria-controls="fuente-poblacion"></button>
      </div><div class="metronet-poblacion__leyenda" aria-label="Densidad de población en habitantes por kilómetro cuadrado">
      ${bandas.map(b => `<span role="img" style="background:#${b.color.toString(16)}" title="${b.etiqueta}" aria-label="${b.etiqueta}"></span>`).join('')}
      <time datetime="2011" title="Censo de población 2011">2011</time></div>
      <div id="fuente-poblacion" class="metronet-trafico__info" hidden>
      <strong>Población · Censo 2011</strong>
      <p>Referencia histórica de 2011: residentes por km² de cada zona censal. Población dividida por la superficie calculada de sus polígonos oficiales. No representa la población actual ni desplazamientos por hora.</p>
      <p>De violeta oscuro a claro: hasta 1.000, 5.000, 10.000, 20.000 y más de 20.000 habitantes/km². Gris: sin datos válidos. Una zona con cero residentes pertenece a la primera banda.</p>
      <p data-poblacion-cobertura>Activá la capa para consultar su cobertura.</p>
      <p>Esta capa no cambia con el reloj del tráfico. Podés construir y editar tu red encima.</p>
      <a href="https://sit.mvot.gub.uy/arcgis/rest/services/07_EXTERNO/INDICADORES_CENSO/MapServer/6" target="_blank" rel="noopener noreferrer">Población: INE · SIT / MVOT</a><br><a href="https://dgrn.mgap.gub.uy/Metadatos/ine_zonas_11_metadatos.pdf" target="_blank" rel="noopener noreferrer">Cartografía: INE · MGAP · Uso libre con atribución</a>
      </div><p role="status" class="metronet-trafico__error" hidden></p>`;
    panel.append(this.elemento);
    this.rango = this.elemento.querySelector('input'); this.info = this.elemento.querySelector('[data-poblacion-info]');
    configurarBotonIcono(this.info, 'informacion', 'Fuente y significado de la densidad de población');
    this.boton.addEventListener('click', () => capa.alternar());
    this.rango.addEventListener('input', () => { const valor = this.rango.value; capa.establecerOpacidad(Number(valor) / 100); });
    this.info.addEventListener('click', () => this.mostrarInfo(this.info.getAttribute('aria-expanded') !== 'true'));
    this.cerrarFuera = e => { if (!this.elemento.contains(e.target)) this.mostrarInfo(false); };
    this.cerrarEscape = e => { if (e.key === 'Escape') this.mostrarInfo(false); };
    document.addEventListener('pointerdown', this.cerrarFuera); document.addEventListener('keydown', this.cerrarEscape);
    capa.alCambiar = () => this.actualizar(); this.actualizar();
  }
  mostrarInfo(visible) { this.elemento.querySelector('#fuente-poblacion').hidden = !visible; this.info.setAttribute('aria-expanded', String(visible)); }
  actualizar() {
    const { estado, visible, datos, opacidad } = this.capa;
    configurarBotonIcono(this.boton, 'poblacion', estado === 'error' ? 'Reintentar carga de población' : visible ? 'Ocultar densidad de población' : 'Mostrar densidad de población');
    this.boton.disabled = estado === 'cargando'; this.boton.setAttribute('aria-pressed', String(visible && estado === 'lista'));
    this.elemento.setAttribute('aria-busy', String(estado === 'cargando'));
    this.rango.disabled = estado !== 'lista' || !visible; this.rango.value = opacidad * 100; this.rango.setAttribute('aria-valuetext', `${Math.round(opacidad * 100)} %`);
    const error = this.elemento.querySelector('[role="status"]'); error.hidden = estado !== 'error';
    error.textContent = 'No se pudo cargar el censo. Podés seguir construyendo y reintentar con el icono.';
    if (datos) this.elemento.querySelector('[data-poblacion-cobertura]').textContent = `${datos.features.length.toLocaleString('es-UY')} zonas representadas; ${datos.metadata.sinPoblacion.length} polígonos sin población asociada se muestran en gris. Descarga: ${datos.metadata.descarga}. Sin actualización automática.`;
  }
  eliminar() { this.capa.alCambiar = () => {}; document.removeEventListener('pointerdown', this.cerrarFuera); document.removeEventListener('keydown', this.cerrarEscape); this.boton.remove(); this.elemento.remove(); }
}
