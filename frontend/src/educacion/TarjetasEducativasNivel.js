import catalogo from './catalogo-svgs-niveles.json' with { type: 'json' };

// El catálogo conserva juntos el contenido editorial y su imagen verificada.
export const TARJETAS_EDUCATIVAS = Object.freeze(catalogo.map(nivel =>
  Object.freeze(nivel.tarjetas.map(({ id, imagen, titulo, texto, aprendizaje, fuente, url, descripcionImagen }) =>
    Object.freeze({ id, imagen, titulo, texto, aprendizaje, fuente, url, descripcionImagen })))));

const ultimasEnMemoria = new Map();
const usadasEnMemoria = new Map();
const PREFIJO_ULTIMA_TARJETA = 'metronet:educacion:ultimo:';
const PREFIJO_TARJETAS_USADAS = 'metronet:educacion:usadas:';
const publicadas = new Map();
const ultimaPublicadaEnMemoria = new Map();
const usadasPublicadasEnMemoria = new Map();

export function registrarTarjetasPublicadas(numero, contenido, idUsuario, idIntento = null) {
  if (!Number.isInteger(numero) || !Array.isArray(contenido?.tarjetas) || ![6, 7].includes(contenido.tarjetas.length)) return;
  const ids = contenido.tarjetas.map(t => t.id);
  if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !id)) return;
  publicadas.set(numero, { tarjetas: contenido.tarjetas, version: contenido.version,
    usuario: idUsuario ?? 'sesion', idIntento });
}

export function limpiarTarjetasPublicadas(numero) {
  publicadas.delete(numero);
}

export function tarjetasDisponibles(numero) {
  return publicadas.get(numero)?.tarjetas ?? TARJETAS_EDUCATIVAS[numero - 1] ?? [];
}

function estadoPublicado(numero) {
  const publicacion = publicadas.get(numero);
  if (!publicacion) return null;
  const clave = `${publicacion.usuario}:${numero}:${publicacion.version}`;
  const ultimoKey = `metronet:educacion:ultimo-id:${clave}`;
  const usadasKey = `metronet:educacion:usadas-id:${clave}`;
  let ultimo = ultimaPublicadaEnMemoria.get(clave) ?? null;
  let usadas = usadasPublicadasEnMemoria.get(clave) ?? null;
  const ids = publicacion.tarjetas.map(t => t.id);
  try {
    if (ultimo === null) ultimo = localStorage.getItem(ultimoKey);
    if (usadas === null) usadas = JSON.parse(localStorage.getItem(usadasKey));
    const migradaKey = `metronet:educacion:migrada:${clave}`;
    if (publicacion.version === 1 && !localStorage.getItem(migradaKey)) {
      const indiceAnterior = Number(localStorage.getItem(`${PREFIJO_ULTIMA_TARJETA}${numero}`));
      const indices = JSON.parse(localStorage.getItem(`${PREFIJO_TARJETAS_USADAS}${numero}`));
      if (localStorage.getItem(`${PREFIJO_ULTIMA_TARJETA}${numero}`) !== null && Number.isInteger(indiceAnterior))
        ultimo = ids[indiceAnterior] ?? null;
      if (Array.isArray(indices) && indices.every(i => Number.isInteger(i) && ids[i]))
        usadas = [...new Set(indices.map(i => ids[i]))];
      localStorage.setItem(migradaKey, '1');
    }
  } catch { /* El almacenamiento puede estar deshabilitado o contener datos legados inválidos. */ }
  if (!ids.includes(ultimo)) ultimo = null;
  if (!Array.isArray(usadas) || usadas.some(id => !ids.includes(id)) || new Set(usadas).size !== usadas.length) usadas = [];
  return { publicacion, clave, ultimoKey, usadasKey, ultimo, usadas };
}

function seleccionarPublicada(numero) {
  const estado = estadoPublicado(numero);
  if (!estado) return null;
  const tarjetas = estado.publicacion.tarjetas;
  const usadas = estado.usadas.length === tarjetas.length ? [] : estado.usadas;
  let candidatas = tarjetas.filter(t => !usadas.includes(t.id));
  if (!usadas.length && candidatas.length > 1) candidatas = candidatas.filter(t => t.id !== estado.ultimo);
  const tarjeta = candidatas[Math.floor(Math.random() * candidatas.length)];
  usadasPublicadasEnMemoria.set(estado.clave, [...usadas, tarjeta.id]);
  ultimaPublicadaEnMemoria.set(estado.clave, tarjeta.id);
  try {
    localStorage.setItem(estado.ultimoKey, tarjeta.id);
    localStorage.setItem(estado.usadasKey, JSON.stringify([...usadas, tarjeta.id]));
  } catch { /* La rotación sigue en memoria. */ }
  return tarjeta;
}

function ultima(numero) {
  if (ultimasEnMemoria.has(numero)) return ultimasEnMemoria.get(numero);
  try {
    const guardada = localStorage.getItem(`${PREFIJO_ULTIMA_TARJETA}${numero}`);
    const indice = Number(guardada);
    if (guardada !== null && Number.isInteger(indice) && indice >= 0 && indice < (TARJETAS_EDUCATIVAS[numero - 1]?.length ?? 0)) return indice;
  } catch { /* El almacenamiento puede estar deshabilitado. */ }
  return ultimasEnMemoria.get(numero) ?? -1;
}

export function seleccionarTarjetaEducativa(numero) {
  if (publicadas.has(numero)) return seleccionarPublicada(numero);
  const pareja = TARJETAS_EDUCATIVAS[numero - 1];
  if (!pareja) return null;
  let usadas = usadasEnMemoria.get(numero);
  if (!usadas) {
    try {
      const guardadas = JSON.parse(localStorage.getItem(`${PREFIJO_TARJETAS_USADAS}${numero}`));
      if (Array.isArray(guardadas) && guardadas.every(i => Number.isInteger(i) && i >= 0 && i < pareja.length)
        && new Set(guardadas).size === guardadas.length) usadas = guardadas;
    } catch { /* Continúa con un ciclo nuevo en memoria. */ }
    usadas ??= [];
  }
  if (usadas.length === pareja.length) usadas = [];
  let candidatas = pareja.map((_, i) => i).filter(i => !usadas.includes(i));
  if (usadas.length === 0 && candidatas.length > 1) candidatas = candidatas.filter(i => i !== ultima(numero));
  const indice = candidatas[Math.floor(Math.random() * candidatas.length)];
  usadas = [...usadas, indice];
  usadasEnMemoria.set(numero, usadas);
  ultimasEnMemoria.set(numero, indice);
  try {
    localStorage.setItem(`${PREFIJO_ULTIMA_TARJETA}${numero}`, String(indice));
    localStorage.setItem(`${PREFIJO_TARJETAS_USADAS}${numero}`, JSON.stringify(usadas));
  } catch { /* Continúa en memoria. */ }
  return pareja[indice];
}

export function tarjetaEducativaActual(numero) {
  const publicada = estadoPublicado(numero);
  if (publicada) return publicada.publicacion.tarjetas.find(t => t.id === publicada.ultimo)
    ?? publicada.publicacion.tarjetas[0];
  const pareja = TARJETAS_EDUCATIVAS[numero - 1];
  if (!pareja) return null;
  return pareja[Math.max(0, ultima(numero))];
}
