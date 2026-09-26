// Coordina contratos existentes. Las reglas y la autorización siguen en el servidor.
export async function prepararDiseno(cliente, idDiseno, { guardar = false, paraSimular = false, vigente = () => true } = {}) {
  const comprobar = () => { if (!vigente()) throw new Error('La operación ya no pertenece al diseño activo.'); };
  const diseno = await cliente.obtener(idDiseno);
  comprobar();
  const protegido = diseno.simulacion.estado === 'COMPLETADO';
  const validacion = await cliente.solicitar(`/${idDiseno}/validacion`, { method: protegido ? 'GET' : 'POST' });
  comprobar();
  if (paraSimular && (!validacion.valido || !validacion.preparadoParaSimular)) {
    throw new Error([...(validacion.observaciones ?? []), ...(validacion.observacionesSimulacion ?? [])].join(' ') || 'La red todavía no está lista para simular.');
  }
  if (guardar && !protegido) await cliente.solicitar(`/${idDiseno}/guardar`, { method: 'POST' });
  comprobar();
  return { validacion, protegido };
}

const CLAVE_INICIO = 'metronet.inicio-simulacion';
export function solicitarInicioSimulacion(idDiseno) {
  try { sessionStorage.setItem(CLAVE_INICIO, JSON.stringify({ idDiseno, fecha: Date.now() })); } catch { /* Play queda disponible si el navegador impide almacenar la intención. */ }
}
export function consumirInicioSimulacion(idDiseno) {
  try {
    const entrada = JSON.parse(sessionStorage.getItem(CLAVE_INICIO) || 'null');
    sessionStorage.removeItem(CLAVE_INICIO);
    return entrada?.idDiseno === idDiseno && Date.now() - entrada.fecha < 30000;
  } catch { return false; }
}
