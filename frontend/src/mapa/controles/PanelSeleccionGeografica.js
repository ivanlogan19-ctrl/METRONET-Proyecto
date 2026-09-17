import '../estilos/seleccion-geografica.css';

export default class PanelSeleccionGeografica {
  constructor(opciones = {}) {
    this.contenedorPadre = opciones.contenedorPadre ?? null;
    this.elemento = null;
    this.manejadorClicFuera = null;
    this.retrasoCierre = null;
    this.contexto = null;
  }

  crear() {
    if (!this.contenedorPadre || this.elemento) return;
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-seleccion-geografica';
    this.elemento.hidden = true;
    this.elemento.setAttribute('role', 'dialog');
    this.elemento.setAttribute('aria-label', 'Información de la selección geográfica');
    this.contenedorPadre.appendChild(this.elemento);
  }

  mostrar({ tipo, nombres, resumen } = {}) {
    const seleccion = Array.isArray(nombres) ? nombres.filter(Boolean) : [];
    if (!seleccion.length) {
      this.ocultar();
      return;
    }
    this.crear();
    if (!this.elemento) return;
    this.contexto = { tipo, nombres: seleccion };
    this.renderizarContenido(resumen);
    this.elemento.hidden = false;
    this.programarCierreAlClicFuera();
  }

  actualizar(resumen) {
    if (!this.elemento || this.elemento.hidden || !this.contexto) return;
    this.renderizarContenido(resumen);
  }

  renderizarContenido(resumen) {
    if (!this.elemento || !this.contexto) return;
    const { tipo, nombres: seleccion } = this.contexto;
    const esBarrio = tipo === 'barrio';
    const titulo = esBarrio ? 'Información del barrio' : 'Información de la zona';
    const puntos = Array.isArray(resumen?.puntos) ? resumen.puntos : [];
    const cantidadReferencias = Number.isFinite(resumen?.cantidadPuntos) ? resumen.cantidadPuntos : puntos.length;
    const cantidadVisibles = Number.isFinite(resumen?.cantidadReferenciasVisibles)
      ? resumen.cantidadReferenciasVisibles
      : 0;
    const estaciones = new Set(puntos.map((punto) => punto.estacionMasCercana?.nombre).filter(Boolean));
    const cabecera = document.createElement('div');
    cabecera.className = 'metronet-seleccion-geografica__cabecera';
    const encabezado = document.createElement('h2');
    encabezado.className = 'metronet-seleccion-geografica__titulo';
    encabezado.textContent = titulo;
    const botonCerrar = document.createElement('button');
    botonCerrar.type = 'button';
    botonCerrar.className = 'metronet-seleccion-geografica__cerrar';
    botonCerrar.setAttribute('aria-label', 'Cerrar información de la selección');
    botonCerrar.textContent = '×';
    botonCerrar.addEventListener('click', () => this.ocultar());
    cabecera.append(encabezado, botonCerrar);
    const nombresSeleccion = document.createElement('p');
    nombresSeleccion.className = 'metronet-seleccion-geografica__nombres';
    nombresSeleccion.textContent = this.formatearSeleccion(seleccion);
    const detalle = document.createElement('p');
    detalle.className = 'metronet-seleccion-geografica__detalle';
    detalle.textContent = cantidadReferencias
      ? `${cantidadReferencias} referencia${cantidadReferencias === 1 ? '' : 's'} asociada${cantidadReferencias === 1 ? '' : 's'} a la selección.`
      : 'No hay puntos de interés asociados a esta selección.';
    const indicadores = document.createElement('p');
    indicadores.className = 'metronet-seleccion-geografica__indicadores';
    const partes = [`${cantidadVisibles} visible${cantidadVisibles === 1 ? '' : 's'} con este zoom`];
    if (estaciones.size) {
      partes.push(`${estaciones.size} estación${estaciones.size === 1 ? '' : 'es'} relacionada${estaciones.size === 1 ? '' : 's'}`);
    }
    indicadores.textContent = partes.join(' · ');
    this.elemento.replaceChildren(cabecera, nombresSeleccion, detalle, indicadores);
  }

  formatearSeleccion(nombres) {
    const visibles = nombres.slice(0, 3).map((nombre) => this.formatearNombre(nombre));
    if (nombres.length > visibles.length) {
      visibles.push(`y ${nombres.length - visibles.length} más`);
    }
    return visibles.join(', ');
  }

  formatearNombre(nombre) {
    return String(nombre)
      .trim()
      .toLocaleLowerCase('es-UY')
      .replace(/(^|[\s-])([a-záéíóúüñ])/giu, (coincidencia, prefijo, letra) => `${prefijo}${letra.toLocaleUpperCase('es-UY')}`);
  }

  programarCierreAlClicFuera() {
    this.cancelarCierreAlClicFuera();
    this.manejadorClicFuera = (evento) => {
      if (this.elemento && !this.elemento.hidden && !this.elemento.contains(evento.target)) {
        this.ocultar();
      }
    };
    this.retrasoCierre = window.setTimeout(() => {
      if (this.manejadorClicFuera) {
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

  ocultar() {
    this.cancelarCierreAlClicFuera();
    if (this.elemento) this.elemento.hidden = true;
    this.contexto = null;
  }

  eliminar() {
    this.cancelarCierreAlClicFuera();
    this.elemento?.remove();
    this.elemento = null;
    this.contenedorPadre = null;
    this.contexto = null;
  }
}
