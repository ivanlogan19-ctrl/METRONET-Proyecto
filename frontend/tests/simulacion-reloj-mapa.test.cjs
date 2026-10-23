const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

test('Phaser: posición geográfica y reloj coinciden por línea durante toda la reproducción', async t => {
  const navegador = await abrirNavegador({ channel: process.env.METRONET_BROWSER_CHANNEL });
  t.after(() => navegador.close());
  const red = {
    simulacion: { idDiseno: 77, nombre: 'Sincronización', modo: 'LIBRE', estado: 'VALIDADO' },
    estaciones: [
      { nombre: 'A', posicionX: 500, posicionY: 400 },
      { nombre: 'B', posicionX: 600, posicionY: 400 },
      { nombre: 'C', posicionX: 700, posicionY: 400 },
      { nombre: 'D', posicionX: 700, posicionY: 500 },
    ],
    lineas: [{ nombre: 'Azul' }, { nombre: 'Roja' }],
    tramos: [
      { nombreLinea: 'Azul', estacionA: 'A', estacionB: 'B', distanciaKm: 2 },
      { nombreLinea: 'Azul', estacionA: 'B', estacionB: 'C', distanciaKm: 10 },
      { nombreLinea: 'Roja', estacionA: 'C', estacionB: 'D', distanciaKm: 18 },
    ],
    unidadesMetro: [
      { idTren: 1, nombreLinea: 'Azul', velocidadPromedio: 4, duracionUt: 3, capacidad: 300 },
      { idTren: 2, nombreLinea: 'Roja', velocidadPromedio: 4, duracionUt: 4.5, capacidad: 300 },
    ],
    preparadoParaSimular: true, territorio: { areas: [], errores: [] }, resultados: [],
  };
  const { pagina, contexto, errores } = await abrirPantalla(navegador, '/simulacion.html?idDiseno=77', {
    responder: req => new URL(req.url()).pathname === '/api/simulaciones/77' ? { json: red } : undefined,
  });
  t.after(() => contexto.close());
  await pagina.route('**/src/simulacion/EscenaSimulacion.js*', async route => {
    const respuesta = await route.fetch();
    await route.fulfill({ response: respuesta, body: (await respuesta.text()).replace(
      'resolver({ escena: this, destruir });',
      'window.escenaPrueba = this; resolver({ escena: this, destruir });') });
  });
  await pagina.reload();
  await pagina.waitForFunction(() => window.escenaPrueba?.motorSimulacion?.rutas.length === 2);
  await pagina.getByRole('button', {name:'Continuar', exact:true}).click();
  await pagina.locator('[data-capa-simulacion="desplazamientos"]').click();
  await pagina.waitForFunction(() => window.escenaPrueba.capasLibre.desplazamientos.flujos.length > 0);
  const movimiento = await pagina.evaluate(() => {
    const escena=window.escenaPrueba, capas=escena.capasLibre;
    escena.game.loop.sleep();
    const inicio=capas.desplazamientos.fase, hora=capas.reloj.hora;
    for(let i=0;i<10;i++) {
      escena.events.emit('update',i*16,16);
      capas.sincronizar(escena.motorSimulacion.obtenerEstado());
    }
    return {avance:(capas.desplazamientos.fase-inicio+1)%1,hora,final:capas.reloj.hora};
  });
  assert.ok(Math.abs(movimiento.avance-.032)<1e-8,JSON.stringify(movimiento));
  assert.equal(movimiento.hora,movimiento.final,'Las flechas se mueven sin adelantar la hora del escenario');
  await pagina.locator('[data-capa-simulacion="desplazamientos"]').click();
  const muestras = await pagina.evaluate(() => {
    const escena = window.escenaPrueba;
    escena.game.loop.sleep(); // Avanzar fotogramas deterministas con el motor y los dibujos reales.
    escena.iniciarAnimacion(1, 4.5);
    const inicio = escena.motorSimulacion.marcaInicio;
    return [0, .5, 1, 2, 3, 4.5].map(horas => {
      escena.update(inicio + horas / 4.5 * escena.motorSimulacion.duracionVisual, 16);
      const estado = escena.motorSimulacion.obtenerEstado();
      const tren = escena.capaRedMetro.unidadesSimulacion.get('1');
      const xEsperada = horas <= .5 ? 500 + horas * 200 : 600 + Math.min(1, (horas - .5) / 2.5) * 100;
      const punto = escena.capaRedMetro.convertirPosicion(xEsperada, 400);
      return { horas: estado.tiempoTranscurrido, estado: estado.estado,
        errorPosicion: Math.hypot(tren.x - punto.x, tren.y - punto.y),
        km: estado.unidades.map(u => u.distanciaRecorridaKm),
        relojActual: document.querySelector('[data-hora-actual]').textContent.trim(),
        relojFin: document.querySelector('[data-hora-fin]').textContent.trim() };
    });
  });
  for (const muestra of muestras) {
    assert.ok(muestra.errorPosicion < 1e-7, JSON.stringify(muestra));
    assert.deepEqual(muestra.km, [Math.min(12, muestra.horas * 4), Math.min(18, muestra.horas * 4)]);
    const minutos = 480 + muestra.horas * 60;
    assert.equal(muestra.relojActual, `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`);
    assert.equal(muestra.relojFin, '12:30');
  }
  assert.equal(muestras[4].estado, 'EN_CURSO', 'la línea corta termina a las 11:00 y la larga sigue');
  assert.equal(muestras[5].estado, 'FINALIZADA');
  await pagina.evaluate(() => window.escenaPrueba.detenerAnimacion());
  assert.equal(await pagina.locator('#tituloSimulacion').textContent(), 'Modo libre');
  assert.equal(await pagina.locator('.simulacion-configuracion-metros').count(), 0);
  assert.deepEqual(await pagina.locator('.metronet-menu-lineas > button > span').allTextContents(), ['Todas', 'Línea azul', 'Línea fucsia']);
  assert.deepEqual(await pagina.locator('.metronet-menu-lineas > button > small').allTextContents(), ['4 UV · 3 UT', '4 UV · 4.5 UT']);
  assert.deepEqual(await pagina.locator('[data-linea-reproducir] > span').allTextContents(), ['Línea azul', 'Línea fucsia']);
  await pagina.getByRole('button', { name:'Adelantar horario 15 minutos', exact:true }).click();
  assert.equal(await pagina.locator('[data-hora-actual]').textContent(), '08:15');
  await pagina.getByRole('button', { name:'Atrasar horario 15 minutos', exact:true }).click();
  await pagina.locator('[data-linea-reproducir="Roja"]').click();
  assert.deepEqual(await pagina.evaluate(() => window.escenaPrueba.motorSimulacion.rutas.map(r=>r.nombreLinea)), ['Azul']);
  assert.equal(await pagina.evaluate(() => window.escenaPrueba.motorSimulacion.duracion), 3);
  for (const unica of ['Azul', 'Roja']) {
    for (const nombre of ['Azul', 'Roja']) {
      const boton = pagina.locator(`[data-linea-reproducir="${nombre}"]`);
      if (await boton.getAttribute('aria-pressed') !== String(nombre === unica)) await boton.click();
    }
    const recargaSeleccion = await pagina.evaluate(() => {
      const e = window.escenaPrueba, capa = e.capaRedMetro;
      const medir = () => ({
        camara: [e.cameras.main.scrollX, e.cameras.main.scrollY, e.cameras.main.zoom],
        estaciones: capa.puntosEstaciones.map(p => [p.nombre, p.x, p.y]),
        trenes: [...capa.unidadesSimulacion].map(([id, tren]) => [id, tren.x, tren.y]),
        estaticos: capa.unidadesEstaticas.length,
      });
      const antes = medir();
      // La ejecución recarga la red del servidor antes de arrancar el reloj.
      e.establecerDiseno(structuredClone(e.disenoActual));
      const recargada = medir();
      e.iniciarAnimacion(1, 4.5);
      const inicio = medir();
      const marca = e.motorSimulacion.marcaInicio;
      const posiciones = [];
      for (const horas of [0.25, 0.5, 1]) {
        e.update(marca + horas / e.motorSimulacion.duracion * e.motorSimulacion.duracionVisual, 16);
        posiciones.push({ ...medir(), hora: e.capasLibre.reloj.hora,
          tiempo: e.motorSimulacion.obtenerEstado().tiempoTranscurrido });
      }
      e.detenerAnimacion();
      return { antes, recargada, inicio, posiciones };
    });
    assert.deepEqual(recargaSeleccion.recargada, recargaSeleccion.antes,
      'Recargar antes de reproducir una línea no debe mostrar otros trenes ni saltar a una vista estática');
    assert.deepEqual(recargaSeleccion.inicio, recargaSeleccion.antes,
      'El reloj inicia desde la misma posición y selección visibles');
    for (const estado of recargaSeleccion.posiciones) {
      assert.deepEqual(estado.camara, recargaSeleccion.antes.camara);
      assert.deepEqual(estado.estaciones, recargaSeleccion.antes.estaciones);
      assert.deepEqual(estado.trenes.map(t => t[0]), [unica === 'Azul' ? '1' : '2']);
      assert.equal(estado.estaticos, 0);
      assert.equal(estado.hora, Math.floor(8 + estado.tiempo));
    }
  }
  await pagina.locator('[data-linea-reproducir="Roja"]').click();
  assert.equal(await pagina.locator('#formularioEjecucion button').isDisabled(), true);
  await pagina.locator('.simulacion-lineas-todas').click();
  assert.equal(await pagina.locator('#formularioEjecucion button').isDisabled(), false);
  await pagina.evaluate(() => window.escenaPrueba.game.loop.wake());
  for (const [width,height] of [[1470,800],[1366,768],[1440,1000]]) {
    await pagina.setViewportSize({width,height});
    const flecha = await pagina.locator('.simulacion-selector-metros > summary').evaluate(e => {
      const s=getComputedStyle(e,'::after');return {contenido:s.content,ancho:s.width,borde:s.borderRightWidth,color:s.borderRightColor,texto:getComputedStyle(e).color,giro:s.transform};
    });
    assert.equal(flecha.contenido, '""');
    assert.equal(flecha.ancho, '8px');
    assert.equal(flecha.borde, '2px');
    assert.equal(flecha.color, flecha.texto);
    assert.match(flecha.giro, /matrix\(0\.707/);
    await pagina.locator('.simulacion-selector-metros > summary').click();
    await pagina.waitForFunction(() => { const menu=document.querySelector('.simulacion-selector-metros__opciones'); return menu.getBoundingClientRect().right <= document.querySelector('.simulacion-selector-metros > summary').getBoundingClientRect().left; });
    const medidas = await pagina.evaluate(() => {
      const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
      return {mapa:rect('.simulacion-lienzo-contenedor'),panel:rect('#instrumentosSimulacion'),menu:rect('.simulacion-selector-metros__opciones'),acceso:rect('.simulacion-selector-metros > summary'),alto:document.documentElement.scrollHeight,ancho:document.documentElement.scrollWidth};
    });
    assert.ok(medidas.panel.right - medidas.panel.left <= 301, JSON.stringify(medidas));
    const accesos = await pagina.locator('.simulacion-accesos-titulo :is(.simulacion-volver-icono, .metronet-aprender-acceso, .metronet-extras-acceso, .metronet-poi > summary, .metronet-hud > summary)').evaluateAll(es => es.filter(e => !e.hidden && e.getBoundingClientRect().width > 0).map(e => {const r=e.getBoundingClientRect();return [r.width,r.height];}));
    for(const medida of accesos) assert.deepEqual(medida,[32,32]);
    assert.ok(medidas.menu.right - medidas.menu.left <= 241, JSON.stringify(medidas));
    assert.ok(medidas.menu.right <= medidas.acceso.left, JSON.stringify(medidas));
    assert.ok(medidas.menu.top >= 0 && medidas.menu.bottom <= height, JSON.stringify(medidas));
    assert.ok(Math.abs(medidas.mapa.bottom-medidas.panel.bottom)<2, JSON.stringify(medidas));
    assert.ok(medidas.alto <= height+1 && medidas.ancho <= width+1, JSON.stringify(medidas));
    if(width===1470) await pagina.screenshot({path:'/tmp/metronet-panel-libre-implementado.png'});
    await pagina.keyboard.press('Escape');
  }
  const colores = await pagina.evaluate(() => [...document.querySelectorAll('[data-linea-reproducir]')].map(b => ({
    mapa: window.escenaPrueba.capaRedMetro.colorLinea(b.dataset.lineaReproducir),
    boton: getComputedStyle(b.querySelector('b')).backgroundColor,
  })));
  for(const color of colores) assert.equal(color.boton, `rgb(${color.mapa >> 16}, ${(color.mapa >> 8) & 255}, ${color.mapa & 255})`);
  const regla = pagina.locator('[data-medicion-distancias]');
  assert.equal(await regla.isVisible(), true);
  await regla.click();
  assert.equal(await regla.getAttribute('aria-pressed'), 'true');
  assert.equal(await pagina.locator('.metronet-mediciones').isVisible(), true);
  for(let i=3;i<=12;i++) {
    const nombre=`Línea ${i}`;
    red.lineas.push({nombre});
    red.tramos.push({nombreLinea:nombre,estacionA:'A',estacionB:'B',distanciaKm:i});
    red.unidadesMetro.push({idTren:i,nombreLinea:nombre,velocidadPromedio:4,duracionUt:i/4,capacidad:300});
  }
  await pagina.reload();
  await pagina.locator('[data-linea-reproducir="Azul"]').waitFor();
  const paginas = pagina.locator('.simulacion-reproduccion .simulacion-lineas-paginas');
  const comprobarFlechas = async () => {
    const estado = await paginas.evaluate(e => ({
      controles:[...e.querySelectorAll('button')].map(b=>({color:getComputedStyle(b).backgroundColor,opacidad:getComputedStyle(b).opacity})),
      contador:e.querySelector('output'),
      distancias:[e.querySelector('button').getBoundingClientRect().left-e.getBoundingClientRect().left,
        e.getBoundingClientRect().right-e.querySelector('button:last-child').getBoundingClientRect().right]
    }));
    assert.equal(estado.controles[0].color, estado.controles[1].color);
    assert.equal(estado.controles[0].opacidad, '1');
    assert.equal(estado.controles[1].opacidad, '1');
    assert.equal(estado.contador, null);
    assert.ok(estado.distancias.every(d=>Math.abs(d)<1),JSON.stringify(estado));
  };
  await comprobarFlechas();
  const alineacion=await pagina.evaluate(()=>{
    const r=s=>document.querySelector(s).getBoundingClientRect();
    const reloj=r('.simulacion-reloj-digital');
    return ['.simulacion-lineas-paginas','.simulacion-lineas-todas','.simulacion-reproduccion__lineas',
      '.simulacion-grupo-metros > .simulacion-selector-metros','.simulacion-parametro-velocidad .simulacion-parametro-valor',
      '#seccionConfiguracion > .simulacion-parametro-valor','.simulacion-capas__botones'].map(s=>({selector:s,izquierda:r(s).left-reloj.left,derecha:r(s).right-reloj.right}));
  });
  for(const fila of alineacion)assert.ok(Math.abs(fila.izquierda)<1&&Math.abs(fila.derecha)<1,JSON.stringify(fila));
  const muestrasColor=await pagina.locator('[data-linea-reproducir]').evaluateAll(es=>es.map(e=>({
    izquierda:e.querySelector('i').getBoundingClientRect().left-e.getBoundingClientRect().left,
    derecha:e.getBoundingClientRect().right-e.querySelector('b').getBoundingClientRect().right
  })));
  for(const muestra of muestrasColor)assert.ok(Math.abs(muestra.izquierda)<1&&Math.abs(muestra.derecha)<1,JSON.stringify(muestra));
  await pagina.locator('.simulacion-reproduccion').getByRole('button',{name:'Líneas siguientes',exact:true}).click();
  assert.equal(await pagina.locator('[data-linea-reproducir="Línea 3"]').isVisible(),true);
  await comprobarFlechas();
  await pagina.locator('.simulacion-selector-metros > summary').click();
  await pagina.getByRole('button',{name:'Opciones siguientes',exact:true}).click();
  await pagina.locator('.simulacion-selector-metros__opciones [data-metro="6"]').click();
  assert.equal(await pagina.locator('#unidadCirculacion').inputValue(),'6');
  await pagina.locator('[data-linea-reproducir="Línea 3"]').click();
  const seleccion = await pagina.locator('[data-linea-reproducir="Línea 3"]').getAttribute('aria-pressed');
  await pagina.evaluate(() => { const e=window.escenaPrueba; e.establecerDiseno(e.disenoActual); });
  assert.equal(await pagina.locator('[data-linea-reproducir="Línea 3"]').getAttribute('aria-pressed'), seleccion, 'Recargar los valores conserva la selección de reproducción');
  await pagina.evaluate(async () => { const m=await import('/src/educacion/TutorialSimulacion.js'); window.tutorialPrueba=m.abrirTutorialSimulacion(()=>{}, undefined, {modo:'LIBRE'}); });
  const titulos=[];
  for(let i=0;i<16;i++) {
    const titulo=await pagina.locator('#recorrido-titulo').textContent(); titulos.push(titulo);
    if(titulo==='¡Listo para simular!')break;
    await pagina.locator('[data-recorrido-siguiente]').click();
  }
  for(const titulo of ['Línea o conexión a configurar','Distancias de la red','Reloj de estación','Cambiar el horario','Línea o conexión a reproducir','Reproducir la selección']) assert.ok(titulos.includes(titulo), JSON.stringify(titulos));
  await pagina.evaluate(() => window.tutorialPrueba.terminar());
  assert.deepEqual(errores, []);
});
