export default class PanelDinamico {
  constructor(opciones = {}) {
    this.id = opciones.id ?? 'metronet-panel';

    this.titulo = opciones.titulo ?? '';

    this.ancho = opciones.ancho ?? 130;

    this.posicion = opciones.posicion ?? {
      top: 55,
      right: 8,
    };

    this.contenedorPadre = opciones.contenedorPadre ?? document.body;

    this.integrado = Boolean(opciones.integrado);

    this.elemento = null;

    this.encabezado = null;

    this.contenido = null;

    this.abierto = false;

    this.manejadorClicFuera = null;

    this.retrasoCierre = null;
  }

  crear() {
    this.eliminar();

    this.crearEstilos();

    const panel = document.createElement('div');

    panel.id = this.id;

    panel.className = 'metronet-panel-dinamico';

    if (this.integrado) {
      panel.classList.add('metronet-panel-integrado');
    }

    panel.controladorPanelDinamico = this;

    panel.style.width = `${this.ancho}px`;

    panel.style.top = `${this.posicion.top}px`;

    panel.style.right = `${this.posicion.right}px`;

    const encabezado = document.createElement('button');

    encabezado.type = 'button';

    encabezado.className = 'metronet-panel-encabezado';

    encabezado.textContent = `${this.titulo} ▼`;

    const contenido = document.createElement('div');

    contenido.className = 'metronet-panel-contenido';

    panel.appendChild(encabezado);

    panel.appendChild(contenido);

    this.contenedorPadre.appendChild(panel);

    this.elemento = panel;

    this.encabezado = encabezado;

    this.contenido = contenido;

    this.contenido.style.display = 'none';

    this.encabezado.addEventListener('click', () => {
      this.alternarContenido();
    });

    return panel;
  }

  establecerTitulo(titulo) {
    this.titulo = titulo;

    this.actualizarEncabezado();
  }

  actualizarEncabezado() {
    if (!this.encabezado) {
      return;
    }

    this.encabezado.textContent = this.abierto ? `${this.titulo} ▲` : `${this.titulo} ▼`;
  }

  establecerContenido(contenido) {
    if (!this.contenido) {
      return;
    }

    this.contenido.innerHTML = contenido;
  }

  agregarElemento(elemento) {
    if (!this.contenido) {
      return;
    }

    this.contenido.appendChild(elemento);
  }

  mostrar() {
    if (!this.elemento) {
      return;
    }

    this.elemento.style.display = 'block';
  }

  ocultar() {
    if (!this.elemento) {
      return;
    }

    this.cerrarContenido();

    this.elemento.style.display = 'none';
  }

  alternar() {
    if (!this.elemento) {
      return;
    }

    const oculto = this.elemento.style.display === 'none';

    if (oculto) {
      this.mostrar();
    } else {
      this.ocultar();
    }
  }

  alternarContenido() {
    if (!this.contenido || !this.elemento) {
      return;
    }

    if (this.abierto) {
      this.cerrarContenido();

      return;
    }

    this.abrirContenido();
  }

  abrirContenido() {
    if (!this.contenido || !this.elemento) {
      return;
    }

    this.cerrarOtrosPaneles();

    this.contenido.style.display = 'block';

    this.elemento.classList.add('metronet-panel-abierto');

    this.abierto = true;

    this.actualizarEncabezado();

    this.ajustarPosicionPantalla();

    this.programarCierreAlClicFuera();
  }

  cerrarContenido() {
    if (!this.contenido) {
      return;
    }

    this.contenido.style.display = 'none';

    this.elemento?.classList.remove('metronet-panel-abierto');

    this.abierto = false;

    this.actualizarEncabezado();

    this.cancelarCierreAlClicFuera();
  }

  cerrarOtrosPaneles() {
    const paneles = document.querySelectorAll('.metronet-panel-dinamico');

    paneles.forEach((panel) => {
      if (panel === this.elemento) {
        return;
      }

      panel.controladorPanelDinamico?.cerrarContenido();
    });
  }

  programarCierreAlClicFuera() {
    this.cancelarCierreAlClicFuera();

    this.manejadorClicFuera = (evento) => {
      if (this.elemento && !this.elemento.contains(evento.target)) {
        this.cerrarContenido();
      }
    };

    this.retrasoCierre = window.setTimeout(() => {
      if (this.abierto && this.manejadorClicFuera) {
        document.addEventListener('pointerdown', this.manejadorClicFuera, true);
      }

      this.retrasoCierre = null;
    }, 0);
  }

  cancelarCierreAlClicFuera() {
    if (this.retrasoCierre !== null) {
      window.clearTimeout(this.retrasoCierre);

      this.retrasoCierre = null;
    }

    if (this.manejadorClicFuera) {
      document.removeEventListener('pointerdown', this.manejadorClicFuera, true);

      this.manejadorClicFuera = null;
    }
  }

  ajustarPosicionPantalla() {
    if (!this.elemento || this.integrado) {
      return;
    }

    const rect = this.elemento.getBoundingClientRect();

    const margen = 8;

    let top = rect.top;

    let right = window.innerWidth - rect.right;

    if (rect.bottom > window.innerHeight - margen) {
      top = window.innerHeight - rect.height - margen;
    }

    if (top < margen) {
      top = margen;
    }

    if (rect.right > window.innerWidth - margen) {
      right = margen;
    }

    if (right < margen) {
      right = margen;
    }

    this.elemento.style.top = `${top}px`;

    this.elemento.style.right = `${right}px`;

    this.elemento.style.left = 'auto';
  }

  mover(top, right) {
    this.posicion = {
      top,
      right,
    };

    if (!this.elemento) {
      return;
    }

    this.elemento.style.top = `${top}px`;

    this.elemento.style.right = `${right}px`;

    this.elemento.style.left = 'auto';
  }

  cambiarAncho(ancho) {
    this.ancho = ancho;

    if (!this.elemento) {
      return;
    }

    this.elemento.style.width = `${ancho}px`;
  }

  eliminar() {
    this.cancelarCierreAlClicFuera();

    if (this.elemento) {
      this.elemento.controladorPanelDinamico = null;

      this.elemento.remove();

      this.elemento = null;

      this.encabezado = null;

      this.contenido = null;

      this.abierto = false;
    }
  }

  crearEstilos() {
    const estiloAnterior = document.getElementById('metronet-panel-dinamico-styles');

    if (estiloAnterior) {
      estiloAnterior.remove();
    }

    const style = document.createElement('style');

    style.id = 'metronet-panel-dinamico-styles';

    style.textContent = `

            .metronet-panel-dinamico {

                position:
                    fixed;

                z-index:
                    1000;

                box-sizing:
                    border-box;

                width:
                    156px;

                background:
                    rgba(
                        7,
                        23,
                        37,
                        0.84
                    );

                border:
                    1px solid rgba(155, 200, 255, 0.26);

                border-radius:
                    14px;

                color:
                    #F8FBFF;

                font-family:
                    Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

                box-shadow:
                    0 14px 34px
                    rgba(
                        0,
                        0,
                        0,
                        0.30
                    ),
                    inset 0 1px 0
                    rgba(255, 255, 255, 0.08);

                backdrop-filter:
                    blur(14px)
                    saturate(130%);

                overflow:
                    visible;
            }


            .metronet-panel-integrado {

                position:
                    static !important;

                width:
                    100% !important;

                min-width:
                    0;
            }


            .metronet-panel-encabezado {

                box-sizing:
                    border-box;

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    center;

                width:
                    100%;

                height:
                    42px;

                padding:
                    0 12px;

                border:
                    none;

                border-radius:
                    13px;

                background:
                    linear-gradient(
                        135deg,
                        #145A7B,
                        #0B79AE
                    );

                color:
                    #F8FBFF;

                font-family:
                    Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

                font-size:
                    13px;

                font-weight:
                    600;

                text-align:
                    center;

                letter-spacing:
                    0.01em;

                cursor:
                    pointer;

                white-space:
                    nowrap;

                transition:
                    background 0.16s ease,
                    filter 0.16s ease;
            }


            .metronet-panel-dinamico.metronet-panel-abierto
            .metronet-panel-encabezado {

                border-radius:
                    13px 13px 0 0;
            }


            .metronet-panel-encabezado:hover {

                background:
                    linear-gradient(
                        135deg,
                        #1A6D91,
                        #1595CF
                    );

                filter:
                    brightness(1.05);
            }


            .metronet-panel-contenido {

                box-sizing:
                    border-box;

                width:
                    100%;

                padding:
                    7px;

                background:
                    rgba(
                        4,
                        18,
                        29,
                        0.93
                    );

                border-top:
                    1px solid rgba(155, 200, 255, 0.16);

                border-radius:
                    0 0 13px 13px;

                overflow:
                    hidden;
            }


            @media (max-width: 700px) {

                .metronet-panel-dinamico {

                    width:
                        calc(50% - 12px) !important;

                    border-radius:
                        12px;
                }

                #metronet-selector-zonas {

                    top:
                        92px !important;

                    right:
                        calc(50% + 4px) !important;
                }

                #metronet-selector-barrios {

                    top:
                        92px !important;

                    right:
                        8px !important;
                }

                .metronet-panel-encabezado {

                    font-size:
                        11px;

                    padding:
                        0 8px;
                }

                .metronet-panel-integrado {

                    width:
                        100% !important;
                }
            }
        `;

    document.head.appendChild(style);
  }
}
