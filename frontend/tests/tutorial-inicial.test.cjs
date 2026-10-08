const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const escenario = n => ({ ...niveles[n - 1], idEscenario:n, desbloqueado:true, estado:'EN_DESARROLLO', progreso:0 });
const consigna = d => ({ condiciones:[
  { clave:'minimoEstaciones', requerido:2, actual:d.estaciones.length, completado:d.estaciones.length >= 2, texto:'Dos estaciones' },
  { clave:'minimoLineas', requerido:1, actual:d.lineas.length, completado:d.lineas.length >= 1, texto:'Una línea' },
] });
async function abrir(t, n = 1, opciones = {}) {
  const v = await abrirEditor(navegador, { escenario:escenario(n), estaciones:[], lineas:[], tramos:[], consigna,
    novedadPresentada: Boolean(opciones.ofrecerRecorrido), ...opciones });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  return v;
}
async function cerrarGuiaInicial(p) {
  await p.locator('.metronet-recorrido').waitFor();
  await p.keyboard.press('Escape');
  await p.locator('.metronet-recorrido').waitFor({ state:'detached' });
}

test('La progresión respeta las herramientas reales de los diez niveles', async t => {
  const { pagina:p } = await abrir(t);
  assert.deepEqual(await p.evaluate(async niveles => {
    const { herramientasIntroducidas } = await import('/src/educacion/TutorialInicial.js');
    return niveles.map(n => herramientasIntroducidas(n, niveles));
  }, niveles), [['estaciones','lineas'],['conexiones'],['metros'],['simulacion'],[],[],[],[],[],[]]);
});

test('Práctica: selección, error, creaciones confirmadas y guardado; cerrar y reabrir conserva el paso', async t => {
  const { pagina:p, solicitudes } = await abrir(t, 1, { ofrecerRecorrido:true });
  const panel = p.locator('.metronet-tutorial');
  await cerrarGuiaInicial(p);
  assert.equal(await panel.getAttribute('data-paso'), 'elegir-estacion');
  await p.locator('[data-elegir-herramienta="lineas"]').click();
  assert.equal(await panel.getAttribute('data-paso'), 'elegir-estacion');
  await p.locator('[data-elegir-herramienta="estaciones"]').click();
  assert.equal(await panel.getAttribute('data-paso'), 'colocar-estacion');
  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX:-100, posicionY:-100 }, 'crearEstacion'));
  assert.equal(await panel.getAttribute('data-paso'), 'colocar-estacion');
  assert.equal(solicitudes.length, 0);
  if (!await panel.evaluate(e => e.open)) await panel.locator('>summary').click();
  await panel.locator('.metronet-tutorial__panel:popover-open').waitFor();
  assert.ok(await panel.locator('.metronet-tutorial__error').isVisible());
  await p.locator('body').click({ position:{ x:2, y:2 } });
  for (const posicionX of [750, 810]) await p.evaluate(x => editorPrueba.ubicarEstacion({ posicionX:x, posicionY:500 }, 'crearEstacion'), posicionX);
  assert.equal(await panel.getAttribute('data-paso'), 'elegir-linea');
  assert.equal(await panel.getAttribute('open'), null);
  if (!await panel.evaluate(e => e.open)) await panel.locator('>summary').click();
  await p.locator('[data-elegir-herramienta="lineas"]').click();
  assert.equal(await panel.getAttribute('data-paso'), 'origen-linea');
  await p.evaluate(() => editorPrueba.seleccionarElemento({ tipo:'estacion', valor:editorPrueba.disenoActual.estaciones[0] }));
  assert.equal(await panel.getAttribute('data-paso'), 'destino-linea');
  // Un rechazo del servidor no confirma una línea ni avanza hacia Guardar.
  await p.route('**/api/simulaciones/77/lineas', route => route.fulfill({status:400,json:{message:'No se pudo crear la línea.'}}));
  await p.evaluate(() => editorPrueba.creacionDirecta.conectar(editorPrueba.disenoActual.estaciones[1]));
  assert.notEqual(await panel.getAttribute('data-paso'), 'guardar');
  await p.unroute('**/api/simulaciones/77/lineas');
  await p.evaluate(() => editorPrueba.seleccionarElemento({ tipo:'estacion', valor:editorPrueba.disenoActual.estaciones[1] }));
  await p.waitForFunction(() => editorPrueba.disenoActual.lineas.length === 1);
  assert.equal(await panel.getAttribute('data-paso'), 'guardar');
  await p.evaluate(() => editorPrueba.guardarDiseno({ evaluar:false }));
  assert.equal(await panel.getAttribute('data-paso'), 'terminado');
  assert.equal(await panel.getByRole('button', { name:'Siguiente', exact:true }).count(),0);
  await p.evaluate(() => { editorPrueba.disenoActual.estaciones = []; editorPrueba.actualizarAyuda(); });
  assert.equal(await panel.getAttribute('data-paso'), 'elegir-estacion');
});

test('El panel muestra explicaciones directas y cierra fuera o con Escape', async t => {
  const { pagina:p } = await abrir(t,2,{ novedadPresentada:true });
  const panel = p.locator('.metronet-tutorial');
  if (!await panel.evaluate(e => e.open)) await panel.locator('>summary').click();
  await panel.locator('.metronet-tutorial__panel:popover-open').waitFor();
  assert.equal(await panel.getByRole('heading',{name:'Tutorial'}).count(),1);
  assert.equal(await panel.locator('[data-tutorial-cerrar]').count(),0);
  assert.match(await panel.locator('.metronet-tutorial__herramientas').innerText(), /Conexión → Agregá tramos/);
  assert.equal(await panel.locator('.metronet-tutorial__herramientas p strong').allTextContents().then(x => x.join(',')),'Nivel → ,Conexión → ');
  assert.equal(await panel.locator('.metronet-tutorial__herramientas details').count(),0);
  assert.equal(await panel.locator('.metronet-tutorial__herramientas a, .metronet-tutorial__herramientas button').count(),0);
  assert.equal(await panel.getByRole('button',{name:'Recorrer la pantalla'}).isVisible(),true);
  await panel.locator('.metronet-tutorial__herramientas p').first().click();
  assert.equal(await panel.evaluate(e => e.open),true);
  const estilos = await panel.evaluate(e => {
    const titulo=e.querySelector('h2'), boton=e.querySelector('.metronet-tutorial__repetir'), caja=e.querySelector('.metronet-tutorial__panel');
    const rb=boton.getBoundingClientRect(), rc=caja.getBoundingClientRect();
    return { barra:getComputedStyle(titulo,'::before').display, borde:getComputedStyle(titulo).borderLeftWidth,
      centro:Math.abs((rb.left+rb.right)/2-(rc.left+rc.right)/2), fondo:getComputedStyle(boton).backgroundColor };
  });
  assert.equal(estilos.barra,'none');
  assert.equal(estilos.borde,'0px');
  assert.ok(estilos.centro < 2,JSON.stringify(estilos));
  await p.keyboard.press('Escape');
  assert.equal(await panel.evaluate(e => e.open),false);
  assert.equal(await p.evaluate(() => document.activeElement?.matches('.metronet-tutorial > summary')),true);
  await panel.locator('>summary').click();
  await p.locator('body').click({ position:{ x:2,y:2 } });
  assert.equal(await panel.evaluate(e => e.open),false);
});

test('Nivel 1 presenta nivel, estación y línea con texto directo y separadores amarillos', async t => {
  const { pagina:p } = await abrir(t,1,{ ofrecerRecorrido:true });
  await cerrarGuiaInicial(p);
  const panel = p.locator('.metronet-tutorial');
  await panel.locator('>summary').click();
  await panel.locator('.metronet-tutorial__panel:popover-open').waitFor();
  assert.equal(await panel.locator('.metronet-tutorial__herramientas p strong').allTextContents().then(x => x.join(',')),
    'Nivel → ,Estación → ,Línea → ');
  assert.equal(await panel.getByText('¿Querés ver el tutorial de nuevo?').count(),0);
  assert.equal(await panel.getByRole('button').count(),1);
  assert.equal(await panel.getByRole('button').evaluate(e => getComputedStyle(e).backgroundColor),'rgb(244, 237, 121)');
  const separadores = await panel.locator('.metronet-tutorial__herramientas p').evaluateAll(items =>
    items.map(item => ({ borde:getComputedStyle(item).borderBottomStyle, color:getComputedStyle(item).borderBottomColor,
      titulo:getComputedStyle(item.querySelector('strong')).color,
      pesoTitulo:getComputedStyle(item.querySelector('strong')).fontWeight,
      pesoExplicacion:getComputedStyle(item.querySelector('span')).fontWeight })));
  assert.ok(separadores.every(item => item.borde === 'solid' && item.color === item.titulo
    && Number(item.pesoTitulo) > Number(item.pesoExplicacion)),JSON.stringify(separadores));
});

test('El cartel final permanece legible y cierra recorrido y panel automáticamente', async t => {
  const { pagina:p } = await abrir(t,2,{ novedadPresentada:true });
  await cerrarGuiaInicial(p);
  const panel = p.locator('.metronet-tutorial');
  if (!await panel.evaluate(e => e.open)) await panel.locator('>summary').click();
  await panel.locator('.metronet-tutorial__panel:popover-open').waitFor();
  await panel.getByRole('button',{name:'Recorrer la pantalla'}).click();
  const guia = p.locator('.metronet-recorrido');
  while (await guia.getAttribute('data-objetivo') !== 'fin') await guia.locator('[data-recorrido-siguiente]').click();
  assert.equal(await guia.getByText('RECORRIDO COMPLETADO').isVisible(),true);
  await guia.waitFor({ state:'detached', timeout:5000 });
  assert.equal(await panel.evaluate(e => e.open),false);
  assert.equal(await panel.locator('.metronet-tutorial__panel:popover-open').count(),0);
  assert.equal(await p.evaluate(() => document.activeElement?.matches('.metronet-tutorial > summary')),true);
});

for (const width of [1440,768,390,320]) test(`Recorrido opcional: ocho controles habilitados, teclado y burbujas a ${width}px`, async t => {
  const { pagina:p, solicitudes } = await abrir(t, 1, { ofrecerRecorrido:true, viewport:{ width, height:900 } });
  await p.emulateMedia({ reducedMotion:'reduce' });
  await cerrarGuiaInicial(p);
  await p.locator('.metronet-tutorial > summary').click();
  await p.getByRole('button', { name:'Recorrer la pantalla', exact:true }).click();
  const dialogo = p.locator('.metronet-recorrido');
  const titulos = [];
  for (let i = 0; i < 8; i++) {
    titulos.push(await dialogo.locator('h2').textContent());
    const caja = await dialogo.boundingBox();
    assert.ok(caja.x >= 0 && caja.y >= 0 && caja.x + caja.width <= width && caja.y + caja.height <= 900, JSON.stringify(caja));
    const marca = await dialogo.locator('.metronet-recorrido__marca').boundingBox();
    const interseccion = Math.max(0, Math.min(caja.x+caja.width, marca.x+marca.width)-Math.max(caja.x,marca.x)) * Math.max(0, Math.min(caja.y+caja.height, marca.y+marca.height)-Math.max(caja.y,marca.y));
    assert.ok(interseccion < marca.width * marca.height * .75, `Objetivo tapado: ${titulos.at(-1)}`);
    assert.equal(await p.evaluate(() => document.activeElement?.matches('[data-recorrido-siguiente]')), true);
    if (i === 1) {
      const estaciones = await p.locator('[data-elegir-herramienta="estaciones"]').boundingBox();
      await p.mouse.click(estaciones.x + estaciones.width / 2, estaciones.y + estaciones.height / 2);
      assert.equal(await p.evaluate(() => editorPrueba.modo), 'normal');
      await dialogo.locator('[data-recorrido-siguiente]').focus();
    }
    await p.keyboard.press('Enter');
  }
  assert.deepEqual(titulos, ['Herramientas','Estación','Línea','Selección','Guardar','Referencias','Controles y pista','Objetivo']);
  assert.equal(await dialogo.locator('h2').textContent(), '¡Listos para construir!');
  await dialogo.waitFor({state:'detached',timeout:5000});
  assert.equal(await p.locator('.metronet-tutorial').getAttribute('data-fase'),'practica');
  assert.equal(solicitudes.length,0);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
});

test('Omitir con Escape, reabrir y cambiar de escenario limpian el recorrido y conservan edición normal', async t => {
  const { pagina:p } = await abrir(t,1,{ ofrecerRecorrido:true });
  await cerrarGuiaInicial(p);
  assert.equal(await p.locator('.metronet-recorrido').count(),0);
  await p.locator('.metronet-tutorial > summary').click();
  await p.locator('.metronet-tutorial__panel:popover-open').waitFor();
  await p.getByRole('button',{name:'Recorrer la pantalla',exact:true}).click();
  await p.evaluate(n => { editorPrueba.escenarioJuegoActual=n; editorPrueba.actualizarAyuda(); },escenario(2));
  assert.equal(await p.locator('.metronet-recorrido').count(),0);
  await p.locator('.metronet-tutorial > summary').click();
  await p.locator('.metronet-tutorial__panel:popover-open').waitFor();
  await p.getByRole('button',{name:'Recorrer la pantalla',exact:true}).click();
  assert.equal(await p.locator('.metronet-recorrido').getAttribute('data-objetivo'),'[data-elegir-herramienta="conexiones"]');
  assert.equal(await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).count(),0);
  assert.equal(await p.locator('.metronet-tutorial').getAttribute('data-paso'),'conexiones');
});

for (const n of [2,3,4,5,10]) test(`Nivel ${n}: recorrido físico solo para herramientas nuevas`, async t => {
  const { pagina:p } = await abrir(t,n);
  assert.equal(await p.locator('.metronet-tutorial>summary').isVisible(),true);
  assert.equal(await p.locator('[data-hud-vista="tutorial"]').count(),0);
  assert.equal(await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).count(),0);
  const panel = p.locator('.metronet-tutorial');
  const objetivo = {2:'[data-elegir-herramienta="conexiones"]',3:'[data-elegir-herramienta="metros"]',4:'[data-ir-simulacion]'}[n];
  assert.equal(await p.locator('.metronet-recorrido').count(),1);
  assert.equal(await p.locator('.metronet-recorrido').getAttribute('data-objetivo'), objetivo ?? '.metronet-herramientas__barra');
  if (n === 3) {
    await p.evaluate(() => { editorPrueba.disenoActual.unidadesMetro=[]; editorPrueba.actualizarAyuda(); });
    assert.equal(await panel.getAttribute('data-paso'),'metros');
  } else assert.equal(await panel.getAttribute('data-paso'),n === 2 ? 'conexiones' : n === 4 ? 'simulacion' : 'manual');
});

test('La guía aparece en primera entrada, no se repite al recargar y queda disponible manualmente', async t => {
  const { pagina:p } = await abrir(t,2);
  const guia = p.locator('.metronet-recorrido');
  await guia.waitFor();
  assert.equal(await guia.getAttribute('data-objetivo'),'[data-elegir-herramienta="conexiones"]');
  await guia.locator('[data-recorrido-omitir]').click();
  await p.reload();
  await p.waitForFunction(() => document.querySelector('.metronet-tutorial')?.dataset.paso === 'conexiones');
  assert.equal(await guia.count(),0);
  await p.locator('.metronet-tutorial > summary').click();
  await p.locator('.metronet-tutorial__panel:popover-open').waitFor();
  assert.equal(await p.locator('.metronet-tutorial__panel:popover-open').getByRole('button').count(),1);
  await p.getByRole('button',{name:'Recorrer la pantalla',exact:true}).click();
  await guia.waitFor();
  while (await guia.getAttribute('data-objetivo') !== 'fin') await guia.locator('[data-recorrido-siguiente]').click();
  assert.equal(await guia.locator('h2').textContent(),'¡Listos para construir!');
  await guia.waitFor({state:'detached',timeout:5000});
  await p.reload();
  await p.waitForFunction(() => document.querySelector('.metronet-tutorial')?.dataset.paso === 'conexiones');
  assert.equal(await guia.count(),0);
});

test('Nivel 4 señala Simular en Edición y permite repetir la indicación', async t => {
  const { pagina:p } = await abrir(t,4);
  const panel = p.locator('.metronet-tutorial');
  assert.equal(await panel.getAttribute('data-paso'),'simulacion');
  const guia = p.locator('.metronet-recorrido');
  assert.equal(await guia.getAttribute('data-objetivo'),'[data-ir-simulacion]');
  assert.equal(await p.locator('[data-ir-simulacion]').isVisible(),true);
  await guia.locator('[data-recorrido-siguiente]').click();
  assert.equal(await guia.locator('h2').textContent(),'¡Listos para construir!');
  assert.equal(await p.locator('[data-ir-simulacion]').isVisible(),true);
  await guia.waitFor({state:'detached',timeout:5000});
  await panel.locator('>summary').click();
  await panel.getByRole('button',{name:'Recorrer la pantalla'}).click();
  assert.equal(await guia.getAttribute('data-objetivo'),'[data-ir-simulacion]');
  await guia.locator('[data-recorrido-omitir]').click();
  await p.reload();
  await p.waitForFunction(() => document.querySelector('.metronet-tutorial')?.dataset.paso === 'simulacion');
  assert.equal(await p.locator('.metronet-recorrido').count(),0);
});

test('Pista aporta razonamiento sin duplicar los controles del tutorial', async t => {
  const { pagina:p } = await abrir(t);
  const ayuda = await p.evaluate(async () => (await import('/src/educacion/AyudaContextual.js')).obtenerAyudaContextual({
    diseno:{estaciones:[{nombre:'A'},{nombre:'B'}],lineas:[]}, escenario:{numero:1,dificultad:'Inicial'},tutorialActivo:true,
    modo:'crearLinea',seleccionadas:['A','B'],estadoConsigna:'disponible',consigna:{condiciones:[{clave:'minimoLineas',completado:false}]},
  }));
  assert.match(ayuda.texto,/orden/); assert.doesNotMatch(ayuda.pista,/pulsá|botón|confirmá/i);
});


test('Tutorial y Controles siguen siendo exclusivos al abrirlos con teclado', async t => {
  const { pagina:p } = await abrir(t);
  await cerrarGuiaInicial(p);
  await p.locator('.metronet-tutorial>summary').focus(); await p.keyboard.press('Enter');
  await p.locator('.metronet-tutorial__panel:popover-open').waitFor();
  await p.locator('.metronet-hud>summary').focus(); await p.keyboard.press('Enter');
  await p.waitForFunction(() => !document.querySelector('.metronet-tutorial').open);
  assert.equal(await p.locator('.metronet-hud').evaluate(e => e.open),true);
});

test('Alternar antes de entregar toggle conserva el último panel solicitado', async t => {
  const { pagina:p } = await abrir(t);
  for (const ultimo of ['.metronet-hud', '.metronet-tutorial']) {
    await p.evaluate(ultimo => {
      const tutorial=document.querySelector('.metronet-tutorial'), hud=document.querySelector('.metronet-hud');
      tutorial.open=false; hud.open=false;
      // Cambios en la misma tarea: los eventos toggle todavía no se entregaron.
      (ultimo === '.metronet-hud' ? tutorial : hud).open=true;
      document.querySelector(ultimo).open=true;
    }, ultimo);
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await p.locator(ultimo).evaluate(e => e.open),true);
    assert.equal(await p.locator('.metronet-hud[open], .metronet-tutorial[open]').count(),1);
  }
});
