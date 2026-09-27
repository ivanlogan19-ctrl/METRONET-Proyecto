// La URL se valida después de normalizarla: /\dominio también puede ser externo.
export function obtenerDestinoSeguro(destino, respaldo = '/inicio.html') {
  if (typeof destino !== 'string' || !destino.startsWith('/') || /[\\\u0000-\u0020]/.test(destino)) return respaldo;
  try {
    const url = new URL(destino, location.origin);
    return url.origin === location.origin ? url.pathname + url.search + url.hash : respaldo;
  } catch { return respaldo; }
}
