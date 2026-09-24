// Sustituye confirm/prompt nativos sin cambiar valores devueltos ni contratos REST.
let dialogoActivo = null;

function abrirDialogo({ mensaje, valor, entrada = false }) {
  if (dialogoActivo) return Promise.resolve(null);
  const focoAnterior = document.activeElement;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'metronet-dialogo-sistema';
  dialogo.setAttribute('aria-labelledby', 'tituloDialogoSistema');
  const form = document.createElement('form'); form.method = 'dialog';
  const etiqueta = document.createElement('p'); etiqueta.className = 'eyebrow'; etiqueta.textContent = 'METRONET // CONTROL DE RED';
  const titulo = document.createElement('h2'); titulo.id = 'tituloDialogoSistema'; titulo.textContent = entrada ? 'Entrada de datos' : 'Confirmar acción';
  form.append(etiqueta, titulo);
  let campo;
  if (entrada) {
    const label = document.createElement('label'); label.textContent = mensaje;
    campo = document.createElement('input'); campo.type = 'text'; campo.value = valor == null ? '' : String(valor);
    label.append(campo); form.append(label);
  } else {
    const texto = document.createElement('p'); texto.textContent = mensaje;
    texto.id = 'descripcionDialogoSistema'; dialogo.setAttribute('aria-describedby', texto.id); form.append(texto);
  }
  const acciones = document.createElement('footer');
  const cancelar = document.createElement('button'); cancelar.type = 'submit'; cancelar.value = 'cancelar'; cancelar.textContent = 'Cancelar';
  const aceptar = document.createElement('button'); aceptar.type = 'submit'; aceptar.value = 'aceptar'; aceptar.textContent = 'Aceptar';
  aceptar.className = /eliminar/i.test(mensaje) ? 'metronet-boton--peligro' : 'metronet-boton--primario';
  acciones.append(cancelar, aceptar); form.append(acciones); dialogo.append(form);
  dialogoActivo = dialogo; document.body.append(dialogo);
  return new Promise(resolve => {
    dialogo.addEventListener('close', () => {
      const resultado = dialogo.returnValue === 'aceptar' ? (entrada ? campo.value : true) : null;
      dialogoActivo = null; dialogo.remove();
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
      resolve(resultado);
    }, { once: true });
    // Enter en un campo confirma el dato; Escape y Cancelar preservan null/false.
    form.addEventListener('submit', evento => {
      evento.preventDefault(); dialogo.close(evento.submitter?.value || 'aceptar');
    });
    if (campo) campo.addEventListener('keydown', evento => {
      if (evento.key === 'Enter') { evento.preventDefault(); dialogo.close('aceptar'); }
    });
    dialogo.addEventListener('keydown', evento => {
      if (evento.key !== 'Tab') return;
      const primero = campo || cancelar;
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault(); aceptar.focus();
      } else if (!evento.shiftKey && document.activeElement === aceptar) {
        evento.preventDefault(); primero.focus();
      }
    });
    dialogo.showModal();
    (campo || cancelar).focus(); campo?.select();
  });
}

export async function confirmarSistema(mensaje) { return (await abrirDialogo({ mensaje })) === true; }
export function pedirDatoSistema(mensaje, valor = '') { return abrirDialogo({ mensaje, valor, entrada: true }); }
