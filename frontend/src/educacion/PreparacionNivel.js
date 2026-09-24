// La introducción es opcional: incluso un fallo de carga de su módulo
// debe permitir que el llamador continúe con el inicio habitual del escenario.
export async function prepararNivel(escenario, anterior = null) {
  try {
    if (anterior) {
      const { mostrarTransicionNivel } = await import('./PantallaTransicionNivel.js');
      return await mostrarTransicionNivel(anterior, escenario, { puntaje: anterior.ultimoPuntaje });
    }
    const { mostrarPreparacionNivel } = await import('./PantallaPreparacionNivel.js');
    return await mostrarPreparacionNivel(escenario);
  } catch {
    return true;
  }
}
