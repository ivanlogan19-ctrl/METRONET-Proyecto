export default class LeyendaPuntosInteres {
  constructor(opciones = {}) {
    this.id = opciones.id ?? 'metronet-leyenda-puntos-interes';
    this.referencias = Array.isArray(opciones.referencias) ? opciones.referencias : [];
    this.contenedorPadre = opciones.contenedorPadre ?? document.body;
    this.integrado = Boolean(opciones.integrado);
    this.titulo = opciones.titulo ?? 'Puntos de interés';
    this.etiquetaBoton = opciones.etiquetaBoton ?? 'Ver puntos de interés';
    this.abiertaInicialmente = Boolean(opciones.abiertaInicialmente);
    this.tituloElemento = null;
    this.elemento = null;
    this.encabezado = null;
    this.contenido = null;
    this.abierta = false;
    this.manejadorClicFuera = null;
    this.retrasoCierre = null;
  }

  crear() {
    this.eliminar();
    this.crearEstilos();

    this.elemento = document.createElement('aside');
    this.elemento.id = this.id;
    this.elemento.className = 'metronet-leyenda-puntos-interes';

    if (this.integrado) {
      this.elemento.classList.add('metronet-leyenda-integrada');
    }

    this.tituloElemento = document.createElement('h2');
    this.tituloElemento.className = 'metronet-leyenda-titulo-seccion';
    this.tituloElemento.textContent = this.titulo;

    this.encabezado = document.createElement('button');
    this.encabezado.type = 'button';
    this.encabezado.className = 'metronet-leyenda-encabezado';
    this.encabezado.setAttribute('aria-expanded', 'false');
    this.encabezado.innerHTML =
      `<span>${this.etiquetaBoton}</span><span class="metronet-leyenda-indicador">▼</span>`;

    this.contenido = document.createElement('div');
    this.contenido.className = 'metronet-leyenda-contenido';
    this.contenido.hidden = true;

    for (const referencia of this.referencias) {
      this.contenido.appendChild(this.crearReferencia(referencia));
    }

    this.encabezado.addEventListener('click', () => this.alternar());

    this.elemento.append(this.encabezado, this.contenido);
    this.contenedorPadre.append(this.tituloElemento, this.elemento);
    if (this.abiertaInicialmente) this.abrir();
  }

  crearReferencia({ color, titulo, descripcion }) {
    const referencia = document.createElement('div');
    referencia.className = 'metronet-leyenda-referencia';

    const marcador = document.createElement('span');
    marcador.className = 'metronet-leyenda-marcador';
    marcador.style.setProperty('--color-marcador', color);

    const texto = document.createElement('div');

    const tituloElemento = document.createElement('div');
    tituloElemento.className = 'metronet-leyenda-titulo';
    tituloElemento.textContent = titulo;

    const descripcionElemento = document.createElement('div');
    descripcionElemento.className = 'metronet-leyenda-descripcion';
    descripcionElemento.textContent = descripcion;

    texto.append(tituloElemento, descripcionElemento);
    referencia.append(marcador, texto);

    return referencia;
  }

  alternar() {
    if (this.abierta) {
      this.cerrar();

      return;
    }

    this.abrir();
  }

  abrir() {
    this.abierta = true;
    this.contenido.hidden = false;
    this.encabezado.setAttribute('aria-expanded', 'true');
    this.elemento.classList.add('metronet-leyenda-abierta');
    this.programarCierreAlClicFuera();
  }

  cerrar() {
    this.abierta = false;
    if (this.contenido) {
      this.contenido.hidden = true;
    }

    this.encabezado?.setAttribute('aria-expanded', 'false');
    this.elemento?.classList.remove('metronet-leyenda-abierta');
    this.cancelarCierreAlClicFuera();
  }

  programarCierreAlClicFuera() {
    this.cancelarCierreAlClicFuera();

    this.manejadorClicFuera = (evento) => {
      if (this.elemento && !this.elemento.contains(evento.target)) {
        this.cerrar();
      }
    };

    this.retrasoCierre = window.setTimeout(() => {
      if (this.abierta && this.manejadorClicFuera) {
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

  eliminar() {
    this.cerrar();
    this.tituloElemento?.remove();
    this.elemento?.remove();
    this.tituloElemento = null;
    this.elemento = null;
    this.encabezado = null;
    this.contenido = null;
    this.abierta = false;
  }

  crearEstilos() {
    const id = 'metronet-leyenda-puntos-interes-estilos';

    if (document.getElementById(id)) {
      return;
    }

    const estilos = document.createElement('style');
    estilos.id = id;
    estilos.textContent = `
      .metronet-leyenda-puntos-interes {
        --alto-maximo-contenido-leyenda: min(430px, calc(100vh - 100px));
        position: fixed;
        z-index: var(--layer-dropdown, 200);
        bottom: 18px;
        left: 18px;
        width: min(238px, calc(100vw - 36px));
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: var(--radius-md, 8px);
        color: var(--text-primary);
        background: var(--panel);
        box-shadow: 0 14px 34px rgb(0 0 0 / .30);
        font-family: var(--font-ui, Inter, ui-sans-serif, system-ui, sans-serif);
      }
      .metronet-leyenda-integrada {
        position: static;
        width: 100%;
        box-sizing: border-box;
      }
      .metronet-leyenda-titulo-seccion {
        margin: 6px 4px -4px;
        color: var(--text-primary);
        font-family: var(--font-tecnica, ui-monospace, monospace);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .metronet-leyenda-encabezado {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 42px;
        padding: 0 13px;
        border: 0;
        border-radius: var(--radius-md, 8px);
        color: inherit;
        background: var(--panel-elevated);
        font: 700 13px var(--font-ui, Inter, ui-sans-serif, system-ui, sans-serif);
        text-align: center;
        cursor: pointer;
      }
      .metronet-leyenda-encabezado:hover,
      .metronet-leyenda-encabezado:focus-visible {
        background: color-mix(in srgb, var(--info-active) 16%, var(--panel-elevated));
      }
      .metronet-leyenda-indicador {
        margin-left: 4px;
        color: var(--text-secondary);
        font-size: 13px;
      }
      .metronet-leyenda-abierta .metronet-leyenda-encabezado {
        border-radius: var(--radius-md, 8px) var(--radius-md, 8px) 0 0;
      }
      .metronet-leyenda-contenido {
        max-height: var(--alto-maximo-contenido-leyenda);
        overflow-y: auto;
        padding: 6px;
        border-top: 1px solid var(--border);
        background: var(--bg-secondary);
      }
      .metronet-leyenda-referencia {
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        padding: 7px 6px;
        border-radius: var(--radius-sm, 5px);
      }
      .metronet-leyenda-referencia:hover { background: var(--panel-elevated); }
      .metronet-leyenda-marcador {
        position: relative;
        display: block;
        width: 16px;
        height: 16px;
        margin: auto;
        border: 2px solid var(--text-primary);
        border-radius: 50%;
        background: var(--panel);
        box-shadow: 0 0 0 1px rgb(0 0 0 / .4);
      }
      .metronet-leyenda-marcador::after {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 7px;
        height: 7px;
        border: 1px solid var(--color-marcador);
        border-radius: 50%;
        background: var(--color-marcador);
        box-shadow: 0 0 0 2px var(--panel);
        content: '';
        transform: translate(-50%, -50%);
      }
      .metronet-leyenda-titulo { font-size: 12px; font-weight: 700; line-height: 1.25; }
      .metronet-leyenda-descripcion { margin-top: 2px; color: var(--text-secondary); font-size: 11px; line-height: 1.3; }
      @media (max-width: 700px) {
        .metronet-leyenda-puntos-interes {
          --alto-maximo-contenido-leyenda: min(330px, calc(100vh - 76px));
          bottom: 10px;
          left: 10px;
          width: min(210px, calc(100vw - 20px));
        }
        .metronet-leyenda-integrada { width: 100%; }
        .metronet-leyenda-titulo-seccion { grid-column: 1 / -1; margin: 4px 2px -2px; }
        .metronet-leyenda-encabezado { padding: 0 8px; font-size: 11px; }
        .metronet-leyenda-indicador { margin-left: 3px; font-size: 11px; }
      }
    `;

    document.head.appendChild(estilos);
  }
}
