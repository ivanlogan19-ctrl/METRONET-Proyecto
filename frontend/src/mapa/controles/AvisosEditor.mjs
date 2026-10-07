/** Los avances rutinarios ya se reflejan en el mapa y los objetivos del editor. */
export function esAvisoRutinarioEditor(texto, tipo) {
  if (tipo === 'info' || tipo === 'exito') return true;
  return tipo === 'advertencia' && (
    /^Progreso \d+%\./.test(texto)
    || /^\d+ de \d+ criterios satisfechos:/.test(texto)
  );
}
