import { configurarBotonIcono, iconoRetro } from '../../interfaz/IconosRetro.js';
import '../estilos/calles.css';
import { ofrecerTutorial } from '../../educacion/OfertaTutorial.js';
import RecorridoInicial from '../../educacion/RecorridoInicial.js';
import { PASOS_CALLES } from '../../educacion/TutorialCalles.js';
import PanelTrafico from './PanelTrafico.js';
import PanelPoblacion from './PanelPoblacion.js';

export default class PanelCalles {
  constructor(capa, trafico, poblacion) {
    this.capa = capa;
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-calles';
    this.elemento.setAttribute('aria-label', 'Calles y avenidas de Montevideo');
    this.elemento.innerHTML = `<div class="metronet-calles__botones">
      <button type="button" data-calles-visible></button>
      <button type="button" data-calles-ajustes aria-expanded="true" aria-controls="opacidad-calles"></button>
      <a class="metronet-calles__fuente" href="https://ckan.montevideo.gub.uy/dataset/vias-de-transito" target="_blank" rel="noopener noreferrer"
         aria-label="Fuente: Intendencia de Montevideo, Geomática. Vías de tránsito, licencia de datos abiertos de Uruguay."
         title="Cartografía: Intendencia de Montevideo · Licencia DAG-UY · Descarga 13/10/2026">ⓘ</a>
    </div>
    <div id="opacidad-calles" class="metronet-calles__opacidad">
      <span aria-hidden="true" class="metronet-calles__tenue">${iconoRetro('capas')}</span>
      <input type="range" min="10" max="100" step="5" value="65" aria-label="Opacidad de calles y avenidas">
      <span aria-hidden="true">${iconoRetro('capas')}</span>
    </div>
    <p class="metronet-calles__estado" role="status" hidden></p>`;
    this.boton = this.elemento.querySelector('[data-calles-visible]');
    this.ajustes = this.elemento.querySelector('[data-calles-ajustes]');
    this.rango = this.elemento.querySelector('input');
    this.panelPoblacion = poblacion ? new PanelPoblacion(poblacion, this.elemento) : null;
    this.panelTrafico = trafico ? new PanelTrafico(trafico, this.elemento) : null;
    if (this.panelPoblacion) this.elemento.querySelector('.metronet-calles__fuente').before(this.panelPoblacion.boton);
    configurarBotonIcono(this.ajustes, 'capas', 'Ajustar transparencia de calles');
    this.boton.addEventListener('click', () => capa.alternar());
    this.ajustes.addEventListener('click', () => {
      const abierto = this.ajustes.getAttribute('aria-expanded') !== 'true';
      this.ajustes.setAttribute('aria-expanded', String(abierto));
      this.elemento.querySelector('#opacidad-calles').hidden = !abierto;
    });
    this.rango.addEventListener('input', () => {
      capa.establecerOpacidad(Number(this.rango.value) / 100);
      trafico?.actualizar();
      this.rango.setAttribute('aria-valuetext', `${this.rango.value} %`);
    });
    capa.alCambiar = () => this.actualizar();
    this.actualizar();
  }

  actualizar() {
    const { estado, visible } = this.capa;
    const error = estado === 'error';
    configurarBotonIcono(this.boton, 'calles', error ? 'Reintentar carga de calles' : visible ? 'Ocultar calles y avenidas' : 'Mostrar calles y avenidas');
    this.boton.setAttribute('aria-pressed', String(visible && estado === 'lista'));
    this.boton.disabled = estado === 'cargando';
    this.rango.disabled = estado !== 'lista' || !visible;
    this.elemento.setAttribute('aria-busy', String(estado === 'cargando'));
    const mensaje = this.elemento.querySelector('.metronet-calles__estado');
    mensaje.hidden = !error;
    mensaje.textContent = error ? 'No se pudieron cargar las calles. Podés seguir construyendo y reintentar con el icono.' : '';
    this.ofrecerSiCorresponde();
  }

  prepararTutorial(idDiseno, idUsuario) {
    this.claveTutorial = `metronet:oferta-calles:v3:${idUsuario}:${idDiseno}`;
    this.ofrecerSiCorresponde();
  }

  ofrecerSiCorresponde() {
    if (!this.claveTutorial || !this.elemento.isConnected || !this.capa.disponible || this.capa.estado !== 'lista'
      || this.ultimaOferta === this.claveTutorial) return;
    this.ultimaOferta = this.claveTutorial;
    try { if (localStorage.getItem(this.claveTutorial)) return; } catch { /* La guía no bloquea editar. */ }
    const clave = this.claveTutorial;
    const registrar = () => { try { localStorage.setItem(clave, 'ofrecida'); } catch { /* Preferencia opcional. */ } };
    this.oferta = ofrecerTutorial({ descripcion: 'Consultá calles, tráfico histórico por horario y densidad de población mientras construís tu red. ¿Querés conocer los controles?',
      alOmitir: registrar,
      alAceptar: () => {
        registrar();
        this.recorrido = new RecorridoInicial(() => {}, { pasos: PASOS_CALLES,
          interactivo: true, disparador: '.metronet-tutorial > summary',
          textoFinal: 'Podés seguir construyendo tu red sobre las calles.' });
        this.recorrido.iniciar();
      } });
  }

  eliminar() {
    this.panelTrafico?.eliminar();
    this.panelPoblacion?.eliminar();
    this.oferta?.terminar(); this.recorrido?.terminar(false);
    this.capa.alCambiar = () => {}; this.elemento.remove();
  }
}
