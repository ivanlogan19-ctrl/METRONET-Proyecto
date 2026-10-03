// Identidad y composición con Chrome real; servicios interceptados, sin escribir cuentas.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL}); });
after(async () => { await navegador?.close(); });
const ASSET = '/assets/metronet-logo-pixel.png';
const resoluciones = [[1920,1080],[1440,900],[1366,768],[1280,720],[768,1024],[390,844],[320,568]];
function cerrar(t, vista) { t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores,[]); }); }

for (const width of [1440, 390]) test(`Inicio ${width}px: una sola marca grande y navegación intacta`, async t => {
  const v = await abrirPantalla(navegador, '/inicio.html', { viewport: { width, height: 844 } }); cerrar(t, v);
  const p = v.pagina;
  assert.equal(await p.locator('.metronet-navegacion__marca').count(), 0);
  assert.equal(await p.locator('.metronet-inicio__marca .metronet-logo__imagen').count(), 1);
  assert.equal(await p.locator('.metronet-navegacion__enlaces a').count(), 4);
  assert.equal(await p.locator('.metronet-inicio__tarjeta').count(), 3);
  assert.equal(await p.getByText('Consejo para tu próxima acción').count(), 0);
  const progreso = await p.locator('.metronet-inicio__tarjeta--progreso').boundingBox();
  const continuar = await p.locator('.metronet-inicio__tarjeta--continuar').boundingBox();
  const crear = await p.locator('.metronet-inicio__tarjeta--crear').boundingBox();
  assert.ok(progreso.y >= Math.max(continuar.y + continuar.height, crear.y + crear.height));
  if (width === 1440) {
    assert.ok(Math.abs(progreso.x - continuar.x) < 1);
    assert.ok(Math.abs(progreso.x + progreso.width - crear.x - crear.width) < 1);
  } else assert.ok(Math.abs(progreso.width - continuar.width) < 1);
  await p.locator('.metronet-navegacion__usuario > summary').click();
  assert.equal(await p.getByRole('link', { name: 'Inicio', exact: true }).last().isVisible(), true);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
});

for (const width of [1440, 390, 320]) test(`Inicio ${width}px: diez niveles agrupados y alineados`, async t => {
  const escenarios = Array.from({length:10}, (_, i) => ({
    idEscenario:i + 1, numero:i + 1, nombre:`Nivel ${i + 1}`, estado:i ? 'BLOQUEADO' : 'DISPONIBLE',
    desbloqueado:i === 0, progreso:0, objetivo:'Conectá estaciones.'
  }));
  escenarios.push({idEscenario:11,numero:null,nombre:'Modo Libre',estado:'BLOQUEADO',desbloqueado:false});
  const v = await abrirPantalla(navegador,'/inicio.html',{viewport:{width,height:900},responder:req=>
    new URL(req.url()).pathname==='/api/juego/progreso'
      ? {json:{escenarios,nivelesCompletados:0,modoLibreDesbloqueado:false}}
      : null}); cerrar(t,v);
  const p=v.pagina, pasos=p.locator('.metronet-inicio__paso');
  assert.equal(await pasos.count(),10);
  assert.match(await pasos.first().innerText(),/Disponible/);
  assert.doesNotMatch(await pasos.first().innerText(),/En curso/);
  assert.equal(await p.locator('.metronet-inicio__tarjeta--crear').getByText('Modo Libre').count(),1);
  const cajas=await pasos.evaluateAll(elementos=>elementos.map(e=>{
    const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};
  }));
  const columnas=width>720?5:2;
  assert.equal(new Set(cajas.map(c=>Math.round(c.y))).size,10/columnas);
  for(let i=0;i<cajas.length;i++) {
    assert.ok(Math.abs(cajas[i].x-cajas[i%columnas].x)<1);
    assert.ok(Math.abs(cajas[i].w-cajas[i%columnas].w)<1);
  }
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
});

test('PNG aprobado intacto: transparencia real, resolución y márgenes originales', async t => {
  for (const [nombre, huellaIdat] of [
    ['logoMETRONET.png','58bd542e1e7e75e2113697188e82a60cace1421a1fdabc9f6b7f4d5a69946921'],
    ['metronet-logo-pixel.png','c134c1a23e22245626b86fdb4093517e82b647ad29c48f2ccc296a8b8e6af246'],
  ]) {
    const bytes = fs.readFileSync(path.join(__dirname,'../public/assets',nombre));
    const imagen = createHash('sha256');
    for (let i = 8; i < bytes.length;) {
      const longitud = bytes.readUInt32BE(i);
      const tipo = bytes.toString('ascii', i + 4, i + 8);
      assert.notEqual(tipo, 'caBX');
      if (tipo === 'IDAT') imagen.update(bytes.subarray(i + 8, i + 8 + longitud));
      i += longitud + 12;
    }
    assert.equal(imagen.digest('hex'),huellaIdat);
  }
  const v = await abrirPantalla(navegador,'/login.html'); cerrar(t,v);
  const datos = await v.pagina.locator('.metronet-logo__imagen').evaluate(async img => {
    await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0); const rgba = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let transparentes=0, semi=0, opacos=0;
    let xMin=canvas.width,yMin=canvas.height,xMax=-1,yMax=-1;
    for(let i=3;i<rgba.length;i+=4){ const a=rgba[i]; if(a===0) transparentes++; else {
      if(a===255) opacos++; else semi++;
      const n=(i-3)/4,x=n%canvas.width,y=Math.floor(n/canvas.width);xMin=Math.min(x,xMin);xMax=Math.max(x,xMax);yMin=Math.min(y,yMin);yMax=Math.max(y,yMax);
    }}
    const digest = await crypto.subtle.digest('SHA-256', rgba);
    const huellaPixeles = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,'0')).join('');
    return {ancho:canvas.width,alto:canvas.height,transparentes,semi,opacos,bbox:[xMin,yMin,xMax+1,yMax+1],huellaPixeles};
  });
  assert.deepEqual(datos,{ancho:1536,alto:1024,transparentes:889231,semi:683633,opacos:0,bbox:[0,26,1488,996],huellaPixeles:'59dccfe113acc6c12fe1d08842d16ee6ecbcf88e3ba103a0455c1962a07ef1d8'});
});

for (const [width,height] of resoluciones) for (const ruta of ['/login.html','/inicio.html','/simulacion.html?idDiseno=77','editor']) {
  test(`Logo ${width}×${height}: ${ruta}, proporción, nitidez, favicon y red sin referencias antiguas`, async t => {
    const v = ruta === 'editor' ? await abrirEditor(navegador,{viewport:{width,height}}) : await abrirPantalla(navegador,ruta,{viewport:{width,height}});
    cerrar(t,v); const p=v.pagina;
    await p.locator('.metronet-logo__imagen').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
    const estado=await p.evaluate(()=>{
      const img=document.querySelector('.metronet-logo__imagen'),r=img.getBoundingClientRect(),c=getComputedStyle(img);
      return {src:new URL(img.currentSrc).pathname,ratio:r.width/r.height,render:c.imageRendering,filter:c.filter,transform:c.transform,
        alt:img.alt,ancho:img.width,alto:img.height,favicon:document.querySelector('link[rel~="icon"]').getAttribute('href'),
        overflow:document.documentElement.scrollWidth>innerWidth+1,recursos:performance.getEntriesByType('resource').filter(r=>/\/assets\/.*(?:logo|Logo)/.test(r.name)).map(r=>({ruta:new URL(r.name).pathname,status:r.responseStatus}))};
    });
    assert.equal(estado.src,ASSET); assert.ok(Math.abs(estado.ratio-1.5)<.01,JSON.stringify(estado));
    assert.equal(estado.render,'pixelated'); assert.equal(estado.filter,'none'); assert.equal(estado.transform,'none');
    assert.ok(estado.alt); assert.equal(estado.favicon,ASSET); assert.equal(estado.overflow,false);
    assert.ok(estado.recursos.length); assert.ok(estado.recursos.every(r=>r.ruta===ASSET && r.status===200),JSON.stringify(estado.recursos));
    if(process.env.METRONET_LOGO_CAPTURAS){
      fs.mkdirSync(process.env.METRONET_LOGO_CAPTURAS,{recursive:true});
      await p.screenshot({path:path.join(process.env.METRONET_LOGO_CAPTURAS,`${ruta.replace(/[^a-z]/gi,'_')}-${width}.png`)});
    }
  });
}

for (const ruta of ['/login.html','/inicio.html']) test(`Descarga lenta: ${ruta} reserva espacio sin mover formulario ni navegación`, async t => {
  let liberar, obtenerPagina;
  const espera = new Promise(r=>{liberar=r;}), paginaLista = new Promise(r=>{obtenerPagina=r;});
  const navegadorControlado = { newContext:async opciones=>{
    const contexto = await navegador.newContext(opciones);
  // Probar esta vista aislada; la navegación persistente tiene su propia suite integral.
  await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType:'application/javascript', body:'' }));
    contexto.on('page',obtenerPagina);
    await contexto.route(`**${ASSET}`,async route=>{await espera;await route.continue();});
    return contexto;
  }};
  const pendiente = abrirPantalla(navegadorControlado,ruta);
  const p=await paginaLista;
  t.after(liberar);
  await p.locator('.metronet-logo__imagen').first().waitFor({state:'attached'});
  await p.evaluate(()=>document.fonts.ready);
  const medir=()=>p.evaluate(()=>Object.fromEntries(['form','.auth-card','.metronet-navegacion','.metronet-navegacion__enlaces','.metronet-navegacion__usuario','[data-marca-inicio]','#tituloInicio','#accionesInicio'].map(selector=>{
    const r=document.querySelector(selector)?.getBoundingClientRect();return [selector,r?{x:r.x,y:r.y,w:r.width,h:r.height}:null];
  })));
  const antes=await medir(); liberar(); const v=await pendiente; cerrar(t,v);
  await p.locator('.metronet-logo__imagen').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  assert.deepEqual(await medir(),antes);
});

for (const width of [1440,390]) for (const ruta of ['/ranking.html','/disenos.html']) test(`Identidad completa: ${ruta} a ${width}px`, async t => {
  const v=await abrirPantalla(navegador,ruta,{viewport:{width,height:900},responder:req=>{
    if(new URL(req.url()).pathname==='/api/juego/progreso')return{json:{modoLibreDesbloqueado:true,escenarios:[]}};
    if(new URL(req.url()).pathname==='/api/juego/ranking')return{json:{jugadores:[{posicion:1,jugador:'Ana',puntajeTotal:100,nivelesCompletados:1,sosVos:true}],puntajeTotal:100,puntajeMaximo:400,tuPosicion:1}};
  }});cerrar(t,v);const p=v.pagina;
  await p.locator('.metronet-logo__imagen').evaluate(i=>i.decode());
  assert.equal(await p.locator('.metronet-logo__imagen').getAttribute('src'),ASSET);
  if(ruta==='/ranking.html')await p.locator('#clasificacionRanking tr').waitFor();
  else await p.locator('#listaMisDisenos[aria-busy=false]').waitFor();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.locator('.metronet-navegacion__usuario>summary').click();
  assert.equal(await p.getByRole('link',{name:'Mi perfil',exact:false}).isVisible(),true);
});
