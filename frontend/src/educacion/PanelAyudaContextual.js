import { ajustarPanelMapa } from '../interfaz/PanelMapa.js';
import { obtenerAyudaContextual } from './AyudaContextual.js';
import { destacarConceptos, cerrarDefinicion } from './glosario/GlosarioContextual.js';
import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import { crearControlMusica } from '../audio/ControlMusica.js';
import PanelTutorialInicial from './PanelTutorialInicial.js';
import { conceptosDelNivel } from './glosario/ContextoConceptos.js';
import './ayuda-contextual.css';
import '../mapa/estilos/referencias-poi.css';

const CONTROLES_EDITOR = 'Arrastrá para mover el mapa. Zoom: rueda, botones + − o pinza de dos dedos. Clic: acción de la herramienta activa. Para colocar estaciones con teclado: enfocá el mapa, mové el cursor con las flechas y pulsá Enter. Escape termina la herramienta.';
const CONTROLES_SIMULACION = 'Arrastrá para mover el mapa. Zoom: rueda, botones + − o pinza de dos dedos. Seleccioná una estación o un metro para consultar su información.';
const CONTROLES_BUSQUEDA = ' La estrella abre las referencias. La lupa busca por nombre, tipo o barrio. Cerrar la búsqueda conserva el punto localizado; borrar el texto retira su marca.';
let secuenciaAyuda = 0;

// La ayuda sigue derivándose del escenario. Abrir/cerrar el HUD nunca altera ese estado.
export default class PanelAyudaContextual {
  constructor(contenedor, { controles = false } = {}) {
    this.contenedor = contenedor;
    contenedor.classList.add('metronet-accesos-ayuda');
    this.integrado = controles;
    this.vista = null;
    this.elemento = document.createElement('details');
    this.elemento.className = 'metronet-hud';
    this.elemento.setAttribute('aria-label', 'Controles del mapa, pista y música');
    const id = `metronet-hud-${++secuenciaAyuda}`;
    this.elemento.innerHTML = `<summary></summary><div class="metronet-hud__panel"><header><h2 data-hud-titulo>Controles del mapa</h2><button type="button" data-hud-cerrar></button></header><div class="metronet-hud__opciones" role="group" aria-label="Opciones del mapa"></div><section class="metronet-hud__contenido" id="${id}"><div data-hud-tecnico><p data-hud-controles></p><div data-hud-teclado></div></div><section class="metronet-assist" hidden><div data-assist-mensaje aria-live="polite" aria-atomic="true" tabindex="0" aria-label="Orientación actual"></div><button type="button" data-assist-pista>Más pista</button></section><div data-hud-musica hidden></div></section></div>`;
    for (const tipo of ['pointerdown', 'mousedown', 'touchstart']) this.elemento.querySelector('.metronet-hud__panel').addEventListener(tipo, e => e.stopPropagation());
    this.acceso = this.elemento.querySelector('summary');
    configurarBotonIcono(this.acceso, 'controles', 'Controles');
    this.acceso.setAttribute('aria-controls', id);
    this.acceso.setAttribute('aria-expanded', 'false');
    const cerrar = this.elemento.querySelector('[data-hud-cerrar]');
    configurarBotonIcono(cerrar, 'cancelar', 'Cerrar controles');
    cerrar.addEventListener('click', () => this.cerrar(true));
    this.opciones = new Map();
    this.tutorial = new PanelTutorialInicial(contenedor);
    this.indicaciones = document.createElement('details');
    this.indicaciones.dataset.indicacionesEscenario = '';
    this.indicaciones.innerHTML = '<summary>Indicaciones del escenario</summary><p></p>';
    this.elemento.querySelector('.metronet-assist').append(this.indicaciones);
    for (const [vista, etiqueta] of [['controles', 'Controles del mapa'], ['pista', 'Pista'], ['musica', 'Música']]) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.dataset.hudVista = vista;
      configurarBotonIcono(boton, vista, etiqueta);
      boton.addEventListener('click', () => { if (this.vista === vista) { this.cerrar(true); return; } this.vista = vista; this.mostrarVista(); });
      this.opciones.set(vista, boton);
      this.elemento.querySelector('.metronet-hud__opciones').append(boton);
    }
    this.mensaje = this.elemento.querySelector('[data-assist-mensaje]');
    this.boton = this.elemento.querySelector('[data-assist-pista]');
    this.boton.addEventListener('click', () => { this.ampliada = !this.ampliada; this.renderizar(); });
    this.elemento.querySelector('[data-hud-controles]').textContent = (controles ? CONTROLES_EDITOR : CONTROLES_SIMULACION) + CONTROLES_BUSQUEDA;
    this.musica = crearControlMusica({ integrado: true });
    this.elemento.querySelector('[data-hud-musica]').append(this.musica.elemento);
    this.alCerrarFuera = e => { if (!this.elemento.contains(e.target)) this.cerrar(); };
    document.addEventListener('pointerdown', this.alCerrarFuera);
    this.elemento.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.elemento.open) { e.stopPropagation(); this.cerrar(true); }
    });
    this.elemento.addEventListener('toggle', () => {
      if (!this.elemento.open && this.elemento.querySelector('.metronet-glosario-contextual')) cerrarDefinicion();
      this.acceso.setAttribute('aria-expanded', String(this.elemento.open));
      this.acceso.setAttribute('aria-pressed', String(this.elemento.open));
    });
    contenedor.hidden = false;
    contenedor.append(this.elemento);
    this.liberarPosicion = ajustarPanelMapa(this.acceso, this.elemento.querySelector('.metronet-hud__panel'));
    this.actualizar({});
    this.mostrarVista();
  }

  cerrar(foco = false) {
    if (this.elemento.querySelector('.metronet-glosario-contextual')) cerrarDefinicion();
    this.elemento.open = false;
    if (foco) this.acceso.focus({ preventScroll: true });
  }

  mostrarVista() {
    if (this.elemento.querySelector('.metronet-glosario-contextual')) cerrarDefinicion();
    for (const [vista, boton] of this.opciones) boton.setAttribute('aria-pressed', String(vista === this.vista));
    this.elemento.querySelector('[data-hud-titulo]').textContent = this.opciones.get(this.vista)?.getAttribute('aria-label') ?? 'Ayuda del mapa';
    this.elemento.querySelector('[data-hud-tecnico]').hidden = this.vista !== 'controles';
    this.elemento.querySelector('.metronet-assist').hidden = this.vista !== 'pista';
    this.elemento.querySelector('[data-hud-musica]').hidden = this.vista !== 'musica';
    this.elemento.dataset.vista = this.vista ?? '';
  }

  actualizar(contexto) {
    if (this.eliminada) return;
    const tutorialActivo = this.tutorial.actualizar(contexto);
    contexto = { ...contexto, tutorialActivo };
    const instrucciones = contexto.escenario?.instrucciones ?? contexto.diseno?.simulacion?.instrucciones ?? '';
    const objetivo = contexto.escenario?.objetivo ?? contexto.diseno?.simulacion?.objetivo ?? '';
    this.indicaciones.hidden = !instrucciones.trim() || instrucciones.trim() === objetivo.trim();
    if (instrucciones !== this.instrucciones) {
      this.instrucciones = instrucciones;
      this.indicaciones.open = false;
      this.indicaciones.querySelector('p').textContent = instrucciones;
      destacarConceptos(this.indicaciones.querySelector('p'), conceptosDelNivel(contexto.escenario ?? contexto.diseno?.simulacion), { contextual:true });
    }
    const ayuda = obtenerAyudaContextual(contexto) ?? {
      clave: 'sin-escenario', etiqueta: 'PISTA', conceptos: [],
      texto: contexto.diseno ? 'Las pistas acompañan los escenarios educativos. Este diseño no tiene una consigna activa.' : 'Abrí un escenario para recibir pistas de su consigna.',
    };
    const contextoId = JSON.stringify([contexto.diseno?.simulacion?.idDiseno, contexto.escenario?.idEscenario, contexto.escenario?.numero]);
    const identidad = JSON.stringify([contextoId, ayuda]);
    if (identidad === this.identidad) return;
    this.contextoId = contextoId;
    this.identidad = identidad;
    this.ayuda = ayuda;
    this.ampliada = false;
    this.renderizar();
  }

  renderizar() {
    const ayuda = this.ayuda;
    this.elemento.dataset.estado = ayuda.clave;
    this.elemento.querySelector('.metronet-assist').dataset.estado = ayuda.clave;
    const contenido = this.ampliada ? ayuda.pista : ayuda.texto;
    const identidadMensaje = JSON.stringify([contenido, ayuda.conceptos]);
    if (identidadMensaje !== this.identidadMensaje) {
      this.identidadMensaje = identidadMensaje;
      const texto = document.createElement('p');
      texto.textContent = contenido;
      this.mensaje.replaceChildren(texto);
      destacarConceptos(this.mensaje, ayuda.conceptos, { contextual: true });
      this.mensaje.scrollTop = 0;
    }
    this.boton.hidden = !ayuda.pista;
    this.boton.textContent = this.ampliada ? 'Pista inicial' : 'Más pista';
    this.boton.setAttribute('aria-pressed', String(this.ampliada));
  }

  eliminar() {
    this.eliminada = true;
    document.removeEventListener('pointerdown', this.alCerrarFuera);
    this.liberarPosicion();
    this.musica.eliminar();
    this.tutorial.eliminar();
    this.elemento.remove();
  }
}
