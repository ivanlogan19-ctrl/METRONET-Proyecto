const PASOS = [
  ['.metronet-herramientas__barra', 'Herramientas', 'Estos símbolos permiten construir y editar la red. Solo aparecen disponibles los que corresponden al nivel.'],
  ['[data-elegir-herramienta="estaciones"]', 'Estación', 'Este símbolo permite colocar estaciones sobre el mapa.'],
  ['[data-elegir-herramienta="lineas"]', 'Línea', 'Esta herramienta une dos estaciones y crea una línea con su primer tramo.'],
  ['[data-elegir-herramienta="seleccion"]', 'Selección', 'Seleccioná elementos existentes para consultar o editar sus propiedades.'],
  ['[data-guardar]', 'Guardar', 'El disquete guarda el diseño y revisa las condiciones del nivel.'],
  ['.metronet-poi > summary', 'Referencias', 'La estrella permite mostrar referencias geográficas. Su buscador localiza un punto concreto.'],
  ['.metronet-hud > summary', 'Controles y pista', 'Acá podés consultar los controles técnicos o pedir una pista sobre la consigna. El libro abre este tutorial.'],
  ['.metronet-consigna__cabecera', 'Objetivo', 'Este panel resume el objetivo y su progreso. Podés desplegar los detalles cuando los necesites.'],
];

const visible = elemento => elemento && !elemento.disabled && elemento.getClientRects().length && getComputedStyle(elemento).visibility !== 'hidden';

// Recorrido exclusivamente de presentación: no dispara acciones del dominio.
export default class RecorridoInicial {
  constructor(alFinalizar, opciones = {}) { this.alFinalizar = alFinalizar; this.opciones = opciones; }
  iniciar() {
    this.focoAnterior = document.activeElement;
    this.scrollAnterior = [scrollX, scrollY];
    this.panel = document.querySelector('#metronet-panel-controles');
    this.scrollPanel = this.panel?.scrollTop;
    this.togglePanel = document.querySelector('[data-panel-edicion-toggle]');
    this.panelCerrado = this.togglePanel?.getAttribute('aria-expanded') === 'false';
    if (this.panelCerrado) this.togglePanel.click();
    this.pasos = (this.opciones.pasos ?? PASOS).filter(([selector]) => visible(document.querySelector(selector)));
    this.indice = 0;
    this.dialogo = document.createElement('dialog');
    this.dialogo.className = 'metronet-recorrido';
    this.dialogo.setAttribute('aria-labelledby', 'recorrido-titulo');
    this.dialogo.innerHTML = '<div class="metronet-recorrido__marca" aria-hidden="true"></div><p data-recorrido-progreso></p><h2 id="recorrido-titulo"></h2><p data-recorrido-texto></p><div class="metronet-recorrido__acciones"><button type="button" data-recorrido-omitir>Omitir</button><button type="button" data-recorrido-siguiente>Siguiente</button></div>';
    document.body.append(this.dialogo);
    this.dialogo.addEventListener('cancel', e => { e.preventDefault(); this.terminar(); });
    this.dialogo.querySelector('[data-recorrido-omitir]').addEventListener('click', () => this.terminar());
    this.dialogo.querySelector('[data-recorrido-siguiente]').addEventListener('click', () => {
      if (this.indice >= this.pasos.length) this.terminar();
      else { this.indice++; this.mostrar(); }
    });
    this.reposicionar = () => this.posicionar();
    window.addEventListener('resize', this.reposicionar);
    window.addEventListener('scroll', this.reposicionar, true);
    if (this.opciones.interactivo) this.dialogo.show();
    else this.dialogo.showModal();
    this.mostrar();
  }
  mostrar() {
    const paso = this.pasos[this.indice];
    this.objetivo = paso ? document.querySelector(paso[0]) : null;
    this.ladoPreferido = null;
    // Los objetivos pueden ser reemplazados al refrescar la consigna.
    if (paso && !visible(this.objetivo)) { this.indice++; this.mostrar(); return; }
    this.dialogo.dataset.objetivo = paso?.[0] ?? 'fin';
    this.dialogo.querySelector('[data-recorrido-progreso]').textContent = paso ? `RECORRIDO // ${this.indice + 1} DE ${this.pasos.length}` : 'RECORRIDO COMPLETADO';
    this.dialogo.querySelector('h2').textContent = paso?.[1] ?? this.opciones.tituloFinal ?? 'Ahora, tu primera red';
    this.dialogo.querySelector('[data-recorrido-texto]').textContent = paso?.[2] ?? this.opciones.textoFinal ?? 'Ya conocés la pantalla. Ahora vamos a construir tu primera red.';
    this.dialogo.querySelector('[data-recorrido-siguiente]').hidden = Boolean(paso?.[3]);
    this.dialogo.querySelector('[data-recorrido-siguiente]').textContent = paso ? 'Siguiente' : 'Comenzar';
    this.dialogo.querySelector('[data-recorrido-omitir]').hidden = !paso;
    this.objetivo?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    this.posicionar();
    if (!paso?.[3]) this.dialogo.querySelector('[data-recorrido-siguiente]').focus({ preventScroll: true });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.dialogo.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 180 });
  }
  notificar(evento) {
    if (!this.dialogo || this.pasos[this.indice]?.[3] !== evento) return;
    this.indice++;
    if (this.indice >= this.pasos.length && this.opciones.interactivo) this.terminar();
    else this.mostrar();
  }
  posicionar() {
    if (!this.dialogo?.open) return;
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
    if (r && !visible) {
      this.dialogo.style.left = `${limitar(parseFloat(this.dialogo.style.left) || margen, w, innerWidth)}px`;
      this.dialogo.style.top = `${limitar(parseFloat(this.dialogo.style.top) || margen, h, innerHeight)}px`;
      evitarSuperposicion();
      return;
    }
    const candidatos = r ? [
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
    this.dialogo.style.left = `${limitar(elegido?.x ?? (innerWidth - w) / 2, w, innerWidth)}px`;
    this.dialogo.style.top = `${limitar(elegido?.y ?? (innerHeight - h) / 2, h, innerHeight)}px`;
    evitarSuperposicion();
  }
  terminar(notificar = true) {
    if (!this.dialogo) return;
    window.removeEventListener('resize', this.reposicionar);
    window.removeEventListener('scroll', this.reposicionar, true);
    this.dialogo.close(); this.dialogo.remove(); this.dialogo = null;
    if (this.panelCerrado && this.togglePanel?.isConnected && this.togglePanel.getAttribute('aria-expanded') === 'true') this.togglePanel.click();
    if (this.panel?.isConnected) this.panel.scrollTop = this.scrollPanel;
    window.scrollTo({ left:this.scrollAnterior[0], top:this.scrollAnterior[1], behavior:'instant' });
    if (this.focoAnterior?.isConnected) this.focoAnterior.focus({ preventScroll: true });
    if (notificar) this.alFinalizar();
  }
}
