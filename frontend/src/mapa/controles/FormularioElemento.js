// Edición dentro del panel de selección, sin diálogos ni persistencia propia.
export function mostrarFormularioElemento(panel, campos, guardar, cancelar) {
  const formulario = document.createElement('form');
  formulario.className = 'metronet-editar-elemento';
  formulario.dataset.editarElemento = '';
  const controles = new Map();
  for (const { nombre, etiqueta, valor, tipo = 'text' } of campos) {
    const label = document.createElement('label');
    const texto = document.createElement('span');
    texto.textContent = etiqueta;
    const input = document.createElement('input');
    input.name = nombre;
    input.type = tipo;
    if (tipo === 'number') input.step = 'any';
    if (tipo === 'checkbox') input.checked = Boolean(valor);
    else input.value = String(valor ?? '');
    label.append(texto, input);
    formulario.append(label);
    controles.set(nombre, input);
  }
  const acciones = document.createElement('div');
  const aceptar = document.createElement('button');
  aceptar.type = 'submit';
  aceptar.textContent = 'Guardar cambios';
  aceptar.className = 'metronet-accion-primaria';
  const volver = document.createElement('button');
  volver.type = 'button';
  volver.textContent = 'Cancelar edición';
  volver.addEventListener('click', cancelar);
  acciones.append(aceptar, volver);
  formulario.append(acciones);
  formulario.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !aceptar.disabled) {
      evento.preventDefault();
      evento.stopPropagation();
      cancelar();
    }
  });
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (aceptar.disabled) return;
    const datos = Object.fromEntries([...controles].map(([nombre, input]) => [nombre, input.type === 'checkbox' ? input.checked : input.value.trim()]));
    aceptar.disabled = true;
    volver.disabled = true;
    try { await guardar(datos); }
    finally { aceptar.disabled = false; volver.disabled = false; }
  });
  panel.querySelector('div')?.replaceWith(formulario);
  controles.values().next().value?.focus();
  return formulario;
}
