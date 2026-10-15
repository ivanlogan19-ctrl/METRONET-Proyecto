import './acciones-interfaz.css';

// Vocabulario compartido por controles generales; no se aplica a herramientas del mapa.
export const ACCIONES_INTERFAZ = Object.freeze({
  simular: { texto: 'Simular', categoria: 'principal' },
  previsualizar: { texto: 'Previsualizar', categoria: 'secundaria' },
  publicar: { texto: 'Publicar', categoria: 'principal' },
  guardar: { texto: 'Guardar', categoria: 'principal' },
  confirmar: { texto: 'Confirmar', categoria: 'principal' },
  agregar: { texto: 'Agregar', categoria: 'principal' },
  jugar: { texto: 'Jugar', categoria: 'principal' },
  iniciar: { texto: 'Iniciar', categoria: 'principal' },
  continuar: { texto: 'Continuar', categoria: 'principal' },
  repetir: { texto: 'Repetir', categoria: 'principal' },
  siguiente: { texto: 'Siguiente', categoria: 'principal' },
  anterior: { texto: 'Anterior', categoria: 'secundaria' },
  volver: { texto: 'Volver', categoria: 'secundaria' },
  abrir: { texto: 'Abrir', categoria: 'secundaria' },
  editar: { texto: 'Editar', categoria: 'secundaria' },
  cerrar: { texto: 'Cerrar', categoria: 'peligro' },
  cancelar: { texto: 'Cancelar', categoria: 'peligro' },
  quitar: { texto: 'Quitar', categoria: 'peligro' },
  eliminar: { texto: 'Eliminar', categoria: 'peligro' },
  reintentar: { texto: 'Reintentar', categoria: 'principal' },
  iniciarTutorial: { texto: 'Iniciar tutorial', categoria: 'secundaria' },
  salirTutorial: { texto: 'Salir del tutorial', categoria: 'peligro' },
  salir: { texto: 'Salir', categoria: 'peligro' },
  eliminarTodo: { texto: 'Eliminar todo', categoria: 'peligro' },
});

export function configurarAccion(boton, accion, { icono = false, compacto = false, conservarTexto = false } = {}) {
  const definicion = ACCIONES_INTERFAZ[accion];
  if (!boton || !definicion) return boton;
  boton.dataset.accionUi = accion;
  boton.dataset.categoriaAccion = definicion.categoria;
  boton.dataset.tamanoAccion = icono ? 'icono' : compacto ? 'pequeno' : 'medio';
  if (icono) {
    boton.title = definicion.texto;
    boton.dataset.ayudaSistema = definicion.texto;
    if (!boton.hasAttribute('aria-label')) boton.setAttribute('aria-label', definicion.texto);
  } else if (!conservarTexto) boton.textContent = definicion.texto;
  return boton;
}

// Sólo etiquetas exactas del catálogo en fábricas de acciones ya auditadas.
export function configurarAccionPorNombre(boton, opciones) {
  const entrada = Object.entries(ACCIONES_INTERFAZ).find(([,d]) => d.texto === boton.textContent.trim());
  return entrada ? configurarAccion(boton, entrada[0], opciones) : boton;
}

export function establecerCargaAccion(boton, cargando) {
  if(cargando && !boton.hasAttribute('data-ancho-accion-previo')) {
    boton.dataset.anchoAccionPrevio=boton.style.width;
    boton.style.width=`${boton.getBoundingClientRect().width}px`;
  } else if(!cargando && boton.hasAttribute('data-ancho-accion-previo')) {
    boton.style.width=boton.dataset.anchoAccionPrevio;
    delete boton.dataset.anchoAccionPrevio;
  }
  boton.disabled=cargando;
  boton.setAttribute('aria-busy',String(cargando));
}
