// Detecta desajustes reales entre controles, contrato REST, validación y persistencia.
// Solo se ejecuta con el clúster efímero de probar-postgres.sh --administracion-e2e.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const {once}=require('node:events');
const {randomBytes}=require('node:crypto');
const {createServer}=require('node:net');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const raiz=path.resolve(__dirname,'../..');
const db=process.env.METRONET_TEST_POSTGRES_URL?.match(/^jdbc:postgresql:\/\/127\.0\.0\.1:(\d+)\/metronet_pruebas$/);
const espera=ms=>new Promise(r=>setTimeout(r,ms));
async function puertoLibre(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();return p;}
function sql(consulta){
  return execFileSync(process.env.METRONET_TEST_PSQL,['-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',db[1],'-U',process.env.METRONET_TEST_POSTGRES_USER,'-d','metronet_pruebas','-c',consulta],
    {encoding:'utf8',env:{...process.env,PGPASSWORD:process.env.METRONET_TEST_POSTGRES_PASSWORD}}).trim();
}
async function disponible(url,proceso){
  for(let i=0;i<180;i++){
    if(proceso.exitCode!==null)throw Error(`Servidor terminó con ${proceso.exitCode}`);
    try{await fetch(url);return;}catch{}
    await espera(250);
  }
  throw Error(`Servidor no disponible: ${url}`);
}

test('Administración real: navegador → Spring Boot → PostgreSQL aislado',{timeout:240000},async t=>{
  assert(db&&db[1]!=='5432','Requiere el PostgreSQL efímero; nunca usar la instalación del jugador');
  const evidencias=path.join(raiz,'.local/informes/admin-e2e');fs.mkdirSync(evidencias,{recursive:true});
  const api=`http://127.0.0.1:${await puertoLibre()}`,base=`http://127.0.0.1:${await puertoLibre()}`;
  const procesos=[];
  t.after(async()=>{for(const p of procesos.reverse()){if(p.exitCode===null){p.kill('SIGTERM');await Promise.race([once(p,'exit'),espera(5000)]);if(p.exitCode===null)p.kill('SIGKILL');}}});
  function iniciar(cmd,args,env,nombre){
    const log=fs.openSync(path.join(evidencias,`${nombre}.log`),'w');
    const p=spawn(cmd,args,{cwd:raiz,env:{...process.env,...env},stdio:['ignore',log,log]});fs.closeSync(log);procesos.push(p);return p;
  }
  const backend=iniciar(path.join(process.env.JAVA_HOME,'bin/java'),['-jar','backend/target/backend-0.0.1-SNAPSHOT.jar'],{
    SERVER_PORT:new URL(api).port,METRONET_DB_URL:process.env.METRONET_TEST_POSTGRES_URL,
    METRONET_DB_USUARIO:'metronet_app',METRONET_DB_CONTRASENA:process.env.METRONET_TEST_POSTGRES_PASSWORD,
    METRONET_CORS_ORIGENES:base,METRONET_SMTP_HABILITADO:'false'},'backend');
  await disponible(api+'/api/admin/niveles',backend);
  const vite=iniciar(process.execPath,['frontend/node_modules/vite/bin/vite.js','frontend','--host','127.0.0.1','--port',new URL(base).port,'--strictPort'],{},'frontend');
  await disponible(base+'/admin-login.html',vite);
  const clave=`Qa!${randomBytes(18).toString('hex')}`;
  const registro=await fetch(api+'/auth/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:'Ana',apellido:'Prueba',email:'admin-e2e@example.test',password:clave,aceptaDatos:true})});
  assert.equal(registro.status,200,await registro.text());
  sql("UPDATE usuario SET rol='ADMIN',identificador_administrador='auditoria-e2e' WHERE email='admin-e2e@example.test'");
  assert.equal((await fetch(api+'/api/admin/niveles')).status,401,'Administración requiere sesión');
  const browser=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL});t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  // Proxy transparente: no se reemplazan respuestas ni se omite ninguna capa.
  await context.route(/http:\/\/[^/]+:8080\//,route=>route.continue({url:api+new URL(route.request().url()).pathname+new URL(route.request().url()).search}));
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errores=[];page.on('pageerror',e=>errores.push(e.message));
  const frame=()=>page.frames().find(f=>f.parentFrame());
  await page.goto(base+'/admin-login.html');
  await page.locator('#pantalla-metronet').waitFor();
  await frame().locator('#usuario').fill('auditoria-e2e');await frame().locator('#password').fill(clave);
  const login=page.waitForResponse(r=>r.url().endsWith('/auth/login/admin')&&r.request().method()==='POST');
  await frame().locator('#loginAdminButton').click();const sesion=await(await login).json();assert(sesion.token);
  await frame().getByRole('link',{name:'Administración',exact:true}).waitFor({timeout:30000});
  assert.match(frame().url(),/inicio.html/,'El acceso de ADMIN llega a Inicio');
  await frame().getByRole('link',{name:'Administración',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#pantalla-metronet')?.contentWindow?.document.querySelector('[data-admin-vista="experiencia"]')||document.querySelector('#pantalla-metronet')?.contentWindow?.document.body?.textContent.includes('Experiencia de juego'));
  await frame().getByRole('button',{name:'Experiencia de juego',exact:true}).click();
  await frame().locator('[data-editar-nivel="10"]').waitFor();
  const get=async ruta=>{const r=await fetch(api+`/api/admin/niveles${ruta}`,{headers:{Authorization:`Bearer ${sesion.token}`}});assert.equal(r.status,200);return r.json();};
  async function abrir(n){await frame().locator(`[data-editar-nivel="${n}"]`).click();await frame().locator('[data-editor-nivel]').waitFor();}
  async function tab(nombre){await frame().getByRole('tab',{name:nombre,exact:true}).click();}
  async function salir(){await frame().getByRole('button',{name:'Volver a los niveles para editar',exact:true}).click();await frame().locator('[data-editar-nivel="10"]').waitFor();}
  async function guardar(n,estado=200){
    const respuesta=page.waitForResponse(r=>r.url().endsWith(`/niveles/${n}/borrador`)&&r.request().method()==='PUT');
    await frame().getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();const r=await respuesta;
    assert.equal(r.status(),estado,await r.text());
    await frame().getByRole('button',{name:'Guardar cambios del nivel',exact:true}).waitFor();return r.json();
  }
  async function preview(n,estado=200){const espera=page.waitForResponse(r=>r.url().endsWith(`/niveles/${n}/previsualizar`));await frame().getByRole('button',{name:'Previsualizar',exact:true}).click();const r=await espera;assert.equal(r.status(),estado,await r.text());return r.json();}
  let falloEdicion=false;
  for(let n=1;n<=10;n++){
    await t.test(`Nivel ${n}: edición, tarjetas, guardado y reapertura reales`,async()=>{
    try {
    const antes=await get(`/${n}/borrador`);await abrir(n);
    const relato=`Comprobación aislada del nivel ${n}.`;
    const desafio={nombre:`Nivel ${n} · Auditoría`,dificultad:'Básico',relato,
      objetivo:`Objetivo de prueba ${n}.`,instrucciones:`Instrucciones de prueba ${n}.`};
    for(const [clave,valor] of Object.entries(desafio))
      await frame().locator('[data-panel-nivel="desafio"]').getByLabel(clave[0].toUpperCase()+clave.slice(1),{exact:true}).fill(valor);
    await tab('Reglas');
    const cantidad=frame().getByLabel('Mínimo de estaciones',{exact:true}).filter({visible:true});
    await cantidad.fill('0');await guardar(n,400);
    assert.equal((await get(`/${n}/borrador`)).revision,antes.revision,'Un rechazo no persiste cambios');
    await cantidad.fill(String(antes.contenido.reglasExito.minimoEstaciones+1));
    const metro=frame().locator('.admin-niveles__herramientas').getByLabel('Metros',{exact:true});
    const habilitado=await metro.isChecked();await metro.setChecked(!habilitado);
    if(n>=4){await tab('UV / UT');await frame().getByLabel('Límite UT',{exact:true}).fill(String(antes.contenido.criterioUvUt.limiteUt+1));await frame().getByLabel('Presupuesto UV',{exact:true}).fill(String(antes.contenido.criterioUvUt.presupuestoUv+1));}
    await tab('Tarjetas');
    for(let i=0;i<7;i++){
      await frame().getByLabel('Tarjeta de aprendizaje',{exact:true}).selectOption(String(i));
      const ficha=frame().locator(`[data-tarjeta-nivel="${i}"]`);
      await ficha.locator('img').evaluate(img=>img.decode());
      await frame().getByLabel('Título',{exact:true}).fill(`Tarjeta comprobada ${n}.${i+1}`);
      await ficha.getByLabel('Texto',{exact:true}).fill(`Texto comprobado ${n}.${i+1}.`);
      await ficha.getByLabel('Aprendizaje',{exact:true}).fill(`Aprendizaje comprobado ${n}.${i+1}.`);
      await ficha.getByLabel('Fuente',{exact:true}).fill(`Fuente comprobada ${n}.${i+1}`);
      await ficha.getByLabel('Url Fuente',{exact:true}).fill(`https://example.test/fuente/${n}/${i+1}`);
      await ficha.getByLabel('Descripcion Imagen',{exact:true}).fill(`Descripción comprobada ${n}.${i+1}.`);
    }
    await frame().getByLabel('Tarjeta de aprendizaje',{exact:true}).selectOption('0');
    const selector=frame().locator('[data-tarjeta-nivel="0"]').getByLabel('Elegir imagen del catálogo');
    const nuevaImagen=await selector.locator('option').nth(1).getAttribute('value');await selector.selectOption(nuevaImagen);
    await guardar(n);
    const guardado=await get(`/${n}/borrador`);
    assert.equal(guardado.revision,antes.revision+1);
    assert.equal(guardado.contenido.reglasExito.minimoEstaciones,antes.contenido.reglasExito.minimoEstaciones+1);
    assert.equal(guardado.contenido.herramientasHabilitadas.metros,!habilitado);
    if(n>=4){assert.equal(guardado.contenido.criterioUvUt.limiteUt,antes.contenido.criterioUvUt.limiteUt+1);assert.equal(guardado.contenido.criterioUvUt.presupuestoUv,antes.contenido.criterioUvUt.presupuestoUv+1);}
    for(const [clave,valor] of Object.entries(desafio))assert.equal(guardado.contenido.desafio[clave],valor);
    for(let i=0;i<7;i++){
      const ficha=guardado.tarjetas[i],marca=`${n}.${i+1}`;
      assert.equal(ficha.titulo,`Tarjeta comprobada ${marca}`);
      assert.equal(ficha.texto,`Texto comprobado ${marca}.`);
      assert.equal(ficha.aprendizaje,`Aprendizaje comprobado ${marca}.`);
      assert.equal(ficha.fuente,`Fuente comprobada ${marca}`);
      assert.equal(ficha.urlFuente,`https://example.test/fuente/${n}/${i+1}`);
      assert.equal(ficha.descripcionImagen,`Descripción comprobada ${marca}.`);
    }
    assert.equal(guardado.tarjetas[0].idSvgCatalogo,nuevaImagen);assert.equal(guardado.tarjetas[6].aprendizaje,`Aprendizaje comprobado ${n}.7.`);
    await salir();await abrir(n);assert.equal(await frame().getByLabel('Relato',{exact:true}).inputValue(),relato);
    await tab('Red de referencia');await frame().locator('.admin-red-referencia__mapa').waitFor();
    await tab('Historial');assert((await frame().locator('[data-panel-nivel="historial"]').innerText()).includes('Versión'));
    await salir();
    } catch(error){falloEdicion=true;throw error;}
    });
    if(falloEdicion)break;
  }
  assert.equal(falloEdicion,false,'La edición debe pasar antes de probar publicación e historial');
  await t.test('Tablas de referencia: crear, editar y quitar estaciones, líneas, conexiones, unidades y ejecuciones',async()=>{
    await abrir(10);await tab('Red de referencia');
    const tablas=frame().locator('[data-tablas-red]');
    const casos=[
      ['estaciones','estaciones',[{nombre:'A',x:660,y:460,transbordo:true},{nombre:'B',x:670,y:460,transbordo:false}]],
      ['lineas','líneas',[{nombre:'Principal'}]],
      ['tramos','conexiones',[{linea:'Principal',a:'A',b:'B'}]],
      ['unidades','unidades',[{linea:'Principal',capacidad:200,uv:5}]],
      ['ejecuciones','ejecuciones de prueba',[{duracion:8,velocidad:2,unidades:[{uv:6}]}]],
    ];
    for(const [tipo,nombre,elementos] of casos){
      await tablas.getByLabel('Elementos de referencia',{exact:true}).selectOption(tipo);
      for(const elemento of elementos){
        await tablas.getByRole('button',{name:`Agregar ${nombre}`,exact:true}).click();
        for(const [clave,valor] of Object.entries(elemento)){
          if(clave==='unidades'){await tablas.getByLabel('Uv',{exact:true}).fill(String(valor[0].uv));continue;}
          const campo=tablas.getByLabel(clave[0].toUpperCase()+clave.slice(1),{exact:true});
          if(typeof valor==='boolean')await campo.setChecked(valor);else await campo.fill(String(valor));
        }
      }
      await tablas.getByRole('button',{name:`Agregar ${nombre}`,exact:true}).click();
      await tablas.locator(':scope > .admin-niveles__grupo > button').click();
    }
    await guardar(10);const guardado=await get('/10/borrador');
    for(const [tipo,,elementos] of casos)assert.deepEqual(guardado.redReferencia[tipo],elementos,tipo);
    await salir();await abrir(10);await tab('Red de referencia');
    await tablas.getByLabel('Elementos de referencia',{exact:true}).selectOption('ejecuciones');
    assert.equal(await tablas.getByLabel('Duracion',{exact:true}).inputValue(),'8');
    assert.equal(await tablas.getByLabel('Uv',{exact:true}).inputValue(),'6');
    await salir();
  });
  await t.test('Referencia inválida bloquea publicación; una solución válida se publica y permite limpiar el historial',async()=>{
    const versionesIniciales=await get('/1/versiones'),versionInicial=versionesIniciales[0].version;
    const escenario=Number(sql("SELECT id_escenario FROM escenario WHERE progresivo=TRUE AND modo='NIVEL' AND numero=1"));
    async function jugador(nombre){
      const email=`${nombre}@example.test`;
      const alta=await fetch(api+'/auth/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre,apellido:'QA',email,password:clave,aceptaDatos:true})});
      assert.equal(alta.status,200);
      const acceso=await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:clave})});
      assert.equal(acceso.status,200);return (await acceso.json()).token;
    }
    async function juego(token,ruta,metodo='GET'){
      const r=await fetch(api+'/api/juego'+ruta,{method:metodo,headers:{Authorization:`Bearer ${token}`}});
      assert.equal(r.status,200,await r.clone().text());return r.json();
    }
    const tokenAnterior=await jugador('anterior-e2e');
    const anterior=await juego(tokenAnterior,`/escenarios/${escenario}/iniciar`,'POST');
    const contenidoAnterior=await juego(tokenAnterior,`/intentos/${anterior.idIntento}/contenido`);
    const escenarioAnterior=(await juego(tokenAnterior,'/escenarios')).find(e=>e.numero===1);
    await abrir(1);const incompleta=await preview(1,400);assert.match(incompleta.detail,/al menos dos estaciones/);
    assert(await frame().getByRole('button',{name:'Publicar versión',exact:true}).isDisabled());
    await tab('Reglas');await frame().getByLabel('Mínimo de estaciones',{exact:true}).filter({visible:true}).fill('2');
    await tab('Red de referencia');
    const geo=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/mapa/datos/barrios_wgs84.geojson'),'utf8'));
    const puntos=[];const colectar=c=>typeof c[0]==='number'?puntos.push(c):c.forEach(colectar);geo.features.forEach(f=>colectar(f.geometry.coordinates));
    const xs=puntos.map(p=>p[0]),ys=puntos.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const poi=Object.values(require('../src/mapa/datos/puntos-interes.json').barrios).flatMap(b=>b.puntos);
    for(const id of [1,3]){
      const p=poi.find(p=>p.id===id),x=(p.longitud-minX)/(maxX-minX)*1000,y=(maxY-p.latitud)/(maxY-minY)*620;
      // Clic real sobre el mapa; la matriz SVG solo convierte coordenadas.
      const punto=await frame().locator('.admin-red-referencia__mapa').evaluate((svg,{x,y})=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const c=p.matrixTransform(svg.getScreenCTM());return{x:c.x,y:c.y};},{x,y});
      const caja=await page.locator('#pantalla-metronet').boundingBox();await page.mouse.click(caja.x+punto.x,caja.y+punto.y);
    }
    await frame().getByLabel('Elementos de referencia',{exact:true}).selectOption('lineas');
    await frame().getByRole('button',{name:'Agregar líneas',exact:true}).click();
    await frame().getByLabel('Acción del mapa de referencia',{exact:true}).selectOption('tramo');
    await frame().getByRole('button',{name:'Estación E1',exact:true}).click();await frame().getByRole('button',{name:'Estación E2',exact:true}).click();
    await guardar(1);const red=(await get('/1/borrador')).redReferencia;assert.equal(red.estaciones.length,2);assert.equal(red.tramos.length,1);
    const vista=await preview(1);assert.equal(vista.diagnostico.viable,true,JSON.stringify(vista.diagnostico));
    const vistaPanel=frame().locator('[data-vista-previa]');
    assert((await vistaPanel.innerText()).includes(vista.contenido.desafio.relato));
    for(let i=0;i<7;i++){
      await vistaPanel.getByLabel('Contenido de la vista previa').selectOption(String(i));
      const tarjeta=vista.tarjetas[i];
      for(const clave of ['titulo','texto','aprendizaje','fuente','urlFuente'])
        assert((await vistaPanel.innerText()).includes(tarjeta[clave]),`Vista previa muestra ${clave}`);
      assert.equal(await vistaPanel.locator('img').getAttribute('alt'),tarjeta.descripcionImagen);
      assert.equal(await vistaPanel.locator('img').getAttribute('src'),tarjeta.idSvgCatalogo);
    }
    await vistaPanel.getByLabel('Contenido de la vista previa').selectOption('validacion');
    for(const condicion of vista.diagnostico.condiciones)
      assert((await vistaPanel.innerText()).includes(condicion.texto));
    await frame().getByRole('button',{name:'Publicar versión',exact:true}).click();
    assert.match(await frame().locator('#mensajeNivelesAdmin').innerText(),/Confirmá la revisión editorial/);
    assert.equal((await get('/1/versiones')).length,versionesIniciales.length,'Sin confirmar no se publica');
    for(let vuelta=0;vuelta<2;vuelta++){
      if(vuelta){await tab('Desafío');await frame().getByLabel('Relato',{exact:true}).fill('Segunda publicación de prueba.');await guardar(1);assert((await preview(1)).diagnostico.viable);}
      await frame().locator('[data-confirmacion-editorial]').check();
      const publicar=page.waitForResponse(r=>r.url().endsWith('/niveles/1/publicar'));
      await frame().getByRole('button',{name:'Publicar versión',exact:true}).click();const r=await publicar;assert.equal(r.status(),200,await r.text());
      assert.equal((await r.json()).version,versionInicial+vuelta+1);
      await frame().getByRole('tab',{name:'Desafío',exact:true}).waitFor();
      await frame().locator('#mensajeNivelesAdmin').filter({hasText:`versión ${versionInicial+vuelta+1}`}).waitFor();
    }
    assert.equal((await get('/1/versiones')).length,versionesIniciales.length+2);
    // El guardado/publicación del administrador se comprueba desde el contrato del jugador.
    assert.deepEqual(await juego(tokenAnterior,`/intentos/${anterior.idIntento}/contenido`),contenidoAnterior,
      'Una partida empezada conserva íntegramente sus textos e imágenes');
    assert.deepEqual((await juego(tokenAnterior,'/escenarios')).find(e=>e.numero===1).herramientasHabilitadas,
      escenarioAnterior.herramientasHabilitadas,'Las herramientas de una partida empezada no cambian');
    const tokenNuevo=await jugador('nuevo-e2e');
    const nuevo=await juego(tokenNuevo,`/escenarios/${escenario}/iniciar`,'POST');
    const publicado=await juego(tokenNuevo,`/intentos/${nuevo.idIntento}/contenido`);
    const guardado=await get('/1/borrador');
    assert.equal(publicado.version,versionInicial+2);
    assert.deepEqual(publicado.desafio,guardado.contenido.desafio);
    for(let i=0;i<7;i++)for(const [publico,editor] of Object.entries({titulo:'titulo',texto:'texto',aprendizaje:'aprendizaje',fuente:'fuente',url:'urlFuente',descripcionImagen:'descripcionImagen',imagen:'idSvgCatalogo'}))
      assert.equal(publicado.tarjetas[i][publico],guardado.tarjetas[i][editor],`El jugador recibe ${publico} de tarjeta ${i+1}`);
    const consignaNueva=await juego(tokenNuevo,`/disenos/${nuevo.idDiseno}/consigna`);
    const escenarioNuevo=(await juego(tokenNuevo,'/escenarios')).find(e=>e.numero===1);
    assert.deepEqual(escenarioNuevo.herramientasHabilitadas,guardado.contenido.herramientasHabilitadas);
    for(const clave of ['nombre','dificultad','objetivo','instrucciones','relato'])
      assert.equal(escenarioNuevo[clave],guardado.contenido.desafio[clave]);
    assert.equal(consignaNueva.condiciones.find(c=>c.clave==='minimoEstaciones').requerido,2);
    await tab('Historial');await frame().getByRole('button',{name:'Borrar registro de versiones',exact:true}).click();
    const confirmacion=frame().getByRole('dialog');await confirmacion.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.equal((await get('/1/versiones')).length,versionesIniciales.length+2);
    await frame().getByRole('button',{name:'Borrar registro de versiones',exact:true}).click();
    const limpieza=page.waitForResponse(r=>r.url().includes('/versiones/sin-uso')&&r.request().method()==='DELETE');
    await confirmacion.getByRole('button',{name:'Aceptar',exact:true}).click();const r=await limpieza;assert.equal(r.status(),200,await r.text());
    assert.deepEqual((await get('/1/versiones')).map(v=>v.version),[versionInicial+2,versionInicial],
      'La limpieza retira la versión intermedia sin uso y conserva vigente y partida anterior');
    assert.equal(Number(sql('SELECT count(*) FROM nivel_publicacion p JOIN escenario e USING(id_escenario) WHERE e.numero=1')),2);
    assert.deepEqual(await juego(tokenAnterior,`/intentos/${anterior.idIntento}/contenido`),contenidoAnterior,
      'La limpieza del historial no rompe partidas existentes');
    await page.screenshot({path:path.join(evidencias,'historial-real.png')});
  });
  assert.deepEqual(errores,[]);
});
