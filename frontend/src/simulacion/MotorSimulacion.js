import { tramosDeRecorridos } from '../mapa/configuracion/RecorridosRed.js';
import { RITMOS as VELOCIDADES_ADMITIDAS, HORAS_INICIALES, duracionVisual, avanceEnKilometros, normalizarHoras } from './EscalaSimulacion.js';
import { numeroMetroEnRed } from '../mapa/controles/NombresRed.js';

export default class MotorSimulacion {
  constructor(diseno, motorAnterior = null) {
    // Estado visual de esta sesión: guardar UV/UT no devuelve los metros al origen.
    this.extremos = new Map(motorAnterior?.extremos ?? []);
    this.diseno = diseno ?? {};
    this.rutas = this.crearRutas();
    this.estado = 'DETENIDA';
    this.velocidad = 1;
    this.duracion = HORAS_INICIALES;
    this.ventanaVisual = HORAS_INICIALES;
    this.duracionVisual = this.calcularDuracionVisual(this.duracion);
    this.marcaInicio = null;
    this.tiempoAcumulado = 0;
    this.progreso = 0;
    this.finalizada = false;
  }

  iniciar({ velocidad = 1, duracion = HORAS_INICIALES, ahora = 0 } = {}) {
    if (!this.rutas.length) return this.detener();
    this.actualizarSentidos();
    this.velocidad = normalizarVelocidad(velocidad);
    this.ventanaVisual = normalizarHoras(duracion);
    this.duracion = Math.max(...this.rutas.map(u => u.duracionUt ?? this.ventanaVisual), this.rutas.length ? 0 : this.ventanaVisual);
    this.duracionVisual = this.calcularDuracionVisual(this.duracion);
    this.marcaInicio = Number(ahora);
    this.tiempoAcumulado = 0;
    this.progreso = 0;
    this.estado = 'EN_CURSO';
    this.finalizada = false;
    return this.obtenerEstado();
  }

  seleccionarLineas(nombres) {
    if (['EN_CURSO', 'PAUSADA'].includes(this.estado)) return this.obtenerEstado();
    const seleccion = new Set(nombres);
    this.rutas = this.crearRutas().filter(ruta => seleccion.has(ruta.nombreLinea));
    this.detener();
    this.duracion = Math.max(0, ...this.rutas.map(ruta => ruta.duracionUt ?? this.ventanaVisual));
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
    this.actualizarSentidos();
    this.marcaInicio = null;
    this.tiempoAcumulado = 0;
    this.progreso = 0;
    this.estado = 'DETENIDA';
    this.finalizada = false;
    return this.obtenerEstado();
  }

  reiniciar(ahora = 0) {
    return this.iniciar({ velocidad: this.velocidad, duracion: this.ventanaVisual, ahora });
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
    const estado = this.obtenerEstado();
    estado.unidades.forEach((unidad, indice) => {
      if (unidad.transitable && unidad.proximaEstacion === null) {
        const ruta = this.rutas[indice];
        this.extremos.set(ruta.idTren, { firma: ruta.firma, alFinal: !ruta.sentidoInverso });
      }
    });
    return estado;
  }

  actualizarSentidos() {
    this.rutas.forEach(ruta => {
      const extremo = this.extremos.get(ruta.idTren);
      ruta.sentidoInverso = extremo?.firma === ruta.firma && extremo.alFinal;
    });
  }

  obtenerEstado() {
    const unidades = this.rutas.map(ruta => this.crearEstadoUnidad(ruta));
    const metroActivo = unidades.find((unidad) => unidad.transitable) ?? null;
    return {
      estado: this.estado,
      velocidad: this.velocidad,
      duracion: this.duracion,
      progreso: this.progreso,
      tiempoTranscurrido: this.progreso * this.duracion,
      tiempoRestante: Math.max(0, this.duracion - this.progreso * this.duracion),
      unidades,
      metroActivo,
      finalizada: this.finalizada,
    };
  }

  crearRutas() {
    const estacionesPorNombre = new Map(this.obtenerEstaciones().map((estacion) => [estacion.nombre, estacion]));
    return this.obtenerUnidadesMetro().map((unidad) => {
      const ruta = construirRuta(this.obtenerTramos(), estacionesPorNombre, unidad.nombreLinea);
      const firma = JSON.stringify([unidad.nombreLinea, ruta.map(estacion =>
        [estacion.nombre, estacion.posicionX, estacion.posicionY, estacion.distanciaDesdeAnteriorKm])]);
      const extremo = this.extremos.get(unidad.idTren);
      return {
        idTren: unidad.idTren,
        identificador: `M-${numeroMetroEnRed(unidad.idTren, this.obtenerUnidadesMetro()) ?? '—'}`,
        nombreLinea: unidad.nombreLinea,
        velocidadUV: Number(unidad.velocidadPromedio) || 0,
        duracionUt: Number.isFinite(unidad.duracionUt) && unidad.duracionUt > 0 ? unidad.duracionUt : null,
        ruta, firma,
        sentidoInverso: extremo?.firma === firma && extremo.alFinal,
      };
    });
  }

  crearEstadoUnidad(unidad) {
    const nombresEstaciones = unidad.ruta.map((estacion) => estacion.nombre);
    const cantidadTramos = Math.max(0, nombresEstaciones.length - 1);
    const longitudes = unidad.ruta.slice(1).map(estacion => estacion.distanciaDesdeAnteriorKm);
    if (unidad.sentidoInverso) { nombresEstaciones.reverse(); longitudes.reverse(); }
    const distanciaTotalKm = longitudes.reduce((total, km) => total + km, 0);
    const avanceKm = avanceEnKilometros(unidad.velocidadUV,
      Math.min(this.progreso * this.duracion, unidad.duracionUt ?? this.ventanaVisual));
    const tolerancia = Number.EPSILON * Math.max(1, distanciaTotalKm) * 8;
    const distanciaRecorridaKm = avanceKm >= distanciaTotalKm - tolerancia
      ? distanciaTotalKm : avanceKm;
    const progresoRuta = distanciaTotalKm > 0 ? distanciaRecorridaKm / distanciaTotalKm : 0;
    let indiceTramo = 0, distanciaPrevia = 0;
    while (indiceTramo < cantidadTramos - 1 && distanciaRecorridaKm >= distanciaPrevia + longitudes[indiceTramo]) {
      distanciaPrevia += longitudes[indiceTramo++];
    }
    const esFinal = cantidadTramos > 0 && distanciaRecorridaKm >= distanciaTotalKm;
    const estacionActual = esFinal
      ? nombresEstaciones.at(-1)
      : (nombresEstaciones[indiceTramo] ?? nombresEstaciones[0] ?? null);
    const proximaEstacion = esFinal ? null : (nombresEstaciones[indiceTramo + 1] ?? null);
    return {
      idTren: unidad.idTren,
      identificador: unidad.identificador,
      nombreLinea: unidad.nombreLinea,
      velocidadUV: unidad.velocidadUV,
      duracionUt: unidad.duracionUt ?? this.ventanaVisual,
      tiempoAgotado: this.progreso * this.duracion >= (unidad.duracionUt ?? this.ventanaVisual),
      progresoRuta: unidad.sentidoInverso ? 1 - progresoRuta : progresoRuta,
      distanciaTotalKm,
      distanciaRecorridaKm,
      utLlegada: unidad.velocidadUV > 0 ? distanciaTotalKm / unidad.velocidadUV : null,
      estacionActual,
      proximaEstacion,
      progresoTramo: !esFinal && longitudes[indiceTramo] > 0 ? (distanciaRecorridaKm - distanciaPrevia) / longitudes[indiceTramo] : 0,
      transitable: cantidadTramos > 0 && distanciaTotalKm > 0,
      enMovimiento: this.estado === 'EN_CURSO' && distanciaTotalKm > 0 && !esFinal
        && unidad.velocidadUV > 0 && this.progreso * this.duracion < (unidad.duracionUt ?? this.ventanaVisual),
    };
  }

  calcularDuracionVisual(duracion) {
    return duracionVisual(duracion);
  }

  obtenerEstaciones() { return Array.isArray(this.diseno.estaciones) ? this.diseno.estaciones : []; }
  obtenerTramos() { return tramosDeRecorridos(this.diseno); }
  obtenerUnidadesMetro() { return Array.isArray(this.diseno.unidadesMetro) ? this.diseno.unidadesMetro : []; }
}

function construirRuta(tramos, estacionesPorNombre, nombreLinea) {
  const tramosLinea = tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
  if (!tramosLinea.length || tramosLinea.some(t => !Number.isFinite(t.distanciaKm) || t.distanciaKm < 0
      || !estacionesPorNombre.has(t.estacionA) || !estacionesPorNombre.has(t.estacionB))) return [];
  const adyacencias = new Map();
  tramosLinea.forEach((tramo, indice) => {
    agregarAdyacencia(adyacencias, tramo.estacionA, { nombre: tramo.estacionB, indice });
    agregarAdyacencia(adyacencias, tramo.estacionB, { nombre: tramo.estacionA, indice });
  });
  const inicio = [...adyacencias.entries()].find(([, conexiones]) => conexiones.length === 1)?.[0] ?? tramosLinea[0].estacionA;
  const visitados = new Set();
  const ruta = [{ ...estacionesPorNombre.get(inicio), distanciaDesdeAnteriorKm: 0 }];
  let estacionActual = inicio;
  while (visitados.size < tramosLinea.length) {
    const siguiente = (adyacencias.get(estacionActual) ?? []).find((conexion) => !visitados.has(conexion.indice));
    if (!siguiente) break;
    visitados.add(siguiente.indice);
    estacionActual = siguiente.nombre;
    ruta.push({ ...estacionesPorNombre.get(estacionActual), distanciaDesdeAnteriorKm: tramosLinea[siguiente.indice].distanciaKm });
  }
  return visitados.size === tramosLinea.length ? ruta : [];
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

export { VELOCIDADES_ADMITIDAS };
