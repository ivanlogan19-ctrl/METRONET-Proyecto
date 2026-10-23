import { configurarAccion } from '../interfaz/AccionesInterfaz.js';
import { ofrecerTutorial } from './OfertaTutorial.js';
import { claveAprendizajeTutorial, describirFunciones, funcionesIntroducidas, registrarFuncionesEnsenadas } from './FuncionesCampana.js';
import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';
import { anclarPanelDesplegable } from '../interfaz/PanelDesplegable.js';
import { pasoPractico, leccionesDisponibles, herramientasIntroducidas, pasosPracticosEditor, accionPracticaCumplida, esRecorridoIntegral, objetivoTutorialPoi } from './TutorialInicial.js';
import RecorridoInicial from './RecorridoInicial.js';
import { consumirInicioTutorial } from './InicioTutorial.js';
import { obtenerSesionActiva } from '../autenticacion/sesion.js';
import { cerrarDefinicion } from './glosario/GlosarioContextual.js';
import './tutorial-inicial.css';

let secuenciaTutorial = 0;
const PASOS_NOVEDAD = {
  estaciones: [
    ['[data-elegir-herramienta="estaciones"]', 'Estación', 'Elegí este icono para ubicar estaciones.'],
    ['#metronet-mapa', 'Ubicar estación', 'Después, elegí un lugar del mapa. Podés colocar varias estaciones seguidas; Escape termina la herramienta.'],
  ],
  lineas: [
    ['[data-elegir-herramienta="lineas"]', 'Línea', 'Elegí este icono para crear una línea.'],
    ['#metronet-mapa', 'Trazar línea', 'Seleccioná dos estaciones distintas del mapa. La línea se crea con su primer tramo.'],
  ],
  conexiones: [
    ['[data-elegir-herramienta="conexiones"]', 'Conexión', 'Uní dos líneas en una estación compartida. Cada metro sigue recorriendo su propia línea.'],
    ['#metronet-mapa', 'Conectar líneas', 'Tocá un extremo y una estación de otra línea. La primera se prolonga hasta la segunda sin mover estaciones ni cambiar sus colores o metros.'],
  ],
  metros: [
    ['[data-elegir-herramienta="metros"]', 'Unidad de metro', 'Elegí este icono para asignar una unidad.'],
    ['#metronet-mapa', 'Asignar metro', 'Tocá una vía del mapa. La unidad quedará asignada a esa línea.'],
  ],
  simulacion: [
    ['[data-ir-simulacion]', 'Simular', 'Este botón abre la pantalla de Simulación cuando la red está preparada. Allí podrás iniciar el recorrido con Play.'],
  ],
};
const HERRAMIENTAS_NUEVAS = {
  estaciones: ['Estación', 'Ubicá estaciones en el mapa. Escape termina la herramienta.'],
  lineas: ['Línea', 'Uní dos estaciones libres o prolongá un extremo, en cualquier orden.'],
  conexiones: ['Conexión', 'Uní líneas en una estación compartida.'],
  metros: ['Unidad de metro', 'Asigná una unidad a una vía del mapa.'],
  simulacion: ['Simulación', 'Comprobá la red y abrí su recorrido simulado.'],
};

export default class PanelTutorialInicial {
  constructor(contenedor) {
    this.intentos = new Map();
    this.elemento = document.createElement('details');
    // Exclusión nativa inmediata: un toggle pendiente no debe cerrar el acceso más reciente.
    this.elemento.name = 'metronet-asistencia';
    this.elemento.className = 'metronet-tutorial';
    this.elemento.setAttribute('aria-label', 'Tutorial de herramientas');
    this.elemento.innerHTML = '<summary></summary><section class="metronet-tutorial__panel metronet-guia-rapida"><header><h2>Guía rápida</h2></header><div data-tutorial-contenido aria-live="polite"></div></section>';
    this.acceso = this.elemento.querySelector('summary');
    configurarBotonIcono(this.acceso, 'tutorialPizarra', 'Tutorial');
    const panel = this.elemento.querySelector('section');
    panel.id = `metronet-tutorial-${++secuenciaTutorial}`;
    this.acceso.setAttribute('aria-controls', panel.id);
    this.contenido = this.elemento.querySelector('[data-tutorial-contenido]');
    contenedor.append(this.elemento);
    this.liberar = anclarPanelDesplegable(this.elemento, this.elemento.querySelector('section'), { ancho:280 });
    this.cerrarConEscape = evento => {
      if (evento.key !== 'Escape' || !this.elemento.open) return;
      evento.preventDefault();
      this.elemento.open = false;
      this.acceso.focus({ preventScroll:true });
    };
    document.addEventListener('keydown', this.cerrarConEscape);
    this.recorrido = new RecorridoInicial((completado) => { if (completado) { this.marcarCompletado(); this.comenzarPractica(); } });
    this.observarPractica = evento => {
      if (evento.type === 'click' && evento.target.closest?.('.metronet-poi__categorias button') && this.estado) this.estado.categoriaUsada = true;
      this.avanzarPractica();
    };
    document.addEventListener('toggle', this.observarPractica, true);
    document.addEventListener('input', this.observarPractica);
    document.addEventListener('change', this.observarPractica);
    document.addEventListener('click', this.observarPractica);
    this.recorridoNovedades = null;
    this.cerrarOtros = evento => {
      if (evento.target.open && evento.target.matches?.('.metronet-hud, .metronet-poi')) this.elemento.open = false;
    };
    document.addEventListener('toggle', this.cerrarOtros, true);
    this.elemento.addEventListener('toggle', () => {
      if (!this.elemento.open) cerrarDefinicion();
      else {
        this.renderizar();
        document.querySelectorAll('.metronet-hud[open], .metronet-poi[open]').forEach(e => { e.open = false; });
      }
    });
  }

  actualizar(contexto) {
    if (contexto.identificando) return false;
    this.contexto = contexto;
    this.integral = esRecorridoIntegral(contexto.escenario);
    this.recorrido.opciones.integral = this.integral;
    this.recorrido.opciones.conexionesRequeridas = this.integral
      ? Boolean(contexto.escenario?.reglasExito?.minimoConexionesLineas) : undefined;
    this.recorrido.opciones.libre = contexto.diseno?.simulacion?.modo === 'EDICION_LIBRE';
    this.recorrido.opciones.senalarDeshabilitados = this.integral;
    const id = JSON.stringify([contexto.diseno?.simulacion?.idDiseno, contexto.escenario?.idEscenario]);
    const nuevo = this.id !== id;
    if (nuevo) { this.oferta?.terminar(); this.practica?.terminar(false); this.practica = null; this.recorrido.terminar(false); this.recorridoNovedades?.terminar(false); this.elemento.open = false; this.id = id; }
    const disponible = Boolean(contexto.diseno);
    this.elemento.hidden = !disponible;
    if (!disponible) return false;
    if (!this.intentos.has(id)) {
      const primeraPasada = consumirInicioTutorial(contexto.diseno, contexto.escenario);
      this.intentos.set(id, { aprendidas:new Set(), primeraPasada, fase:'practica' });
    }
    this.estado = this.intentos.get(id);
    this.recorrido.opciones.textoFinal = Number.isInteger(contexto.escenario?.numero)
      ? `Ya conocés los controles del nivel ${contexto.escenario.numero}. Podés construir tu red.`
      : 'Ya conocés los controles. Podés construir tu red.';
    this.leccion = pasoPractico(contexto, this.estado);
    this.elemento.dataset.paso = this.leccion?.clave ?? 'manual';
    this.elemento.dataset.fase = this.estado.fase;
    const nuevas = herramientasIntroducidas(contexto.escenario, contexto.catalogo);
    this.herramientasNuevas = nuevas;
    const claveNovedad = nuevas.length
      ? `metronet:tutorial-nueva-herramienta:v1:${obtenerSesionActiva()?.usuario?.idUsuario}:${contexto.escenario.numero}` : null;
    if (nuevo) {
      this.claveNovedad = claveNovedad;
      this.recorridoNovedades = nuevas.length ? new RecorridoInicial((completado, motivo) => {
        if (this.claveNovedad && (completado || motivo === 'omitido')) try {
          localStorage.setItem(this.claveNovedad, completado ? 'presentada' : 'omitida');
        } catch { /* La guía sigue disponible. */ }
        if (completado) this.marcarCompletado();
        if (completado && this.contexto?.escenario?.numero === 1) this.comenzarPractica();
      }, {
        interactivo: true, senalarDeshabilitados: true, disparador: '.metronet-tutorial > summary',
        pasos: nuevas.flatMap(clave => PASOS_NOVEDAD[clave] ?? []),
        tituloFinal: '¡Listos para construir!',
        textoFinal: `Ya conocés ${nuevas.map(clave => HERRAMIENTAS_NUEVAS[clave][0].toLowerCase()).join(' y ')}. Continuá construyendo la red.`,
      }) : null;
    }
    const identidad = JSON.stringify([id, this.estado.fase, this.leccion, contexto.error, leccionesDisponibles(contexto)]);
    if (identidad !== this.identidad) { this.identidad = identidad; this.renderizar(); }
    if (nuevo && !this.recorridosSuspendidos) {
      const primeraPasada = this.estado.primeraPasada;
      this.estado.primeraPasada = false;
      if (!this.integral) {
        if (nuevas.length) this.ofrecerNovedades(() => this.mostrarNovedades(), nuevas); else if (primeraPasada) this.iniciarRecorrido(this.recorrido);
      } else if (contexto.escenario?.numero === 1) this.ofrecerTutorialInicial();
      else if (pasosPracticosEditor(contexto.escenario?.numero, contexto.escenario).length
        && funcionesIntroducidas(contexto.escenario.numero, contexto.escenario).some(clave => clave.startsWith('editor.'))) this.ofrecerNovedades(() => this.comenzarPractica(), funcionesIntroducidas(contexto.escenario.numero, contexto.escenario).filter(c => c.startsWith('editor.')));
      else if (nuevas.length) this.ofrecerNovedades(() => this.mostrarNovedades(), nuevas);
    }
    this.avanzarPractica();
    return Boolean(this.leccion);
  }

  ofrecerTutorialInicial() {
    const clave = `metronet:oferta-inicial:v1:${obtenerSesionActiva()?.usuario?.idUsuario}:${this.contexto.diseno.simulacion.idDiseno}`;
    try { if (localStorage.getItem(clave)) return; } catch { /* Ayuda disponible. */ }
    const registrar = () => { try { localStorage.setItem(clave, 'ofrecida'); } catch { /* No bloquea jugar. */ } };
    this.oferta = ofrecerTutorial({ titulo:'¿Querés realizar el tutorial inicial?', inicial:true,
      descripcion:'Conocé las herramientas paso a paso. También podés empezar a construir ahora.',
      alAceptar:() => { registrar(); this.iniciarRecorrido(this.recorrido); }, alOmitir:registrar });
  }

  ofrecerNovedades(accion, funciones) {
    const idUsuario = obtenerSesionActiva()?.usuario?.idUsuario;
    const claves = funciones.map(c => `metronet:oferta-funcion:v3:${idUsuario}:${this.contexto.diseno.simulacion.idDiseno}:${claveAprendizajeTutorial(c)}`);
    try { if (claves.length && claves.every(c => localStorage.getItem(c))) return; } catch { /* Ayuda disponible. */ }
    const registrar = () => { try { claves.forEach(c => localStorage.setItem(c, 'ofrecida')); } catch { /* No bloquea jugar. */ } };
    this.oferta = ofrecerTutorial({ descripcion:`Ahora podés ${describirFunciones(funciones)}. ¿Querés aprender cómo se usa?`,
      alAceptar:() => { registrar(); accion(); }, alOmitir:registrar });
  }

  boton(texto, accion) {
    const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = texto;
    boton.addEventListener('click', accion); return boton;
  }

  mostrarNovedades() {
    this.recorridoNovedades?.terminar(false);
    this.iniciarRecorrido(this.recorridoNovedades);
  }

  iniciarRecorrido(recorrido) {
    this.elemento.open = false;
    this.acceso.focus({ preventScroll:true });
    recorrido?.iniciar();
  }

  renderizar() {
    const contenido = [];
    const texto = (contenidoTexto, etiqueta = 'p') => { const e = document.createElement(etiqueta); e.textContent = contenidoTexto; contenido.push(e); return e; };
    if (this.estado.completado) texto('Tutorial completado').className = 'metronet-tutorial__completado';
    const lista = document.createElement('div');
    lista.className = 'metronet-tutorial__herramientas';
    const visible = selector => [...document.querySelectorAll(selector)].some(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    const temas = [];
    if (visible('[data-elegir-herramienta="estaciones"]')) temas.push(['estaciones', 'Ubicá estaciones y unilas para construir tu red.']);
    if (visible('[data-elegir-herramienta="metros"]')) temas.push(['metros', 'Asigná un metro tocando una vía.']);
    if (visible('[data-guardar]')) temas.push(['guardar', 'Guardá la red con el disquete.']);
    if (visible('[data-ir-simulacion]')) temas.push(['play', Number.isInteger(this.contexto?.escenario?.numero)
      ? 'Simulá la red y volvé para finalizar el nivel.' : 'Simulá tu red y volvé para seguir editando.']);
    if (visible('[data-calles-visible]')) temas.push(['calles', 'Mostrá las vías reales y acercate para ver calles. Podés construir encima.']);
    if (visible('#opacidad-calles')) temas.push(['capas', 'Ajustá la transparencia de las calles.']);
    if (visible('[data-poblacion-visible]')) temas.push(['poblacion', 'Mostrá densidad del Censo 2023 y ajustá su transparencia. No cambia con la hora del tráfico.']);
    if (visible('[data-desplazamientos-visible]')) temas.push(['desplazamientos', 'Explorá viajes históricos por hora; el control junto a su transparencia pausa o reanuda las flechas.']);
    if (visible('[data-trafico-visible]')) temas.push(['trafico', 'Consultá tráfico histórico por hora. Los colores muestran intensidad relativa; no atascos.']);
    const requierePoi = this.contexto?.escenario?.reglasExito?.puntosInteresObjetivo?.length
      || this.contexto?.consigna?.referenciasObjetivo?.length;
    if (requierePoi && visible('.metronet-poi > summary')) temas.push(['checkpoint', 'Buscá los puntos de interés con la bandera y colocá estaciones dentro de sus áreas.']);
    if (visible('.metronet-aprender-acceso')) temas.push(['tutorial', 'Aprender abre las tarjetas educativas de este nivel.']);
    for (const [icono, descripcion] of temas) {
      const item = document.createElement('p');
      item.innerHTML = iconoRetro(icono);
      const explicacion = document.createElement('span'); explicacion.textContent = descripcion;
      item.append(explicacion); lista.append(item);
    }
    contenido.push(lista);
    const error = this.contexto.error;
    if (error) texto(typeof error === 'string' ? error : error.message ?? error.mensaje ?? 'La operación no pudo completarse. Revisá la ubicación o selección e intentá nuevamente.').className = 'metronet-tutorial__error';
    const repetir = this.boton('Recorrer la pantalla', () => {
      if (this.integral && this.contexto.escenario?.numero !== 1 && pasosPracticosEditor(this.contexto.escenario?.numero, this.contexto.escenario).length) {
        this.practica?.terminar(false); this.practica = null; this.comenzarPractica();
      } else if (this.contexto.escenario?.numero !== 1 && this.herramientasNuevas.length) this.mostrarNovedades();
      else this.iniciarRecorrido(this.recorrido);
    });
    configurarBotonIcono(repetir, 'reiniciar', 'Iniciar tutorial');configurarAccion(repetir,'iniciarTutorial',{icono:true});
    repetir.className += ' metronet-tutorial__repetir'; contenido.push(repetir);
    this.contenido.replaceChildren(...contenido);
  }

  marcarCompletado() {
    if (this.estado) { this.estado.completado = true; this.renderizar(); }
  }

  comenzarPractica() {
    this.estado.fase = 'practica'; this.actualizar(this.contexto); this.elemento.open = false;
    this.acceso.focus({ preventScroll:true });
    const pasos = this.integral ? pasosPracticosEditor(this.contexto.escenario?.numero, this.contexto.escenario) : [];
    if (pasos.length && !this.practica) {
      this.practica = new RecorridoInicial(completado => { if (completado) { this.marcarCompletado(); registrarFuncionesEnsenadas(obtenerSesionActiva()?.usuario?.idUsuario, funcionesIntroducidas(this.contexto.escenario.numero, this.contexto.escenario).filter(c => c.startsWith('editor.')).map(claveAprendizajeTutorial)); } }, { pasos, pasosDinamicos:true, interactivo:true,
        disparador:'.metronet-tutorial > summary', tituloFinal:'Práctica realizada',
        textoFinal:'Continuá con la consigna. Podés volver a abrir este tutorial cuando lo necesites.' });
      this.practica.iniciar();
      this.avanzarPractica();
    }
  }
  avanzarPractica() {
    if (!this.practica?.dialogo || !this.contexto?.diseno) return;
    const objetivo = objetivoTutorialPoi(this.contexto.escenario?.numero, this.contexto.escenario);
    const controles = {
      categoriaUsada:Boolean(this.estado.categoriaUsada),
      barriosAbiertos:document.querySelector('#metronet-selector-barrios .metronet-panel-encabezado')?.getAttribute('aria-expanded') === 'true',
      barrioSeleccionado:Boolean(document.querySelector('.metronet-selector-barrios-lista input:checked:not([value=""])')),
      zonasAbiertas:document.querySelector('#metronet-selector-zonas .metronet-panel-encabezado')?.getAttribute('aria-expanded') === 'true',
      zonaSeleccionada:Boolean(document.querySelector('.metronet-selector-zonas-lista input:checked')),
      poiFijado:Boolean(document.querySelector('.metronet-punto-interes-mantener input:checked')),
      poiFichaCerrada:!document.querySelector('.metronet-punto-interes-panel'),
      poiAbierto:Boolean(document.querySelector('.metronet-poi[open]')),
      buscadorAbierto:document.querySelector('.metronet-panel-puntos-alternar')?.getAttribute('aria-expanded') === 'true',
      poiBuscado:Boolean(objetivo && document.querySelector('.metronet-panel-puntos-busqueda')?.value.trim()
        && document.querySelector('.metronet-panel-puntos-lista')?.textContent.includes(objetivo.nombre)),
    };
    while (this.practica.dialogo) {
      const evento = this.practica.pasos[this.practica.indice]?.[3];
      if (!evento || !accionPracticaCumplida(evento, this.contexto, this.estado, controles)) break;
      this.practica.notificar(evento);
    }
  }
  registrarUso(herramienta) { this.estado?.aprendidas.add(herramienta); }
  cerrarRecorridos(suspender = false) {
    this.oferta?.terminar();
    if (suspender) this.recorridosSuspendidos = true;
    this.practica?.terminar(false); this.practica = null;
    this.recorrido.terminar(false);
    this.recorridoNovedades?.terminar(false);
    this.elemento.open = false;
  }
  reactivarRecorridos() {
    this.recorridosSuspendidos = false;
    this.id = null;
    if (this.contexto?.diseno) this.actualizar(this.contexto);
  }
  eliminar() {
    this.cerrarRecorridos(); this.liberar(); document.removeEventListener('toggle', this.cerrarOtros, true);
    document.removeEventListener('keydown', this.cerrarConEscape);
    document.removeEventListener('toggle', this.observarPractica, true);
    document.removeEventListener('input', this.observarPractica);
    document.removeEventListener('change', this.observarPractica);
    document.removeEventListener('click', this.observarPractica);
    this.elemento.remove(); this.intentos.clear();
  }
}
