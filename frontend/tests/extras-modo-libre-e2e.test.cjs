const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const API=process.env.METRONET_API_PRUEBAS,BASE='http://127.0.0.1:5198';
test('Extras: primera entrada, omisión, tutorial, recuperación, siete tarjetas y premio real',{skip:!API,timeout:210000},async t=>{
  const browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/http:\/\/[^/]+:8080\//,route=>route.continue({url:API+new URL(route.request().url()).pathname}));
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const errores=[];page.on('pageerror',e=>errores.push(e.message));
  const vista=page.frameLocator('#pantalla-metronet');
  const frame=()=>page.frames().find(f=>f.parentFrame());
  await page.goto(BASE+'/login.html');
  await vista.locator('#email').fill('extras-browser@example.test');
  await vista.locator('#password').fill(process.env.METRONET_E2E_CLAVE);
  await vista.locator('#loginButton').click();
  await vista.locator('[data-continuar-bienvenida]').click();
  await vista.locator('#accionesInicio[aria-busy="false"]').waitFor();
  const token=await frame().evaluate(()=>JSON.parse(localStorage.getItem('sesionUsuario')).token);
  const headers={Authorization:`Bearer ${token}`};
  const estado=async()=> (await context.request.get(API+'/api/juego/aprendizaje/extras',{headers})).json();
  assert.equal((await context.request.put(API+'/api/juego/aprendizaje/extras/tarjetas/1',{headers})).status(),403);
  assert.equal((await context.request.get(API+'/api/juego/aprendizaje/extras')).status(),401);
  await vista.getByRole('link',{name:'Aprendizaje',exact:true}).first().click();
  await vista.locator('#extrasAprendizaje').getByText(/Ingresá a Modo Libre/).waitFor();
  await vista.getByRole('link',{name:'Inicio',exact:true}).first().click();
  await vista.locator('.metronet-inicio__tarjeta--crear button').click();
  await vista.getByRole('heading',{name:'Tu próxima red empieza acá',exact:true}).waitFor();
  const primerDiseno=Number(new URL(frame().url()).searchParams.get('idDiseno'));
  assert.equal(await vista.locator('dialog[open]').count(),1,'La bienvenida no se superpone al tutorial');
  for(const [width,height] of [[1440,900],[1280,720],[390,844]]) {
    await page.setViewportSize({width,height});
    assert.ok(await vista.locator('.metronet-extras').evaluate(e=>e.getBoundingClientRect().right<=innerWidth && e.getBoundingClientRect().bottom<=innerHeight));
    assert.ok(await vista.locator('.metronet-extras').evaluate(e=>[...e.querySelectorAll('*')].every(n=>getComputedStyle(n).fontFamily.includes('Silkscreen'))));
    await page.screenshot({path:`/tmp/metronet-extras-bienvenida-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await vista.getByRole('button',{name:'Ir a construir',exact:true}).click();
  await vista.getByRole('button',{name:'Recorrer las funciones',exact:true}).click();
  await vista.locator('.metronet-recorrido').getByRole('heading',{name:'Tarjetas Extras',exact:true}).waitFor();
  await vista.locator('[data-recorrido-omitir]').click();
  assert.deepEqual((await estado()).visitadas,[],'Saltar no cuenta tarjetas');
  assert.equal((await estado()).bienvenidaVista,true);
  const icono=vista.getByRole('button',{name:'Extras de Modo Libre',exact:true});
  const cajas=await frame().evaluate(()=>['.metronet-aprender-acceso','.metronet-extras-acceso'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top};}));
  assert.ok(cajas[1].left>=cajas[0].right && Math.abs(cajas[1].top-cajas[0].top)<2,'Icono propio junto a Aprender');
  await icono.click();
  await vista.getByRole('heading',{name:'Calles y avenidas',exact:true}).waitFor();
  await vista.getByRole('button',{name:'Siguiente →',exact:true}).click();
  await vista.getByRole('heading',{name:'Densidad de población',exact:true}).waitFor();
  await vista.getByRole('button',{name:'← Anterior',exact:true}).click();
  await vista.getByRole('heading',{name:'Calles y avenidas',exact:true}).waitFor();
  await vista.getByRole('button',{name:'Siguiente →',exact:true}).click();
  await vista.getByRole('heading',{name:'Densidad de población',exact:true}).waitFor();
  assert.deepEqual((await estado()).visitadas,[1,2],'Repetir no suma tarjetas');
  await vista.getByRole('button',{name:'Cerrar tarjetas',exact:true}).click();
  await frame().goto(BASE+'/aprendizaje.html');
  await vista.locator('#extrasAprendizaje').getByText('7 tarjetas disponibles · 2 de 7 recorridas').waitFor();
  await vista.locator('#extrasAprendizaje button').nth(2).click();
  await vista.getByRole('heading',{name:'Tráfico histórico',exact:true}).waitFor();
  for(const [width,height] of [[1440,900],[1280,720],[390,844]]) {
    await page.setViewportSize({width,height});
    const medidas=await vista.locator('.metronet-extras').evaluate(e=>({ancho:e.scrollWidth<=e.clientWidth+1,alto:e.scrollHeight<=e.clientHeight+1}));
    assert.ok(medidas.ancho);if(width>700)assert.ok(medidas.alto,'La tarjeta entra sin scroll en escritorio');
    await page.screenshot({path:`/tmp/metronet-extras-tarjeta-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  // Un fallo de escritura no inventa progreso y conserva salida voluntaria.
  await context.route('**/api/juego/aprendizaje/extras/tarjetas/3',route=>route.abort());
  await vista.getByRole('button',{name:'Siguiente →',exact:true}).click();
  await vista.locator('[data-extras-estado]').getByText(/reintentar/).waitFor();
  assert.deepEqual((await estado()).visitadas,[1,2]);
  await context.unroute('**/api/juego/aprendizaje/extras/tarjetas/3');
  for(const titulo of ['Desplazamientos','Horarios','Cobertura','Diseño y simulación']) {
    await vista.getByRole('button',{name:'Siguiente →',exact:true}).click();
    await vista.locator('.metronet-extras').getByRole('heading',{name:titulo,exact:true}).waitFor();
  }
  assert.equal((await estado()).premioObtenido,false);
  await vista.getByRole('button',{name:'Finalizar recorrido',exact:true}).click();
  await vista.getByRole('heading',{name:'Cartógrafo de la red',exact:true}).waitFor();
  await page.screenshot({path:'/tmp/metronet-extras-premio.png'});
  await vista.getByRole('button',{name:'Continuar',exact:true}).click();
  assert.equal((await estado()).premioObtenido,true);
  assert.equal((await estado()).visitadas.length,7);
  assert.equal((await (await context.request.put(API+'/api/juego/aprendizaje/extras/tarjetas/7',{headers})).json()).nuevoTrofeo,null);
  await frame().goto(BASE+'/ranking.html');
  await vista.getByRole('heading',{name:'Cartógrafo de la red',exact:true}).waitFor();
  assert.equal(await vista.locator('.ranking-trofeo').count(),6);
  await frame().goto(BASE+'/aprendizaje.html');
  await vista.locator('#extrasAprendizaje').getByText('7 tarjetas disponibles · 7 de 7 recorridas').waitFor();
  // Cada diseño nuevo/recreado vuelve a ofrecer Extras, conservando premio y progreso.
  async function solicitar(method,path,data) {
    const r=await context.request.fetch(API+path,{method,headers,data});
    assert.ok(r.ok(),await r.text());
    return r.headers()['content-type']?.includes('json')?r.json():null;
  }
  const catalogo=await solicitar('GET','/api/juego/escenarios');
  const escenarioLibre=catalogo.find(e=>e.numero===null);
  await solicitar('DELETE','/api/simulaciones/'+primerDiseno);
  for(const motivo of ['nuevo','borrado','reiniciado']) {
    if(motivo==='reiniciado') await solicitar('POST','/api/juego/recorrido/reiniciar',{});
    const libre=await solicitar('POST','/api/juego/escenarios/'+escenarioLibre.idEscenario+'/iniciar',{});
    const url=BASE+'/?idDiseno='+libre.idDiseno+'&idEscenario='+libre.idEscenario+'&idIntento='+libre.idIntento;
    await frame().goto(url);
    await vista.getByRole('heading',{name:'Tu próxima red empieza acá',exact:true}).waitFor();
    assert.equal(await vista.getByRole('button',{name:'Recorrer las funciones',exact:true}).count(),0);
    await vista.getByRole('button',{name:'Ver las 7 tarjetas',exact:true}).click();
    await vista.getByRole('heading',{name:'Calles y avenidas',exact:true}).waitFor();
    await vista.getByRole('button',{name:'Saltar e ir a construir',exact:true}).click();
    await vista.getByRole('button',{name:'Recorrer las funciones',exact:true}).click();
    await vista.locator('[data-recorrido-omitir]').click();
    await frame().goto(url);
    await vista.getByRole('button',{name:'Extras de Modo Libre',exact:true}).waitFor();
    assert.equal(await vista.locator('.metronet-extras').count(),0,'Reabrir el mismo diseño no repite la bienvenida');
    assert.equal((await estado()).premioObtenido,true);
    assert.equal((await estado()).visitadas.length,7);
    if(motivo!=='borrado') await solicitar('DELETE','/api/simulaciones/'+libre.idDiseno);
  }
  assert.deepEqual(errores,[]);
});

test('Primera entrada: bienvenida, siete tarjetas y premio antes del tutorial',{skip:!API,timeout:90000},async t=>{
  const browser=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/http:\/\/[^/]+:8080\//,route=>route.continue({url:API+new URL(route.request().url()).pathname}));
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const vista=page.frameLocator('#pantalla-metronet');
  await page.goto(BASE+'/login.html');
  await vista.locator('#email').fill('extras-entrada@example.test');
  await vista.locator('#password').fill(process.env.METRONET_E2E_CLAVE);
  await vista.locator('#loginButton').click();
  await vista.locator('[data-continuar-bienvenida]').click();
  await vista.locator('#accionesInicio[aria-busy="false"]').waitFor();
  await vista.locator('.metronet-inicio__tarjeta--crear button').click();
  await vista.getByRole('button',{name:'Ver las 7 tarjetas',exact:true}).click();
  for(const titulo of ['Calles y avenidas','Densidad de población','Tráfico histórico','Desplazamientos','Horarios','Cobertura','Diseño y simulación']) {
    await vista.locator('.metronet-extras').getByRole('heading',{name:titulo,exact:true}).waitFor();
    assert.equal(await vista.getByRole('button',{name:'Recorrer las funciones',exact:true}).count(),0,'No adelantar el tutorial');
    assert.equal(await vista.locator('dialog[open]').count(),1);
    await vista.getByRole('button',{name:titulo==='Diseño y simulación'?'Finalizar recorrido':'Siguiente →',exact:true}).click();
  }
  await vista.getByRole('heading',{name:'Cartógrafo de la red',exact:true}).waitFor();
  assert.equal(await vista.locator('dialog[open]').count(),1,'El premio no se superpone al tutorial');
  assert.equal(await vista.getByRole('button',{name:'Recorrer las funciones',exact:true}).count(),0);
  await vista.getByRole('button',{name:'Continuar',exact:true}).click();
  await vista.getByRole('button',{name:'Recorrer las funciones',exact:true}).click();
  await vista.locator('.metronet-recorrido').getByRole('heading',{name:'Tarjetas Extras',exact:true}).waitFor();
});
