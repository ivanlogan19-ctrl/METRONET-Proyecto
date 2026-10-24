const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { abrirNavegador } = require('./soporte/navegador.cjs');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await abrirNavegador({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
async function abrir(t, reducido = false) {
  let motor = navegador;
  if (reducido && process.env.METRONET_BROWSER === 'firefox') {
    motor = await abrirNavegador({ firefoxUserPrefs:{'ui.prefersReducedMotion':1} });
    t.after(() => motor.close());
  }
  const vista = await abrirPantalla(motor, '/inicio.html', { viewport:{width:1440,height:900},
    reducedMotion:reducido ? 'reduce' : 'no-preference',
    responder: r => new URL(r.url()).pathname.includes('/aprendizaje/extras/') ? {json:{visitadas:[],nuevoTrofeo:null}} : null,
  });
  t.after(() => vista.contexto.close());
  t.after(() => assert.deepEqual(vista.errores, []));
  await vista.pagina.evaluate(async () => {
    const { gestorMusica } = await import('/src/audio/GestorMusica.js');
    gestorMusica.establecerSilencio(true);
    const { abrirExtras } = await import('/src/educacion/extras/PresentacionExtras.js');
    window.controlEntrada = new AbortController();
    window.entradaTerminada = false;
    void abrirExtras({ bienvenida:true, animacion:true, signal:controlEntrada.signal }).then(() => { window.entradaTerminada = true; });
  });
  return vista;
}

test('Continuar omite el túnel y ofrece la tarjeta sin registrar lecturas', async t => {
  const { pagina:p, solicitudes } = await abrir(t);
  await p.locator('.metronet-extras--entrada canvas').waitFor();
  assert.equal(await p.locator('dialog[open]').count(), 1);
  assert.equal(await p.locator('[data-continuar-bienvenida]').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(72, 180, 255)');
  await p.locator('[data-continuar-bienvenida]').click();
  await p.locator('.metronet-extras--bienvenida').waitFor();
  assert.equal(await p.locator('canvas').count(), 0);
  assert.equal(await p.locator('.metronet-libre__cabecera p').innerText(), 'Nuevas herramientas para llevar tu red a la próxima estación.');
  const aspecto = await p.evaluate(() => {
    const temas = [...document.querySelectorAll('.metronet-libre__temas li')];
    const botones = [...document.querySelectorAll('.metronet-libre__pie button')];
    const rect = e => [Math.round(e.getBoundingClientRect().width),Math.round(e.getBoundingClientRect().height)];
    return { temas:temas.map(rect), botones:botones.map(rect), colores:temas.map(e=>getComputedStyle(e).backgroundColor),
      iconos:temas.map(e=>rect(e.querySelector('svg'))), densidad:temas[1].innerText,
      pesos:temas.map(e=>getComputedStyle(e.querySelector('span')).fontWeight) };
  });
  assert.equal(new Set(aspecto.temas.map(JSON.stringify)).size, 1);
  assert.deepEqual(aspecto.botones, [[153,44],[153,44]]);
  assert.equal(new Set(aspecto.colores).size, 7);
  assert.deepEqual(aspecto.iconos, Array(7).fill([32,32]));
  assert.ok(aspecto.pesos.every(peso=>Number(peso)>=700));
  assert.match(aspecto.densidad,/Densidad\s+de\s+población/);
  assert.equal(solicitudes.filter(s=>/\/tarjetas\/\d+$/.test(s.path)).length, 0);
  await p.locator('.metronet-extras--bienvenida').evaluate(async e=>{await document.fonts.ready;await Promise.all(e.getAnimations().map(a=>a.finished));});
  await p.screenshot({path:`/tmp/metronet-libre-integrado-${process.env.METRONET_BROWSER || 'chrome'}.png`});
  await p.getByRole('button',{name:'Ver las 7 tarjetas',exact:true}).click();
  await p.locator('.metronet-extras__puntos[aria-label="Tarjeta 1 de 7"]').waitFor();
  assert.equal(await p.locator('.metronet-extras--bienvenida').count(),0);
  await p.getByRole('button',{name:'Cerrar',exact:true}).click();
  await p.waitForFunction(()=>entradaTerminada);
});

test('La animación finaliza sola y mantiene la música hasta salir de las tarjetas', async t => {
  const {pagina:p} = await abrir(t);
  await p.locator('.metronet-extras--entrada').waitFor();
  await p.locator('.metronet-extras--bienvenida').waitFor({timeout:7000});
  assert.equal(await p.evaluate(async()=>(await import('/src/audio/GestorMusica.js')).gestorMusica.obtenerEstado().contexto),'modoLibre');
  await p.getByRole('button',{name:'Ir a construir',exact:true}).click();
  await p.waitForFunction(()=>entradaTerminada);
  assert.notEqual(await p.evaluate(async()=>(await import('/src/audio/GestorMusica.js')).gestorMusica.obtenerEstado().contexto),'modoLibre');
});

test('Movimiento reducido pasa al cartel sin túnel ni parpadeo', async t => {
  const {pagina:p} = await abrir(t,true);
  assert.equal(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  await p.locator('.metronet-extras--bienvenida').waitFor();
  assert.equal(await p.locator('.metronet-extras--entrada').count(),0);
  assert.equal(await p.locator('.metronet-extras--bienvenida').evaluate(e=>getComputedStyle(e).animationName),'none');
});

test('Abortar la entrada libera el diálogo y su audio; Escape permite omitirla', async t => {
  const {pagina:p} = await abrir(t);
  await p.locator('.metronet-extras--entrada').waitFor();
  await p.evaluate(()=>controlEntrada.abort());
  await p.waitForFunction(()=>entradaTerminada);
  assert.equal(await p.locator('dialog[open]').count(),0);
  await p.evaluate(async()=>{const {abrirExtras}=await import('/src/educacion/extras/PresentacionExtras.js');void abrirExtras({bienvenida:true,animacion:true});});
  await p.locator('.metronet-extras--entrada').waitFor();
  await p.keyboard.press('Escape');
  await p.locator('.metronet-extras--bienvenida').waitFor();
  assert.equal(await p.locator('dialog[open]').count(),1);
});

// La salida del navegador está silenciada; se comprueba el recurso y su reloj real.
test('Modo libre reproduce música al entrar desde el contenedor sin tocar la animación', async t => {
  const v = await abrirPantalla(navegador, '/inicio.html', {contenedor:true, responder:r => {
    const ruta = new URL(r.url()).pathname;
    if (ruta === '/api/juego/escenarios') return {json:[{idEscenario:45,numero:null,modo:'EDICION_LIBRE',nombre:'Modo libre',desbloqueado:true,herramientasHabilitadas:{}}]};
    if (ruta.includes('/aprendizaje/extras/')) return {json:{visitadas:[],nuevoTrofeo:null}};
    if (ruta === '/api/simulaciones/77') return {json:{
      simulacion:{idDiseno:77,idEscenario:45,modo:'EDICION_LIBRE',nombre:'Red libre',estado:'EN_DISENO'},
      estaciones:[],lineas:[],tramos:[],unidadesMetro:[],territorio:{areas:[],errores:[]},
    }};
  }});
  t.after(() => v.contexto.close());
  t.after(() => assert.deepEqual(v.errores, []));
  await v.vista.locator('h1').click();
  await v.pagina.waitForFunction(()=>[...document.querySelectorAll('audio')].some(a=>!a.paused && a.currentTime>0 && a.volume>0));
  await v.vista.evaluate(() => location.assign('/?idDiseno=77'));
  await v.vista.locator('.metronet-extras--entrada').waitFor();
  await v.pagina.waitForFunction(()=>{
    const a=document.querySelector('audio[src="/audio/modo-libre-theme.m4a"]');
    return a && !a.paused && a.currentTime>0 && a.volume>0;
  },null,{timeout:3000});
  assert.equal(await v.vista.locator('.metronet-extras--entrada').count(),1);
});

test('Wyald acompaña túnel, portada y tarjetas sin reiniciarse y se libera al cerrar', async t => {
  const {pagina:p} = await abrir(t);
  await p.locator('.metronet-extras--entrada').waitFor();
  await p.evaluate(async()=>{const {gestorMusica}=await import('/src/audio/GestorMusica.js');gestorMusica.establecerSilencio(false);});
  await p.locator('.metronet-extras--entrada canvas').click({position:{x:10,y:10}});
  await p.waitForFunction(()=>{const a=document.querySelector('audio[src="/audio/modo-libre-theme.m4a"]');return a && !a.paused && a.currentTime>0;});
  const pista=p.locator('audio[src="/audio/modo-libre-theme.m4a"]');
  assert.equal(await pista.evaluate(a=>a.loop),true);
  assert.ok(await pista.evaluate(a=>a.duration>=189.6 && a.duration<=189.9));
  await pista.evaluate(a=>{window.pistaEntrada=a;window.tiempoEntrada=a.currentTime;});
  await p.locator('[data-continuar-bienvenida]').click();
  await p.waitForFunction(()=>!pistaEntrada.paused && pistaEntrada.currentTime>tiempoEntrada);
  await p.getByRole('button',{name:'Ver las 7 tarjetas',exact:true}).click();
  for (let i=1;i<7;i++) {
    await p.locator(`.metronet-extras__puntos[aria-label="Tarjeta ${i} de 7"]`).waitFor();
    await p.getByRole('button',{name:'Siguiente',exact:true}).click();
  }
  await p.locator('.metronet-extras__puntos[aria-label="Tarjeta 7 de 7"]').waitFor();
  assert.equal(await pista.evaluate(a=>a===window.pistaEntrada && !a.paused && a.currentTime>window.tiempoEntrada),true);
  await p.getByRole('button',{name:'Finalizar recorrido',exact:true}).click();
  await p.waitForFunction(()=>entradaTerminada);
  await p.waitForFunction(()=>[...document.querySelectorAll('audio[src="/audio/modo-libre-theme.m4a"]')].every(a=>a.paused || a.volume===0));
});
