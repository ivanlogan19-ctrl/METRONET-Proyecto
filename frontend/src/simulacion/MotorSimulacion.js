const VELOCIDADES_ADMITIDAS = Object.freeze([0.5, 1, 2, 4]);
const DURACION_VISUAL_MINIMA = 5_000;
const DURACION_VISUAL_MAXIMA = 18_000;
const FACTOR_DURACION_VISUAL = 300;

export default class MotorSimulacion {
  constructor(diseno) {
    this.diseno = diseno ?? {};
    this.rutas = this.crearRutas();
    this.estado = 'DETENIDA';
    this.velocidad = 1;
    this.duracion = 60;
    this.duracionVisual = this.calcularDuracionVisual(this.duracion);
    this.marcaInicio = null;
    this.tiempoAcumulado = 0;
    this.progreso = 0;
    this.finalizada = false;
  }

  iniciar({ velocidad = 1, duracion = 60, ahora = 0 } = {}) {
    this.velocidad = normalizarVelocidad(velocidad);
    this.duracion = normalizarDuracion(duracion);
    this.duracionVisual = this.calcularDuracionVisual(this.duracion);
    this.marcaInicio = Number(ahora);
    this.tiempoAcumulado = 0;
    this.progreso = 0;
    this.estado = 'EN_CURSO';
    this.finalizada = false;
    return this.obtenerEstado();
  }

  pausar(ahora = 0) {
    if (this.estado !== 'EN_CURSO') return this.obtenerEstado();
    this.actualizar(ahora);
    if (this.estado !== 'EN_CURSO') return this.obtenerEstado();
    this.tiempoAcumulado = this.progreso;
    this.estado = 'PAUSADA';
    this.marcaInicio = null;
    return this.obtenerEstado();
  }

  reanudar(ahora = 0) {
    if (this.estado !== 'PAUSADA') return this.obtenerEstado();
    this.marcaInicio = Number(ahora);
    this.estado = 'EN_CURSO';
    return this.obtenerEstado();
  }

  detener() {
    this.marcaInicio = null;
    this.tiempoAcumulado = 0;
    this.progreso = 0;
    this.estado = 'DETENIDA';
    this.finalizada = false;
    return this.obtenerEstado();
  }

  reiniciar(ahora = 0) {
    return this.iniciar({ velocidad: this.velocidad, duracion: this.duracion, ahora });
  }

  establecerVelocidad(velocidad, ahora = 0) {
    const nuevaVelocidad = normalizarVelocidad(velocidad);
    if (this.estado === 'EN_CURSO') {
      this.actualizar(ahora);
      this.tiempoAcumulado = this.progreso;
    }
    this.velocidad = nuevaVelocidad;
    this.marcaInicio = this.estado === 'EN_CURSO' ? Number(ahora) : this.marcaInicio;
    return this.obtenerEstado();
  }

  actualizar(ahora = 0) {
    if (this.estado !== 'EN_CURSO') return this.obtenerEstado();
    const transcurrido = Math.max(0, Number(ahora) - Number(this.marcaInicio ?? ahora));
    const avance = (transcurrido * this.velocidad) / this.duracionVisual;
    this.progreso = Math.min(1, this.tiempoAcumulado + avance);
    if (this.progreso >= 1) {
      this.tiempoAcumulado = 1;
      this.marcaInicio = null;
      this.estado = 'FINALIZADA';
      this.finalizada = true;
    }
    return this.obtenerEstado();
  }

  obtenerEstado() {
    const unidades = this.rutas.map((ruta, indice) => this.crearEstadoUnidad(ruta, indice));
    const metroActivo = unidades.find((unidad) => unidad.transitable) ?? null;
    return {
      estado: this.estado,
      velocidad: this.velocidad,
      duracion: this.duracion,
      progreso: this.progreso,
      tiempoTranscurrido: Math.round(this.progreso * this.duracion),
      tiempoRestante: Math.max(0, this.duracion - Math.round(this.progreso * this.duracion)),
      unidades,
      metroActivo,
      finalizada: this.finalizada,
    };
  }

  crearRutas() {
    const estacionesPorNombre = new Map(this.obtenerEstaciones().map((estacion) => [estacion.nombre, estacion]));
    return this.obtenerUnidadesMetro().map((unidad) => ({
      idTren: unidad.idTren,
      nombreLinea: unidad.nombreLinea,
      ruta: construirRuta(this.obtenerTramos(), estacionesPorNombre, unidad.nombreLinea),
    }));
  }

  crearEstadoUnidad(unidad, indice) {
    const nombresEstaciones = unidad.ruta.map((estacion) => estacion.nombre);
    const cantidadTramos = Math.max(0, nombresEstaciones.length - 1);
    const desfaseInicial = cantidadTramos && this.rutas.length > 1 ? Math.min(indice * 0.08, 0.3) : 0;
    const progresoRuta = cantidadTramos
      ? Math.min(1, Math.max(0, (this.progreso - desfaseInicial) / (1 - desfaseInicial)))
      : 0;
    const indiceTramo = cantidadTramos ? Math.min(Math.floor(progresoRuta * cantidadTramos), cantidadTramos - 1) : -1;
    const esFinal = cantidadTramos > 0 && progresoRuta >= 1;
    const estacionActual = esFinal
      ? nombresEstaciones.at(-1)
      : (nombresEstaciones[indiceTramo] ?? nombresEstaciones[0] ?? null);
    const proximaEstacion = esFinal ? null : (nombresEstaciones[indiceTramo + 1] ?? null);
    return {
      idTren: unidad.idTren,
      identificador: formatearIdentificadorMetro(unidad.idTren, indice),
      nombreLinea: unidad.nombreLinea,
      progresoRuta,
      estacionActual,
      proximaEstacion,
      progresoTramo: cantidadTramos ? (progresoRuta * cantidadTramos) % 1 : 0,
      transitable: cantidadTramos > 0,
    };
  }

  calcularDuracionVisual(duracion) {
    return Math.min(DURACION_VISUAL_MAXIMA, Math.max(DURACION_VISUAL_MINIMA, duracion * FACTOR_DURACION_VISUAL));
  }

  obtenerEstaciones() { return Array.isArray(this.diseno.estaciones) ? this.diseno.estaciones : []; }
  obtenerTramos() { return Array.isArray(this.diseno.tramos) ? this.diseno.tramos : []; }
  obtenerUnidadesMetro() { return Array.isArray(this.diseno.unidadesMetro) ? this.diseno.unidadesMetro : []; }
}

function construirRuta(tramos, estacionesPorNombre, nombreLinea) {
  const tramosLinea = tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
  if (!tramosLinea.length) return [];
  const adyacencias = new Map();
  tramosLinea.forEach((tramo, indice) => {
    agregarAdyacencia(adyacencias, tramo.estacionA, { nombre: tramo.estacionB, indice });
    agregarAdyacencia(adyacencias, tramo.estacionB, { nombre: tramo.estacionA, indice });
  });
  const inicio = [...adyacencias.entries()].find(([, conexiones]) => conexiones.length === 1)?.[0] ?? tramosLinea[0].estacionA;
  const visitados = new Set();
  const ruta = [inicio];
  let estacionActual = inicio;
  while (visitados.size < tramosLinea.length) {
    const siguiente = (adyacencias.get(estacionActual) ?? []).find((conexion) => !visitados.has(conexion.indice));
    if (!siguiente) break;
    visitados.add(siguiente.indice);
    estacionActual = siguiente.nombre;
    ruta.push(estacionActual);
  }
  return ruta.map((nombre) => estacionesPorNombre.get(nombre)).filter(Boolean);
}

function agregarAdyacencia(adyacencias, origen, destino) {
  const conexiones = adyacencias.get(origen) ?? [];
  conexiones.push(destino);
  adyacencias.set(origen, conexiones);
}

function normalizarVelocidad(velocidad) {
  const velocidadNumerica = Number(velocidad);
  return VELOCIDADES_ADMITIDAS.includes(velocidadNumerica) ? velocidadNumerica : 1;
}

function normalizarDuracion(duracion) {
  const duracionNumerica = Math.round(Number(duracion));
  return Number.isFinite(duracionNumerica) ? Math.max(10, duracionNumerica) : 60;
}

function formatearIdentificadorMetro(idTren, indice) {
  const identificador = String(idTren ?? '').trim();
  return identificador ? `M-${identificador}` : `M-${String(indice + 1).padStart(2, '0')}`;
}

export { VELOCIDADES_ADMITIDAS };
