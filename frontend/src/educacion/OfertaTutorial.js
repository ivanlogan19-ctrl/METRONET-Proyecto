// La oferta comparte tamaño, tipografía y acciones con la presentación inicial.
export function ofrecerTutorial({ titulo = 'Nueva funcionalidad', descripcion, inicial = false, bienvenidaLibre = false, textoAceptar, textoOmitir = 'Comenzar directamente', alAceptar, alOmitir = () => {} }) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-recorrido';
  dialogo.setAttribute('data-oferta-tutorial', '');
  if (bienvenidaLibre) dialogo.setAttribute('data-bienvenida-libre', '');
  const encabezado = document.createElement('h2'); encabezado.textContent = titulo;
  encabezado.id = 'oferta-tutorial-titulo'; dialogo.setAttribute('aria-labelledby', encabezado.id);
  const parrafos = (Array.isArray(descripcion) ? descripcion : [descripcion]).map(contenido => {
    const texto = document.createElement('p'); texto.textContent = contenido; return texto;
  });
  const acciones = document.createElement('div'); acciones.className = 'metronet-recorrido__acciones';
  const cerrar = () => { if (dialogo.open) dialogo.close(); dialogo.remove(); };
  for (const [etiqueta, accion] of [[textoAceptar ?? (inicial ? 'Mostrar tutorial' : 'Hacer el tutorial'), alAceptar], [textoOmitir, alOmitir]]) {
    const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = etiqueta;
    boton.addEventListener('click', () => { cerrar(); accion(); }); acciones.append(boton);
  }
  dialogo.addEventListener('cancel', e => { e.preventDefault(); cerrar(); alOmitir(); });
  dialogo.append(encabezado, ...parrafos, acciones); document.body.append(dialogo); dialogo.showModal();
  return { terminar: cerrar };
}
