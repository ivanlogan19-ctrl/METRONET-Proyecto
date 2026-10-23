import catalogo from './recorrido-integral.json';

// Registro compartido por Editor y Simulación. La progresión surge de reglas,
// no de listas de números duplicadas en cada pantalla.
export function escenarioCampana(numero, escenario) {
  return escenario?.reglasExito ? escenario : catalogo.find(n => n.numero === numero);
}
export function funcionesCampana(escenario) {
  const r = escenario?.reglasExito ?? {}, h = escenario?.herramientasHabilitadas ?? {};
  const funciones = [];
  if (h.estaciones && h.lineas && h.metros) funciones.push('editor.basico');
  if (r.minimoTramos >= 2 || r.configuracionRecorrido?.estacionesPorLinea?.some(n => n > 2)) funciones.push('editor.extender');
  if (r.puntosInteresObjetivo?.length) funciones.push('editor.poi');
  if (r.minimoConexionesLineas) funciones.push('editor.conectar');
  const practica = r.configuracionRecorrido?.practica;
  if (practica && practica !== 'inicial') funciones.push(practica.endsWith('UT') ? 'simulacion.duracion' : 'simulacion.velocidad');
  for (const [clave, activa] of Object.entries(r.aprendizajeSimulacion ?? {}))
    if (activa) funciones.push(`simulacion.${clave}`);
  return funciones;
}
export function funcionesIntroducidas(numero, escenario) {
  const anteriores = new Set(catalogo.filter(n => n.numero < numero).flatMap(funcionesCampana));
  return funcionesCampana(escenarioCampana(numero, escenario)).filter(clave => !anteriores.has(clave));
}
const claveRegistro = id => `metronet:funciones-ensenadas:v1:${id ?? 'invitado'}`;
export function funcionesEnsenadas(id) {
  try { return new Set(JSON.parse(localStorage.getItem(claveRegistro(id)) ?? '[]')); }
  catch { return new Set(); }
}
export function registrarFuncionesEnsenadas(id, funciones) {
  const aprendidas = funcionesEnsenadas(id);
  funciones.forEach(clave => aprendidas.add(clave));
  try { localStorage.setItem(claveRegistro(id), JSON.stringify([...aprendidas])); } catch { /* No bloquea jugar. */ }
}

// Cambiar una lección no borra lo aprendido en las demás.
export const claveAprendizajeTutorial = clave => clave === 'editor.conectar' ? 'editor.conectar.v3' : clave === 'editor.poi' ? 'editor.poi.v2' : ['editor.basico', 'editor.extender'].includes(clave) ? `${clave}.v3` : clave;
export function describirFunciones(funciones) {
  const nombres = { 'editor.extender':'extender recorridos con Línea', 'editor.poi':'buscar puntos de interés y usar sus categorías, barrios y zonas',
    'editor.conectar':'unir líneas en una estación compartida con Conexión', 'simulacion.velocidad':'cambiar la velocidad UV y observar la UT calculada',
    'simulacion.duracion':'cambiar la duración UT y observar la UV calculada', 'simulacion.global':'ajustar todas las líneas',
    'simulacion.individual':'ajustar una sola línea', 'simulacion.combinacion':'comparar UV y UT juntas' };
  return funciones.map(c => nombres[c] ?? c).join(' y ');
}
