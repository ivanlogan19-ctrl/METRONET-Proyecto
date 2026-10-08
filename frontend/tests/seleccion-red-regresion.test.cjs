const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
let browser;
before(async () => { browser = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => browser?.close());

test('el techo visible del marcador también selecciona la estación al conectar', async t => {
  const { contexto, pagina, errores } = await abrirEditor(browser);
  t.after(() => contexto.close());
  await pagina.locator('[data-elegir-herramienta="conexiones"]').click();
  const via = await pagina.evaluate(() => {
    const capa = editorPrueba.capaRedMetro, camara = capa.escena.cameras.main;
    const p = capa.convertirPosicion(640,465), r = capa.escena.game.canvas.getBoundingClientRect();
    return {x:r.x+(p.x-camara.worldView.x)*camara.zoom, y:r.y+(p.y-camara.worldView.y)*camara.zoom};
  });
  await pagina.mouse.click(via.x, via.y);
  for (const [nombre, x, y] of [['Parque',700,460], ['Este',810,480]]) {
    const punto = await pagina.evaluate(({x,y}) => {
      const capa=editorPrueba.capaRedMetro, camara=capa.escena.cameras.main;
      const p=capa.convertirPosicion(x,y), r=capa.escena.game.canvas.getBoundingClientRect();
      const escala=Math.max(.125,Math.min(1,1/camara.zoom));
      return {x:r.x+(p.x-camara.worldView.x)*camara.zoom,
        y:r.y+(p.y-22*escala-camara.worldView.y)*camara.zoom};
    }, {x,y});
    await pagina.mouse.click(punto.x,punto.y);
    if (nombre === 'Parque') assert.deepEqual(await pagina.evaluate(()=>editorPrueba.estacionesSeleccionadas), ['Parque']);
  }
  await pagina.waitForFunction(()=>editorPrueba.disenoActual.tramos.length===2);
  assert.deepEqual(errores, []);
});

test('selección elige la estación más cercana aunque ambas entren en la tolerancia', async t => {
  const { contexto, pagina, errores } = await abrirEditor(browser);
  t.after(() => contexto.close());
  const elegidas = await pagina.evaluate(() => {
    const capa = editorPrueba.capaRedMetro;
    return [.65, 1, 2.5].map(zoom => {
      capa.escena.cameras.main.setZoom(zoom);
      const p = capa.convertirPosicion(700,460);
      capa.diseno.estaciones = [
        {nombre:'Vecina',posicionX:699,posicionY:460},
        {nombre:'Destino',posicionX:700,posicionY:460},
      ];
      return capa.obtenerEstacionCercana(p)?.nombre;
    });
  });
  assert.deepEqual(elegidas, ['Destino','Destino','Destino']);
  assert.deepEqual(errores, []);
});

test('Metro prioriza la vía cercana y solo ofrece selector en una superposición real', async t => {
  const { contexto, pagina, errores } = await abrirEditor(browser);
  t.after(() => contexto.close());
  const resultado = await pagina.evaluate(() => {
    const capa = editorPrueba.capaRedMetro;
    capa.escena.cameras.main.setZoom(1);
    capa.diseno.estaciones = [
      {nombre:'A',posicionX:600,posicionY:450}, {nombre:'B',posicionX:700,posicionY:450},
      {nombre:'C',posicionX:600,posicionY:455}, {nombre:'D',posicionX:700,posicionY:455},
    ];
    const lejana = {nombreLinea:'Lejana',estacionA:'C',estacionB:'D'};
    const cercana = {nombreLinea:'Cercana',estacionA:'A',estacionB:'B'};
    capa.diseno.tramos = [lejana,cercana];
    const p = capa.convertirPosicion(650,450);
    const primera = capa.obtenerTramosCercanos(p).map(t => t.nombreLinea);
    capa.diseno.tramos = [cercana,{...cercana,nombreLinea:'Superpuesta'}];
    return {primera,superpuestas:capa.obtenerTramosCercanos(p).map(t=>t.nombreLinea)};
  });
  assert.deepEqual(resultado.primera, ['Cercana']);
  assert.deepEqual(resultado.superpuestas, ['Cercana','Superpuesta']);
  assert.deepEqual(errores, []);
});

test('zoom máximo: el nodo y el grosor visible de la vía siguen siendo seleccionables', async t => {
  const { contexto, pagina } = await abrirEditor(browser);
  t.after(() => contexto.close());
  const resultado = await pagina.evaluate(() => {
    const capa = editorPrueba.capaRedMetro;
    capa.escena.cameras.main.setZoom(8);
    capa.diseno.estaciones = [{nombre:'A',posicionX:600,posicionY:450}, {nombre:'B',posicionX:700,posicionY:450}];
    capa.diseno.tramos = [{nombreLinea:'Azul',estacionA:'A',estacionB:'B'}];
    const a=capa.convertirPosicion(600,450), centro=capa.convertirPosicion(650,450);
    return {nodo:capa.obtenerEstacionCercana({x:a.x,y:a.y+5})?.nombre,
      via:capa.obtenerTramoCercano({x:centro.x,y:centro.y+2})?.nombreLinea,
      fuera:capa.obtenerTramoCercano({x:centro.x,y:centro.y+8})};
  });
  assert.equal(resultado.nodo,'A');
  assert.equal(resultado.via,'Azul');
  assert.equal(resultado.fuera,null);
});

test('Metro reconoce tramos cortos y largos, diagonales, verticales y horizontales con zoom y cámara desplazada', async t => {
 const v=await abrirEditor(browser);t.after(()=>v.contexto.close());
 const casos=await v.pagina.evaluate(()=>{
  const capa=editorPrueba.capaRedMetro, camara=capa.escena.cameras.main;
  const resultados=[];
  for(const zoom of [.65,1,2.5,8]) for(const [dx,dy] of [[8,0],[100,0],[0,100],[8,8],[100,60]]) {
   camara.setZoom(zoom);camara.setScroll(170,80);
   capa.diseno.estaciones=[{nombre:'A',posicionX:600,posicionY:450},{nombre:'B',posicionX:600+dx,posicionY:450+dy}];
   capa.diseno.tramos=[{nombreLinea:'Vía',estacionA:'A',estacionB:'B'}];
   const a=capa.convertirPosicion(600,450),b=capa.convertirPosicion(600+dx,450+dy);
   const largo=Math.hypot(b.x-a.x,b.y-a.y), nx=-(b.y-a.y)/largo,ny=(b.x-a.x)/largo;
   const punto={x:(a.x+b.x)/2+nx*8/zoom,y:(a.y+b.y)/2+ny*8/zoom};
   resultados.push({zoom,dx,dy,nombre:capa.obtenerTramoCercano(punto)?.nombreLinea});
  }
  return resultados;
 });
 assert.equal(casos.length,20);
 for(const caso of casos) assert.equal(caso.nombre,'Vía',JSON.stringify(caso));
 assert.deepEqual(v.errores,[]);
});
