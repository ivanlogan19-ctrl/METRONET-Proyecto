// Navegador real y API simulada: no escribe en PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
const niveles = require('../src/educacion/niveles.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const modulo = '/src/educacion/glosario/';
const escenario = numero => ({ ...niveles.find(n => n.numero === numero), idEscenario: 800 + numero, estado: 'DISPONIBLE', desbloqueado: true });
async function abrir(t, ruta = '/escenarios.html', opciones = {}) {
  const vista = await abrirPantalla(navegador, ruta, opciones);
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  return vista;
}
async function captura(pagina, nombre) {
  if (!process.env.METRONET_GLOSARIO_CAPTURAS) return;
  fs.mkdirSync(process.env.METRONET_GLOSARIO_CAPTURAS, { recursive: true });
  await pagina.locator('.metronet-glosario-ventana').evaluateAll(elementos =>
    Promise.all(elementos.flatMap(e => e.getAnimations()).map(animacion => animacion.finished.catch(() => {}))));
  await pagina.screenshot({ path: path.join(process.env.METRONET_GLOSARIO_CAPTURAS, `${nombre}.png`) });
}

test('Registro: alias, plurales, límites de palabras, acentos, términos largos y faltantes', async t => {
  const { pagina: p } = await abrir(t);
  const resultado = await p.evaluate(async modulo => {
    const { CONCEPTOS, segmentarConceptos, obtenerConcepto } = await import(modulo + 'Conceptos.js');
    const { conceptosDelNivel } = await import(modulo + 'ContextoConceptos.js');
    const texto = 'LÍNEAS DE METRO, estaciones, conexión y tramos; POI, puntos de interés, transbordos. Unidades del mapa. Metronet, estacionamiento, zapoi, _POI y POI_.';
    return { texto, segmentos: segmentarConceptos(texto, conceptosDelNivel({numero:7})), desconocido: obtenerConcepto('sin-definicion'),
      faltante: segmentarConceptos('Texto POI sin ayuda.', ['sin-definicion']), ids: CONCEPTOS.map(c => c.id) };
  }, modulo);
  assert.equal(resultado.segmentos.map(s => s.texto).join(''), resultado.texto);
  assert.deepEqual(resultado.segmentos.filter(s => s.id).map(s => s.id), ['linea','estacion','conexion','conexion','poi','poi','transbordo','unidades-mapa']);
  assert.equal(resultado.desconocido, null);
  assert.deepEqual(resultado.faltante, [{texto:'Texto POI sin ayuda.'}]);
  assert.equal(new Set(resultado.ids).size, resultado.ids.length);
  for (const interno of ['PASA','DTO','repositorio','JPA','frecuencia']) assert.equal(resultado.ids.includes(interno), false);
});

test('Configuración explícita: niveles consecutivos, herramientas y repaso sin conceptos nuevos', async t => {
  const { pagina: p } = await abrir(t);
  const resultado = await p.evaluate(async ({modulo,niveles}) => {
    const {conceptosDelNivel} = await import(modulo+'ContextoConceptos.js');
    return { niveles: niveles.map(n => ({numero:n.numero,ids:conceptosDelNivel(n)})),
      desconocido:conceptosDelNivel({numero:999}), sinSimulacion:conceptosDelNivel({numero:4,herramientasHabilitadas:{simulacion:false}}) };
  }, {modulo,niveles});
  for (const nivel of resultado.niveles) {
    assert.equal(nivel.ids.includes('simulacion'), nivel.numero >= 4);
    assert.equal(nivel.ids.includes('transbordo'), nivel.numero >= 7);
    assert.equal(nivel.ids.includes('poi'), nivel.numero >= 4);
    assert.ok(nivel.ids.includes('puntaje'), 'Todos los niveles tienen criterios de puntuación');
  }
  assert.deepEqual(resultado.niveles[7].ids, resultado.niveles[6].ids, 'Nivel 8 repasa conceptos ya disponibles');
  assert.deepEqual(resultado.desconocido, []);
  assert.equal(resultado.sinSimulacion.includes('simulacion'), false);
  assert.equal(resultado.sinSimulacion.includes('ritmo'), false);
});

test('Consigna intacta, términos repetidos, texto seguro y actualización idempotente', async t => {
  const { pagina:p } = await abrir(t);
  const resultado = await p.evaluate(async modulo => {
    const {destacarConceptos} = await import(modulo+'GlosarioContextual.js');
    const contenedor=document.createElement('section'); document.body.append(contenedor);
    const p=document.createElement('p'); p.textContent='POI, puntos de interés, estaciones y transbordos. <img src=x onerror=alert(1)>';
    const a=document.createElement('button'); a.textContent='Localizar estación';
    contenedor.append(p,a); const antes=contenedor.textContent;
    destacarConceptos(contenedor,['poi','estacion','transbordo']); destacarConceptos(contenedor,['poi','estacion','transbordo']);
    const datos={antes,despues:contenedor.textContent,ids:[...contenedor.querySelectorAll('[data-concepto]')].map(e=>e.dataset.concepto),anidados:contenedor.querySelectorAll('button button').length,imagenes:contenedor.querySelectorAll('img').length};
    destacarConceptos(contenedor,['estacion']); datos.resto=[...contenedor.querySelectorAll('[data-concepto]')].map(e=>e.dataset.concepto);
    return datos;
  }, modulo);
  assert.equal(resultado.antes,resultado.despues); assert.deepEqual(resultado.ids,['poi','estacion','transbordo']);
  assert.equal(resultado.anidados,0); assert.equal(resultado.imagenes,0); assert.deepEqual(resultado.resto,['estacion']);
});

test('Tap: abre, cierra y permite continuar; contenido largo sin desbordes', async t => {
  const contexto=await navegador.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true}); t.after(()=>contexto.close());
  // Probar esta vista aislada; la navegación persistente tiene su propia suite integral.
  await contexto.route('**/iniciar-contenedor.js', ruta => ruta.fulfill({ contentType:'application/javascript', body:'' }));
  const p=await contexto.newPage();
  await p.goto((process.env.METRONET_URL_PRUEBAS||'http://127.0.0.1:5173')+'/login.html');
  await p.evaluate(async modulo=>{
    const {destacarConceptos}=await import(modulo+'GlosarioContextual.js');
    const main=document.createElement('main'); main.id='textoLargo'; main.style.padding='24px';
    main.textContent=('Una estación con conexión y transbordo permite planificar el recorrido. ').repeat(20);
    document.body.replaceChildren(main); destacarConceptos(main,['estacion','conexion','transbordo']);
  },modulo);
  const boton=p.locator('[data-concepto=transbordo]'); await boton.tap();
  await p.locator('.metronet-glosario-ventana').waitFor();
  await captura(p,'touch-360');
  assert.equal(await p.getByRole('button',{name:'Cerrar explicación'}).count(),0);
  await p.mouse.click(5,5);
  assert.equal(await p.locator('.metronet-glosario-ventana').count(),0);
  assert.equal(await p.locator('#textoLargo [data-concepto]').count(),3);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});

test('La explicación contextual se cierra al pulsar fuera o con Escape', async t => {
  const {pagina:p} = await abrir(t, '/login.html');
  await p.evaluate(async modulo => {
    const {destacarConceptos} = await import(modulo+'GlosarioContextual.js');
    const contenedor = document.createElement('section');
    contenedor.style.padding = '40px';
    contenedor.textContent = 'Una unidad de metro circula por la línea.';
    document.body.append(contenedor);
    destacarConceptos(contenedor, ['unidad'], {contextual:true});
  }, modulo);
  const termino = p.locator('[data-concepto=unidad]');
  await termino.click();
  assert.equal(await p.locator('.metronet-glosario-contextual').count(), 1);
  assert.equal(await p.getByRole('button',{name:'Cerrar explicación'}).count(), 0);
  await p.mouse.click(5,5);
  assert.equal(await p.locator('.metronet-glosario-contextual').count(), 0);
  await termino.click();
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.metronet-glosario-contextual').count(), 0);
});

test('Constructor: objetivos visibles y cambio de nivel sin acciones ocultas', async t => {
  const nivel={...escenario(7),objetivo:'Conectá los POI mediante una estación de transbordo.',instrucciones:'Ubicá estaciones en barrios y zonas.'};
  const {contexto,pagina:p,errores,solicitudes}=await abrirEditor(navegador,{escenario:nivel});
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  await p.waitForFunction(()=>editorPrueba.estadoConsigna==='disponible');
  const consigna=p.locator('[data-contenedor-consigna]');
  if(await consigna.locator('[data-alternar-consigna]').isVisible() && await consigna.locator('[data-alternar-consigna]').getAttribute('aria-expanded')==='false') await consigna.locator('[data-alternar-consigna]').click();
  assert.equal(await consigna.locator('.metronet-consigna__lista-breve .metronet-consigna__texto-objetivo').textContent(),nivel.objetivo);
  assert.equal(await p.locator('[data-elegir-herramienta=estaciones]').isVisible(),true);
  assert.equal(await p.locator('[data-herramienta] [data-concepto=linea]').first().isVisible(),false);
  assert.equal(await p.locator('dialog[open]').count(),0);
  await p.locator('[data-elegir-herramienta=estaciones]').click();
  assert.equal(await p.locator('[data-elegir-herramienta=estaciones]').getAttribute('aria-pressed'),'true');
  await p.evaluate(()=>{editorPrueba.escenarioJuegoActual={numero:1,objeto:'',objetivo:'Creá estaciones y una línea. POI y simulación no pertenecen a este nivel.'}; editorPrueba.aplicarHerramientas();});
  assert.equal(await consigna.locator('.metronet-consigna__lista-breve .metronet-consigna__texto-objetivo').textContent(),'Creá estaciones y una línea. POI y simulación no pertenecen a este nivel.');
  assert.equal(await p.locator('.metronet-glosario-contextual').count(),0);
  assert.equal(solicitudes.length,0);
});

test('Simulación: consigna por ID real, unidades correctas y consulta sin ejecutar', async t => {
  const {pagina:p,solicitudes}=await abrir(t,'/simulacion.html?idDiseno=77',{responder:req=>{
    if(req.url().endsWith('/progreso')) return {json:{escenarios:[{...escenario(7),idEscenario:42}]}};
    if(req.url().endsWith('/consigna')) return {json:{estadoGlobal:'PARCIAL',progreso:50,condiciones:[{texto:'Estaciones de transbordo',actual:1,requerido:2}],referenciasObjetivo:[]}};
    return null;
  }});
  assert.equal(await p.locator('#consignaSimulacion').count(),0);
  assert.equal(await p.locator('.simulacion-ritmo').isVisible(), false);

  await p.locator('#seccionConfiguracion [data-concepto=duracion]').click();
  assert.match(await p.locator('.metronet-glosario-ventana').textContent(),/horas/); await p.keyboard.press('Escape');
  await p.locator('#seccionCirculacion [data-concepto=velocidad]').click();
  assert.match(await p.locator('.metronet-glosario-ventana').textContent(),/UV/); await p.keyboard.press('Escape');
  assert.equal(solicitudes.some(s=>s.method==='POST'),false);
  assert.equal(await p.locator('#duracionSimulacion').getAttribute('min'),'1');
  assert.equal(await p.locator('#formularioEjecucion button[type=submit]').isEnabled(),true);
});

test('Falla de contexto educativo: simulación y reproducción siguen disponibles', async t => {
  const {pagina:p}=await abrir(t,'/simulacion.html?idDiseno=77',{responder:req=>req.url().endsWith('/progreso')?{status:503,json:{}}:null});
  assert.equal(await p.locator('#formularioEjecucion button[type=submit]').isEnabled(),true);
  await p.locator('#seccionCirculacion [data-concepto=velocidad]').click();
  assert.match(await p.locator('.metronet-glosario-ventana').textContent(),/UV/);
});
