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
  await pagina.getByRole('button', { name:'Adelantar horario 15 minutos', exact:true }).click();
  assert.equal(await pagina.locator('[data-hora-actual]').textContent(), '08:15');
  await pagina.getByRole('button', { name:'Atrasar horario 15 minutos', exact:true }).click();
  await pagina.locator('[data-linea-reproducir="Roja"]').click();
  assert.deepEqual(await pagina.evaluate(() => window.escenaPrueba.motorSimulacion.rutas.map(r=>r.nombreLinea)), ['Azul']);
  assert.equal(await pagina.evaluate(() => window.escenaPrueba.motorSimulacion.duracion), 3);
  await pagina.locator('[data-linea-reproducir="Azul"]').click();
  assert.equal(await pagina.locator('#formularioEjecucion button').isDisabled(), true);
  await pagina.locator('.simulacion-lineas-todas').click();
  assert.equal(await pagina.locator('#formularioEjecucion button').isDisabled(), false);
  await pagina.evaluate(() => window.escenaPrueba.game.loop.wake());
  for (const [width,height] of [[1470,800],[1366,768],[1440,1000]]) {
    await pagina.setViewportSize({width,height});
    await pagina.locator('.simulacion-selector-metros > summary').click();
    await pagina.waitForFunction(() => { const menu=document.querySelector('.simulacion-selector-metros__opciones'); return menu.getBoundingClientRect().right <= document.querySelector('.simulacion-selector-metros > summary').getBoundingClientRect().left; });
    const medidas = await pagina.evaluate(() => {
      const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
      return {mapa:rect('.simulacion-lienzo-contenedor'),panel:rect('#instrumentosSimulacion'),menu:rect('.simulacion-selector-metros__opciones'),acceso:rect('.simulacion-selector-metros > summary'),alto:document.documentElement.scrollHeight,ancho:document.documentElement.scrollWidth};
    });
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
  await pagina.locator('.simulacion-reproduccion').getByRole('button',{name:'Líneas siguientes',exact:true}).click();
  assert.equal(await pagina.locator('[data-linea-reproducir="Línea 3"]').isVisible(),true);
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
  for(const titulo of ['Línea a configurar','Distancias de la red','Reloj de estación','Cambiar el horario','Líneas a reproducir','Reproducir la selección']) assert.ok(titulos.includes(titulo), JSON.stringify(titulos));
  await pagina.evaluate(() => window.tutorialPrueba.terminar());
  assert.deepEqual(errores, []);
});
