// Phaser real y API simulada. Requiere Vite activo y Playwright del entorno.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
async function preparar(t, opciones) {
  const resultado = await abrirEditor(navegador, opciones);
  t.after(() => resultado.contexto.close());
  t.after(() => assert.deepEqual(resultado.errores, []));
  await resultado.pagina.evaluate(() => { window.poi = juegoPrueba.scene.getScene('MapaScene').capaPuntosInteres; });
  return resultado;
}

test('radio POI: dibujo y coordenadas de estación comparten centro y límite inclusive', async t => {
  const { pagina } = await preparar(t);
  const radios = await pagina.evaluate(() => {
    const dibujo = [], crear = poi.escena.add.graphics;
    poi.escena.add.graphics = function (...args) {
      const g = crear.apply(this,args), original=g.strokeEllipse;
      g.strokeEllipse = function (x,y,ancho,alto,...resto) {
        if(this.name.startsWith('cobertura-poi-')) dibujo.push({id:Number(this.name.slice(14)),x,y,ancho,alto});
        return original.call(this,x,y,ancho,alto,...resto);
      };
      return g;
    };
    try { poi.establecerPuntosObjetivo([{idPunto:1,radioCobertura:25},{idPunto:3,radioCobertura:25}]); }
    finally { poi.escena.add.graphics=crear; }
    const red=editorPrueba.capaRedMetro;
    return dibujo.map(d=>{
      const p=poi.representaciones.find(r=>r.punto.id===d.id).posicion;
      const escala=poi.capaBarrios.calcularEscalaMapa();
      const centro={x:(p.x-escala.offsetX)/escala.anchoMapa*1000,y:(p.y-escala.offsetY)/escala.altoMapa*620};
      return {...d,centroVisual:p,casos:[24.99,25,25.01].map(distancia=>{
        const punto=red.convertirPosicion(centro.x+distancia,centro.y);
        return {distancia,radioNormalizado:Math.hypot((punto.x-d.x)/(d.ancho/2),(punto.y-d.y)/(d.alto/2))};
      })};
    });
  });
  assert.equal(radios.length,2);
  for(const r of radios) {
    assert.equal(r.x,r.centroVisual.x);assert.equal(r.y,r.centroVisual.y);
    assert.ok(r.casos[0].radioNormalizado<1);
    assert.ok(Math.abs(r.casos[1].radioNormalizado-1)<1e-8,'El borde visual corresponde exactamente a 25 unidades');
    assert.ok(r.casos[2].radioNormalizado>1);
  }
});

test('el zoom no crea etiquetas normales ni deja objetos huérfanos', async (t) => {
  const { pagina } = await preparar(t);
  const resultado = await pagina.evaluate(() => {
    const inicial = poi.escena.children.length;
    const vistas = [1, 2, 4, 1, 4, 2, 4].map((zoom) => {
      poi.escena.cameras.main.setZoom(zoom);
      poi.actualizarVisibilidad(zoom, { vista: { minimoX: 0, minimoY: 0, maximoX: 2000, maximoY: 2000 } });
      return { etiquetas: poi.representaciones.filter(r => r.etiqueta?.visible).length, objetos: poi.escena.children.length };
    });
    return { inicial, vistas };
  });
  for (const vista of resultado.vistas) {
    assert.equal(vista.etiquetas, 0);
    assert.equal(vista.objetos, resultado.inicial);
  }
});

test('seleccionar, usar botones de zoom y cerrar conserva y después elimina nombre y ficha', async (t) => {
  const { pagina } = await preparar(t);
  await pagina.evaluate(() => poi.seleccionarPunto(1, { enfocar: true, duracion: 0 }));
  const ficha = pagina.getByRole('dialog', { name: 'Información de Palacio Legislativo' });
  await ficha.waitFor();
  for (let i = 0; i < 3; i++) {
    await pagina.locator('.metronet-control-zoom-boton').first().click();
    await pagina.locator('.metronet-control-zoom-boton').nth(1).click();
  }
  assert.equal(await ficha.count(), 1);
  assert.deepEqual(await pagina.evaluate(() => ({ seleccion: poi.puntoSeleccionado, etiquetas: poi.representaciones.filter(r => r.etiqueta?.visible).map(r => r.punto.id) })), { seleccion: 'id:1', etiquetas: [] });
  assert.match(await ficha.innerText(), /Barrio según el mapa: AGUADA/);
  assert.match(await ficha.innerText(), /Zona: OESTE/);
  assert.match(await ficha.innerText(), /Coordenadas:/);
  await ficha.getByRole('button', { name: 'Cerrar', exact: true }).click();
  assert.equal(await ficha.count(), 0);
  assert.equal(await pagina.evaluate(() => poi.puntoSeleccionado), null);
  assert.equal(await pagina.evaluate(() => poi.representaciones.filter(r => r.etiqueta).length), 0);
});

test('búsqueda localiza el POI y muestra nombre; sin resultados no selecciona otro', async (t) => {
  const { pagina } = await preparar(t);
  await pagina.locator('.metronet-poi>summary').click();
  await pagina.getByRole('button', { name: 'Buscar punto de interés' }).click();
  const busqueda = pagina.getByRole('searchbox', { name: 'Buscar punto de interés' });
  await busqueda.fill('Palacio Legislativo');
  await pagina.locator('.metronet-panel-puntos-lista button').first().click();
  await pagina.getByRole('dialog', { name: 'Información de Palacio Legislativo' }).waitFor();
  assert.equal(await pagina.evaluate(() => poi.puntoSeleccionado), 'id:1');
  await pagina.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await pagina.locator('.metronet-poi>summary').click();
  await pagina.getByRole('button', { name: 'Buscar punto de interés' }).click();
  await busqueda.fill('zz-no-existe-zz');
  assert.equal(await pagina.locator('.metronet-panel-puntos-lista button').count(), 0);
  assert.equal(await pagina.evaluate(() => poi.puntoSeleccionado), null);
});

test('varios objetivos conservan etiquetas y radios, y se limpian al cambiar de escenario', async (t) => {
  const { pagina } = await preparar(t, { objetivos: [{ idPunto: 1, radioCobertura: 60 }, { idPunto: 26, radioCobertura: 60 }] });
  assert.deepEqual((await pagina.evaluate(() => poi.representaciones.filter(r => r.etiqueta).map(r => r.punto.id))).sort((a,b)=>a-b), []);
  assert.equal(await pagina.evaluate(() => poi.elementos.filter(e => e.name?.startsWith('cobertura-poi-')).length), 2);
  const cobertura = await pagina.evaluate(async () => {
    const { obtenerCategoriaReferencia } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
    const referencia = poi.representaciones.find(r => r.punto.id === 1);
    const categoria = obtenerCategoriaReferencia(referencia.punto);
    const inicial = referencia.cobertura.visible;
    poi.establecerCategoriasVisibles([categoria]);
    const activada = referencia.cobertura.visible;
    poi.establecerCategoriasVisibles([]);
    return { inicial, activada, apagada: referencia.cobertura.visible };
  });
  assert.deepEqual(cobertura, { inicial: false, activada: true, apagada: false });
  const escalas = await pagina.evaluate(() => [1, 2, 4].flatMap(zoom => {
    poi.escena.cameras.main.setZoom(zoom);
    poi.actualizarTamanoIconos();
    return poi.elementos.filter(e => e.name?.startsWith('cobertura-poi-')).map(e => e.scaleX);
  }));
  assert.ok(escalas.every(escala => escala === 1), 'el radio debe conservar sus unidades del mapa al hacer zoom');
  await pagina.evaluate(() => poi.seleccionarPunto(26));
  const texto = await pagina.getByRole('dialog').innerText();
  assert.match(texto, /Objetivo del nivel/i);
  assert.match(texto, /60 unidades del mapa/);
  assert.match(texto, /Barrio según el mapa: PUNTA GORDA/);
  assert.match(texto, /Barrio del catálogo: CARRASCO/);
  await pagina.getByRole('button', { name: 'Cerrar', exact: true }).click();
  assert.equal(await pagina.evaluate(() => poi.representaciones.filter(r => r.etiqueta).length), 0);
  await pagina.evaluate(() => {
    poi.establecerPuntosObjetivo([]);
    poi.establecerPuntosObjetivo([{ idPunto: 1, radioCobertura: 60 }]);
    poi.establecerPuntosObjetivo([]);
  });
  assert.equal(await pagina.evaluate(() => poi.elementos.filter(e => e.name?.startsWith('cobertura-poi-')).length), 0);
  assert.equal(await pagina.evaluate(() => poi.representaciones.filter(r => r.etiqueta).length), 0);
});

test('referencias inexistentes y nombres duplicados no destacan POI incorrectos', async (t) => {
  const { pagina } = await preparar(t);
  const resultado = await pagina.evaluate(() => {
    poi.establecerPuntosObjetivo([{ idPunto: 9999, nombrePunto: 'Palacio Legislativo' }, { nombrePunto: 'Estadio Jardines del Hipódromo' }]);
    return { etiquetas: poi.representaciones.filter(r => r.etiqueta).length,
      inexistente: poi.seleccionarPunto({ idPunto: 9999, nombrePunto: 'Palacio Legislativo' }),
      ambiguo: poi.seleccionarPunto('Estadio Jardines del Hipódromo') };
  });
  assert.deepEqual(resultado, { etiquetas: 0, inexistente: null, ambiguo: null });
});

test('ficha sin campos opcionales no inventa información', async (t) => {
  const { pagina } = await preparar(t);
  await pagina.evaluate(() => {
    poi.establecerDatos({ barrios: { '': { puntos: [{ id: 500, nombre: 'Referencia de prueba', longitud: 0, latitud: 0 }] } } });
    poi.seleccionarPunto(500);
  });
  const ficha = pagina.getByRole('dialog', { name: 'Información de Referencia de prueba' });
  const texto = await ficha.innerText();
  assert.doesNotMatch(texto, /undefined|null|Sin descripción|Barrio:|Zona:/);
  assert.match(texto, /Coordenadas: 0.00000, 0.00000/);
  assert.equal(await ficha.locator('.metronet-punto-interes-panel-descripcion').count(), 0);
});

test('selecciones repetidas destruyen etiquetas anteriores y el mapa sigue navegable', async (t) => {
  const { pagina } = await preparar(t);
  const resultado = await pagina.evaluate(() => {
    const inicial = poi.escena.children.length;
    for (let i = 0; i < 10; i++) {
      poi.seleccionarPunto(i % 2 ? 1 : 26);
      poi.limpiarPuntoSeleccionado();
    }
    return { inicial, final: poi.escena.children.length, fichas: document.querySelectorAll('.metronet-punto-interes-panel').length };
  });
  assert.equal(resultado.final, resultado.inicial);
  assert.equal(resultado.fichas, 0);
  await pagina.locator('.metronet-control-zoom-restaurar').click();
});

test('clic en marcador objetivo y clic fuera seleccionan y deseleccionan sin bloquear Phaser', async (t) => {
  const { pagina } = await preparar(t, { objetivos: [{ idPunto: 1, radioCobertura: 60 }] });
  await pagina.evaluate(async () => {
    const { CATEGORIAS_PUNTUALES } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
    poi.establecerCategoriasVisibles(CATEGORIAS_PUNTUALES);
  });
  await pagina.evaluate(() => poi.enfocarPunto(1, 0));
  await pagina.waitForFunction(() => poi.representaciones.find(r => r.punto.id === 1)?.contenedor.visible);
  // Esperar un cuadro permite que Phaser aplique el enfoque de la cámara.
  await pagina.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const posicion = await pagina.evaluate(() => {
    const p = poi.representaciones.find(r => r.punto.id === 1).posicion;
    const camara = poi.escena.cameras.main;
    const rect = poi.escena.game.canvas.getBoundingClientRect();
    return { x: rect.x + (p.x - camara.worldView.x) * camara.zoom, y: rect.y + (p.y - camara.worldView.y) * camara.zoom };
  });
  await pagina.mouse.click(posicion.x, posicion.y);
  await pagina.getByRole('dialog', { name: 'Información de Palacio Legislativo' }).waitFor();
  await pagina.locator('#metronet-mapa canvas').click({ position: { x: 30, y: 30 } });
  assert.equal(await pagina.getByRole('dialog').count(), 0);
  assert.equal(await pagina.evaluate(() => poi.puntoSeleccionado), null);
  await pagina.locator('.metronet-control-zoom-restaurar').click();
});
