import { obtenerAyudaContextual } from './AyudaContextual.js';
import { destacarConceptos } from './glosario/GlosarioContextual.js';
import './ayuda-contextual.css';

// ControlZoom permite arrastrar en modo normal (Seleccionar); la pinza solo hace zoom.
const CONTROLES = 'Arrastrá con Seleccionar para mover. Zoom: rueda, botones + − o pinza de dos dedos. Clic: acción de la herramienta activa.';
let secuenciaAyuda = 0;

// Sin reloj ni persistencia: cada intento comienza con su propio contexto.
export default class PanelAyudaContextual {
  constructor(contenedor, { controles = false } = {}) {
    this.contenedor = contenedor;
    this.integrado = controles;
    this.vista = 'pista';
    contenedor.hidden = true;
    this.elemento = document.createElement('section');
    this.elemento.className = `metronet-assist${controles ? ' metronet-assist--integrado' : ''}`;
    this.elemento.hidden = true;
    this.elemento.setAttribute('aria-label', 'Ayuda contextual del escenario');
    const idMensaje = `metronet-pista-${++secuenciaAyuda}`;
    this.elemento.innerHTML = controles
      ? `<header class="metronet-assist__cabecera"><h2 class="metronet-titulo metronet-titulo--panel"><span data-assist-etiqueta></span><button type="button" data-assist-alternar aria-controls="${idMensaje}"><span data-assist-titulo-movil>PISTA</span><span data-assist-indicador aria-hidden="true">+</span></button></h2><div class="metronet-assist__acciones"><button type="button" data-assist-pista>Más pista</button><button type="button" data-assist-controles aria-pressed="false">Controles</button></div></header><div id="${idMensaje}" data-assist-mensaje aria-live="polite" aria-atomic="true" tabindex="0" aria-label="Orientación actual"></div>`
      : '<h2 class="metronet-titulo metronet-titulo--panel">ASSIST <span data-assist-etiqueta></span></h2><div data-assist-mensaje aria-live="polite" aria-atomic="true" tabindex="0" aria-label="Orientación actual"></div><div class="metronet-assist__acciones"><button type="button" data-assist-pista>Más pista</button></div>';
    this.etiqueta = this.elemento.querySelector('[data-assist-etiqueta]');
    this.mensaje = this.elemento.querySelector('[data-assist-mensaje]');
    this.boton = this.elemento.querySelector('[data-assist-pista]');
    this.boton.setAttribute('aria-pressed', 'false');
    this.boton.addEventListener('click', () => {
      this.ampliada = !this.ampliada;
      this.renderizar();
    });
    this.botonControles = this.elemento.querySelector('[data-assist-controles]');
    this.botonControles?.addEventListener('click', () => {
      this.vista = this.vista === 'pista' ? 'controles' : 'pista';
      this.renderizar();
    });
    if (controles) {
      this.botonAlternar = this.elemento.querySelector('[data-assist-alternar]');
      this.acciones = this.elemento.querySelector('.metronet-assist__acciones');
      this.resolucionReducida = window.matchMedia('(max-width: 620px)');
      this.expandida = !this.resolucionReducida.matches;
      this.alCambiarResolucion = () => {
        this.expandida = !this.resolucionReducida.matches;
        this.actualizarExpansion();
      };
      this.resolucionReducida.addEventListener('change', this.alCambiarResolucion);
      this.botonAlternar.addEventListener('click', () => {
        this.expandida = !this.expandida;
        this.actualizarExpansion();
      });
    }
    contenedor.append(this.elemento);
  }

  actualizar(contexto) {
    if (this.eliminada) return;
    const ayuda = obtenerAyudaContextual(contexto) ?? (this.integrado ? {
      clave: 'sin-escenario', etiqueta: 'PISTA', conceptos: [],
      texto: contexto.diseno ? 'Las pistas acompañan los escenarios educativos. Este diseño no tiene una consigna activa.' : 'Abrí un escenario para recibir pistas de su consigna.',
    } : null);
    const contextoId = JSON.stringify([contexto.diseno?.simulacion?.idDiseno, contexto.escenario?.idEscenario, contexto.escenario?.numero]);
    const identidad = JSON.stringify([contextoId, ayuda]);
    if (identidad === this.identidad) return;
    const cambiaContexto = contextoId !== this.contextoId;
    this.contextoId = contextoId;
    this.identidad = identidad;
    this.ayuda = ayuda;
    this.ampliada = false;
    if (cambiaContexto) {
      this.vista = 'pista'; this.identidadMensaje = null;
      if (this.integrado) this.expandida = !this.resolucionReducida.matches;
    }
    this.elemento.hidden = !ayuda;
    this.contenedor.hidden = !ayuda;
    if (!ayuda) { this.identidadMensaje = null; this.mensaje.replaceChildren(); return; }
    this.renderizar();
  }

  renderizar() {
    const ayuda = this.ayuda;
    const controles = this.vista === 'controles';
    this.elemento.dataset.estado = ayuda.clave;
    this.elemento.dataset.vista = this.vista;
    this.etiqueta.textContent = this.integrado ? (controles ? 'CONTROLES' : 'PISTA') : (this.ampliada ? 'OTRA MIRADA' : ayuda.etiqueta);
    const contenido = controles ? CONTROLES : this.ampliada ? ayuda.pista : ayuda.texto;
    // Mientras se consultan controles se guarda la pista más reciente sin reanunciar lo mismo.
    const identidadMensaje = JSON.stringify([this.vista, contenido, controles ? [] : ayuda.conceptos]);
    if (identidadMensaje !== this.identidadMensaje) {
      this.identidadMensaje = identidadMensaje;
      const texto = document.createElement('p');
      texto.textContent = contenido;
      // Reemplazar el contenido retira también una definición que ya no corresponda.
      this.mensaje.replaceChildren(texto);
      if (!controles) destacarConceptos(this.mensaje, ayuda.conceptos, { contextual: true });
      this.mensaje.scrollTop = 0;
    }
    this.boton.hidden = controles || !ayuda.pista;
    this.boton.textContent = this.integrado ? (this.ampliada ? 'Pista inicial' : 'Más pista') : (this.ampliada ? 'Volver a la orientación' : 'Necesito una pista');
    this.boton.setAttribute('aria-pressed', String(this.ampliada));
    if (this.botonControles) {
      this.botonControles.textContent = controles ? 'Volver a pista' : 'Controles';
      this.botonControles.setAttribute('aria-pressed', String(controles));
      this.elemento.querySelector('[data-assist-titulo-movil]').textContent = this.etiqueta.textContent;
      this.actualizarExpansion();
    }
  }

  actualizarExpansion() {
    const abierta = !this.resolucionReducida.matches || this.expandida;
    // Ocultar mediante el DOM permite transferir el foco antes de retirar el botón.
    if (this.resolucionReducida.matches) this.botonAlternar.hidden = false;
    this.etiqueta.hidden = this.resolucionReducida.matches;
    // Al contraer, ninguna acción oculta conserva el foco de teclado.
    if (!abierta && (this.mensaje.contains(document.activeElement) || this.acciones.contains(document.activeElement))) this.botonAlternar.focus({ preventScroll: true });
    this.mensaje.hidden = !abierta;
    this.acciones.hidden = !abierta;
    if (!this.resolucionReducida.matches && document.activeElement === this.botonAlternar) this.botonControles.focus({ preventScroll: true });
    this.botonAlternar.hidden = !this.resolucionReducida.matches;
    this.botonAlternar.setAttribute('aria-expanded', String(abierta));
    this.botonAlternar.setAttribute('aria-label', `${abierta ? 'Contraer' : 'Mostrar'} ${this.vista === 'controles' ? 'controles del mapa' : 'pista del escenario'}`);
    this.elemento.querySelector('[data-assist-indicador]').textContent = abierta ? '−' : '+';
  }

  eliminar() {
    this.eliminada = true;
    this.resolucionReducida?.removeEventListener('change', this.alCambiarResolucion);
    this.elemento.remove();
  }
}
