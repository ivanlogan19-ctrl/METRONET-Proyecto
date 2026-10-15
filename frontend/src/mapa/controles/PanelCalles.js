import '../estilos/colores-capas.css';
import PanelDesplazamientos from './PanelDesplazamientos.js';
import { configurarBotonIcono } from '../../interfaz/IconosRetro.js';
import '../estilos/calles.css';
import { ofrecerTutorial } from '../../educacion/OfertaTutorial.js';
import RecorridoInicial from '../../educacion/RecorridoInicial.js';
import { PASOS_CALLES } from '../../educacion/TutorialCalles.js';
import PanelTrafico from './PanelTrafico.js';
import PanelPoblacion from './PanelPoblacion.js';

export default class PanelCalles {
  constructor(capa, trafico, poblacion, desplazamientos) {
    this.capa = capa;
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-calles';
    this.elemento.setAttribute('aria-label', 'Análisis del territorio');
    this.elemento.innerHTML = `<div class="metronet-calles__botones">
      <button type="button" data-calles-visible></button>
    </div>
    <div id="opacidad-calles" class="metronet-calles__opacidad">
      <input type="range" min="10" max="100" step="5" value="65" aria-label="Opacidad de calles y avenidas">
    </div>
    <p class="metronet-calles__estado" role="status" hidden></p>`;
    this.boton = this.elemento.querySelector('[data-calles-visible]');
    this.rango = this.elemento.querySelector('input');
    this.panelPoblacion = poblacion ? new PanelPoblacion(poblacion, this.elemento) : null;
    this.panelTrafico = trafico ? new PanelTrafico(trafico, this.elemento) : null;
    if (this.panelPoblacion) this.elemento.querySelector('.metronet-calles__botones').append(this.panelPoblacion.boton);
    this.panelDesplazamientos = desplazamientos ? new PanelDesplazamientos(desplazamientos, this.elemento) : null;
    this.boton.addEventListener('click', () => capa.alternar());
    this.rango.addEventListener('input', () => {
      capa.establecerOpacidad(Number(this.rango.value) / 100);
      trafico?.actualizar();
      this.rango.setAttribute('aria-valuetext', `${this.rango.value} %`);
    });
    capa.alCambiar = () => this.actualizar();
    this.organizarCategorias();
    this.actualizar();
  }

  organizarCategorias() {
    // Reutilizar los controles conserva sus eventos, estados y accesos del tutorial.
    const categoria = (nombre, clave) => {
      const seccion = document.createElement('section');
      seccion.className = 'metronet-territorio__categoria';
      seccion.dataset.categoriaTerritorio = clave;
      seccion.setAttribute('aria-label', nombre);
      const titulo = document.createElement('h3'); titulo.textContent = nombre;
      const controles = document.createElement('div'); controles.className = 'metronet-territorio__controles';
      seccion.append(titulo, controles); this.elemento.append(seccion);
      return controles;
    };
    const botones = this.elemento.querySelector('.metronet-calles__botones');
    const calles = categoria('Calles', 'calles');
    const opacidad = this.elemento.querySelector('#opacidad-calles');
    calles.append(this.boton, opacidad);
    calles.parentElement.append(this.elemento.querySelector('.metronet-calles__estado'));
    if (this.panelTrafico) {
      const trafico = categoria('Tráfico', 'trafico');
      trafico.append(this.panelTrafico.boton, this.panelTrafico.elemento.querySelector('.metronet-trafico__leyenda'));
      trafico.parentElement.append(this.panelTrafico.error);
    }
    if (this.panelPoblacion) {
      const poblacion = categoria('Población', 'poblacion');
      const panel = this.panelPoblacion;
      panel.elemento.querySelector('.metronet-poblacion__opacidad > span').remove();
      poblacion.append(panel.boton, panel.elemento);
    }
    if (this.panelDesplazamientos) {
      const desplazamientos = categoria('Desplazamientos', 'desplazamientos');
      const panel = this.panelDesplazamientos;
      panel.elemento.querySelector('.metronet-desplazamientos__opacidad > span').remove();
      desplazamientos.append(panel.boton, panel.elemento);
    }
    if (this.panelTrafico) {
      const horarios = categoria('Horarios', 'horarios');
      this.panelTrafico.elemento.querySelector('.metronet-trafico__hora > span').remove();
      horarios.append(this.panelTrafico.elemento);
    }
    botones.remove();
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
    this.claveTutorial = `metronet:oferta-calles:v7:${idUsuario}:${idDiseno}`;
    this.ofrecerSiCorresponde();
  }

  ofrecerSiCorresponde() {
    if (!this.claveTutorial || !this.elemento.isConnected || !this.capa.disponible || this.capa.estado !== 'lista'
      || this.ultimaOferta === this.claveTutorial) return;
    this.ultimaOferta = this.claveTutorial;
    try { if (localStorage.getItem(this.claveTutorial)) return; } catch { /* La guía no bloquea editar. */ }
    const clave = this.claveTutorial;
    const registrar = () => { try { localStorage.setItem(clave, 'ofrecida'); } catch { /* Preferencia opcional. */ } };
    this.oferta = ofrecerTutorial({
      titulo: 'Bienvenido al Modo Libre', bienvenidaLibre: true,
      descripcion: [
        'Diseñá tu propia red de metro sobre Montevideo.',
        'Utilizá las herramientas de calles, tráfico histórico, población y desplazamientos por horario para decidir dónde ubicar estaciones y cómo conectarlas.',
        'Conocé las funciones nuevas paso a paso.',
      ],
      textoAceptar: 'Recorrer las funciones', textoOmitir: 'Empezar a diseñar',
      alOmitir: registrar,
      alAceptar: () => {
        registrar();
        this.recorrido = new RecorridoInicial(() => {}, { pasos: PASOS_CALLES,
          interactivo: true, senalarDeshabilitados: true, disparador: '.metronet-tutorial > summary',
          textoFinal: 'Podés seguir construyendo tu red sobre las calles.' });
        this.recorrido.iniciar();
      } });
  }

  eliminar() {
    this.panelTrafico?.eliminar();
    this.panelPoblacion?.eliminar();
    this.panelDesplazamientos?.eliminar();
    this.oferta?.terminar(); this.recorrido?.terminar(false);
    this.capa.alCambiar = () => {}; this.elemento.remove();
  }
}
