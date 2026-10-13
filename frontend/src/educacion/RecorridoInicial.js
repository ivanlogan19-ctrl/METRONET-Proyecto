import { configurarBotonIcono, iconoRetro } from '../interfaz/IconosRetro.js';
import { PASOS_CALLES } from './TutorialCalles.js';
const PASOS_INTEGRAL = [
  ['#metronet-mapa', 'Mapa de la red', 'Acá construís tu red. Arrastrá para desplazarte por el mapa.'],
  ['.metronet-control-zoom', 'Vista del mapa', 'Usá + y − para acercar o alejar. El botón de ajustar vuelve a encuadrar la red.'],
  ['.metronet-control-zoom__brujula', 'Rotación del mapa', 'Las flechas curvas giran el mapa a izquierda o derecha. La aguja señala el norte. Tocá la brújula para volver a colocar el norte arriba.'],
  ['.metronet-herramientas__barra', 'Herramientas', 'Estos símbolos permiten construir y editar la red. Solo aparecen disponibles los que corresponden al nivel.'],
  ['[data-elegir-herramienta="estaciones"]', 'Estación', 'Este símbolo permite colocar estaciones sobre el mapa.'],
  ['[data-elegir-herramienta="lineas"]', 'Línea', 'Esta herramienta une dos estaciones y crea una línea con su primer tramo.'],
  ['[data-elegir-herramienta="seleccion"]', 'Selección', 'Seleccioná elementos existentes para consultar o editar sus propiedades.'],
  ['[data-guardar]', 'Guardar', 'El disquete guarda el diseño y revisa las condiciones del nivel.'],
  ['[data-elegir-herramienta="conexiones"]', 'Conexión', 'Elegí una vía y dos estaciones para extender una línea.'],
  ['[data-elegir-herramienta="metros"]', 'Metro', 'Tocá una vía con esta herramienta para asignarle una unidad.'],
  ['[data-ir-simulacion]', 'Simular', 'En Acciones de nivel podés pasar a Simulación después de guardar y comprobar la red.'],
  ['.metronet-aprender-acceso', 'Aprender', 'Abrí este botón para volver a ver las tarjetas educativas de este nivel.'],
  ['.metronet-hud--integrado > summary', 'Música', 'Este botón permite activar o silenciar la música y ajustar su volumen.'],
  ['.metronet-consigna__cabecera', 'Metas del nivel', 'Este panel muestra las metas y su progreso. Cada meta cumplida se marca con una estrella.'],
];

const PASOS = [...PASOS_CALLES.slice(0,-1), ...PASOS_INTEGRAL.slice(3,8),
  ['.metronet-poi > summary', 'Referencias', 'La bandera amarilla permite mostrar referencias geográficas. Su buscador localiza un punto concreto.'],
  ...PASOS_INTEGRAL.slice(-3)];

const visible = elemento => elemento && !elemento.disabled && elemento.getClientRects().length && getComputedStyle(elemento).visibility !== 'hidden';
const senalable = elemento => elemento && elemento.getClientRects().length && getComputedStyle(elemento).visibility !== 'hidden';

// Recorrido exclusivamente de presentación: no dispara acciones del dominio.
export default class RecorridoInicial {
  constructor(alFinalizar, opciones = {}) { this.alFinalizar = alFinalizar; this.opciones = opciones; }
  iniciar() {
    this.focoAnterior = document.activeElement;
    this.scrollAnterior = [scrollX, scrollY];
    this.scrollBody = document.body.scrollTop;
    this.panel = document.querySelector('#metronet-panel-controles');
    this.scrollPanel = this.panel?.scrollTop;
    this.togglePanel = document.querySelector('[data-panel-edicion-toggle]');
    this.panelCerrado = this.togglePanel?.getAttribute('aria-expanded') === 'false';
    if (this.panelCerrado) this.togglePanel.click();
    this.pasos = (this.opciones.pasos ?? (this.opciones.integral ? PASOS_INTEGRAL : PASOS)).filter(([selector]) =>
      this.opciones.pasosDinamicos || (this.opciones.senalarDeshabilitados ? senalable : visible)(document.querySelector(selector)));
    this.indice = 0;
    this.dialogo = document.createElement('dialog');
    this.dialogo.className = 'metronet-recorrido';
    this.dialogo.setAttribute('aria-labelledby', 'recorrido-titulo');
    this.dialogo.innerHTML = '<div class="metronet-recorrido__marca" aria-hidden="true"></div><p data-recorrido-progreso></p><header class="metronet-recorrido__cabecera"><span data-recorrido-icono aria-hidden="true"></span><h2 id="recorrido-titulo"></h2></header><p data-recorrido-texto></p><div class="metronet-recorrido__acciones"><button type="button" data-recorrido-omitir>Omitir</button><button type="button" data-recorrido-siguiente>Siguiente</button></div>';
    configurarBotonIcono(this.dialogo.querySelector('[data-recorrido-omitir]'), 'cancelar', 'Omitir');
    configurarBotonIcono(this.dialogo.querySelector('[data-recorrido-siguiente]'), 'play', 'Siguiente');
    document.body.append(this.dialogo);
    this.dialogo.addEventListener('cancel', e => { e.preventDefault(); this.terminar(true, false, 'omitido'); });
    this.dialogo.querySelector('[data-recorrido-omitir]').addEventListener('click', () => this.terminar(true, false, 'omitido'));
    this.dialogo.querySelector('[data-recorrido-siguiente]').addEventListener('click', () => {
      if (this.indice >= this.pasos.length) this.terminar(true, true);
      else { this.indice++; this.mostrar(); }
    });
    this.reposicionar = () => this.posicionar();
    window.addEventListener('resize', this.reposicionar);
    window.addEventListener('scroll', this.reposicionar, true);
    this.alAlternar = () => {
      cancelAnimationFrame(this.reposicionPendiente);
      this.reposicionPendiente = requestAnimationFrame(this.reposicionar);
    };
    document.addEventListener('toggle', this.alAlternar, true);
    if (this.opciones.interactivo) {
      this.cerrarConEscape = evento => {
        if (evento.key !== 'Escape') return;
        evento.preventDefault();
        this.terminar(true, false, 'omitido');
      };
      window.addEventListener('keydown', this.cerrarConEscape);
      this.dialogo.show();
    }
    else this.dialogo.showModal();
    this.mostrar();
  }
  mostrar() {
    clearTimeout(this.cierreFinal);
    this.cierreFinal = null;
    const paso = this.pasos[this.indice];
    this.objetivo = paso ? document.querySelector(paso[0]) : null;
    this.ladoPreferido = null;
    // Los objetivos pueden ser reemplazados al refrescar la consigna.
    if (paso && !this.opciones.pasosDinamicos && !senalable(this.objetivo)) { this.indice++; this.mostrar(); return; }
    this.dialogo.dataset.objetivo = paso?.[0] ?? 'fin';
    const estado = this.dialogo.querySelector('[data-recorrido-progreso]');
    estado.hidden = Boolean(paso);
    estado.textContent = paso ? '' : 'RECORRIDO COMPLETADO';
    this.dialogo.querySelector('h2').textContent = paso?.[1] ?? this.opciones.tituloFinal ?? '¡Listos para construir!';
    this.dialogo.querySelector('[data-recorrido-texto]').textContent = paso?.[2] ?? this.opciones.textoFinal ?? 'Ya conocés los controles. Podés comenzar a construir la red.';
    this.dialogo.querySelector('[data-recorrido-siguiente]').hidden = !paso || Boolean(paso[3]);
    const icono = this.objetivo?.querySelector('svg.metronet-icono');
    this.dialogo.querySelector('[data-recorrido-icono]').innerHTML = icono?.outerHTML ?? iconoRetro(paso ? 'tutorialPizarra' : 'finalizarRed');
    this.dialogo.querySelector('[data-recorrido-omitir]').hidden = !paso;
    this.objetivo?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    this.posicionar();
    if (!paso?.[3]) this.dialogo.querySelector('[data-recorrido-siguiente]').focus({ preventScroll: true });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.dialogo.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 180 });
    if (!paso) this.cierreFinal = setTimeout(() => this.terminar(true, true), 3500);
  }
  notificar(evento) {
    if (!this.dialogo || this.pasos[this.indice]?.[3] !== evento) return;
    this.indice++;
    if (this.indice >= this.pasos.length && this.opciones.interactivo) this.terminar(true, true);
    else this.mostrar();
  }
  posicionar() {
    if (!this.dialogo?.open) return;
    this.restaurarMarcoMapa();
    const selector = this.pasos[this.indice]?.[0];
    this.objetivo = selector ? document.querySelector(selector) : null;
    const margen = 12, espacio = 12;
    const r = this.objetivo?.getBoundingClientRect();
    const w = this.dialogo.offsetWidth, h = this.dialogo.offsetHeight;
    const marca = this.dialogo.querySelector('.metronet-recorrido__marca');
    const evitarSuperposicion = () => {
      if (marca.hidden) return;
      const tarjeta = this.dialogo.getBoundingClientRect(), foco = marca.getBoundingClientRect();
      if (tarjeta.left < foco.right && tarjeta.right > foco.left && tarjeta.top < foco.bottom && tarjeta.bottom > foco.top) marca.hidden = true;
    };
    const visible = r && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    marca.hidden = !visible;
    if (visible) {
      const izquierda = Math.max(0, r.left - 3), arriba = Math.max(0, r.top - 3);
      const derecha = Math.min(innerWidth, r.right + 3), abajo = Math.min(innerHeight, r.bottom + 3);
      Object.assign(marca.style, {
        left: `${izquierda}px`, top: `${arriba}px`, width: `${derecha - izquierda}px`, height: `${abajo - arriba}px`,
        borderLeftWidth: r.left < 3 ? '0' : '3px', borderTopWidth: r.top < 3 ? '0' : '3px',
        borderRightWidth: r.right > innerWidth - 3 ? '0' : '3px', borderBottomWidth: r.bottom > innerHeight - 3 ? '0' : '3px',
      });
    }
    const limitar = (valor, tamano, limite) => Math.max(margen, Math.min(valor, Math.max(margen, limite - tamano - margen)));
    const candidatos = r && visible ? [
      { lado: 'izquierda', x: r.left - w - espacio, y: r.top },
      { lado: 'abajo', x: r.left, y: r.bottom + espacio },
      { lado: 'arriba', x: r.left, y: r.top - h - espacio },
      { lado: 'derecha', x: r.right + espacio, y: r.top },
    ] : [];
    const cabe = ({ x, y }) => x >= margen && y >= margen && x + w <= innerWidth - margen && y + h <= innerHeight - margen;
    const espacioLibre = {
      izquierda: r?.left ?? 0, abajo: r ? innerHeight - r.bottom : 0,
      arriba: r?.top ?? 0, derecha: r ? innerWidth - r.right : 0,
    };
    const elegido = candidatos.find(c => c.lado === this.ladoPreferido)
      ?? candidatos.find(cabe)
      ?? candidatos.reduce((mejor, c) => espacioLibre[c.lado] > espacioLibre[mejor.lado] ? c : mejor, candidatos[0]);
    if (elegido && !this.ladoPreferido) this.ladoPreferido = elegido.lado;
    let x = limitar(r && !visible ? parseFloat(this.dialogo.style.left) || margen : elegido?.x ?? (innerWidth - w) / 2, w, innerWidth);
    let y = limitar(r && !visible ? parseFloat(this.dialogo.style.top) || margen : elegido?.y ?? (innerHeight - h) / 2, h, innerHeight);
    if (this.opciones.evitarControles) {
      const controles = [...document.querySelectorAll(this.opciones.evitarControles)]
        .filter(elemento => !this.dialogo.contains(elemento) && elemento.getClientRects().length)
        .map(elemento => elemento.getBoundingClientRect())
        .filter(c => c.width && c.height && c.right > 0 && c.bottom > 0 && c.left < innerWidth && c.top < innerHeight);
      const maxX = Math.max(margen, innerWidth - w - margen);
      const maxY = Math.max(margen, innerHeight - h - margen);
      const valores = (inicio, fin) => [...new Set([inicio, fin, ...Array.from({ length: Math.ceil((fin - inicio) / 16) + 1 }, (_, i) => Math.min(fin, inicio + i * 16))])];
      const solapamiento = (cx, cy) => controles.reduce((total, c) => {
        const ancho = Math.max(0, Math.min(cx + w + 4, c.right) - Math.max(cx - 4, c.left));
        const alto = Math.max(0, Math.min(cy + h + 4, c.bottom) - Math.max(cy - 4, c.top));
        return total + ancho * alto;
      }, 0);
      let mejor = { x, y, area: solapamiento(x, y), distancia: 0 };
      for (const cx of valores(margen, maxX)) for (const cy of valores(margen, maxY)) {
        const area = solapamiento(cx, cy), distancia = Math.hypot(cx - x, cy - y);
        if (area < mejor.area || (area === mejor.area && distancia < mejor.distancia)) mejor = { x: cx, y: cy, area, distancia };
      }
      ({ x, y } = mejor);
      this.dialogo.dataset.controlesCubiertos = String(mejor.area > 0);
    }
    if (visible && this.objetivo.matches('#visorSimulacion, #metronet-mapa')) {
      // El borde pertenece al mapa, detrás del cartel; nunca a su capa flotante.
      this.marcoMapa = { elemento: this.objetivo, outline: this.objetivo.style.outline, offset: this.objetivo.style.outlineOffset };
      this.objetivo.style.outline = '3px solid var(--tutorial-acento)';
      this.objetivo.style.outlineOffset = '-3px';
      marca.hidden = true;
      x = limitar(r.left + espacio, w, innerWidth);
      y = limitar(r.top + espacio, h, innerHeight);
    }
    this.dialogo.style.left = `${x}px`;
    this.dialogo.style.top = `${y}px`;
    evitarSuperposicion();
  }
  restaurarMarcoMapa() {
    if (!this.marcoMapa) return;
    const { elemento, outline, offset } = this.marcoMapa;
    elemento.style.outline = outline;
    elemento.style.outlineOffset = offset;
    this.marcoMapa = null;
  }
  terminar(notificar = true, completado = false, motivo = 'interrumpido') {
    this.restaurarMarcoMapa();
    if (!this.dialogo) return;
    clearTimeout(this.cierreFinal);
    this.cierreFinal = null;
    window.removeEventListener('resize', this.reposicionar);
    window.removeEventListener('scroll', this.reposicionar, true);
    document.removeEventListener('toggle', this.alAlternar, true);
    cancelAnimationFrame(this.reposicionPendiente);
    if (this.cerrarConEscape) window.removeEventListener('keydown', this.cerrarConEscape);
    document.querySelector(this.opciones.disparador)?.removeAttribute('aria-description');
    if (this.dialogo.open) this.dialogo.close();
    this.dialogo.remove(); this.dialogo = null;
    if (this.panelCerrado && this.togglePanel?.isConnected && this.togglePanel.getAttribute('aria-expanded') === 'true') this.togglePanel.click();
    if (this.panel?.isConnected) this.panel.scrollTop = this.scrollPanel;
    window.scrollTo({ left:this.scrollAnterior[0], top:this.scrollAnterior[1], behavior:'instant' });
    document.body.scrollTop = this.scrollBody;
    if (this.focoAnterior?.isConnected) this.focoAnterior.focus({ preventScroll: true });
    if (notificar) this.alFinalizar(completado, completado ? 'completado' : motivo);
  }
}
