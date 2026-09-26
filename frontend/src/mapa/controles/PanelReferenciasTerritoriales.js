import { ajustarPanelMapa } from '../../interfaz/PanelMapa.js';
import { CATEGORIAS_REFERENCIAS, colorCssReferencia, obtenerCategoriaReferencia } from '../configuracion/CategoriasReferencias.js';
import { configurarBotonIcono, iconoRetro } from '../../interfaz/IconosRetro.js';
import '../estilos/referencias-poi.css';

// Una única puerta a las capas. Los datos y su selección siguen en las capas Phaser.
export default class PanelReferenciasTerritoriales {
  constructor({ contenedor, mapa, alCambiarCategorias, alCambiarGeografia }) {
    Object.assign(this, { contenedor, mapa, alCambiarCategorias, alCambiarGeografia });
    this.categorias = []; this.controles = new Map(); this.indicadores = new Map();
    this.geografia = { barrios: true, zonas: false };
  }
  crear() {
    this.elemento = document.createElement('details');
    this.elemento.className = 'metronet-poi';
    const acceso = document.createElement('summary');
    configurarBotonIcono(acceso, 'poi', 'Puntos de interés de Montevideo');
    acceso.setAttribute('aria-expanded','false');
    this.panel = document.createElement('div'); this.panel.className = 'metronet-poi__panel';
    for (const tipo of ['pointerdown', 'mousedown', 'touchstart']) this.panel.addEventListener(tipo, e => e.stopPropagation());
    this.panel.innerHTML = '<header><h2>Referencias de Montevideo</h2><button type="button" data-cerrar-poi></button></header>';
    const cerrar = this.panel.querySelector('[data-cerrar-poi]');
    configurarBotonIcono(cerrar,'cancelar','Cerrar puntos de interés');
    cerrar.addEventListener('click',()=>this.cerrar(true));
    const controles = document.createElement('div'); controles.className = 'metronet-poi__categorias';
    controles.setAttribute('role','group'); controles.setAttribute('aria-label','Capas geográficas');
    this.estado = document.createElement('div'); this.estado.className = 'metronet-capas-activas';
    this.estado.setAttribute('role','group'); this.estado.setAttribute('aria-label','Capas activas');
    this.geografico = document.createElement('section'); this.geografico.className='metronet-poi__geografia'; this.geografico.hidden=true;
    this.geografico.innerHTML='<h3>Barrios / Zonas</h3><div class="metronet-poi__visibilidad"></div><div data-contenedor-selectores-mapa></div>';
    this.seleccion = this.geografico.querySelector('[data-contenedor-selectores-mapa]');
    this.seleccion.addEventListener('click', evento => {
      const encabezado = evento.target.closest('.metronet-panel-encabezado');
      if (encabezado?.getAttribute('aria-expanded') === 'true') this.mostrarListaGeografica(encabezado);
    });
    for (const tipo of ['barrios','zonas']) {
      const b=document.createElement('button'); b.type='button'; b.textContent=`Mostrar ${tipo}`; b.dataset.capaGeografica=tipo;
      b.addEventListener('click',()=>{this.geografia[tipo]=!this.geografia[tipo];this.alCambiarGeografia?.({...this.geografia});this.actualizarGeografia();});
      this.geografico.querySelector('.metronet-poi__visibilidad').append(b);
    }
    for (const [categoria, datos] of Object.entries(CATEGORIAS_REFERENCIAS)) {
      if (categoria === 'OTROS') continue;
      const control = document.createElement('button'); control.type='button'; control.dataset.categoria=categoria;
      configurarBotonIcono(control,datos.icono,datos.etiqueta); control.style.setProperty('--referencia-color',colorCssReferencia(categoria));
      control.addEventListener('click',()=>{
        if (categoria === 'BARRIOS_ZONAS') {this.geografico.hidden=!this.geografico.hidden;control.setAttribute('aria-expanded',String(!this.geografico.hidden));return;}
        const visibles=new Set(this.categorias); if(visibles.has(categoria))visibles.delete(categoria);else visibles.add(categoria);
        this.alCambiarCategorias([...visibles]);
      });
      if (categoria === 'BARRIOS_ZONAS') control.setAttribute('aria-expanded', 'false');
      this.controles.set(categoria,control);
      controles.append(control);
      const indicador=document.createElement('span');indicador.dataset.categoria=categoria;indicador.innerHTML=iconoRetro(datos.icono);
      indicador.style.setProperty('--referencia-color',colorCssReferencia(categoria));indicador.title=datos.etiqueta;indicador.setAttribute('aria-label',datos.etiqueta);indicador.tabIndex=0;indicador.setAttribute('role','img');
      this.indicadores.set(categoria,indicador);this.estado.append(indicador);
    }
    this.busqueda=document.createElement('div');this.busqueda.className='metronet-poi__busqueda';
    this.accesoBusqueda=document.createElement('div');this.accesoBusqueda.className='metronet-poi__acceso-busqueda';
    controles.append(this.accesoBusqueda);
    this.panel.append(controles,this.busqueda,this.geografico);
    this.elemento.append(acceso,this.panel);this.contenedor.append(this.elemento);
    this.herramientas=document.createElement('div');this.herramientas.className='metronet-poi__zoom';this.contenedor.append(this.herramientas);
    this.mapa.append(this.estado);
    this.estado.hidden = true;
    this.alCerrarFuera=e=>{if(!this.elemento.contains(e.target))this.cerrar();};
    this.alEscape=e=>{if(e.key==='Escape' && this.elemento.open){e.stopPropagation();this.cerrar(true);}};
    document.addEventListener('pointerdown',this.alCerrarFuera);
    this.elemento.addEventListener('keydown',this.alEscape);
    this.elemento.addEventListener('toggle',()=>{acceso.setAttribute('aria-expanded',String(this.elemento.open));acceso.setAttribute('aria-pressed',String(this.elemento.open));this.estado.hidden=!this.elemento.open;});
    this.liberarPosicion = ajustarPanelMapa(acceso, this.panel);
    this.actualizarGeografia();
  }
  cerrar(foco=false){this.elemento.open=false;if(foco)this.elemento.querySelector('summary').focus();}
  mostrarListaGeografica(encabezado) {
    const contenido = encabezado.parentElement.querySelector('.metronet-panel-contenido');
    if (!contenido) return;
    const panel = this.panel.getBoundingClientRect();
    const margen = parseFloat(getComputedStyle(this.panel).paddingTop) || 0;
    const recorte = contenido.getBoundingClientRect().bottom - panel.bottom + margen;
    // Desplazar solo este menú y conservar ambos accesos visibles en pantallas bajas.
    const espacioEncabezado = encabezado.getBoundingClientRect().top - panel.top - margen;
    if (recorte > 0 && espacioEncabezado > 0) this.panel.scrollTop += Math.min(recorte, espacioEncabezado);
  }
  actualizarGeografia(){
    this.geografico.querySelectorAll('[data-capa-geografica]').forEach(b=>b.setAttribute('aria-pressed',String(this.geografia[b.dataset.capaGeografica])));
    const activa=this.geografia.barrios||this.geografia.zonas;
    this.indicadores.get('BARRIOS_ZONAS').hidden=!activa;
    this.controles.get('BARRIOS_ZONAS').setAttribute('aria-pressed',String(activa));
  }
  actualizar(categorias=[]) {
    this.categorias=categorias;
    for(const [categoria,control] of this.controles){
      if(categoria==='BARRIOS_ZONAS')continue;
      const activa=categorias.includes(categoria);control.setAttribute('aria-pressed',String(activa));
      if(this.indicadores.has(categoria))this.indicadores.get(categoria).hidden=!activa;
    }
    this.actualizarGeografia();
  }
  establecerCatalogo(puntos){
    for(const [categoria,control] of this.controles){
      if(categoria==='BARRIOS_ZONAS')continue;
      const cantidad=puntos.filter(p=>obtenerCategoriaReferencia(p)===categoria).length;
      control.title=`${CATEGORIAS_REFERENCIAS[categoria].descripcion} · ${cantidad} referencias`;
      control.disabled=cantidad===0;
    }
  }
  eliminar(){this.liberarPosicion?.();document.removeEventListener('pointerdown',this.alCerrarFuera);this.elemento?.remove();this.estado?.remove();this.herramientas?.remove();}
}
