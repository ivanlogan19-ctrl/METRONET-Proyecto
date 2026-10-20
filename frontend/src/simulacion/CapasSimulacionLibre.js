import '../mapa/estilos/colores-capas.css';
import CapaCalles from '../mapa/capas/CapaCalles.js';
import CapaTrafico from '../mapa/capas/CapaTrafico.js';
import CapaPoblacion from '../mapa/capas/CapaPoblacion.js';
import CapaDesplazamientos from '../mapa/capas/CapaDesplazamientos.js';
import { configurarBotonIcono } from '../interfaz/IconosRetro.js';
import { RelojTerritorial, minutosDesdeHora, mostrarHora, circuloCobertura } from './RelojTerritorial.mjs';
import SelectorLineasReproduccion from './SelectorLineasReproduccion.js';
import './capas-simulacion.css';

export default class CapasSimulacionLibre {
  constructor(escena, diseno) {
    this.escena = escena; this.diseno = diseno;
    this.clave = `metronet:simulacion-territorio:v1:${diseno.simulacion.idDiseno}`;
    try { this.preferencias = JSON.parse(localStorage.getItem(this.clave)) || {}; } catch { this.preferencias = {}; }
    this.reloj = new RelojTerritorial(minutosDesdeHora(this.preferencias.inicio ?? '') ?? 480);
    this.calles = new CapaCalles(escena, escena.capaBarrios);
    this.trafico = new CapaTrafico(escena, this.calles, this.reloj);
    this.poblacion = new CapaPoblacion(escena, escena.capaBarrios);
    this.desplazamientos = new CapaDesplazamientos(escena, escena.capaBarrios, this.reloj);
    this.capas = { calles: this.calles, trafico: this.trafico, poblacion: this.poblacion, desplazamientos: this.desplazamientos };
    this.cobertura = escena.add.graphics().setDepth(6).setVisible(false);
    this.crearPanel();
    for (const [clave, capa] of Object.entries(this.capas)) {
      capa.alCambiar = () => this.actualizarBotones();
      capa.establecerDisponible(true);
      if (this.preferencias[clave]) capa.alternar();
    }
    this.cobertura.setVisible(Boolean(this.preferencias.cobertura));
    this.establecerOpacidad(this.preferencias.opacidad ?? .65);
    this.redibujar(); this.actualizarBotones();
  }
  crearPanel() {
    document.body.classList.add('simulacion-libre-territorio');
    this.horarios = document.querySelector('.simulacion-acciones-panel');
    this.horarios.classList.add('simulacion-horarios');
    this.tituloAcciones = this.horarios.querySelector('h3');
    this.tituloAcciones.textContent = 'Reloj de estación';
    this.relojVisual = document.createElement('div');
    this.relojVisual.className = 'simulacion-reloj-digital';
    this.relojVisual.innerHTML = `<button type="button" data-paso-hora="-1" aria-label="Atrasar horario 15 minutos">◀</button>
      <output data-hora-actual aria-label="Hora del escenario"></output>
      <button type="button" data-paso-hora="1" aria-label="Adelantar horario 15 minutos">▶</button>
      <output data-hora-fin hidden></output>`;
    this.tituloAcciones.after(this.relojVisual);
    this.flechasHora = [...this.relojVisual.querySelectorAll('[data-paso-hora]')];
    this.flechasHora.forEach(boton => boton.addEventListener('click', () => {
      this.reloj.inicio = (this.reloj.inicio + Number(boton.dataset.pasoHora) * 15 + 1440) % 1440;
      this.preferencias.inicio = mostrarHora(this.reloj.inicio); this.guardar();
      this.sincronizar(this.estado ?? this.escena.motorSimulacion.obtenerEstado());
    }));
    this.selectorLineas = new SelectorLineasReproduccion(this.diseno, nombres => this.escena.seleccionarLineasReproduccion(nombres));
    this.panel = document.createElement('section'); this.panel.className = 'simulacion-territorio-panel simulacion-capas';
    this.panel.innerHTML = `<h3 class="simulacion-seccion-titulo">Capas del mapa</h3><div class="simulacion-capas__botones"></div>
      <input type="range" min="10" max="100" step="5" value="65" aria-label="Transparencia de las capas">
      <p role="status" hidden></p>`;
    this.botones = {};
    for (const [clave, icono, nombre] of [['calles', 'calles', 'calles y avenidas'], ['trafico', 'trafico', 'tráfico histórico'],
      ['poblacion', 'poblacion', 'densidad de población'], ['desplazamientos', 'desplazamientos', 'desplazamientos históricos'],
      ['cobertura', 'cobertura', 'cobertura de 500 m']]) {
      const boton = document.createElement('button'); boton.type = 'button'; boton.dataset.capaSimulacion = clave;
      this.botones[clave] = { boton, icono, nombre }; this.panel.querySelector('div').append(boton);
      boton.addEventListener('click', async () => {
        if (clave === 'cobertura') this.cobertura.setVisible(!this.cobertura.visible);
        else await this.capas[clave].alternar();
        if (this.eliminado) return;
        this.preferencias[clave] = clave === 'cobertura' ? this.cobertura.visible : this.capas[clave].visible;
        this.guardar(); this.actualizarBotones();
      });
    }
    this.rango = this.panel.querySelector('input');
    this.rango.addEventListener('input', () => { this.establecerOpacidad(Number(this.rango.value)/100); this.guardar(); });
    const instrumentos = document.getElementById('instrumentosSimulacion');
    this.horarios.after(this.selectorLineas.elemento);
    instrumentos.append(this.panel);
  }
  guardar() { try { localStorage.setItem(this.clave, JSON.stringify(this.preferencias)); } catch { /* No bloquea simular. */ } }
  establecerOpacidad(valor) {
    const opacidad = Number.isFinite(Number(valor)) ? Math.min(1, Math.max(.1, Number(valor))) : .65;
    this.preferencias.opacidad = opacidad; this.rango.value = opacidad * 100;
    this.calles.establecerOpacidad(opacidad); this.trafico.actualizar();
    this.poblacion.establecerOpacidad(opacidad); this.desplazamientos.establecerOpacidad(opacidad);
    this.cobertura.setAlpha(opacidad);
  }
  actualizarBotones() {
    if (this.eliminado) return;
    const errores = [];
    for (const [clave, {boton, icono, nombre}] of Object.entries(this.botones)) {
      const capa = this.capas[clave], error = capa?.estado === 'error';
      const visible = capa ? capa.visible && capa.estado === 'lista' : this.cobertura.visible;
      const etiqueta = `${error ? 'Reintentar' : visible ? 'Ocultar' : 'Mostrar'} ${nombre}`;
      if (boton.getAttribute('aria-label') !== etiqueta) configurarBotonIcono(boton, icono, etiqueta);
      boton.disabled = capa?.estado === 'cargando'; boton.setAttribute('aria-pressed', String(visible));
      if (error) errores.push(nombre);
    }
    const mensaje = this.panel.querySelector('[role="status"]');
    mensaje.hidden = !errores.length;
    mensaje.textContent = errores.length ? `Sin datos: ${errores.join(', ')}. Reintentá con su icono; podés seguir simulando.` : '';
  }
  sincronizar(estado) {
    this.estado = estado;
    const t = estado.tiempoTranscurrido ?? 0;
    const duracion = estado.duracion ?? 0;
    this.reloj.sincronizar(t);
    this.selectorLineas.establecerBloqueado(this.bloqueoExterno || ['EN_CURSO', 'PAUSADA'].includes(estado.estado));
    this.mostrarReloj('[data-hora-actual]', this.reloj.inicio + t * 60);
    this.mostrarReloj('[data-hora-fin]', this.reloj.inicio + duracion * 60);
  }
  mostrarReloj(selector, minutos) {
    const salida = this.horarios.querySelector(selector);
    const [hora, dia] = mostrarHora(minutos).split(' ');
    salida.replaceChildren(document.createTextNode(hora));
    if (dia) {
      const detalle = document.createElement('small'); detalle.className = 'simulacion-horarios__dia';
      detalle.textContent = ` ${dia}`; salida.append(detalle);
    }
  }
  redibujar() {
    this.calles.redibujar(); this.trafico.redibujar(); this.poblacion.redibujar(); this.desplazamientos.redibujar();
    const barrios = this.escena.capaBarrios, limites = barrios.transformacion, escala = barrios.calcularEscalaMapa();
    if (!limites || !escala) return;
    const g = this.cobertura; g.clear(); g.fillStyle(0x40bcdf, .3); g.lineStyle(2, 0x40bcdf, .9);
    for (const e of this.diseno.estaciones ?? []) {
      const lon = limites.minX + Number(e.posicionX)/1000 * (limites.maxX-limites.minX);
      const lat = limites.maxY - Number(e.posicionY)/620 * (limites.maxY-limites.minY);
      const puntos = circuloCobertura(lon, lat).map(p => barrios.convertirCoordenada(p, escala));
      g.fillPoints(puntos, true); g.strokePoints(puntos, true);
    }
  }
  eliminar() {
    this.eliminado = true;
    for (const capa of Object.values(this.capas)) capa.eliminar();
    this.cobertura.destroy(); this.reloj.eliminar(); this.relojVisual.remove(); this.panel.remove();
    this.selectorLineas.elemento.remove();
    this.horarios.classList.remove('simulacion-horarios'); this.tituloAcciones.textContent = 'Acciones';
    document.body.classList.remove('simulacion-libre-territorio');
  }
}
