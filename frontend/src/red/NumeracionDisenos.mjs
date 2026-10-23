// La numeración de presentación cuenta los diseños existentes de cada cuenta.
// Las claves de base de datos permanecen intactas para abrir, guardar y eliminar.
export function numerarDisenos(disenos) {
  const cantidades = new Map();
  const numeros = new Map();
  for (const diseno of [...disenos].sort((a, b) => a.idDiseno - b.idDiseno)) {
    const propietario = diseno.idUsuario ?? diseno.correoPropietario ?? '';
    const numero = (cantidades.get(propietario) ?? 0) + 1;
    cantidades.set(propietario, numero);
    numeros.set(diseno.idDiseno, numero);
  }
  return numeros;
}

export function etiquetaDiseno(diseno, numeros) {
  const numero = numeros.get(diseno.idDiseno);
  return numero ? `Diseño ${numero}` : 'Diseño';
}

export function nombreDiseno(diseno, numeros) {
  return diseno.nombre?.trim() || etiquetaDiseno(diseno, numeros);
}
