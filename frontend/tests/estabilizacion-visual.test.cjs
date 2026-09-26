const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
const BASE = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });
const progreso = { escenarios: [{ numero:1, nombre:'Red inicial', mejorPuntaje:100, ultimoPuntaje:90, puntajeMaximo:100 }], nivelesCompletados:1, cantidadNiveles:10 };
const jugadores = Array.from({length:8},(_,i)=>({posicion:i+1,jugador:i===0?'Alias largo de prueba sin datos personales de usuarios reales':'Jugador '+(i+1),puntajeTotal:i===0?123456789:100-i,nivelesCompletados:10-i,sosVos:i===1}));
const ranking = lista => ({jugadores:lista,puntajeTotal:99,puntajeMaximo:1000,tuPosicion:lista.length>1?2:null});
function responder(req) {
 const path=new URL(req.url()).pathname;
 if(path==='/api/juego/escenarios')return {json:[]};
 if(path==='/api/juego/ranking')return {json:ranking(jugadores)};
}
async function abrir(t,ruta,opciones={}) {
 const v=await abrirPantalla(navegador,ruta,{responder,...opciones});
 t.after(()=>v.contexto.close());t.after(()=>assert.deepEqual(v.errores,[]));return v;
}
async function esperarMapa(p) {
 await p.locator('.metronet-hud > summary').waitFor({state:'attached'});
 await p.waitForFunction(()=>{const m=document.querySelector('#metronet-mapa'),c=m?.querySelector('canvas');return c&&Math.abs(c.height-m.getBoundingClientRect().height)<3&&c.height>300;});
}
async function medidas(p) {
 return p.evaluate(()=>Object.fromEntries(['.metronet-navegacion','#metronet-aplicacion','#metronet-mapa','#metronet-mapa canvas'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x,y:r.y,w:r.width,h:r.height}]})));
}
for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[390,844]]) test(`Mis Diseños ${width}x${height}: tamaño inicial y menús independientes`,async t=>{
 const {pagina:p}=await abrir(t,'/',{viewport:{width,height}});await esperarMapa(p);
 const antes=await medidas(p);
 assert.equal(antes['#metronet-aplicacion'].h,height-antes['.metronet-navegacion'].h);
 await p.locator('.metronet-navegacion__usuario > summary').click();assert.deepEqual(await medidas(p),antes);
 await p.keyboard.press('Escape');
 if(width<620)await p.locator('[data-panel-edicion-toggle]').click();
 await p.locator('.metronet-hud > summary').scrollIntoViewIfNeeded();
 const base=await medidas(p);
 await p.locator('.metronet-hud > summary').click();
 await p.locator('.metronet-hud__panel').waitFor();
 assert.deepEqual(await medidas(p),base);
 const panel=await p.locator('.metronet-hud__panel').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width+1&&panel.y+panel.height<=height+1);
 await p.keyboard.press('Escape');assert.deepEqual(await medidas(p),base);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});
for(const origen of ['/inicio.html','/escenarios.html','/ranking.html'])test(`Mis Diseños desde ${origen}, atrás y adelante`,async t=>{
 const {pagina:p}=await abrir(t,origen,{responder:req=>new URL(req.url()).pathname==='/api/juego/progreso'?{json:{...progreso,modoLibreDesbloqueado:true}}:responder(req)});await p.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Mis diseños',exact:true}).click();await p.getByRole('link',{name:'Abrir diseño: Red de Montevideo'}).click();await esperarMapa(p);
 const base=await medidas(p);await p.goBack();await p.goForward();await esperarMapa(p);assert.deepEqual(await medidas(p),base);
});
for(const ruta of ['/login.html','/admin-login.html','/registro.html','/recuperar-contrasena.html','/nueva-contrasena.html','/verificar-codigo.html'])test(`Música ${ruta}: icono común y formulario estable`,async t=>{
 const {pagina:p}=await abrir(t,ruta,{viewport:{width:390,height:844}});
 const acceso=p.locator('[data-control-musica] > summary');await acceso.waitFor();
 assert.equal(await acceso.getAttribute('aria-label'),'Música');
 assert.deepEqual(await acceso.evaluate(e=>{const r=e.getBoundingClientRect();return[r.width,r.height]}),[44,44]);
 const antes=await p.locator('.auth-card').boundingBox();await acceso.click();await p.locator('.metronet-audio__panel:popover-open').waitFor();
 assert.deepEqual(await p.locator('.auth-card').boundingBox(),antes);
 await p.getByRole('checkbox',{name:'Silenciar música'}).check();assert.equal(await p.getByRole('checkbox',{name:'Silenciar música'}).isChecked(),true);
 await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('[data-control-musica] > summary')?.getAttribute('aria-expanded')==='false');assert.deepEqual(await p.locator('.auth-card').boundingBox(),antes);
});
for(const width of [1440,390,320])test(`POI ${width}: lupa compacta, consulta conservada y sin categoría Otros`,async t=>{
 const v=await abrirEditor(navegador,{viewport:{width,height:900}});t.after(()=>v.contexto.close());t.after(()=>assert.deepEqual(v.errores,[]));const p=v.pagina;
 assert.equal(await p.locator('.metronet-capas-activas').isVisible(),false);
 await p.locator('.metronet-poi > summary').click();
 assert.equal(await p.locator('.metronet-poi__categorias button').count(),10);
 assert.equal(await p.locator('.metronet-capas-activas [data-categoria=OTROS]').count(),0);
 assert.equal(await p.locator('.metronet-poi [data-categoria=OTROS]').count(),0);
 const compacto=()=>p.getByRole('button',{name:'Buscar punto de interés',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return[r.width,r.height]});
 assert.deepEqual(await compacto(),[44,44]);
 const lupa=p.getByRole('button',{name:'Buscar punto de interés',exact:true});await lupa.focus();await p.keyboard.press('Enter');
 const campo=p.getByRole('searchbox',{name:'Buscar punto de interés',exact:true});await campo.fill('Hospital');
 assert.ok((await campo.boundingBox()).width>110, 'El input ocupa el ancho disponible al abrir');
 assert.ok((await p.locator('.metronet-panel-puntos-interes').boundingBox()).width>240, 'La búsqueda abierta utiliza el panel, no la caja de la lupa');
 await p.locator('.metronet-panel-puntos-item').first().waitFor();
 const puntos=await p.locator('.metronet-panel-puntos-item').count();assert.ok(puntos>0);
 await p.getByRole('button',{name:'Cerrar búsqueda',exact:true}).click();assert.deepEqual(await compacto(),[44,44]);
 await lupa.click();assert.equal(await campo.inputValue(),'Hospital');assert.equal(await p.locator('.metronet-panel-puntos-item').count(),puntos);
 await campo.fill('zzzz-sin-referencia');assert.equal(await p.locator('.metronet-panel-puntos-item').count(),0);
 await p.keyboard.press('Escape');assert.deepEqual(await compacto(),[44,44]);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});
test('Sin control Otros, incluso cuando existen referencias sin categoría aprobada',async t=>{
 const {pagina:p}=await abrir(t,'/');await esperarMapa(p);
 const r=await p.evaluate(async()=>{const {default:Panel}=await import('/src/mapa/controles/PanelReferenciasTerritoriales.js');const contenedor=document.createElement('div');document.body.append(contenedor);const panel=new Panel({contenedor,mapa:contenedor,alCambiarCategorias:()=>{}});panel.crear();panel.establecerCatalogo([]);const vacio=!panel.controles.has('OTROS');panel.establecerCatalogo([{tipo:'TIPO_SIN_CLASIFICAR'}]);const conDatos=!panel.controles.has('OTROS');panel.eliminar();contenedor.remove();return{vacio,conDatos};});assert.deepEqual(r,{vacio:true,conDatos:true});
});
test('Todos los dibujos comparten centro y escala pixel; estados no desplazan los botones',async t=>{
 const {pagina:p}=await abrir(t,'/inicio.html');
 const r=await p.evaluate(async()=>{const {PICTOGRAMAS_MAPA}=await import('/src/interfaz/PictogramasMapa.js');const {configurarBotonIcono}=await import('/src/interfaz/IconosRetro.js');const holder=document.createElement('div');holder.style.cssText='display:flex;flex-wrap:wrap;gap:8px';document.body.append(holder);return Object.keys(PICTOGRAMAS_MAPA).map(nombre=>{const b=document.createElement('button');configurarBotonIcono(b,nombre,nombre);holder.append(b);const r=b.getBoundingClientRect(),s=b.querySelector('svg').getBoundingClientRect(),d=b.querySelector('path').getBBox();return{nombre,w:r.width,h:r.height,dx:s.x+s.width/2-r.x-r.width/2,dy:s.y+s.height/2-r.y-r.height/2,cx:d.x+d.width/2,cy:d.y+d.height/2,max:Math.max(d.width,d.height)};});});
 for(const i of r){assert.deepEqual([i.w,i.h],[44,44],i.nombre);assert.ok(Math.abs(i.dx)<.1&&Math.abs(i.dy)<.1,i.nombre);assert.ok(Math.abs(i.cx-8)<=.5&&Math.abs(i.cy-8)<=.5,i.nombre);assert.ok(i.max>=13&&i.max<=14,i.nombre);}
 const boton=p.getByRole('button',{name:'guardar',exact:true});await boton.scrollIntoViewIfNeeded();const box=await boton.boundingBox();await boton.hover();assert.deepEqual(await boton.boundingBox(),box);await p.mouse.down();assert.deepEqual(await boton.boundingBox(),box);await p.mouse.up();
});
for(const width of [1440,390,320])for(const cantidad of [0,1,8])test(`Ranking ${width}: ${cantidad} registros, tabla y datos secundarios`,async t=>{
 const {pagina:p}=await abrir(t,'/ranking.html',{viewport:{width,height:900},responder:req=>{const path=new URL(req.url()).pathname;if(path==='/api/juego/ranking')return{json:ranking(jugadores.slice(0,cantidad))};if(path==='/api/juego/progreso')return{json:progreso};}});
 await p.locator('#resumenPuntaje').filter({hasText:'Mejor puntaje acumulado'}).waitFor();
 assert.equal(await p.locator('#clasificacionRanking tr').count(),cantidad);
 assert.equal(await p.locator('#estadoRanking').isVisible(),cantidad===0);
 assert.equal(await p.getByRole('columnheader').count(),4);
 assert.equal(await p.getByRole('columnheader').evaluateAll(celdas=>celdas.every(celda=>{const texto=document.createRange();texto.selectNodeContents(celda);const r=texto.getBoundingClientRect(),c=celda.getBoundingClientRect();return r.height<=parseFloat(getComputedStyle(celda).lineHeight)+1&&r.left>=c.left&&r.right<=c.right;})),true,'Los encabezados se leen en una sola línea dentro de su columna');
 if(cantidad){assert.equal(await p.locator('#clasificacionRanking tr').first().locator('td').nth(2).textContent(),'123456789');}
 await p.locator('.ranking-detalle > summary').click();assert.equal(await p.locator('#puntajesPorNivel li').count(),1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});
test('Ranking admin: conserva exclusión y resumen secundario',async t=>{
 const {pagina:p}=await abrir(t,'/ranking.html',{administrador:true});await p.locator('#resumenPuntaje').filter({hasText:'Esta cuenta no participa'}).waitFor();assert.equal(await p.locator('.ranking-marcador').count(),1);assert.equal(await p.locator('#tituloMiDesempeno').textContent(),'ADMIN // Modo de pruebas');
});

test('POI táctil: lupa de 44px y resultados legibles sin tooltip sobre el input',async t=>{
 const v=await abrirEditor(navegador,{viewport:{width:390,height:844},hasTouch:true});t.after(()=>v.contexto.close());t.after(()=>assert.deepEqual(v.errores,[]));const p=v.pagina;
 await p.locator('.metronet-poi>summary').tap();const lupa=p.getByRole('button',{name:'Buscar punto de interés',exact:true});await lupa.tap();
 const campo=p.getByRole('searchbox',{name:'Buscar punto de interés',exact:true});await campo.fill('Hospital');assert.ok((await campo.boundingBox()).width>110);
 assert.equal(await campo.getAttribute('data-ayuda-sistema'),null);
 const figura=await p.locator('.metronet-panel-puntos-icono svg').first().boundingBox();assert.deepEqual([figura.width,figura.height],[16,16]);
 await p.getByRole('button',{name:'Cerrar búsqueda',exact:true}).tap();assert.deepEqual(await p.getByRole('button',{name:'Buscar punto de interés',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return[r.width,r.height]}),[44,44]);
});
