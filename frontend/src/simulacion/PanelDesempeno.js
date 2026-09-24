const texto = (tag, valor) => { const e = document.createElement(tag); e.textContent = valor; return e; };

export function renderizarDesempeno(contenedor, diseno, desempeno, guardar) {
  contenedor.replaceChildren();
  const disponible = Number.isFinite(desempeno?.puntajeMaximo);
  contenedor.append(texto('h3', 'Circulación y desempeño'));
  const contexto = texto('p', 'Velocidad promedio de circulación en km/h. Los tiempos son estimaciones de distancia / velocidad, sin paradas ni tráfico. El ritmo × solo acelera la reproducción y no otorga puntos.');
  contenedor.append(contexto);
  if (disponible) {
    const etapa = { RED: '1 · Resolver la red', VELOCIDAD: '2 · Ajustar velocidades', SIMULACION: '3 · Simular la configuración actual', LISTO: 'Resultado listo para registrar' }[desempeno.etapa];
    contenedor.append(texto('strong', etapa), texto('p', desempeno.explicacion));
    contenedor.append(texto('p', `Puntaje estimado: ${desempeno.puntaje} / ${desempeno.puntajeMaximo}. Se registra al completar la consigna y evaluar la simulación.`));
  }
  const campo = document.createElement('fieldset');
  campo.dataset.controlesCirculacion = '';
  campo.append(texto('legend', 'Velocidades de las unidades'));
  for (const unidad of diseno.unidadesMetro ?? []) {
    const form = document.createElement('form'); form.className = 'simulacion-velocidad-unidad';
    const label = texto('label', `Metro ${unidad.idTren} · ${unidad.nombreLinea} · km/h`);
    const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.step = '0.1'; input.required = true;
    input.value = unidad.velocidadPromedio; input.setAttribute('aria-label', `Velocidad del metro ${unidad.idTren} en km/h`);
    const boton = texto('button', 'Aplicar km/h'); boton.type = 'submit';
    input.disabled = boton.disabled = disponible && !desempeno.redResuelta;
    label.append(input); form.append(label, boton);
    const medida = desempeno?.unidades?.find(u => u.idTren === unidad.idTren);
    if (medida) form.append(texto('p', `${medida.distanciaKm.toFixed(2)} km · ${medida.tiempoMinutos.toFixed(1)} min estimados a ${medida.velocidadKmh} km/h.`));
    let guardando = false;
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (guardando) return; guardando = true; boton.disabled = true;
      try { await guardar(unidad, Number(input.value)); } finally { guardando = false; boton.disabled = false; }
    });
    campo.append(form);
  }
  if (!diseno.unidadesMetro?.length) campo.append(texto('p', 'Agregá una unidad desde el Constructor para configurar su circulación.'));
  contenedor.append(campo);
}
