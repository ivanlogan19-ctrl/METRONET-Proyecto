const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless:true, channel:process.env.METRONET_BROWSER_CHANNEL, args:['--autoplay-policy=no-user-gesture-required'] }); });
after(async () => { await navegador?.close(); });
const base = process.env.METRONET_URL_PRUEBAS || 'http://127.0.0.1:5173';
async function abrir(t, ruta='/inicio.html', opciones={}) {
  const v = await abrirPantalla(navegador, ruta, { administrador:true, ...opciones, contenedor:true, responder: async req => (await opciones.responder?.(req)) ?? (new URL(req.url()).pathname === "/api/juego/escenarios" ? {json:[]} : null) });
  t.after(async () => { await v.contexto.close(); assert.deepEqual(v.errores,[]); });
  return v;
}
async function sonar(p, pista='menu') {
  await p.waitForFunction(pista => { const g=window[Symbol.for('metronet:gestor-musica')], a=g?.audio;
    return a?.getAttribute('src')===`/audio/${pista}-theme.mp3` && !a.paused && a.currentTime>0 && a.volume===.35 && g.canales.size===1;
  },pista);
}
async function marcar(p) {
  await p.evaluate(() => { window.audioOriginal=document.querySelector('audio'); window.eventosAudio=[];
    for(const e of ['pause','play','emptied','seeking']) audioOriginal.addEventListener(e,()=>eventosAudio.push(e));
    window.tiempoOriginal=audioOriginal.currentTime; window.instanteOriginal=performance.now();
  });
}
async function continuidad(p) {
  const d=await p.evaluate(()=>({ mismo:audioOriginal===document.querySelector('audio'), eventos:eventosAudio,
    avance:audioOriginal.currentTime-tiempoOriginal, real:(performance.now()-instanteOriginal)/1000,
    canales:document.querySelectorAll('audio').length, oyentes:window[Symbol.for('metronet:gestor-musica')].oyentes.size,
    temporales:window[Symbol.for('metronet:gestor-musica')].temporales.size }));
  assert.equal(d.mismo,true); assert.deepEqual(d.eventos,[]); assert.equal(d.canales,1);
  assert.ok(Math.abs(d.avance-d.real)<.3,JSON.stringify(d)); assert.ok(d.oyentes<=2,JSON.stringify(d)); return d;
}
async function ir(v,p,nombre,ruta) {
  await v.locator('.metronet-navegacion__enlaces').getByRole('link',{name:nombre,exact:true}).click();
  await v.waitForURL(`**/${ruta}.html`); await v.locator('.metronet-navegacion').waitFor(); await p.waitForURL(`**/${ruta}.html`);
}

test('Doce cambios de menú, Atrás/Adelante: mismo Audio, sin pause/play/seek ni acumulación',async t=>{
  const {pagina:p,vista:v}=await abrir(t); await sonar(p); await marcar(p);
  for(let i=0;i<3;i++) for(const [n,r] of [['Escenarios','escenarios'],['Ranking','ranking'],['Administración','admin'],['Inicio','inicio']]) await ir(v,p,n,r);
  await continuidad(p);
  await p.goBack(); await v.waitForURL('**/admin.html'); await p.waitForURL('**/admin.html');
  await p.goBack(); await v.waitForURL('**/ranking.html'); await p.waitForURL('**/ranking.html');
  await p.goForward(); await v.waitForURL('**/admin.html'); await p.waitForURL('**/admin.html');
  assert.equal((await continuidad(p)).temporales,0);
  assert.equal(await v.locator('audio').count(),0);
});

test('Carga lenta del HTML de destino: música ininterrumpida durante la espera real',async t=>{
  const {pagina:p,vista:v}=await abrir(t); await sonar(p); await marcar(p);
  let liberar; const demora=new Promise(r=>liberar=r);
  await p.route('**/ranking.html',async ruta=>{await demora;await ruta.continue();});
  try {
    const click=v.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Ranking',exact:true}).click({noWaitAfter:true});
    await p.waitForTimeout(900); await continuidad(p); liberar(); await click;
    await v.waitForURL('**/ranking.html'); await continuidad(p);
  } finally { liberar(); }
});

test('Menú, juego y Administración alternan sus pistas; las subsecciones ADMIN no las reinician', async t => {
  const { pagina: p, vista: v } = await abrir(t);
  await sonar(p);
  for (let i = 0; i < 3; i++) {
    await v.evaluate(() => location.assign('/?idDiseno=77'));
    await v.locator('[data-editor-activo]:not([hidden])').waitFor({ state: 'attached' });
    await sonar(p, 'extra');
    await ir(v, p, 'Administración', 'admin'); await sonar(p, 'menu'); await marcar(p);
    for (const vista of ['disenos', 'configuracion', 'actividad', 'usuarios']) {
      await v.locator(`[data-vista="${vista}"]`).click();
      await continuidad(p);
    }
    assert.equal(await v.locator('audio').count(), 0);
    await ir(v, p, 'Inicio', 'inicio'); await sonar(p);
    const estado = await p.evaluate(() => {
      const g = window[Symbol.for('metronet:gestor-musica')];
      return { canales: g.canales.size, oyentes: g.oyentes.size, temporales: g.temporales.size, timer: g.temporizadorMezcla };
    });
    assert.equal(estado.canales, 1); assert.ok(estado.oyentes <= 2);
    assert.equal(estado.temporales, 0); assert.equal(estado.timer, null);
  }
});

test('Contextos y preferencias: menú → juego → simulación, volumen y silencio compartidos',async t=>{
  const {pagina:p,vista:v}=await abrir(t); await sonar(p);
  await v.evaluate(()=>location.assign('/?idDiseno=77')); await v.locator('[data-editor-activo]:not([hidden])').waitFor({state:'attached'});
  await sonar(p,'extra'); await marcar(p);
  await v.evaluate(()=>location.assign('/simulacion.html?idDiseno=77')); await v.locator('#panelSimulacion:not([hidden])').waitFor();
  await sonar(p,'extra'); await continuidad(p);
  await v.locator('#volverEdicion').click(); await v.waitForURL('**/?idDiseno=77*');
  await sonar(p,'extra'); await continuidad(p);
  await v.evaluate(async()=>{const {gestorMusica:g}=await import('/src/audio/GestorMusica.js');g.establecerVolumen(.2);g.establecerSilencio(true);});
  await ir(v,p,'Inicio','inicio');
  assert.deepEqual(await p.evaluate(()=>{const g=window[Symbol.for('metronet:gestor-musica')];return[g.volumen,g.silenciado,g.audio.paused];}),[.2,true,true]);
  await v.locator('.metronet-audio>summary').click(); await v.locator('[data-silencio-musica]').uncheck();
  await p.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').volume===.2);
});

for(const rol of ['ADMIN','JUGADOR']) test(`Login/logout ${rol}: pistas originales, destino y regreso seguro`,async t=>{
  const admin=rol==='ADMIN';
  const {pagina:p,vista:v}=await abrir(t,admin?'/admin-login.html':'/login.html',{administrador:admin,responder:req=>{
    const ruta=new URL(req.url()).pathname;
    if(ruta===`/auth/login${admin?'/admin':''}`)return{json:{token:'sesion-de-prueba',usuario:{idUsuario:7,nombre:'Prueba',rol}}};
    if(ruta.startsWith('/auth/logout'))return{status:204};
  }});
  await sonar(p,'extra'); await v.locator(admin?'#usuario':'#email').fill(admin?'operador':'prueba@example.test');
  await v.locator('#password').fill('Prueba1!'); await v.locator(admin?'#loginAdminButton':'#loginButton').click();
  await v.locator('.metronet-bienvenida').waitFor(); await sonar(p,'welcome');
  await v.locator('[data-continuar-bienvenida]').click(); await v.waitForURL(`**/${admin?'admin':'inicio'}.html`); await sonar(p);
  await v.locator('.metronet-navegacion__usuario>summary').click(); await v.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await v.waitForURL('**/login.html'); await sonar(p,'extra');
  assert.equal(await p.evaluate(()=>localStorage.getItem('sesionAdministrador')||localStorage.getItem('sesionUsuario')),null);
  await p.goBack(); await v.locator('#loginForm, #loginAdminForm').waitFor();
  assert.equal(await v.locator('#tablaUsuarios, .metronet-inicio__tarjeta').count(),0);
});

test('Credenciales inválidas: permanece login, sin bienvenida ni cambio de pista',async t=>{
  const {pagina:p,vista:v}=await abrir(t,'/login.html',{responder:req=>new URL(req.url()).pathname==='/auth/login'?{status:401,json:{detail:'Credenciales incorrectas.'}}:null});
  await sonar(p,'extra'); await marcar(p); await v.locator('#email').fill('incorrecto@example.test'); await v.locator('#password').fill('Prueba1!');await v.locator('#loginButton').click();
  await v.locator('#mensaje.error').waitFor();assert.equal(await v.locator('.metronet-bienvenida').count(),0); await continuidad(p);
});

test('Recarga explícita recupera posición y conserva tipo reload en la vista',async t=>{
  const {pagina:p}=await abrir(t); await sonar(p); await p.locator('audio').evaluate(a=>a.currentTime=3);
  await p.reload(); await p.locator('#pantalla-metronet').waitFor(); const v=await (await p.locator('#pantalla-metronet').elementHandle()).contentFrame();
  await v.locator('.metronet-inicio__tarjeta').first().waitFor(); await sonar(p);
  assert.ok(await p.locator('audio').evaluate(a=>a.currentTime>=3));
  assert.equal(await v.evaluate(()=>window[Symbol.for('metronet:tipo-navegacion')]),'reload');
});

test('Historial reemplazado por editor mantiene URL, título y solo una entrada',async t=>{
  const {pagina:p,vista:v}=await abrir(t); await ir(v,p,'Escenarios','escenarios');
  await v.evaluate(()=>history.replaceState({},'', '/escenarios.html?prueba=77#objetivo'));
  await p.waitForURL('**/escenarios.html?prueba=77#objetivo');assert.equal(await p.title(),await v.title());
  await p.goBack();await p.waitForURL('**/inicio.html');await v.waitForURL('**/inicio.html');
});

for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]) test(`Contenedor ocupa viewport sin cortar pantalla ${viewport.width}`,async t=>{
  const {pagina:p,vista:v}=await abrir(t,'/inicio.html',{viewport});
  assert.deepEqual(await p.locator('iframe').evaluate(e=>{const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height];}),[0,0,viewport.width,viewport.height]);
  assert.equal(await v.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await v.locator('h1').isVisible(),true);
});

test('Seguridad: solo mismo origen puede embeber las vistas; destino externo rechazado',async t=>{
  const {pagina:p,vista:v}=await abrir(t,'/login.html');
  const respuesta=await p.request.get(`${base}/inicio.html`);
  assert.match(respuesta.headers()['content-security-policy'],/frame-ancestors 'self'/);
  assert.equal(respuesta.headers()['x-frame-options'],'SAMEORIGIN');
  await p.goto(`${base}/aplicacion.html?destino=${encodeURIComponent('https://example.test/')}`);
  await p.frameLocator('iframe').locator('#loginForm').waitFor();assert.equal(new URL(p.url()).pathname,'/login.html');
});

test('El respaldo de HTML independiente continúa disponible si falla el contenedor',async t=>{
  const {pagina:p}=await abrir(t,'/login.html');
  await p.goto(`${base}/login.html?documento=1`);await p.locator('#loginForm').waitFor();assert.equal(await p.locator('iframe').count(),0);
});

test('Salir del editor conserva confirmación, cancelar conserva mapa y música',async t=>{
  const {pagina:p,vista:v}=await abrir(t,'/inicio.html');
  await v.evaluate(()=>location.assign('/?idDiseno=77'));await v.locator('[data-editor-activo]:not([hidden])').waitFor({state:'attached'});await sonar(p,'extra');
  await v.evaluate(async()=>{window.limpiarPrueba=(await import('/src/navegacion/NavegacionAplicacion.js')).registrarControlCambios({hayCambios:()=>true,guardar:()=>false});});
  await marcar(p);await v.locator('.metronet-navegacion__enlaces').getByRole('link',{name:'Inicio',exact:true}).click();await v.locator('[data-dialogo-cambios]').waitFor();
  await v.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(new URL(v.url()).pathname,'/');await continuidad(p);
  await v.evaluate(()=>limpiarPrueba());await ir(v,p,'Inicio','inicio');await sonar(p);
});

test('Documento anterior no puede cambiar audio con callbacks tardíos',async t=>{
  const {pagina:p,vista:v}=await abrir(t);await sonar(p);
  await v.evaluate(async()=>{const g=(await import('/src/audio/GestorMusica.js')).gestorMusica;parent.callbackAntiguo=()=>g.establecerContexto('gameplay');});
  await ir(v,p,'Ranking','ranking');await marcar(p);await p.evaluate(()=>{callbackAntiguo();delete window.callbackAntiguo;});await continuidad(p);
});

test('Fallo de entrada del contenedor ofrece acceso al HTML de respaldo',async t=>{
  const contexto=await navegador.newContext();t.after(()=>contexto.close());const p=await contexto.newPage();
  await p.route('**/src/navegacion/ContenedorAplicacion.js*',r=>r.abort());
  await p.goto(`${base}/login.html`);await p.locator('#error-pantalla:not([hidden])').waitFor();
  await p.locator('#abrir-documento').click();await p.locator('#loginForm').waitFor();assert.equal(await p.locator('iframe').count(),0);
});

for(const reducido of [false,true]) test(`Intro y cartel de nivel conservan canción y duración completa (reducido ${reducido})`,async t=>{
  const nivel={...require('../src/educacion/niveles.json')[0],idEscenario:1,estado:'DISPONIBLE',desbloqueado:true};
  const red={simulacion:{idDiseno:77,idEscenario:1,nombre:'Primera red',modo:'NIVEL',estado:'EN_DISENO'},estaciones:[],lineas:[],tramos:[],unidadesMetro:[],preparadoParaSimular:false,territorio:{areas:[],errores:[]}};
  const {pagina:p,vista:v}=await abrir(t,'/inicio.html',{administrador:false,reducedMotion:reducido?'reduce':'no-preference',responder:req=>{
    const path=new URL(req.url()).pathname;
    if(path==='/api/juego/progreso')return{json:{escenarios:[nivel],cantidadNiveles:10,nivelesCompletados:0,modoLibreDesbloqueado:false}};
    if(path==='/api/juego/escenarios')return{json:[nivel]};
    if(path.endsWith('/escenarios/1/iniciar'))return{json:{idDiseno:77,idEscenario:1,idIntento:123,numeroCampana:1,mostrarTutorial:true}};
    if(path==='/api/simulaciones/77')return{json:red};
  }});
  const inicio=Date.now();await v.getByRole('button',{name:'Comenzar escenario',exact:true}).click();await v.locator('.metronet-viaje').waitFor();await sonar(p,'victory');await marcar(p);
  await v.locator('.metronet-viaje .metronet-cartel-transicion:not([hidden])').waitFor();await continuidad(p);
  assert.ok(await p.locator('audio').evaluate(a=>a.currentTime>10.5&&a.currentTime<13.9));
  await v.waitForURL('**/?idDiseno=77&idEscenario=1&idIntento=123');await p.waitForURL('**/?idDiseno=77&idEscenario=1&idIntento=123');
  assert.ok(Date.now()-inicio>=13600&&Date.now()-inicio<20000);await sonar(p,'extra');
  await v.getByRole('button',{name:'Mostrar tutorial',exact:true}).waitFor();assert.equal(await v.locator('.metronet-identificacion').count(),0);
});

test('Outro y siguiente nivel mantienen la canción completa y liberan su contexto al navegar',async t=>{
  const {pagina:p,vista:v}=await abrir(t);await sonar(p);
  await v.evaluate(async()=>{const {mostrarTransicionNivel}=await import('/src/educacion/PantallaTransicionNivel.js');window.finPrueba=mostrarTransicionNivel({numero:1},{numero:2},{puntaje:100});});
  await sonar(p,'victory');await marcar(p);const inicio=Date.now();
  await v.locator('.metronet-victoria .metronet-cartel-transicion:not([hidden])').waitFor();await continuidad(p);
  assert.equal(await v.evaluate(()=>finPrueba),'siguiente');assert.ok(Date.now()-inicio>13000);
  await ir(v,p,'Escenarios','escenarios');await sonar(p);assert.equal(await p.evaluate(()=>window[Symbol.for('metronet:gestor-musica')].temporales.size),0);
});

test('Gesto de usuario dentro del iframe habilita audio y conserva acceso con autoplay bloqueado',async t=>{
  const b=await chromium.launch({headless:true,channel:process.env.METRONET_BROWSER_CHANNEL,args:['--autoplay-policy=user-gesture-required']});t.after(()=>b.close());
  const {pagina:p,vista:v,contexto:c,errores}=await abrirPantalla(b,'/login.html',{contenedor:true});t.after(async()=>{await c.close();assert.deepEqual(errores,[]);});
  await p.waitForFunction(()=>window[Symbol.for('metronet:gestor-musica')].obtenerEstado().esperandoGesto);
  assert.equal(await v.locator('#loginButton').isEnabled(),true);await v.locator('#email').click();await sonar(p,'extra');
});

test('Permisos de JUGADOR siguen bloqueando Administración dentro del contenedor',async t=>{
  const {pagina:p,vista:v}=await abrir(t,'/inicio.html',{administrador:false});
  await v.evaluate(()=>location.assign('/admin.html'));await v.waitForURL('**/admin-login.html');await p.waitForURL('**/admin-login.html');
  assert.equal(await v.locator('#tablaUsuarios').count(),0);assert.equal(await v.locator('#loginAdminForm').isVisible(),true);
});

for(const reducido of [false,true]) test(`Entrada contenida breve y redirects repetidos sin transición nativa inválida (reducido ${reducido})`,async t=>{
  const {pagina:p,vista:v}=await abrir(t,'/inicio.html',{administrador:false,reducedMotion:reducido?'reduce':'no-preference'});
  const estilo=await v.locator('body').evaluate(e=>{const s=getComputedStyle(e);return{nombre:s.animationName,duracion:s.animationDuration};});
  assert.equal(estilo.nombre,reducido?'none':'metronet-entrada-pagina');
  if(!reducido)assert.equal(estilo.duracion,'0.18s');
  for(let i=0;i<4;i++){
    await v.evaluate(()=>location.assign('/admin.html'));await v.waitForURL('**/admin-login.html');await v.locator('#loginAdminForm').waitFor();
    assert.equal(await v.locator('link[href="/transiciones-documento.css"]').count(),0);
    await v.evaluate(()=>location.assign('/inicio.html'));await v.locator('.metronet-inicio__tarjeta').first().waitFor();
    await p.waitForURL('**/inicio.html');
  }
});

test('Ranking largo: Atrás y recarga completa restauran scroll dentro de la vista',async t=>{
  const {pagina:p,vista:v}=await abrir(t,'/ranking.html',{viewport:{width:1280,height:720},responder:req=>new URL(req.url()).pathname==='/api/juego/ranking'?{json:{jugadores:Array.from({length:40},(_,i)=>({posicion:i+1,jugador:'Jugador '+i,puntajeTotal:1000-i,nivelesCompletados:10})),puntajeTotal:0,puntajeMaximo:1000,tuPosicion:null}}:null});
  await v.locator('#clasificacionRanking tr').first().waitFor();await v.evaluate(()=>scrollTo(0,600));assert.equal(await v.evaluate(()=>scrollY),600);
  await v.evaluate(()=>location.assign('/inicio.html'));await v.locator('.metronet-inicio__tarjeta').first().waitFor();
  await p.goBack();await v.locator('#clasificacionRanking tr').first().waitFor();await v.waitForFunction(()=>scrollY===600);
  await p.reload();await p.locator('#pantalla-metronet').waitFor();const f=await(await p.locator('#pantalla-metronet').elementHandle()).contentFrame();
  await f.locator('#clasificacionRanking tr').first().waitFor();await f.waitForFunction(()=>scrollY===600);
});
