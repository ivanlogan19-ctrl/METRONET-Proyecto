const { test, before, after }=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
let navegador;
before(async()=>{navegador=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL});});
after(async()=>{await navegador?.close();});
const ranking={jugadores:Array.from({length:40},(_,i)=>({posicion:i+1,jugador:'Jugador '+i,puntajeTotal:1000-i,nivelesCompletados:10,sosVos:false})),puntajeTotal:0,puntajeMaximo:1000,tuPosicion:null};
const responder=req=>{
 const path=new URL(req.url()).pathname;
 if(path==='/auth/login/admin')return{json:{token:'prueba-de-navegacion',usuario:{idUsuario:7,nombre:'Operador',rol:'ADMIN'}}};
 if(path.startsWith('/auth/logout'))return{status:204};
 if(path==='/api/juego/escenarios')return{json:[]};
 if(path==='/api/juego/ranking')return{json:ranking};
};
async function abrir(t,ruta,opciones={}){const v=await abrirPantalla(navegador,ruta,{responder,...opciones});t.after(()=>v.contexto.close());t.after(()=>assert.deepEqual(v.errores,[]));return v;}
async function ingresar(p){await p.locator('#usuario').fill('operador');await p.locator('#password').fill('Prueba1!');await p.locator('#loginAdminButton').click();await p.locator('.metronet-bienvenida').waitFor();await p.locator('[data-continuar-bienvenida]').click();await p.waitForURL('**/admin.html');await p.locator('[data-editar-usuario]').first().waitFor();}
test('Recorrido completo: editor, escenarios, administración, logout, bienvenida, inicio, ranking y diseños',async t=>{
 const {pagina:p}=await abrir(t,'/admin-login.html');await ingresar(p);
 const alturas=[];
 const ir=async nombre=>{await p.locator('.metronet-navegacion__enlaces').getByRole('link',{name:nombre,exact:true}).click();await p.locator('.metronet-navegacion__enlace.activo').first().waitFor();alturas.push(await p.locator('.metronet-navegacion').evaluate(e=>e.getBoundingClientRect().height));};
 await ir('Mis diseños');await p.locator('#listaMisDisenos[aria-busy=false]').waitFor();await p.getByRole('link',{name:'Abrir diseño: Red de Montevideo'}).click();await p.waitForURL(url=>url.pathname==='/'&&url.searchParams.get('idDiseno')==='77');await p.locator('[data-editor-activo]:not([hidden])').waitFor({state:'attached'});
 await ir('Escenarios');await p.locator('.metronet-escenarios-pagina__tarjeta').first().waitFor();await ir('Administración');
 await p.locator('.metronet-navegacion__usuario>summary').click();await p.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await p.waitForURL('**/login.html');
 await p.getByRole('link',{name:'Acceso administrativo',exact:true}).click();await ingresar(p);
 for(const nombre of ['Inicio','Escenarios','Ranking','Mis diseños'])await ir(nombre);
 await p.locator('#listaMisDisenos[aria-busy=false]').waitFor();await p.getByRole('link',{name:'Abrir diseño: Red de Montevideo'}).click();await p.waitForURL(url=>url.pathname==='/'&&url.searchParams.get('idDiseno')==='77');await p.locator('[data-editor-activo]:not([hidden])').waitFor({state:'attached'});
 await p.waitForFunction(()=>{const m=document.querySelector('#metronet-mapa'),c=m?.querySelector('canvas');return c&&Math.abs(c.height-m.getBoundingClientRect().height)<3;});
 assert.deepEqual([...new Set(alturas)],[76]);
 assert.equal(await p.locator('.metronet-mapa-cargando').count(),0);
});
for(const reducedMotion of ['no-preference','reduce'])test(`Scroll nativo y transición ${reducedMotion}: nueva página arriba, atrás restaura`,async t=>{
 const {pagina:p,contexto}=await abrir(t,'/ranking.html',{viewport:{width:1280,height:720},reducedMotion});
 await contexto.addInitScript(()=>{addEventListener('pagereveal',e=>{if(e.viewTransition)e.viewTransition.ready.then(()=>sessionStorage.setItem('transicion-probada','lista'),()=>sessionStorage.setItem('transicion-probada','omitida'));});});
 await p.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Inicio',exact:true}).click();await p.locator('.metronet-inicio__tarjeta').first().waitFor();
 if(reducedMotion==='no-preference'){await p.waitForFunction(()=>sessionStorage.getItem('transicion-probada')!==null);assert.equal(await p.evaluate(()=>sessionStorage.getItem('transicion-probada')),'lista');}
 await p.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Ranking',exact:true}).click();
 await p.locator('#clasificacionRanking tr').first().waitFor();await p.evaluate(()=>scrollTo(0,600));const anterior=await p.evaluate(()=>scrollY);assert.equal(anterior,600);
 await p.evaluate(async()=>{const {navegarConCambiosPendientes}=await import('/src/navegacion/NavegacionAplicacion.js');await navegarConCambiosPendientes('/inicio.html');});await p.waitForURL('**/inicio.html');await p.locator('.metronet-inicio__tarjeta').first().waitFor();assert.equal(await p.evaluate(()=>scrollY),0);
 await p.goBack();await p.locator('#clasificacionRanking tr').first().waitFor();await p.waitForFunction(()=>scrollY===600);assert.equal(await p.evaluate(()=>scrollY),anterior);
 if(reducedMotion==='reduce')assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement,'::view-transition-new(root)').animationName),'none');
});
