import PanelReferenciasTerritoriales from './PanelReferenciasTerritoriales.js';
import PanelPuntosInteres from './PanelPuntosInteres.js';
import SelectorBarrios from './SelectorBarrios.js';
import SelectorZonas from './SelectorZonas.js';

// Composición compartida por editor y visor. Selección y visibilidad son estados distintos.
export default class ReferenciasGeograficas {
  constructor(escena, { contenedor, mapa, alSeleccionarGeografia = () => {}, alSeleccionarPunto, alCambiarCategorias = () => {} } = {}) {
    this.escena = escena;
    this.panel = new PanelReferenciasTerritoriales({
      contenedor, mapa,
      alCambiarCategorias: categorias => {
        escena.capaPuntosInteres.establecerCategoriasVisibles(categorias);
        alCambiarCategorias(categorias);
      },
      alCambiarGeografia: estado => escena.capaBarrios.establecerVisibilidad(estado),
    });
    this.panel.crear();
    if (escena.capaTerritorial?.elemento) this.panel.panel.append(escena.capaTerritorial.elemento);
    const seleccionar = (tipo, seleccion) => {
      if (tipo === 'barrio') {
        escena.capaBarrios.establecerBarriosSeleccionados(seleccion);
        escena.capaPuntosInteres.establecerBarriosSeleccionados(seleccion);
      } else {
        if (escena.capaZonas) escena.capaZonas.establecerZonasSeleccionadas(seleccion);
        else escena.capaBarrios.establecerZonasSeleccionadas(seleccion);
        escena.capaPuntosInteres.establecerZonasSeleccionadas(seleccion);
      }
      alSeleccionarGeografia(tipo, seleccion);
      if (seleccion.length) {
        if (tipo === 'barrio') escena.controlZoom?.enfocarBarrios(seleccion);
        else escena.controlZoom?.enfocarZonas(seleccion);
      }
    };
    this.barrios = new SelectorBarrios({ titulo:'Barrios', integrado:true, contenedorPadre:this.panel.seleccion, onCambio:s => seleccionar('barrio',s) });
    this.zonas = new SelectorZonas({ titulo:'Zonas', integrado:true, contenedorPadre:this.panel.seleccion, onCambio:s => seleccionar('zona',s) });
    this.barrios.crear(escena.capaBarrios.obtenerNombres());
    this.zonas.crear();
    this.busqueda = new PanelPuntosInteres({
      contenedorPadre:this.panel.busqueda,
      contenedorAcceso:this.panel.accesoBusqueda,
      alSeleccionar: punto => {
        this.panel.cerrar();
        if (alSeleccionarPunto) alSeleccionarPunto(punto);
        else escena.capaPuntosInteres.seleccionarPunto(punto, { desdeBusqueda:true, enfocar:true, mostrarInformacion:true });
      },
      alLimpiarBusqueda: () => escena.capaPuntosInteres.limpiarPuntoBuscado(),
    });
    this.busqueda.crear();
    this.panel.establecerCatalogo(escena.capaPuntosInteres.puntos);
    this.actualizar(escena.capaPuntosInteres.obtenerResumenPuntos());
  }
  actualizar(resumen) {
    this.panel.actualizar(resumen.categoriasVisibles);
    this.busqueda.actualizar(resumen);
  }
  eliminar() {
    this.barrios.eliminar();
    this.zonas.eliminar();
    this.busqueda.eliminar();
    this.panel.eliminar();
  }
}
