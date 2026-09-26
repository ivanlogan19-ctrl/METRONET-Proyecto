// Catálogo y Phaser reales; API interceptada para no modificar cuentas ni diseños.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirEditor } = require('./soporte/editor.cjs');
const CATEGORIAS = ['AGUA','ESPACIOS_VERDES','INFRAESTRUCTURA','CULTURA','SALUD','COMERCIO','PATRIMONIO','INSTITUCIONAL','OTROS'];
let navegador;
before(async () => { navegador = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => navegador?.close());
async function abrir(t, opciones) {
  const v = await abrirEditor(navegador, opciones);
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores, []); });
  await v.pagina.evaluate(() => { window.poi = editorPrueba.escena.capaPuntosInteres; });
  return v;
}
async function panel(p) { if (!await p.locator('.metronet-poi').evaluate(e=>e.open)) await p.locator('.metronet-poi>summary').click(); }

test('Inventario: 121 IDs, metadata y coordenadas intactos, 62 polígonos, seis zonas, categorías justificadas y paletas independientes', async t => {
  const {pagina:p}=await abrir(t);
  const r=await p.evaluate(async()=>{
    const m=await import('/src/mapa/configuracion/CategoriasReferencias.js');
    const {PALETA_RED}=await import('/src/mapa/configuracion/PaletaRed.js');
    const fuente=(await import('/src/mapa/datos/puntos-interes.json')).default;
    const originales=Object.values(fuente.barrios).flatMap(b=>b.puntos);
    return {
      ids:poi.puntos.map(p=>p.id),
      intactos:originales.every(o=>poi.puntos.some(p=>['id','nombre','tipo','descripcion','latitud','longitud','imagen'].every(k=>p[k]===o[k]))),
      grupos:Object.fromEntries(m.CATEGORIAS_PUNTUALES.map(c=>[c,poi.puntos.filter(p=>m.obtenerCategoriaReferencia(p)===c).length])),
      barrios:editorPrueba.escena.capaBarrios.barrios.length,
      zonas:(await import('/src/mapa/utilidades/ClasificadorZonas.js')).ZONAS.length,
      patrimonio:poi.puntos.filter(p=>m.obtenerCategoriaReferencia(p)==='PATRIMONIO').map(p=>p.tipo),
      casos:['Hospital universitario','Museo ferroviario','Parque','Plaza mirador','Río','Arroyo','Puerto','Edificio histórico','Espacio público'].map(tipo=>m.obtenerCategoriaReferencia({tipo})),
      colores:Object.values(m.CATEGORIAS_REFERENCIAS).map(c=>c.color),
      rail:[...PALETA_RED.lineas,...Object.values(PALETA_RED.estaciones),...PALETA_RED.metros,PALETA_RED.transbordo],
      buscables:poi.obtenerResumenPuntos().puntosBusqueda.length,
    };
  });
  assert.equal(r.ids.length,121); assert.equal(new Set(r.ids).size,121); assert.equal(r.intactos,true);
  assert.equal(r.barrios,62); assert.equal(r.zonas,6); assert.equal(r.buscables,121);
  assert.deepEqual(r.grupos,{AGUA:9,ESPACIOS_VERDES:33,INFRAESTRUCTURA:17,CULTURA:28,SALUD:3,COMERCIO:7,PATRIMONIO:11,INSTITUCIONAL:1});
  assert.ok(r.patrimonio.every(t=>t.startsWith('Patrimonio')||['Edificio histórico','Estadio histórico','Avenida histórica','Universidad'].includes(t)));
  assert.deepEqual(r.casos,['SALUD','CULTURA','ESPACIOS_VERDES','ESPACIOS_VERDES','AGUA','AGUA','INFRAESTRUCTURA','PATRIMONIO','OTROS']);
  assert.equal(new Set(r.colores).size,r.colores.length); assert.ok(r.colores.every(c=>!r.rail.includes(c)));
});

test('Multiselección por UI: barrios y zonas independientes, ocultar/restaurar no borra selección ni afecta POI', async t=>{
  const {pagina:p,solicitudes}=await abrir(t);
  await panel(p); await p.getByRole('button',{name:'Barrios / Zonas',exact:true}).click();
  await p.locator('#metronet-selector-barrios .metronet-panel-encabezado').click();
  await p.locator('#metronet-selector-barrios input[value="AGUADA"]').check();
  await p.locator('#metronet-selector-barrios input[value="AIRES PUROS"]').check();
  await p.locator('#metronet-selector-zonas .metronet-panel-encabezado').click();
  const zonas=p.locator('#metronet-selector-zonas input');
  await zonas.nth(1).check(); await zonas.nth(2).check();
  const seleccion=()=>p.evaluate(()=>({b:editorPrueba.escena.capaBarrios.barriosSeleccionados,z:editorPrueba.escena.capaBarrios.zonasSeleccionadas,c:[...poi.categoriasVisibles]}));
  const antes=await seleccion(); assert.equal(antes.b.length,2); assert.equal(antes.z.length,2);
  await p.locator('#metronet-selector-barrios .metronet-panel-encabezado').click();
  await p.locator('#metronet-selector-barrios input[value="AGUADA"]').uncheck();
  assert.deepEqual(await seleccion(), { ...antes, b: ['AIRES PUROS'] });
  await p.locator('#metronet-selector-barrios input[value="AGUADA"]').check();
  await p.locator('#metronet-selector-zonas .metronet-panel-encabezado').click();
  await zonas.nth(1).uncheck();
  const restante = await seleccion();
  assert.equal(restante.z.length, 1);
  assert.deepEqual([...restante.b].sort(), [...antes.b].sort());
  assert.equal(await zonas.nth(2).isChecked(), true);
  await zonas.nth(1).check();
  const restaurada = await seleccion();
  await p.locator('[data-capa-geografica="barrios"]').click();
  assert.deepEqual(await seleccion(),restaurada);
  assert.equal(await p.evaluate(()=>editorPrueba.escena.capaBarrios.graficos.every(r=>r.grafico.commandBuffer.length===0)),true);
  await p.locator('[data-capa-geografica="zonas"]').click();
  assert.deepEqual(await seleccion(),restaurada);
  assert.equal(await p.evaluate(()=>editorPrueba.escena.capaBarrios.graficos.some(r=>r.grafico.commandBuffer.length>0)),true);
  await p.locator('[data-capa-geografica="barrios"]').click();
  assert.deepEqual(await seleccion(),restaurada); assert.deepEqual(solicitudes,[]);
});

test('Objetivos visibles con capas apagadas y búsqueda persistente sin modificar selección territorial', async t=>{
  const {pagina:p}=await abrir(t,{objetivos:[{idPunto:85,radioCobertura:60}]});
  await p.evaluate(()=>{poi.establecerCategoriasVisibles([]); editorPrueba.escena.selectorBarrios.seleccionarBarrio('AGUADA');});
  for(const id of [85,29,20,33,1]){
    await panel(p); await p.getByRole('button',{name:'Buscar punto de interés',exact:true}).click();
    const nombre=await p.evaluate(id=>poi.puntos.find(p=>p.id===id).nombre,id);
    await p.getByRole('searchbox').fill(nombre);
    await p.locator(`.metronet-panel-puntos-lista [data-id-punto="${id}"]`).click();
    const ficha=p.getByRole('dialog'); await ficha.waitFor(); assert.match(await ficha.innerText(),new RegExp(nombre.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
    await ficha.getByRole('button',{name:'Cerrar',exact:true}).click();
    const r=await p.evaluate(id=>({capas:[...poi.categoriasVisibles],b:editorPrueba.escena.capaBarrios.barriosSeleccionados,visible:poi.representaciones.find(r=>r.punto.id===id).contenedor.visible,buscado:poi.puntoBuscado}),id);
    assert.deepEqual(r.capas,[]); assert.deepEqual(r.b,['AGUADA']); assert.equal(r.visible,true); assert.ok(r.buscado);
    await panel(p); await p.getByRole('button',{name:'Buscar punto de interés',exact:true}).click(); await p.getByRole('searchbox').fill(''); await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(()=>poi.puntoBuscado),null);
  }
  assert.equal(await p.evaluate(()=>poi.representaciones.find(r=>r.punto.id===85).contenedor.visible),true);
});

for(const width of [1440,1024,768,390,320]) test(`POI y HUD a ${width}px: acceso compacto, alineación, teclado y sin overflow`,async t=>{
  const {pagina:p}=await abrir(t,{viewport:{width,height:844}});
  assert.equal(await p.locator('.metronet-poi').evaluate(e=>e.open),false);
  assert.equal(await p.locator('.metronet-territorio-selectores').count(),0);
  await p.locator('.metronet-poi>summary').focus(); await p.keyboard.press('Enter');
  const rect=await p.locator('.metronet-poi__panel').boundingBox();
  assert.ok(rect.x>=0&&rect.x+rect.width<=width); assert.ok(rect.width<=410);
  const sizes=await p.locator('.metronet-poi__categorias button').evaluateAll(bs=>bs.map(b=>({h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width,p:getComputedStyle(b).padding,svg:!!b.querySelector('svg')})));
  assert.ok(sizes.every(b=>b.h>=44&&b.w>=44&&b.svg)); assert.equal(new Set(sizes.map(b=>b.h)).size,1); assert.equal(new Set(sizes.map(b=>b.p)).size,1);
  await p.keyboard.press('Escape'); assert.equal(await p.locator('.metronet-poi').evaluate(e=>e.open),false);
  assert.equal(await p.locator('.metronet-poi>summary').evaluate(e=>e===document.activeElement),true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await p.locator('.metronet-capas-activas span').count(),9);
});

test('Reingreso y cambio de diseño no duplican controles ni conservan búsqueda anterior', async t=>{
  const {pagina:p}=await abrir(t);
  await p.evaluate(()=>editorPrueba.escena.localizarReferencia(33,{desdeBusqueda:true}));
  await p.evaluate(()=>editorPrueba.abrirDiseno(77));
  await p.reload(); await p.waitForFunction(()=>window.juegoPrueba?.scene.getScene('MapaScene')?.editorRedMetro?.disenoActual);
  assert.equal(await p.locator('.metronet-poi').count(),1); assert.equal(await p.locator('.metronet-hud').count(),1); assert.equal(await p.locator('[data-control-musica]').count(),1);
  assert.equal(await p.evaluate(()=>juegoPrueba.scene.getScene('MapaScene').capaPuntosInteres.puntoBuscado),null);
});

test('Iconos e indicadores mantienen el color de su categoría y muestran ayuda al recibir foco', async t => {
  const { pagina: p } = await abrir(t);
  await panel(p);
  const colores = await p.evaluate(async () => {
    const { CATEGORIAS_REFERENCIAS } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
    return Object.entries(CATEGORIAS_REFERENCIAS).filter(([categoria]) => categoria !== 'OTROS').map(([categoria, { color }]) => {
      const boton = document.querySelector(`.metronet-poi__categorias [data-categoria="${categoria}"]`);
      const indicador = document.querySelector(`.metronet-capas-activas [data-categoria="${categoria}"]`);
      return {
        esperado: `rgb(${color >> 16}, ${(color >> 8) & 255}, ${color & 255})`,
        boton: getComputedStyle(boton.querySelector('svg')).color,
        indicador: getComputedStyle(indicador.querySelector('svg')).color,
        borde: getComputedStyle(indicador).borderTopColor,
      };
    });
  });
  for (const { esperado, boton, indicador, borde } of colores) {
    assert.equal(boton, esperado);
    assert.equal(indicador, esperado);
    assert.equal(borde, esperado);
  }
  await p.getByRole('img', { name: 'Salud', exact: true }).focus();
  await p.waitForFunction(() => document.querySelector('#metronet-ayuda-sistema')?.textContent === 'Salud');
  assert.equal(await p.getByRole('tooltip').isVisible(), true);
});

test('Mapa estrecho: vista general reduce densidad sin perder el catálogo ni el punto buscado', async t => {
  const { pagina: p } = await abrir(t, { viewport: { width: 320, height: 844 } });
  await p.evaluate(() => {
    editorPrueba.escena.cameras.main.setZoom(1);
    poi.actualizarVisibilidad(1, { forzar: true });
  });
  const estado = await p.evaluate(async () => {
    const { obtenerCategoriaReferencia } = await import('/src/mapa/configuracion/CategoriasReferencias.js');
    const visibles = poi.representaciones.filter(r => r.contenedor.visible);
    return {
      catalogo: poi.puntos.length,
      porCategoria: visibles.reduce((r, p) => {
        const c = obtenerCategoriaReferencia(p.punto);
        r[c] = (r[c] || 0) + 1;
        return r;
      }, {}),
    };
  });
  assert.equal(estado.catalogo, 121);
  assert.ok(Object.values(estado.porCategoria).every(cantidad => cantidad <= 3));
  await panel(p);
  await p.getByRole('button', { name: 'Buscar punto de interés' }).click();
  await p.getByRole('searchbox').fill('Hospital de Clínicas');
  await p.locator('.metronet-panel-puntos-lista button').first().click();
  assert.equal(await p.getByRole('dialog', { name: 'Información de Hospital de Clínicas' }).isVisible(), true);
});
