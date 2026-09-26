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
  const v = await abrirEditor(navegador, { escenario:escenario(n), estaciones:[], lineas:[], tramos:[], consigna, ...opciones });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  return v;
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
  await p.getByRole('button', { name:'Comenzar directamente', exact:true }).click();
  assert.equal(await panel.getAttribute('data-paso'), 'elegir-estacion');
  await p.locator('[data-elegir-herramienta="lineas"]').click();
  assert.equal(await panel.getAttribute('data-paso'), 'elegir-estacion');
  await p.locator('[data-elegir-herramienta="estaciones"]').click();
  assert.equal(await panel.getAttribute('data-paso'), 'colocar-estacion');
  await p.evaluate(() => editorPrueba.ubicarEstacion({ posicionX:-100, posicionY:-100 }, 'crearEstacion'));
  assert.equal(await panel.getAttribute('data-paso'), 'colocar-estacion');
  assert.equal(solicitudes.length, 0);
  assert.ok(await panel.locator('.metronet-tutorial__error').isVisible());
  await p.getByRole('button', { name:'Cerrar tutorial', exact:true }).click();
  for (const posicionX of [750, 810]) await p.evaluate(x => editorPrueba.ubicarEstacion({ posicionX:x, posicionY:500 }, 'crearEstacion'), posicionX);
  assert.equal(await panel.getAttribute('data-paso'), 'elegir-linea');
  assert.equal(await panel.getAttribute('open'), null);
  await panel.locator('>summary').click();
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

for (const width of [1440,768,390,320]) test(`Recorrido opcional: ocho controles habilitados, teclado y burbujas a ${width}px`, async t => {
  const { pagina:p, solicitudes } = await abrir(t, 1, { ofrecerRecorrido:true, viewport:{ width, height:900 } });
  await p.emulateMedia({ reducedMotion:'reduce' });
  await p.getByRole('button', { name:'Mostrar tutorial', exact:true }).focus();
  await p.keyboard.press('Enter');
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
  await dialogo.getByRole('button', { name:'Comenzar', exact:true }).click();
  assert.equal(await dialogo.count(),0);
  assert.equal(await p.locator('.metronet-tutorial').getAttribute('data-fase'),'practica');
  assert.equal(solicitudes.length,0);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
});

test('Omitir con Escape, reabrir y cambiar de escenario limpian el recorrido y conservan edición normal', async t => {
  const { pagina:p } = await abrir(t,1,{ ofrecerRecorrido:true });
  await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).click();
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-recorrido').count(),0);
  await p.getByRole('button',{name:'Recorrer la pantalla',exact:true}).click();
  await p.evaluate(n => { editorPrueba.escenarioJuegoActual=n; editorPrueba.actualizarAyuda(); },escenario(2));
  assert.equal(await p.locator('.metronet-recorrido').count(),0);
  assert.equal(await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).count(),0);
  assert.equal(await p.locator('.metronet-tutorial').getAttribute('data-paso'),'conexiones');
});

for (const n of [2,3,4,5,10]) test(`Nivel ${n}: acceso propio sin tour automático; introducción solo de novedades`, async t => {
  const { pagina:p } = await abrir(t,n);
  assert.equal(await p.locator('.metronet-tutorial>summary').isVisible(),true);
  assert.equal(await p.locator('[data-hud-vista="tutorial"]').count(),0);
  assert.equal(await p.getByRole('button',{name:'Mostrar tutorial',exact:true}).count(),0);
  const panel = p.locator('.metronet-tutorial');
  if (n === 3) {
    await p.evaluate(() => { editorPrueba.disenoActual.unidadesMetro=[]; editorPrueba.actualizarAyuda(); });
    assert.equal(await panel.getAttribute('data-paso'),'metros');
  } else assert.equal(await panel.getAttribute('data-paso'),n === 2 ? 'conexiones' : n === 4 ? 'simulacion' : 'manual');
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
  await p.locator('.metronet-tutorial>summary').focus(); await p.keyboard.press('Enter');
  await p.locator('.metronet-tutorial__panel:popover-open').waitFor();
  await p.locator('.metronet-hud>summary').focus(); await p.keyboard.press('Enter');
  await p.waitForFunction(() => !document.querySelector('.metronet-tutorial').open);
  assert.equal(await p.locator('.metronet-hud').evaluate(e => e.open),true);
});
