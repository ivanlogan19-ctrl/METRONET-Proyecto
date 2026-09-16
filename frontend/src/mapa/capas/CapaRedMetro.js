const COLORES_LINEAS = [0x55c3e7, 0xf3ca62, 0x9ed49c, 0xd7a9f4, 0xff9e92];

export default class CapaRedMetro {
  constructor(escena, opciones = {}) {
    this.escena = escena;
    this.capaBarrios = opciones.capaBarrios;
    this.alSeleccionar = opciones.alSeleccionar ?? (() => {});
    this.alUbicarEstacion = opciones.alUbicarEstacion ?? (() => {});
    this.diseno = null;
    this.modo = 'normal';
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.grafico = null;
    this.zonasInteractivas = [];
    this.animaciones = [];
    this.manejadorPointer = (puntero) => this.procesarPuntero(puntero);
  }

  crear() {
    this.grafico = this.escena.add.graphics();
    this.escena.input.on('pointerdown', this.manejadorPointer);
  }

  establecerDiseno(diseno) {
    this.diseno = diseno;
    this.estacionesSeleccionadas = [];
    this.elementoSeleccionado = null;
    this.detenerAnimacion();
    this.dibujar();
  }

  establecerModo(modo) {
    this.modo = modo;
    this.elementoSeleccionado = null;
    this.dibujar();
  }

  establecerEstacionesSeleccionadas(nombres) {
    this.estacionesSeleccionadas = Array.isArray(nombres) ? nombres : [];
    this.dibujar();
  }

  establecerElementoSeleccionado(elemento) {
    this.elementoSeleccionado = elemento;
    this.dibujar();
  }

  actualizarTamano() {
    this.dibujar();
  }

  obtenerTransformacion() {
    return this.capaBarrios?.calcularEscalaMapa?.() ?? null;
  }

  convertirPosicion(posicionX, posicionY) {
    const transformacion = this.obtenerTransformacion();
    if (!transformacion) return { x: 0, y: 0 };
    return {
      x: transformacion.offsetX + (Number(posicionX) / 1000) * transformacion.anchoMapa,
      y: transformacion.offsetY + (Number(posicionY) / 620) * transformacion.altoMapa,
    };
  }

  convertirPuntero(puntero) {
    const transformacion = this.obtenerTransformacion();
    if (!transformacion) return null;
    const punto = puntero.positionToCamera(this.escena.cameras.main);
    if (
      punto.x < transformacion.offsetX || punto.x > transformacion.offsetX + transformacion.anchoMapa ||
      punto.y < transformacion.offsetY || punto.y > transformacion.offsetY + transformacion.altoMapa
    ) return null;
    return {
      posicionX: Math.round(((punto.x - transformacion.offsetX) / transformacion.anchoMapa) * 1000),
      posicionY: Math.round(((punto.y - transformacion.offsetY) / transformacion.altoMapa) * 620),
      punto,
    };
  }

  dibujar() {
    if (!this.grafico) return;
    this.grafico.clear();
    this.zonasInteractivas.forEach((zona) => zona.destroy());
    this.zonasInteractivas = [];
    if (!this.diseno) return;
    const estaciones = new Map(this.diseno.estaciones.map((estacion) => [estacion.nombre, estacion]));
    this.diseno.tramos.forEach((tramo, indice) => this.dibujarTramo(tramo, estaciones, indice));
    this.diseno.estaciones.forEach((estacion) => this.dibujarEstacion(estacion));
    this.diseno.unidadesMetro.forEach((unidad, indice) => this.dibujarUnidad(unidad, indice));
  }

  dibujarTramo(tramo, estaciones, indice) {
    const origen = estaciones.get(tramo.estacionA);
    const destino = estaciones.get(tramo.estacionB);
    if (!origen || !destino) return;
    const desde = this.convertirPosicion(origen.posicionX, origen.posicionY);
    const hasta = this.convertirPosicion(destino.posicionX, destino.posicionY);
    const seleccionado = (
      this.elementoSeleccionado?.tipo === 'tramo' && this.esMismoTramo(this.elementoSeleccionado.valor, tramo)
    ) || (
      this.elementoSeleccionado?.tipo === 'linea' && this.elementoSeleccionado.valor.nombre === tramo.nombreLinea
    );
    this.grafico.lineStyle(seleccionado ? 7 : 5, this.colorLinea(tramo.nombreLinea, indice), seleccionado ? 1 : 0.88);
    this.grafico.lineBetween(desde.x, desde.y, hasta.x, hasta.y);
  }

  dibujarEstacion(estacion) {
    const punto = this.convertirPosicion(estacion.posicionX, estacion.posicionY);
    const seleccionada = this.estacionesSeleccionadas.includes(estacion.nombre);
    const activa = this.elementoSeleccionado?.tipo === 'estacion' && this.elementoSeleccionado.valor.nombre === estacion.nombre;
    const radio = seleccionada || activa ? 11 : 8;
    this.grafico.fillStyle(estacion.transbordo ? 0xf3ca62 : 0xf4f7fa, 1);
    this.grafico.fillCircle(punto.x, punto.y, radio);
    this.grafico.lineStyle(2, seleccionada || activa ? 0x55c3e7 : 0x111820, 1);
    this.grafico.strokeCircle(punto.x, punto.y, radio);
    this.grafico.lineStyle(1, 0xe8eef3, 0.8);
    this.grafico.strokeRect(punto.x + 12, punto.y - 17, Math.max(54, estacion.nombre.length * 7), 20);
    const texto = this.escena.add.text(punto.x + 16, punto.y - 13, estacion.nombre, { color: '#e8eef3', fontFamily: 'Inter, sans-serif', fontSize: '11px' }).setDepth(4);
    this.zonasInteractivas.push(texto);
  }

  dibujarUnidad(unidad, indice) {
    const ruta = this.obtenerRuta(unidad.nombreLinea);
    if (!ruta.length) return;
    const punto = this.convertirPosicion(ruta[0].posicionX, ruta[0].posicionY);
    const seleccionada = this.elementoSeleccionado?.tipo === 'unidad' && this.elementoSeleccionado.valor.idTren === unidad.idTren;
    this.grafico.fillStyle(this.colorLinea(unidad.nombreLinea, indice), 1);
    this.grafico.fillRoundedRect(punto.x - 8, punto.y - 6, 16, 12, 3);
    this.grafico.lineStyle(seleccionada ? 3 : 1, 0xf4f7fa, 1);
    this.grafico.strokeRoundedRect(punto.x - 8, punto.y - 6, 16, 12, 3);
  }

  procesarPuntero(puntero) {
    const convertido = this.convertirPuntero(puntero);
    if (!convertido || !this.diseno) return;
    if (this.modo === 'crearEstacion' || this.modo === 'reubicarEstacion') {
      this.alUbicarEstacion(convertido, this.modo);
      return;
    }
    const unidad = this.obtenerUnidadCercana(convertido.punto);
    if (unidad) {
      this.alSeleccionar({ tipo: 'unidad', valor: unidad });
      return;
    }
    const estacion = this.obtenerEstacionCercana(convertido.punto);
    if (estacion) {
      this.alSeleccionar({ tipo: 'estacion', valor: estacion });
      return;
    }
    const tramo = this.obtenerTramoCercano(convertido.punto);
    if (tramo) this.alSeleccionar({ tipo: 'tramo', valor: tramo });
  }

  obtenerEstacionCercana(punto) {
    return this.diseno.estaciones.find((estacion) => {
      const posicion = this.convertirPosicion(estacion.posicionX, estacion.posicionY);
      return Phaser.Math.Distance.Between(punto.x, punto.y, posicion.x, posicion.y) <= 17 / this.escena.cameras.main.zoom;
    }) ?? null;
  }

  obtenerUnidadCercana(punto) {
    return this.diseno.unidadesMetro.find((unidad) => {
      const ruta = this.obtenerRuta(unidad.nombreLinea);
      if (!ruta.length) return false;
      const posicion = this.convertirPosicion(ruta[0].posicionX, ruta[0].posicionY);
      return Phaser.Math.Distance.Between(punto.x, punto.y, posicion.x, posicion.y) <= 14 / this.escena.cameras.main.zoom;
    }) ?? null;
  }

  obtenerTramoCercano(punto) {
    const estaciones = new Map(this.diseno.estaciones.map((estacion) => [estacion.nombre, estacion]));
    return this.diseno.tramos.find((tramo) => {
      const origen = estaciones.get(tramo.estacionA);
      const destino = estaciones.get(tramo.estacionB);
      if (!origen || !destino) return false;
      const desde = this.convertirPosicion(origen.posicionX, origen.posicionY);
      const hasta = this.convertirPosicion(destino.posicionX, destino.posicionY);
      return this.distanciaPuntoTramo(punto, desde, hasta) <= 10 / this.escena.cameras.main.zoom;
    }) ?? null;
  }

  obtenerRuta(nombreLinea) {
    const estaciones = new Map(this.diseno.estaciones.map((estacion) => [estacion.nombre, estacion]));
    const tramos = this.diseno.tramos.filter((tramo) => tramo.nombreLinea === nombreLinea);
    if (!tramos.length) return [];
    const ruta = [estaciones.get(tramos[0].estacionA), estaciones.get(tramos[0].estacionB)];
    tramos.slice(1).forEach((tramo) => ruta.push(estaciones.get(tramo.estacionB)));
    return ruta.filter(Boolean);
  }

  distanciaPuntoTramo(punto, desde, hasta) {
    const diferenciaX = hasta.x - desde.x;
    const diferenciaY = hasta.y - desde.y;
    const longitudCuadrada = diferenciaX * diferenciaX + diferenciaY * diferenciaY;
    if (longitudCuadrada === 0) return Phaser.Math.Distance.Between(punto.x, punto.y, desde.x, desde.y);
    const proyeccion = Phaser.Math.Clamp(
      ((punto.x - desde.x) * diferenciaX + (punto.y - desde.y) * diferenciaY) / longitudCuadrada,
      0,
      1,
    );
    return Phaser.Math.Distance.Between(punto.x, punto.y, desde.x + proyeccion * diferenciaX, desde.y + proyeccion * diferenciaY);
  }

  iniciarAnimacion(velocidad, duracion) {
    this.detenerAnimacion();
    const duracionVisual = Math.max(2600, Math.min(9000, (Number(duracion) * 120) / Math.max(Number(velocidad), 0.5)));
    this.diseno.unidadesMetro.forEach((unidad, indice) => {
      const ruta = this.obtenerRuta(unidad.nombreLinea);
      if (ruta.length < 2) return;
      const tren = this.escena.add.circle(0, 0, 8, this.colorLinea(unidad.nombreLinea, indice)).setDepth(6);
      const inicio = this.escena.time.now + indice * 240;
      const evento = this.escena.time.addEvent({ delay: 16, loop: true, callback: () => {
        const progreso = ((this.escena.time.now - inicio) / duracionVisual) % 1;
        const segmento = Math.min(ruta.length - 2, Math.floor(progreso * (ruta.length - 1)));
        const avance = (progreso * (ruta.length - 1)) % 1;
        const origen = this.convertirPosicion(ruta[segmento].posicionX, ruta[segmento].posicionY);
        const destino = this.convertirPosicion(ruta[segmento + 1].posicionX, ruta[segmento + 1].posicionY);
        tren.setPosition(Phaser.Math.Linear(origen.x, destino.x, avance), Phaser.Math.Linear(origen.y, destino.y, avance));
      }});
      this.animaciones.push({ evento, tren });
    });
  }

  detenerAnimacion() {
    this.animaciones.forEach(({ evento, tren }) => { evento.remove(false); tren.destroy(); });
    this.animaciones = [];
  }

  colorLinea(nombre, indice) {
    const valor = String(nombre ?? '').split('').reduce((total, caracter) => total + caracter.charCodeAt(0), indice);
    return COLORES_LINEAS[valor % COLORES_LINEAS.length];
  }

  esMismoTramo(primero, segundo) {
    return primero.nombreLinea === segundo.nombreLinea && primero.estacionA === segundo.estacionA && primero.estacionB === segundo.estacionB;
  }

  eliminar() {
    this.detenerAnimacion();
    this.escena.input.off('pointerdown', this.manejadorPointer);
    this.zonasInteractivas.forEach((zona) => zona.destroy());
    this.zonasInteractivas = [];
    this.grafico?.destroy();
    this.grafico = null;
  }
}
