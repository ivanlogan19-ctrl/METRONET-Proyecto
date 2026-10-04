/** Editor acotado de UT y presupuesto UV; abrir y previsualizar no publican cambios. */
export function crearAdministracionUvUt({ contenedor, mensaje, token, urlServidor, errorRespuesta }) {
  let niveles = [];
  const base = `${urlServidor()}/api/admin/niveles/criterio-uvut`;
  const cabeceras = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const avisar = (texto, error = false) => {
    mensaje.textContent = texto;
    mensaje.className = `admin-mensaje ${error ? 'error' : ''}`;
  };

  async function cargar() {
    avisar('Cargando criterios UV/UT…');
    try {
      const respuesta = await fetch(base, { headers: cabeceras });
      if (!respuesta.ok) throw new Error(await errorRespuesta(respuesta, 'No fue posible cargar los criterios.'));
      niveles = await respuesta.json();
      contenedor.replaceChildren(...niveles.map(crearFila));
      avisar('Los cambios de criterios se aplican únicamente a intentos nuevos.');
    } catch (error) { avisar(error.message, true); }
  }

  function crearFila(nivel) {
    const fila = document.createElement('article');
    fila.className = 'admin-configuracion-item admin-criterio-uv-ut';
    const info = document.createElement('div');
    const titulo = document.createElement('h3');
    titulo.textContent = `Nivel ${nivel.numero} · criterio UV/UT`;
    const detalle = document.createElement('p');
    detalle.textContent = `Versión ${nivel.version || 'sin publicar'} · Red verificada: ${nivel.tramosFixture.join(' + ')} tramos. ${nivel.aviso}`;
    info.append(titulo, detalle);
    const campos = document.createElement('div');
    campos.className = 'admin-campo-configuracion';
    const ut = document.createElement('input');
    ut.type = 'number'; ut.min = '1'; ut.step = '1'; ut.value = nivel.limiteUt ?? '';
    ut.setAttribute('aria-label', `Límite UT del nivel ${nivel.numero}`);
    const uv = document.createElement('input');
    uv.type = 'number'; uv.min = '0.01'; uv.step = '0.01'; uv.value = nivel.presupuestoUv ?? '';
    uv.setAttribute('aria-label', `Presupuesto UV del nivel ${nivel.numero}`);
    const etiquetaUt = document.createElement('label'); etiquetaUt.textContent = 'Límite UT'; etiquetaUt.append(ut);
    const etiquetaUv = document.createElement('label'); etiquetaUv.textContent = 'Presupuesto UV'; etiquetaUv.append(uv);
    campos.append(etiquetaUt, etiquetaUv);
    const vista = document.createElement('button');
    vista.type = 'button'; vista.className = 'admin-secundario'; vista.textContent = 'Previsualizar';
    const aplicar = document.createElement('button');
    aplicar.type = 'button'; aplicar.className = 'admin-guardar'; aplicar.textContent = 'Aplicar a intentos nuevos'; aplicar.disabled = true;
    const construirCambio = () => ({ limiteUt: Number(ut.value), presupuestoUv: Number(uv.value), versionEsperada: nivel.version });
    const invalidar = () => { aplicar.disabled = true; detalle.textContent = 'Previsualizá estos valores antes de aplicarlos.'; };
    ut.addEventListener('input', invalidar); uv.addEventListener('input', invalidar);
    vista.addEventListener('click', async () => {
      aplicar.disabled = true;
      if (!ut.checkValidity() || !uv.checkValidity() || !ut.value || !uv.value) return avisar('Ingresá UT enteras positivas y presupuesto UV válido.', true);
      try {
        const respuesta = await fetch(`${base}/${nivel.numero}/previsualizar`, { method: 'POST', headers: cabeceras, body: JSON.stringify(construirCambio()) });
        if (!respuesta.ok) throw new Error(await errorRespuesta(respuesta, 'No fue posible previsualizar.'));
        const previo = await respuesta.json();
        detalle.textContent = `${previo.aviso}. UV mínima de la red verificada: ${previo.uvMinimaFixture ?? '—'}.`;
        aplicar.disabled = !previo.viable;
        avisar(previo.viable ? 'Vista previa lista. Aplicá solo si querés publicar estos valores.' : previo.aviso, !previo.viable);
      } catch (error) { avisar(error.message, true); }
    });
    aplicar.addEventListener('click', async () => {
      if (aplicar.disabled) return;
      aplicar.disabled = true;
      try {
        const respuesta = await fetch(`${base}/${nivel.numero}`, { method: 'PUT', headers: cabeceras, body: JSON.stringify(construirCambio()) });
        if (!respuesta.ok) throw new Error(await errorRespuesta(respuesta, 'No fue posible aplicar los criterios.'));
        await cargar();
        avisar(`Criterio del nivel ${nivel.numero} publicado para intentos nuevos.`);
      } catch (error) { avisar(error.message, true); }
    });
    fila.append(info, campos, vista, aplicar);
    return fila;
  }

  return { cargar };
}
