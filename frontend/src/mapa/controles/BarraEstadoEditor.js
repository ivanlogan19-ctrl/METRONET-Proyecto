import { registrarDestinoNotificaciones } from '../../componentes/NotificacionesMetronet.js';
import PanelAyudaContextual from '../../educacion/PanelAyudaContextual.js';

const DURACIONES = { info: 4200, exito: 4200, advertencia: 6200, error: 9000 };
const ETIQUETAS = { info: 'Información', exito: 'Completado', advertencia: 'Advertencia', error: 'Error' };

// Una sola zona de asistencia fuera del mapa. Los avisos vacíos no reservan altura.
export default class BarraEstadoEditor {
  constructor(contenedor, { alCambiarTamano } = {}) {
    this.contenedor = contenedor;
    this.ultimoError = '';
    this.tipo = null;
    this.liberarDestino = registrarDestinoNotificaciones((texto, tipo) => this.mostrar(texto, tipo));
    contenedor.innerHTML = `<div data-ayuda-contextual></div><div class="metronet-estado-editor__feedback"><div class="metronet-estado-editor__mensaje" tabindex="0" aria-label="Estado del editor"><p role="status" aria-atomic="true"></p><p role="alert" aria-atomic="true"></p></div><button type="button" data-revisar-error hidden>Revisar error</button></div>`;
    this.contenedorAyuda = contenedor.querySelector('[data-ayuda-contextual]');
    document.querySelector('[data-hud-mapa]')?.append(this.contenedorAyuda);
    this.panelAyuda = new PanelAyudaContextual(this.contenedorAyuda, { controles: true });
    this.panelAyuda.actualizar({});
    this.estado = contenedor.querySelector('[role=status]');
    this.error = contenedor.querySelector('[role=alert]');
    this.botonError = contenedor.querySelector('[data-revisar-error]');
    this.botonError.addEventListener('click', () => this.mostrar(this.ultimoError, 'error'));
    if (alCambiarTamano) {
      this.observadorTamano = new ResizeObserver(() => alCambiarTamano());
      this.observadorTamano.observe(contenedor);
    }
  }

  mostrar(texto, tipo = 'info') {
    if (this.eliminada || !texto || !this.contenedor.isConnected) return;
    tipo = Object.hasOwn(DURACIONES, tipo) ? tipo : 'info';
    window.clearTimeout(this.temporizador);
    this.tipo = tipo;
    if (tipo === 'error') {
      this.ultimoError = texto;
      this.botonError.hidden = false;
    }
    this.contenedor.dataset.tipo = tipo;
    this.estado.textContent = tipo === 'error' ? '' : `${ETIQUETAS[tipo]}: ${texto}`;
    this.error.textContent = tipo === 'error' ? `${ETIQUETAS[tipo]}: ${texto}` : '';
    this.temporizador = window.setTimeout(() => {
      this.estado.textContent = '';
      this.error.textContent = '';
      this.tipo = null;
      delete this.contenedor.dataset.tipo;
    }, DURACIONES[tipo]);
  }

  eliminar() {
    this.eliminada = true;
    this.liberarDestino();
    window.clearTimeout(this.temporizador);
    this.panelAyuda.eliminar();
    this.contenedorAyuda.remove();
    this.observadorTamano?.disconnect();
    this.contenedor.replaceChildren();
    delete this.contenedor.dataset.tipo;
  }
}
