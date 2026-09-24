import catalogo from './mensajesTransicion.json';

const ultimosEnMemoria = new Map();
const GENERICO = Object.freeze({ id: 'generico', categoria: 'Consejo de movilidad', texto: 'Analizá las conexiones antes de tomar una decisión.' });

// Contenido editorial basado en niveles.json y en las mecánicas existentes.
// No se generan hechos históricos ni se guarda el mensaje dentro del escenario.
export function seleccionarMensajeTransicion(numero) {
  const mensajes = catalogo.find(nivel => nivel.numero === numero)?.mensajes ?? [];
  if (!mensajes.length) return GENERICO;
  const clave = `metronet:transicion:ultimo:${numero}`;
  let ultimo = ultimosEnMemoria.get(numero);
  try { ultimo = sessionStorage.getItem(clave) ?? ultimo; } catch { /* Sin almacenamiento, alcanza la memoria de esta página. */ }
  const alternativas = mensajes.filter(mensaje => mensaje.id !== ultimo);
  const disponibles = alternativas.length ? alternativas : mensajes;
  const elegido = disponibles[Math.floor(Math.random() * disponibles.length)];
  ultimosEnMemoria.set(numero, elegido.id);
  try { sessionStorage.setItem(clave, elegido.id); } catch { /* El acceso al nivel no depende del almacenamiento. */ }
  return elegido;
}
