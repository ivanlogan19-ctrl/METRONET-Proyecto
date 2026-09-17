import '../estilos/puntos-interes.css';

const PRIORIDAD_ESTADO = Object.freeze({ OBJETIVO: 0, PENDIENTE: 1, ATENDIDO: 2, COMPLETADO: 3, REFERENCIA: 4 });
const CAMPOS_CERCA_RED = Object.freeze(['puntosCercaRed', 'puntosCercaDeRed', 'puntosCercanos', 'referenciasCercaDeRed', 'cercaDeRed']);
const CAMPOS_AREA_VISIBLE = Object.freeze(['puntosAreaVisible', 'puntosVisibles', 'referenciasAreaVisible', 'enAreaVisible']);
const MAXIMO_RESULTADOS_BUSQUEDA = 8;

export default class PanelPuntosInteres {
  constructor(opciones = {}) {
    this.contenedorPadre = opciones.contenedorPadre ?? null;
    this.alSeleccionar = opciones.alSeleccionar ?? (() => {});
    this.elemento = null;
    this.botonAlternar = null;
    this.contenido = null;
    this.campoBusqueda = null;
    this.contador = null;
    this.contenedorHerramientas = null;
    this.lista = null;
    this.estado = null;
    this.estaAbierto = false;
    this.terminoBusqueda = '';
    this.identificador = `metronet-referencias-${Math.random().toString(36).slice(2, 10)}`;
    this.resumen = this.crearResumen();
  }

  crearResumen() {
    return {
      puntos: [],
      puntosBusqueda: [],
      cantidadObjetivos: 0,
      puntoSeleccionado: null,
    };
  }

  crear() {
    if (!this.contenedorPadre) return;
    this.eliminar();
    this.elemento = document.createElement('section');
    this.elemento.className = 'metronet-panel-puntos-interes';
    this.elemento.setAttribute('aria-label', 'Referencias del mapa');

    const cabecera = document.createElement('div');
    cabecera.className = 'metronet-panel-puntos-cabecera';
    const titulo = document.createElement('h2');
    titulo.className = 'metronet-panel-puntos-titulo';
    titulo.textContent = 'Referencias del mapa';
    const acciones = document.createElement('div');
    acciones.className = 'metronet-panel-puntos-acciones';
    this.contador = document.createElement('span');
    this.contador.className = 'metronet-panel-puntos-contador metronet-solo-lectores';
    this.contador.setAttribute('aria-live', 'polite');
    this.botonAlternar = document.createElement('button');
    this.botonAlternar.type = 'button';
    this.botonAlternar.className = 'metronet-panel-puntos-alternar';
    this.botonAlternar.setAttribute('aria-controls', this.identificador);
    this.botonAlternar.addEventListener('click', () => this.establecerAbierto(!this.estaAbierto));
    acciones.append(this.contador, this.botonAlternar);
    this.contenedorHerramientas = document.createElement('div');
    this.contenedorHerramientas.className = 'metronet-panel-puntos-herramientas';
    this.contenedorHerramientas.setAttribute('aria-label', 'Opciones del mapa');
    cabecera.append(titulo, acciones, this.contenedorHerramientas);

    this.contenido = document.createElement('div');
    this.contenido.id = this.identificador;
    this.contenido.className = 'metronet-panel-puntos-contenido';
    this.contenido.hidden = true;
    const etiquetaBusqueda = document.createElement('label');
    etiquetaBusqueda.className = 'metronet-solo-lectores';
    etiquetaBusqueda.htmlFor = `${this.identificador}-busqueda`;
    etiquetaBusqueda.textContent = 'Buscar referencias del mapa';
    this.campoBusqueda = document.createElement('input');
    this.campoBusqueda.id = `${this.identificador}-busqueda`;
    this.campoBusqueda.className = 'metronet-panel-puntos-busqueda';
    this.campoBusqueda.type = 'search';
    this.campoBusqueda.placeholder = 'Buscar referencia';
    this.campoBusqueda.autocomplete = 'off';
    this.campoBusqueda.setAttribute('aria-controls', `${this.identificador}-lista`);
    this.campoBusqueda.addEventListener('input', () => {
      this.terminoBusqueda = this.campoBusqueda.value;
      this.renderizarLista();
    });
    this.lista = document.createElement('div');
    this.lista.id = `${this.identificador}-lista`;
    this.lista.className = 'metronet-panel-puntos-lista';
    this.lista.setAttribute('aria-label', 'Resultados de referencias');
    this.estado = document.createElement('p');
    this.estado.className = 'metronet-panel-puntos-estado-contexto';
    this.estado.setAttribute('aria-live', 'polite');
    this.contenido.append(etiquetaBusqueda, this.campoBusqueda, this.estado, this.lista);
    this.elemento.append(cabecera, this.contenido);
    this.contenedorPadre.appendChild(this.elemento);
    this.establecerAbierto(false);
    this.renderizar();
  }

  obtenerContenedorHerramientas() {
    return this.contenedorHerramientas;
  }

  actualizar(resumen = {}) {
    this.resumen = {
      ...this.crearResumen(),
      ...resumen,
      puntos: Array.isArray(resumen.puntos) ? resumen.puntos : [],
      puntosBusqueda: Array.isArray(resumen.puntosBusqueda) ? resumen.puntosBusqueda : [],
      cantidadObjetivos: Number(resumen.cantidadObjetivos) || 0,
      puntoSeleccionado: resumen.puntoSeleccionado ?? null,
    };
    this.renderizar();
  }

  establecerAbierto(estaAbierto) {
    this.estaAbierto = Boolean(estaAbierto);
    if (!this.contenido || !this.botonAlternar) return;
    this.contenido.hidden = !this.estaAbierto;
    this.botonAlternar.setAttribute('aria-expanded', String(this.estaAbierto));
    this.botonAlternar.setAttribute('aria-label', this.estaAbierto ? 'Cerrar referencias del mapa' : 'Abrir referencias del mapa');
    this.botonAlternar.textContent = this.estaAbierto ? '▲' : '▼';
    if (this.estaAbierto) this.renderizarLista();
  }

  renderizar() {
    if (!this.elemento || !this.contador) return;
    const cantidad = this.obtenerPuntosContextuales().length;
    const cantidadObjetivos = this.resumen.cantidadObjetivos;
    this.contador.textContent = cantidadObjetivos
      ? `${cantidadObjetivos} objetivo${cantidadObjetivos === 1 ? '' : 's'}`
      : `${cantidad} referencia${cantidad === 1 ? '' : 's'}`;
    if (this.estaAbierto) this.renderizarLista();
  }

  renderizarLista() {
    if (!this.lista || !this.estado) return;
    const grupos = this.tieneBusquedaActiva()
      ? this.obtenerGruposBusqueda()
      : this.obtenerGruposContextuales().map((grupo) => ({
        ...grupo,
        puntos: this.filtrarPuntos(grupo.puntos),
      })).filter((grupo) => grupo.puntos.length);
    this.lista.replaceChildren();
    if (!grupos.length) {
      this.estado.textContent = this.obtenerMensajeVacio();
      return;
    }
    this.estado.textContent = this.obtenerMensajeContexto(grupos);
    grupos.forEach((grupo) => this.lista.appendChild(this.crearGrupo(grupo)));
  }

  crearGrupo(grupo) {
    const seccion = document.createElement('section');
    seccion.className = 'metronet-panel-puntos-grupo';
    const titulo = document.createElement('h3');
    titulo.className = 'metronet-panel-puntos-subtitulo';
    titulo.textContent = grupo.titulo;
    const elementos = document.createElement('div');
    elementos.className = 'metronet-panel-puntos-elementos';
    elementos.setAttribute('aria-label', grupo.titulo);
    grupo.puntos.forEach((punto) => elementos.appendChild(this.crearItem(punto)));
    seccion.append(titulo, elementos);
    return seccion;
  }

  crearItem(punto) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = `metronet-panel-puntos-item ${this.obtenerClaseEstado(punto)}`;
    boton.dataset.idPunto = String(punto.id ?? '');
    if (punto.seleccionado) boton.setAttribute('aria-current', 'true');
    const identidad = document.createElement('span');
    identidad.className = 'metronet-panel-puntos-identidad';
    const icono = document.createElement('span');
    icono.className = 'metronet-panel-puntos-icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.textContent = this.obtenerIconoEstado(punto.estado);
    const texto = document.createElement('span');
    const nombre = document.createElement('span');
    nombre.className = 'metronet-panel-puntos-nombre';
    nombre.textContent = punto.nombre || 'Referencia sin nombre';
    const tipo = document.createElement('span');
    tipo.className = 'metronet-panel-puntos-tipo';
    tipo.textContent = punto.tipo || 'Punto de interés';
    texto.append(nombre, tipo);
    identidad.append(icono, texto);
    const estado = document.createElement('span');
    estado.className = 'metronet-panel-puntos-estado';
    estado.textContent = this.obtenerEtiquetaEstado(punto.estado);
    boton.append(identidad, estado);
    boton.addEventListener('click', () => {
      this.alSeleccionar(punto);
      this.establecerAbierto(false);
    });
    return boton;
  }

  obtenerGruposContextuales() {
    const cercaDeRed = this.obtenerPuntosResumen(CAMPOS_CERCA_RED);
    const areaVisible = this.obtenerPuntosResumen(CAMPOS_AREA_VISIBLE);
    const tieneContexto = cercaDeRed.encontrado || areaVisible.encontrado;
    if (!tieneContexto) {
      return [{ titulo: 'Referencias disponibles', puntos: this.ordenarPuntos(this.resumen.puntos) }];
    }
    const clavesIncluidas = new Set();
    const grupos = [];
    if (cercaDeRed.puntos.length) {
      const puntos = this.ordenarPuntos(this.sinDuplicados(cercaDeRed.puntos, clavesIncluidas));
      if (puntos.length) grupos.push({ titulo: 'Cerca de tu red', puntos });
    }
    if (areaVisible.puntos.length) {
      const puntos = this.ordenarPuntos(this.sinDuplicados(areaVisible.puntos, clavesIncluidas));
      if (puntos.length) grupos.push({ titulo: 'En el área visible', puntos });
    }
    if (!grupos.length) return [{ titulo: 'Referencias disponibles', puntos: [] }];
    return grupos;
  }

  obtenerGruposBusqueda() {
    const catalogo = this.obtenerCatalogoBusqueda();
    const coincidencias = this.ordenarPuntos(this.filtrarPuntos(catalogo));

    if (!coincidencias.length) {
      return [];
    }

    return [{
      titulo: 'Resultados de la búsqueda',
      puntos: coincidencias.slice(0, MAXIMO_RESULTADOS_BUSQUEDA),
      cantidadTotal: coincidencias.length,
    }];
  }

  obtenerCatalogoBusqueda() {
    const puntos = this.resumen.puntosBusqueda.length
      ? this.resumen.puntosBusqueda
      : this.obtenerPuntosContextuales();

    return this.sinDuplicados(puntos, new Set());
  }

  obtenerPuntosResumen(campos) {
    for (const campo of campos) {
      const valor = this.resumen[campo];
      if (Array.isArray(valor)) return { encontrado: true, puntos: valor };
      if (valor && Array.isArray(valor.puntos)) return { encontrado: true, puntos: valor.puntos };
    }
    return { encontrado: false, puntos: [] };
  }

  obtenerPuntosContextuales() {
    const claves = new Set();
    return this.obtenerGruposContextuales()
      .flatMap((grupo) => grupo.puntos)
      .filter((punto) => this.sinDuplicados([punto], claves).length);
  }

  sinDuplicados(puntos, claves) {
    return puntos.filter((punto) => {
      const nombre = this.normalizarTexto(punto.nombre);
      const tipo = this.normalizarTexto(punto.tipo);
      const barrio = this.normalizarTexto(punto.barrio ?? punto.barrioGeografico);
      const clave = nombre ? `${nombre}|${tipo}|${barrio}` : `id:${String(punto.id ?? '')}`;
      if (claves.has(clave)) return false;
      claves.add(clave);
      return true;
    });
  }

  filtrarPuntos(puntos) {
    const termino = this.normalizarTexto(this.terminoBusqueda);
    if (!termino) return puntos;
    return puntos.filter((punto) => this.normalizarTexto([
      punto.nombre,
      punto.tipo,
      punto.descripcion,
      punto.barrio,
      punto.zona,
      this.obtenerEtiquetaEstado(punto.estado),
    ].filter(Boolean).join(' ')).includes(termino));
  }

  tieneBusquedaActiva() {
    return Boolean(this.normalizarTexto(this.terminoBusqueda));
  }

  normalizarTexto(texto) {
    return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  }

  obtenerMensajeContexto(grupos) {
    const cantidad = grupos.reduce((total, grupo) => total + grupo.puntos.length, 0);
    if (this.tieneBusquedaActiva() && cantidad) {
      const cantidadTotal = grupos.reduce((total, grupo) => total + (grupo.cantidadTotal ?? grupo.puntos.length), 0);
      const sufijo = cantidadTotal > cantidad ? ` Mostrando ${cantidad} de ${cantidadTotal}.` : '';
      return `${cantidadTotal} coincidencia${cantidadTotal === 1 ? '' : 's'} encontrada${cantidadTotal === 1 ? '' : 's'}.${sufijo}`;
    }
    if (grupos.some((grupo) => grupo.titulo === 'Cerca de tu red')) return 'Mostrando referencias relacionadas con tu red y la vista actual.';
    if (grupos.some((grupo) => grupo.titulo === 'En el área visible')) return 'Mostrando referencias del área visible.';
    return 'Elegí una referencia para ubicarla en el mapa.';
  }

  obtenerMensajeVacio() {
    if (this.tieneBusquedaActiva()) return 'No hay referencias que coincidan en el catálogo del mapa.';
    if (this.resumen.haySeleccion) return 'No hay referencias para la selección y el nivel de zoom actual.';
    return 'Acercá el mapa o seleccioná una zona, un barrio o una red para ver referencias relevantes.';
  }

  ordenarPuntos(puntos) {
    return [...puntos].sort((primero, segundo) => {
      const prioridadPrimero = PRIORIDAD_ESTADO[primero.estado] ?? PRIORIDAD_ESTADO.REFERENCIA;
      const prioridadSegundo = PRIORIDAD_ESTADO[segundo.estado] ?? PRIORIDAD_ESTADO.REFERENCIA;
      return prioridadPrimero - prioridadSegundo || String(primero.nombre).localeCompare(String(segundo.nombre), 'es');
    });
  }

  obtenerClaseEstado(punto) {
    const clases = [];
    if (punto.seleccionado) clases.push('es-seleccionado');
    if (punto.estado === 'OBJETIVO' || punto.estado === 'PENDIENTE') clases.push('es-objetivo');
    if (punto.estado === 'ATENDIDO') clases.push('estado-atendido');
    if (punto.estado === 'COMPLETADO') clases.push('estado-completado');
    return clases.join(' ');
  }

  obtenerIconoEstado(estado) {
    return ({ OBJETIVO: '◆', PENDIENTE: '◇', ATENDIDO: '•', COMPLETADO: '✓' })[estado] ?? '•';
  }

  obtenerEtiquetaEstado(estado) {
    return ({ OBJETIVO: 'Objetivo', PENDIENTE: 'Pendiente', ATENDIDO: 'Atendido', COMPLETADO: 'Completado' })[estado] ?? 'Referencia';
  }

  eliminar() {
    this.elemento?.remove();
    this.elemento = null;
    this.botonAlternar = null;
    this.contenido = null;
    this.campoBusqueda = null;
    this.contador = null;
    this.contenedorHerramientas = null;
    this.lista = null;
    this.estado = null;
  }
}
