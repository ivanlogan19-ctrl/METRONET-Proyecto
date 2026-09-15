export default class LeyendaPuntosInteres {
  constructor(opciones = {}) {
    this.id = opciones.id ?? 'metronet-leyenda-puntos-interes';
    this.referencias = Array.isArray(opciones.referencias) ? opciones.referencias : [];
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

    this.encabezado = document.createElement('button');
    this.encabezado.type = 'button';
    this.encabezado.className = 'metronet-leyenda-encabezado';
    this.encabezado.setAttribute('aria-expanded', 'false');
    this.encabezado.innerHTML =
      '<span>Referencias</span><span class="metronet-leyenda-indicador">▾</span>';

    this.contenido = document.createElement('div');
    this.contenido.className = 'metronet-leyenda-contenido';
    this.contenido.hidden = true;

    for (const referencia of this.referencias) {
      this.contenido.appendChild(this.crearReferencia(referencia));
    }

    this.encabezado.addEventListener('click', () => this.alternar());

    this.elemento.append(this.encabezado, this.contenido);
    document.body.appendChild(this.elemento);
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
    this.elemento?.remove();
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
        position: fixed;
        z-index: 2500;
        bottom: 18px;
        left: 18px;
        width: min(238px, calc(100vw - 36px));
        overflow: hidden;
        border: 1px solid rgba(141, 215, 247, 0.26);
        border-radius: 14px;
        background: rgba(7, 23, 37, 0.84);
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(14px) saturate(130%);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .metronet-leyenda-encabezado {
        display: flex;
        align-items: center;
        width: 100%;
        min-height: 42px;
        padding: 0 13px;
        border: 0;
        border-radius: 13px;
        background: linear-gradient(135deg, #145a7b, #0b79ae);
        color: inherit;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-align: center;
        cursor: pointer;
        transition: background 0.16s ease, transform 0.16s ease, filter 0.16s ease;
      }

      .metronet-leyenda-encabezado:hover {
        background: linear-gradient(135deg, #1a6d91, #1595cf);
        filter: brightness(1.05);
        transform: translateY(-1px);
      }

      .metronet-leyenda-indicador {
        position: absolute;
        right: 13px;
        color: #ffffff;
        font-size: 13px;
        transition: transform 0.16s ease;
      }

      .metronet-leyenda-abierta .metronet-leyenda-encabezado {
        border-radius: 13px 13px 0 0;
      }

      .metronet-leyenda-abierta .metronet-leyenda-indicador {
        transform: rotate(180deg);
      }

      .metronet-leyenda-contenido {
        max-height: min(430px, calc(100vh - 100px));
        overflow-y: auto;
        padding: 6px;
        border-top: 1px solid rgba(141, 215, 247, 0.16);
        background: rgba(4, 18, 29, 0.93);
      }

      .metronet-leyenda-referencia {
        display: grid;
        grid-template-columns: 24px 1fr;
        gap: 8px;
        align-items: center;
        padding: 7px 6px;
        border-radius: 9px;
      }

      .metronet-leyenda-referencia:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .metronet-leyenda-marcador {
        position: relative;
        display: block;
        width: 16px;
        height: 16px;
        margin: auto;
        border: 2px solid #e8f8ff;
        border-radius: 50%;
        background: #061d32;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
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
        box-shadow: 0 0 0 2px rgba(6, 29, 50, 0.8);
        content: '';
        transform: translate(-50%, -50%);
      }

      .metronet-leyenda-titulo {
        font-size: 12px;
        font-weight: 600;
        line-height: 1.25;
      }

      .metronet-leyenda-descripcion {
        margin-top: 2px;
        color: #a9c9d9;
        font-size: 11px;
        line-height: 1.3;
      }

      @media (max-width: 700px) {
        .metronet-leyenda-puntos-interes {
          bottom: 10px;
          left: 10px;
          width: min(210px, calc(100vw - 20px));
        }

        .metronet-leyenda-contenido {
          max-height: min(330px, calc(100vh - 76px));
        }

        .metronet-leyenda-encabezado {
          padding: 0 8px;
          font-size: 11px;
        }

        .metronet-leyenda-indicador {
          right: 8px;
          font-size: 11px;
        }
      }
    `;

    document.head.appendChild(estilos);
  }
}
