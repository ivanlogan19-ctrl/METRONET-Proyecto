// Un tap solo se confirma al soltar. Arrastre, pinza, cancelación y rueda lo invalidan.
export default class GestosRed {
  constructor(capa) {
    this.capa = capa;
    this.punteros = new Map();
    this.canvas = capa.escena.game.canvas;
    this.iniciar = p => {
      if (p.event?.target && p.event.target !== this.canvas) return;
      capa.previsualizacion?.clear();
      const gesto = { x:p.x, y:p.y, cancelado:false };
      this.punteros.set(p.id, gesto);
      if (this.punteros.size > 1) this.cancelar();
    };
    this.mover = p => {
      const gesto = this.punteros.get(p.id);
      if (gesto && Math.hypot(p.x-gesto.x,p.y-gesto.y) > 6) gesto.cancelado = true;
      if (!this.punteros.size && p.event?.target === this.canvas) capa.previsualizarRecorrido(p);
    };
    this.terminar = p => {
      const gesto = this.punteros.get(p.id);
      this.punteros.delete(p.id);
      if (gesto && !gesto.cancelado && Math.hypot(p.x-gesto.x,p.y-gesto.y) <= 6 && (!p.event?.target || p.event.target === this.canvas)) capa.procesarPuntero(p);
    };
    this.cancelar = () => { this.punteros.forEach(g => { g.cancelado = true; }); capa.previsualizacion?.clear(); };
    this.fuera = p => { this.cancelar(); this.punteros.delete(p.id); };
    this.eventos = { pointerdown:this.iniciar, pointermove:this.mover, pointerup:this.terminar, pointerupoutside:this.fuera, wheel:this.cancelar, gameout:this.cancelar };
    Object.entries(this.eventos).forEach(([evento,manejador]) => capa.escena.input.on(evento,manejador));
    this.canvas.addEventListener('pointercancel', this.cancelar);
    this.canvas.addEventListener('lostpointercapture', this.cancelar);
    if (capa.editable) this.prepararTeclado();
  }
  prepararTeclado() {
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label','Mapa editable. Con Estación activa, usá flechas y Enter para colocar; Escape cancela.');
    this.cursor = document.createElement('span');
    this.cursor.className = 'metronet-cursor-mapa';
    this.cursor.hidden = true;
    this.cursor.setAttribute('aria-hidden','true');
    this.canvas.parentElement.append(this.cursor);
    this.tecla = evento => {
      if (!['crearEstacion','reubicarEstacion'].includes(this.capa.modo)) return;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(evento.key)) return;
      evento.preventDefault(); evento.stopPropagation();
      const ancho = this.capa.escena.scale.width, alto = this.capa.escena.scale.height;
      this.posicion ??= {x:ancho/2,y:alto/2};
      const delta = evento.shiftKey ? 20 : 5;
      const direcciones = {ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};
      if (direcciones[evento.key]) {
        this.posicion.x = Math.max(0,Math.min(ancho,this.posicion.x+direcciones[evento.key][0]));
        this.posicion.y = Math.max(0,Math.min(alto,this.posicion.y+direcciones[evento.key][1]));
      }
      this.cursor.hidden = false;
      this.cursor.style.left = `${this.canvas.offsetLeft + this.posicion.x/ancho*this.canvas.clientWidth}px`;
      this.cursor.style.top = `${this.canvas.offsetTop + this.posicion.y/alto*this.canvas.clientHeight}px`;
      if (evento.key === 'Enter' && !evento.repeat) this.capa.procesarPuntero({ event:{}, positionToCamera:camara => camara.getWorldPoint(this.posicion.x,this.posicion.y) });
    };
    this.desenfocar = () => { this.cursor.hidden = true; };
    this.canvas.addEventListener('keydown',this.tecla);
    this.canvas.addEventListener('blur',this.desenfocar);
  }
  eliminar() {
    Object.entries(this.eventos).forEach(([evento,manejador]) => this.capa.escena.input.off(evento,manejador));
    this.canvas.removeEventListener('pointercancel',this.cancelar);
    this.canvas.removeEventListener('lostpointercapture',this.cancelar);
    this.canvas.removeEventListener('keydown',this.tecla);
    this.canvas.removeEventListener('blur',this.desenfocar);
    this.cursor?.remove();
  }
}
