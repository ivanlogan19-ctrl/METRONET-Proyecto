const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const niveles=require('../src/educacion/niveles.json');
const catalogo=require('../src/educacion/catalogo-svgs-niveles.json');
let navegador;
before(async()=>{navegador=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL})});
after(async()=>{await navegador?.close()});

// Regresión: los editores de listas y casillas heredaban una grilla que los
// desplazaba fuera del panel; comprobar cada alternativa del selector real.
for(const viewport of [{width:1280,height:720},{width:1440,height:900},{width:1920,height:1080}]) {
  test(`Todas las reglas nuevas quedan alineadas y contenidas a ${viewport.width}`,async t=>{
    const {pagina:p}=await abrirEditor(t,viewport,1);
    await p.getByRole('tab',{name:'Reglas',exact:true}).click();
    const selector=p.getByLabel('Regla admitida para agregar',{exact:true});
    const reglaPoi=p.locator('[data-regla-nivel="puntosInteresObjetivo"]');
    if(await reglaPoi.count()) {
      await p.getByLabel('Regla del nivel',{exact:true}).selectOption('puntosInteresObjetivo');
      await reglaPoi.getByRole('button',{name:'Quitar toda la regla de lugares objetivo',exact:true}).click();
    }
    const claves=await selector.locator('option').evaluateAll(ns=>ns.map(n=>n.value));
    let ancla;
    for(const clave of claves) {
      await selector.selectOption(clave);
      const bloque=p.locator('.admin-niveles__agregar-regla');
      const campos=p.locator('.admin-niveles__valor-nueva-regla');
      if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/propuesta-${clave}-${viewport.width}.png`});
      const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
      assert(medidas.contenido<=medidas.alto+1,`${clave}: formulario sin desplazamiento (${medidas.contenido}/${medidas.alto})`);
      const borde=await bloque.boundingBox(),menu=await selector.boundingBox();
      const posicion={y:borde.y,alto:borde.height,menuY:menu.y};
      if(ancla)assert.deepEqual(posicion,ancla,'El panel y el menú conservan su posición entre variantes');
      ancla=posicion;
      const desborde=await p.evaluate(()=>({ancho:document.documentElement.scrollWidth,alto:document.documentElement.scrollHeight}));
      assert(desborde.ancho<=viewport.width&&desborde.alto<=viewport.height,'Sin desplazamiento de la página');
      const accion=await bloque.getByRole('button',{name:'Agregar regla admitida',exact:true}).boundingBox();
      assert(Math.abs(accion.y+accion.height/2-menu.y-menu.height/2)<2,`${clave}: agregar a la altura del menú`);
      assert(Math.abs(accion.x+accion.width-borde.x-borde.width)<2,`${clave}: agregar en el borde derecho`);
      for(const control of await campos.locator('input,select,button').filter({visible:true}).all()) {
        const caja=await control.boundingBox();
        assert(caja.x>=borde.x&&caja.x+caja.width<=borde.x+borde.width+1,`${clave}: control dentro del ancho`);
        assert(caja.y>=borde.y&&caja.y+caja.height<=borde.y+borde.height+1,`${clave}: control dentro del alto`);
        assert(caja.y+caja.height<=viewport.height,`${clave}: control dentro de pantalla`);
      }
      const numero=campos.locator(':scope > label > input[type="number"]');
      if(await numero.count()) {
        const caja=await numero.boundingBox();
        assert(Math.abs(caja.y-menu.y)<2,`${clave}: cantidad a la altura del menú`);
        assert.equal(await numero.evaluate(n=>getComputedStyle(n).textAlign),'center');
      }
      const casillas=campos.locator('input[type="checkbox"]');
      for(const casilla of await casillas.all()) {
        const caja=await casilla.boundingBox();
        assert(Math.abs(caja.y+caja.height/2-menu.y-menu.height/2)<2,`${clave}: casilla alineada con el menú`);
      }
      const lista=campos.locator('select');
      if(await lista.count()) {
        const controles=campos.locator('input').filter({visible:true});
        const cajas=await Promise.all((await controles.all()).map(n=>n.boundingBox()));
        const elemento=await lista.boundingBox();
        assert(cajas.every(c=>Math.abs(c.y-elemento.y)<2),`${clave}: Elemento alineado con los demás campos`);
        assert(cajas.every(c=>Math.abs(c.y-cajas[0].y)<2),`${clave}: campos en una fila`);
        for(const nombre of [clave==='puntosInteresObjetivo'?'Quitar lugar seleccionado':'Quitar zona seleccionada',`Agregar ${(await selector.locator('option:checked').innerText()).toLowerCase()}`]) {
          const boton=bloque.getByRole('button',{name:nombre,exact:true});
          const caja=await boton.boundingBox();
          assert(Math.abs(caja.y+caja.height-elemento.y-elemento.height)<2,`${clave}: ${nombre} alineado bajo Agregar`);
          const color=await boton.evaluate(n=>getComputedStyle(n).backgroundColor);
          assert.equal(color,nombre.startsWith('Quitar')?'rgb(255, 141, 169)':'rgb(112, 229, 177)');
        }
        const acciones=await bloque.locator('.admin-niveles__acciones-lista > button').evaluateAll(ns=>ns.map(n=>{
          const r=n.getBoundingClientRect();return {x:r.x,y:r.y,ancho:r.width,alto:r.height};
        }));
        assert(Math.abs(acciones[0].ancho-acciones[1].ancho)<1&&Math.abs(acciones[0].alto-acciones[1].alto)<1,`${clave}: agregar y quitar tienen iguales dimensiones`);
        assert(Math.abs(acciones[0].y-acciones[1].y)<1&&acciones[0].x+acciones[0].ancho<acciones[1].x,`${clave}: acciones separadas a izquierda y derecha`);
        if(clave==='areasObjetivo') {
          await bloque.getByRole('button',{name:'Agregar barrios y zonas objetivo',exact:true}).click();
          assert.equal(await lista.locator('option').count(),2,'La acción reubicada agrega un área');
          await lista.selectOption('1');
          await campos.getByLabel('Nombre',{exact:true}).filter({visible:true}).fill('CENTRO');
          await bloque.getByRole('button',{name:'Quitar zona seleccionada',exact:true}).click();
          assert.equal(await lista.locator('option').count(),1,'La acción reubicada quita el área seleccionada');
        }
      }
      if(process.env.METRONET_CAPTURAS_ADMIN&&['areasObjetivo','aprendizajeSimulacion','maximoEstaciones'].includes(clave))
        await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-regla-${clave}-${viewport.width}.png`});
    }
    // Estas dos variantes ya estaban activas en el nivel de prueba.
    for(const clave of ['maximoEstaciones','requiereObjetivosMismaLinea']) {
      await p.locator(`[data-regla-nivel="${clave}"] > .admin-niveles__quitar-regla`).click();
      await selector.selectOption(clave);
      const bloque=p.locator('.admin-niveles__agregar-regla');
      const menu=await selector.boundingBox();
      const boton=await bloque.getByRole('button',{name:'Agregar regla admitida',exact:true}).boundingBox();
      assert(Math.abs(menu.y-boton.y)<1&&menu.height===boton.height);
      const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
      assert(medidas.contenido<=medidas.alto+1,`${clave}: sin desplazamiento`);
      const valor=bloque.locator('.admin-niveles__valor-nueva-regla input');
      if(clave==='maximoEstaciones')await valor.fill('12');
      else await valor.check();
      await bloque.getByRole('button',{name:'Agregar regla admitida',exact:true}).click();
      const agregado=p.locator(`[data-regla-nivel="${clave}"] input`);
      if(clave==='maximoEstaciones')assert.equal(await agregado.inputValue(),'12');
      else assert.equal(await agregado.isChecked(),true);
    }
    const subtitulos=await p.locator('.admin-niveles__grupo-reglas h3, .admin-niveles__herramientas h3').evaluateAll(ns=>ns.map(n=>{
      const s=getComputedStyle(n);return {fuente:s.fontFamily,tamano:s.fontSize,color:s.color,adorno:getComputedStyle(n,'::before').content,visible:getComputedStyle(n,'::before').display};
    }));
    assert(subtitulos.every(s=>s.adorno==='none'||s.visible==='none'),'Sin marcas azules en subtítulos');
    assert(subtitulos.every(s=>s.fuente===subtitulos[0].fuente&&s.tamano===subtitulos[0].tamano&&s.color===subtitulos[0].color),'Subtítulos uniformes');
  });
}

async function abrirEditor(t,viewport={width:1440,height:900},numero=10,responderExtra=()=>null) {
  const nivel=niveles[numero-1];
  const tarjetas=catalogo[numero-1].tarjetas.map(t=>({id:t.id,titulo:t.titulo,texto:t.texto,aprendizaje:t.aprendizaje,
    fuente:t.fuente,urlFuente:t.url,descripcionImagen:t.descripcionImagen,idSvgCatalogo:t.imagen}));
  let revision=1;
  const contenido={desafio:{nombre:nivel.nombre,relato:'Una red comienza con un trayecto sencillo.',objetivo:nivel.objetivo,
    instrucciones:nivel.instrucciones,dificultad:nivel.dificultad},
    reglasExito:{...nivel.reglasExito,requiereRedValida:true},herramientasHabilitadas:nivel.herramientasHabilitadas,
    criterioUvUt:{limiteUt:2,presupuestoUv:6.5},ayudas:[{claveCondicion:'simulacionActual',texto:'Contenido conservado',pista:'Dato previo'}]};
  const redReferencia={estaciones:[],lineas:[],tramos:[],unidades:[],ejecuciones:[]};
  const borrador=()=>({numero,versionBase:2,revision,contenido,redReferencia,tarjetas});
  const v=await abrirPantalla(navegador,'/admin.html',{viewport,administrador:true,responder:req=>{
    const extra=responderExtra(req);if(extra)return extra;
    const ruta=new URL(req.url()).pathname;
    if(ruta==='/api/admin/niveles')return {json:[{numero,nombre:nivel.nombre,versionPublicada:2,revisionBorrador:revision}]};
    if(ruta.endsWith(`/${numero}/borrador`)) {
      if(req.method()==='PUT'){revision++;Object.assign(contenido,req.postDataJSON())}
      return {json:borrador()};
    }
    if(ruta.endsWith(`/${numero}/versiones`))return {json:[]};
  }});
  t.after(async()=>{await v.contexto.close();assert.deepEqual(v.errores,[])});
  await v.pagina.getByRole('button',{name:'Experiencia de juego'}).click();
  await v.pagina.getByRole('button',{name:'Editar',exact:true}).click();
  await v.pagina.getByRole('tab',{name:'Desafío',exact:true}).waitFor();
  return {...v,borrador};
}

test('Guardar y Publicar permanecen juntos y publican solamente el borrador validado',async t=>{
  let vista;
  const {pagina:p,borrador,solicitudes}=await abrirEditor(t,{width:1440,height:900},1,req=>{
    if(req.url().endsWith('/previsualizar'))return {json:vista};
    if(req.url().endsWith('/publicar'))return {json:{version:3}};
  });
  const cabecera=p.locator('.admin-niveles__cabecera');
  const guardar=cabecera.getByRole('button',{name:'Guardar cambios del nivel',exact:true});
  const publicar=cabecera.getByRole('button',{name:'Publicar versión',exact:true});
  assert.equal(await publicar.count(),1,'Publicar está disponible en la cabecera global');
  assert.equal(await publicar.isDisabled(),true,'No se publica sin validar');
  assert.notEqual(await publicar.locator('path').getAttribute('d'),await guardar.locator('path').getAttribute('d'),'Guardar y Publicar se distinguen visualmente');
  const cajaGuardar=await guardar.boundingBox(),cajaPublicar=await publicar.boundingBox();
  assert(Math.abs(cajaGuardar.y-cajaPublicar.y)<1&&cajaPublicar.x>cajaGuardar.x,'Guardar está junto a Publicar');
  await p.getByLabel('Nombre',{exact:true}).filter({visible:true}).fill('Nivel listo para publicar');
  await guardar.click();await p.waitForFunction(()=>!document.querySelector('[data-estado-borrador]').classList.contains('admin-niveles__estado--pendiente'));
  assert.equal(solicitudes.filter(s=>s.path.endsWith('/publicar')).length,0,'Guardar no publica');
  vista={...borrador(),versionPublicada:2,revisionBorrador:2,diagnostico:{viable:true,mensaje:'Referencia viable',condiciones:[],huella:'revision-2'}};
  await p.getByRole('button',{name:'Previsualizar'}).click();
  await p.getByText('Referencia viable').waitFor();
  await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();
  if(process.env.METRONET_CAPTURAS_ADMIN)
    await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-guardar-publicar.png`});
  await publicar.click();
  assert.equal(solicitudes.filter(s=>s.path.endsWith('/publicar')).length,0,'La revisión editorial sigue siendo obligatoria');
  await p.locator('[data-confirmacion-editorial]').check();
  await Promise.all([p.waitForResponse(r=>r.url().endsWith('/publicar')&&r.request().method()==='POST'),publicar.click()]);
  assert.deepEqual(solicitudes.find(s=>s.path.endsWith('/publicar')).body,
    {versionEsperada:2,revisionEsperada:2,huellaPreview:'revision-2',confirmacionEditorial:true});
});

// Una respuesta lenta no debe marcar como guardados cambios que no se enviaron.
test('Editar durante el guardado conserva los cambios nuevos como pendientes',async t=>{
  let resolver,avisar;
  const recibido=new Promise(r=>{avisar=r});
  let revision=1;
  const {pagina:p,solicitudes}=await abrirEditor(t,{width:1440,height:900},1,req=>{
    if(req.method()!=='PUT')return;
    const datos=req.postDataJSON();revision++;
    const respuesta={json:{numero:1,versionBase:2,revision,contenido:datos,redReferencia:datos.redReferencia,tarjetas:datos.tarjetas}};
    if(revision===2)return new Promise(r=>{resolver=()=>r(respuesta);avisar()});
    return respuesta;
  });
  const nombre=p.getByLabel('Nombre',{exact:true}).filter({visible:true});
  const guardar=p.getByRole('button',{name:'Guardar cambios del nivel',exact:true});
  await nombre.fill('Nombre enviado');await guardar.click();await recibido;
  await nombre.fill('Edición posterior');
  const respuesta=p.waitForResponse(r=>r.url().endsWith('/borrador')&&r.request().method()==='PUT');resolver();await respuesta;
  await p.waitForFunction(()=>document.querySelector('[data-estado-borrador]').disabled===false);
  assert.equal(await nombre.inputValue(),'Edición posterior');
  assert.equal(await p.locator('.admin-niveles__estado-texto').textContent(),'Cambios sin guardar');
  await guardar.click();await p.waitForFunction(()=>!document.querySelector('[data-estado-borrador]').classList.contains('admin-niveles__estado--pendiente'));
  assert.equal(solicitudes.filter(s=>s.method==='PUT')[1].body.desafio.nombre,'Edición posterior');
  assert.equal(await p.locator('.admin-niveles__estado-texto').textContent(),'Borrador guardado');
});

// Una validación de un borrador anterior no habilita Publicar tras editarlo.
test('Editar durante la validación invalida su respuesta tardía',async t=>{
  let resolver,avisar,vista;
  const recibido=new Promise(r=>{avisar=r});
  const {pagina:p,borrador,solicitudes}=await abrirEditor(t,{width:1440,height:900},1,req=>{
    if(req.url().endsWith('/previsualizar'))return new Promise(r=>{resolver=()=>r({json:vista});avisar()});
  });
  vista={...borrador(),versionPublicada:2,revisionBorrador:1,diagnostico:{viable:true,mensaje:'Referencia viable',condiciones:[],huella:'qa'}};
  await p.getByRole('button',{name:'Previsualizar'}).click();await recibido;
  await p.getByLabel('Nombre',{exact:true}).filter({visible:true}).fill('Cambio posterior al análisis');
  resolver();await p.getByRole('button',{name:'Previsualizar'}).click();
  await p.locator('.admin-mensaje').filter({hasText:/Guardá/}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Publicar versión'}).isDisabled(),true);
  assert.equal(solicitudes.filter(s=>s.path.endsWith('/publicar')).length,0);
});

test('Consultar el historial conserva la validación y la revisión editorial',async t=>{
  let vista;
  const {pagina:p,borrador}=await abrirEditor(t,{width:1440,height:900},1,req=>{
    if(req.url().endsWith('/previsualizar'))return {json:vista};
    if(req.url().endsWith('/versiones'))return {json:Array.from({length:6},(_,i)=>({version:6-i,publicadoEn:'2026-10-01'}))};
  });
  vista={...borrador(),versionPublicada:2,revisionBorrador:1,diagnostico:{viable:true,mensaje:'Referencia viable',condiciones:[],huella:'qa'}};
  await p.getByRole('button',{name:'Previsualizar'}).click();
  await p.getByText('Referencia viable').waitFor();await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();await p.locator('[data-confirmacion-editorial]').check();
  await p.getByRole('tab',{name:'Historial',exact:true}).click();
  await p.getByRole('button',{name:'Siguiente',exact:true}).click();
  await p.getByRole('tab',{name:'Vista previa',exact:true}).click();
  assert.equal(await p.getByLabel('Contenido de la vista previa').isVisible(),true);
  assert.equal(await p.locator('[data-confirmacion-editorial]').isChecked(),true);
  await p.getByRole('tab',{name:'Desafío',exact:true}).click();
  await p.getByLabel('Nombre',{exact:true}).filter({visible:true}).fill('Nueva edición');
  assert.equal(await p.locator('[data-confirmacion-editorial]').isChecked(),false);
  assert.equal(await p.getByRole('button',{name:'Publicar versión'}).isDisabled(),true);
});

test('Una lista vacía permite volver a agregar y editar lugares objetivo',async t=>{
  const {pagina:p,solicitudes}=await abrirEditor(t,{width:1440,height:900},1);
  await p.getByRole('tab',{name:'Reglas',exact:true}).click();
  await p.getByLabel('Regla del nivel',{exact:true}).selectOption('puntosInteresObjetivo');
  const regla=p.locator('[data-regla-nivel="puntosInteresObjetivo"]');
  assert.equal(await regla.getByRole('button',{name:'Quitar toda la regla de lugares objetivo',exact:true}).count(),1,'Borrado de regla diferenciado del lugar seleccionado');
  const quitar=regla.getByRole('button',{name:'Quitar lugar seleccionado',exact:true});
  const idInicial=await regla.getByLabel('Id Punto',{exact:true}).filter({visible:true}).inputValue();
  await regla.getByLabel('Elemento',{exact:true}).selectOption('1');
  await quitar.click();
  assert.equal(await regla.getByLabel('Id Punto',{exact:true}).inputValue(),idInicial,'Quitar conserva el otro lugar');
  await quitar.click();
  assert.equal(await quitar.isDisabled(),true,'Una lista vacía no permite quitar otro lugar');
  const agregar=regla.getByRole('button',{name:'Agregar lugares objetivo',exact:true});
  assert.equal(await agregar.isEnabled(),true);
  await agregar.click();await regla.getByLabel('Id Punto',{exact:true}).fill('18');
  await regla.getByLabel('Radio Cobertura',{exact:true}).fill('20');
  await Promise.all([p.waitForResponse(r=>r.url().endsWith('/1/borrador')&&r.request().method()==='PUT'),p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click()]);
  assert.deepEqual(solicitudes.find(s=>s.method==='PUT').body.reglasExito.puntosInteresObjetivo,[{idPunto:18,radioCobertura:20}]);
  await regla.getByRole('button',{name:'Quitar toda la regla de lugares objetivo',exact:true}).click();
  assert.equal(await regla.count(),0,'El basurero elimina toda la regla');
  assert.equal(await p.getByLabel('Regla del nivel',{exact:true}).isVisible(),false,'Sin reglas existentes no se muestra un menú con solo Agregar regla');
  await Promise.all([p.waitForResponse(r=>r.url().endsWith('/1/borrador')&&r.request().method()==='PUT'),p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click()]);
  assert.equal('puntosInteresObjetivo' in solicitudes.filter(s=>s.method==='PUT').at(-1).body.reglasExito,false);
});

for(const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:1366,height:768},{width:1280,height:720},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]) {
  test(`Editor de niveles compacto, secciones accesibles y sin overflow a ${viewport.width}`,async t=>{
    const {pagina:p}=await abrirEditor(t,viewport);
    assert.equal(await p.getByRole('button',{name:/Agregar pista|Quitar pista|Quitar Regla histórica/}).count(),0);
    assert.equal(await p.getByRole('tabpanel').count(),1);
    for(const nombre of ['Desafío','Metas y POI','Reglas','Red de referencia','Tarjetas','Vista previa','Historial']) {
      await p.getByRole('tab',{name:nombre,exact:true}).click();
      assert.equal(await p.getByRole('tabpanel').count(),1);
      assert.equal(await p.getByRole('tabpanel',{name:nombre,exact:true}).isVisible(),true);
      const medidas=await p.evaluate(()=>({ancho:innerWidth,alto:innerHeight,scrollAncho:document.documentElement.scrollWidth,
        scrollAlto:document.documentElement.scrollHeight,guardar:document.querySelector('.admin-niveles__utilidades').getBoundingClientRect().toJSON(),
        panel:document.querySelector('.admin-niveles__paneles').getBoundingClientRect().toJSON()}));
      assert(medidas.scrollAncho<=medidas.ancho,`${nombre}: sin scroll horizontal`);
      if(viewport.width>=1000){
        assert(medidas.scrollAlto<=medidas.alto+1,`${nombre}: sin recorrido vertical de la página (${medidas.scrollAlto}/${medidas.alto})`);
        assert(medidas.guardar.top>=0&&medidas.guardar.bottom<=medidas.alto,`${nombre}: acciones visibles`);
        assert(medidas.panel.height>=140,`${nombre}: área de trabajo útil`);
        if(nombre==='Tarjetas') {
          const formulario=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
          assert(formulario.contenido<=formulario.alto+1,`Tarjetas: todos los campos sin desplazamiento (${formulario.contenido}/${formulario.alto})`);
          const ficha=p.locator('[data-tarjeta-nivel]:visible');
          for(const campo of await ficha.locator('input,select,textarea').all()) {
            const caja=await campo.boundingBox();
            assert(caja.y>=medidas.panel.top&&caja.y+caja.height<=medidas.panel.bottom,'Cada campo está dentro del área visible');
          }
        }
        if(nombre==='Vista previa') {
          const cartel=await p.locator('.admin-niveles__aviso-vista').evaluate(n=>({caja:n.getBoundingClientRect().toJSON(),color:getComputedStyle(n).color,
            alineacion:getComputedStyle(n).textAlign}));
          assert.equal(cartel.alineacion,'center');
          assert.equal(cartel.color,'rgb(112, 229, 177)');
          assert(Math.abs(cartel.caja.y+cartel.caja.height/2-(medidas.panel.top+medidas.panel.height/2))<3,'Aviso centrado verticalmente');
        }
      }
      if(process.env.METRONET_CAPTURAS_ADMIN&&['Desafío','Tarjetas'].includes(nombre))
        await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-editor-${viewport.width}-${nombre}.png`,fullPage:true});
    }
    const salir=p.getByRole('button',{name:'Volver a los niveles para editar',exact:true});
    const caja=await salir.boundingBox();
    assert(caja&&caja.x>=0&&caja.x+caja.width<=viewport.width,'La puerta de salida permanece dentro de la pantalla');
    await p.getByRole('tab',{name:'Desafío',exact:true}).focus();
    await p.keyboard.press('ArrowRight');
    assert.equal(await p.getByRole('tab',{name:'Metas y POI',exact:true}).getAttribute('aria-selected'),'true');
    await p.keyboard.press('End');
    assert.equal(await p.getByRole('tab',{name:'Historial',exact:true}).getAttribute('aria-selected'),'true');
  });
}

test('El disquete guarda el nivel y conserva los cambios si la petición falla',async t=>{
  let fallar=true;
  const {pagina:p,solicitudes}=await abrirEditor(t,{width:1280,height:720},3,req=>{
    if(req.method()==='PUT'&&fallar)return {status:503,json:{mensaje:'No se pudo guardar'}};
  });
  const guardar=p.getByRole('button',{name:'Guardar cambios del nivel',exact:true});
  assert.equal(await guardar.count(),1,'El disquete es una acción accesible');
  assert.equal(await p.getByRole('button',{name:'Guardar borrador',exact:true}).count(),0,'Sin botón duplicado');
  const nombre=p.getByRole('tabpanel',{name:'Desafío',exact:true}).getByLabel('Nombre',{exact:true});
  await nombre.fill('Nivel editado desde el disquete');
  await guardar.click();
  await p.locator('.admin-mensaje.error').waitFor();
  assert.equal(await nombre.inputValue(),'Nivel editado desde el disquete');
  assert.equal(await guardar.evaluate(n=>n.classList.contains('admin-niveles__estado--pendiente')),true);
  assert.equal(await guardar.isEnabled(),true);
  fallar=false;
  await guardar.focus();await p.keyboard.press('Enter');
  await p.waitForFunction(()=>!document.querySelector('[data-estado-borrador]').classList.contains('admin-niveles__estado--pendiente'));
  assert.equal(await guardar.evaluate(n=>n.classList.contains('admin-niveles__estado--pendiente')),false);
  const guardados=solicitudes.filter(s=>s.method==='PUT');
  assert.equal(guardados.length,2);
  assert.equal(guardados[1].body.desafio.nombre,'Nivel editado desde el disquete');
});

test('Desafío en dos columnas, cabecera conservada y reglas simples compactas',async t=>{
  const {pagina:p}=await abrirEditor(t,{width:1280,height:720},3);
  const panel=p.getByRole('tabpanel',{name:'Desafío',exact:true});
  const caja=await panel.boundingBox();
  const relato=await panel.getByLabel('Relato',{exact:true}).boundingBox();
  const objetivo=await panel.getByLabel('Objetivo',{exact:true}).boundingBox();
  const instrucciones=await panel.getByLabel('Instrucciones',{exact:true}).boundingBox();
  assert(relato.x+relato.width<objetivo.x,'Relato a la izquierda del objetivo');
  assert(Math.abs(objetivo.x-instrucciones.x)<1&&objetivo.y+objetivo.height<instrucciones.y,'Objetivo e instrucciones apilados y alineados');
  assert(Math.abs(objetivo.height-instrucciones.height)<1,'Objetivo e instrucciones tienen igual altura');
  for(const area of [relato,objetivo,instrucciones])assert(area.height>=40&&area.y+area.height<=caja.y+caja.height,'Campos legibles dentro del panel');
  assert.equal((await panel.getByLabel('Nombre',{exact:true}).boundingBox()).height,(await panel.getByLabel('Dificultad',{exact:true}).boundingBox()).height,'Nombre y dificultad tienen igual altura');
  const estado=p.locator('[data-estado-borrador]');
  assert.equal(await estado.locator('svg').count(),1,'Guardado se representa con un icono');
  assert.equal(await estado.getAttribute('data-ayuda-sistema'),'Guardar cambios del nivel · Borrador guardado');
  const indicador=await estado.boundingBox();
  const puerta=await p.getByRole('button',{name:'Volver a los niveles para editar'}).boundingBox();
  assert(Math.abs(indicador.y+indicador.height/2-puerta.y-puerta.height/2)<1,'Iconos centrados en la misma fila');
  await panel.getByLabel('Nombre',{exact:true}).fill('Nombre editado');
  assert.equal(await estado.getAttribute('data-ayuda-sistema'),'Guardar cambios del nivel · Cambios sin guardar');
  await p.getByRole('tab',{name:'Reglas',exact:true}).click();
  const regla=p.locator('[data-regla-nivel="minimoLineas"]');
  assert((await regla.boundingBox()).height<=100,'Una regla simple no ocupa toda la pantalla');
  const cajaRegla=await p.locator('.admin-niveles__reglas-detalle').boundingBox();
  const herramientas=await p.locator('.admin-niveles__herramientas').boundingBox();
  if(cajaRegla)assert(herramientas.y+herramientas.height<=cajaRegla.y,'Herramientas antes de los objetivos específicos');
  const condiciones=await p.locator('.admin-niveles__condiciones').boundingBox();
  assert(Math.abs(herramientas.x-condiciones.x)<1&&herramientas.width<condiciones.width*.55,'Herramientas en la columna izquierda');
  assert((await regla.getByLabel('Mínimo de líneas',{exact:true}).boundingBox()).width<(await regla.boundingBox()).width,'Valor numérico dentro de su condición');
  assert((await regla.getByRole('button',{name:'Quitar Mínimo de líneas'}).boundingBox()).width<=44,'Acción quitar compacta');
  if(process.env.METRONET_CAPTURAS_ADMIN)
    await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-editor-regla-simple.png`});
  await regla.getByLabel('Mínimo de líneas',{exact:true}).fill('2');
  await p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('[data-estado-borrador]').classList.contains('admin-niveles__estado--pendiente'));
  assert.equal(await estado.getAttribute('data-ayuda-sistema'),'Guardar cambios del nivel · Borrador guardado');
  assert.equal(await regla.getByLabel('Mínimo de líneas',{exact:true}).inputValue(),'2');
});

test('Reglas legibles y mapa de referencia ocupa la altura disponible',async t=>{
  const {pagina:p}=await abrirEditor(t,{width:1920,height:1080},1);
  await p.getByRole('tab',{name:'Reglas',exact:true}).click();
  const agregar=p.getByLabel('Regla admitida para agregar',{exact:true});
  const clave=await agregar.locator('option').evaluateAll(n=>n.reduce((a,b)=>b.textContent.length>a.textContent.length?b:a).value);
  await agregar.selectOption(clave);
  const texto=await agregar.locator('selectedcontent').evaluate(n=>({ancho:n.clientWidth,contenido:n.scrollWidth}));
  assert(texto.contenido<=texto.ancho,'El nombre largo se lee sin recorte');
  const lista=await agregar.boundingBox();
  const boton=await p.getByRole('button',{name:'Agregar regla admitida',exact:true}).boundingBox();
  const herramientas=await p.locator('.admin-niveles__herramientas').boundingBox();
  assert(lista.y>=herramientas.y+herramientas.height,'Agregar regla aparece debajo de herramientas');
  assert(Math.abs(boton.y+boton.height/2-lista.y-lista.height/2)<2&&boton.x>lista.x+lista.width,'Agregar queda a la derecha en la misma fila que el selector');
  await p.getByRole('tab',{name:'Red de referencia',exact:true}).click();
  assert.equal(await p.getByText(/Ubicá estaciones en el mapa/).count(),0);
  const mapa=p.locator('.admin-red-referencia__mapa');
  const cajaMapa=await mapa.boundingBox();
  const cajaPanel=await p.getByRole('tabpanel',{name:'Red de referencia',exact:true}).boundingBox();
  assert(Math.abs(cajaMapa.y+cajaMapa.height-(cajaPanel.y+cajaPanel.height-13))<3,'Mapa hasta el borde inferior');
  assert(cajaMapa.height>1080*.55,'No conserva el límite que dejaba espacio vacío');
  await mapa.click({position:{x:cajaMapa.width/2,y:cajaMapa.height/2}});
  assert.equal(await p.getByRole('button',{name:'Estación E1',exact:true}).count(),1,'Mapa conserva la interacción');
  if(process.env.METRONET_CAPTURAS_ADMIN) await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-mapa-ampliado.png`});
});

test('Cambiar pestaña o tarjeta conserva los cambios y guardar preserva el contrato previo',async t=>{
  const {pagina:p,solicitudes}=await abrirEditor(t);
  const nombre=p.getByRole('tabpanel',{name:'Desafío',exact:true}).getByLabel('Nombre',{exact:true});
  await nombre.fill('Red editada sin perder campos');
  await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();
  await p.getByLabel('Tarjeta de aprendizaje',{exact:true}).selectOption('6');
  await p.getByLabel('Título',{exact:true}).fill('Última tarjeta editada');
  await p.getByRole('tab',{name:'Desafío',exact:true}).click();
  assert.equal(await nombre.inputValue(),'Red editada sin perder campos');
  await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();
  assert.equal(await p.getByLabel('Tarjeta de aprendizaje',{exact:true}).inputValue(),'6');
  assert.equal(await p.locator('[data-tarjeta-nivel]:visible').count(),1);
  await p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('[data-estado-borrador]').classList.contains('admin-niveles__estado--pendiente'));
  const guardado=solicitudes.find(s=>s.method==='PUT'&&s.path.endsWith('/10/borrador')).body;
  assert.equal(guardado.desafio.nombre,'Red editada sin perder campos');
  assert.equal(guardado.tarjetas.length,7);
  assert.equal(guardado.tarjetas[6].titulo,'Última tarjeta editada');
  assert.equal(guardado.reglasExito.requiereRedValida,true);
  assert.deepEqual(guardado.reglasExito.puntuacion,niveles[9].reglasExito.puntuacion);
  assert.deepEqual(guardado.ayudas,[{claveCondicion:'simulacionActual',texto:'Contenido conservado',pista:'Dato previo'}]);
  assert.equal(await p.getByRole('tab',{name:'Tarjetas',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await p.getByLabel('Tarjeta de aprendizaje',{exact:true}).inputValue(),'6');
  await p.getByLabel('Tarjeta de aprendizaje',{exact:true}).selectOption('0');
  assert.equal(await p.locator('.admin-niveles__estado-texto').textContent(),'Borrador guardado','Elegir tarjeta no ensucia el borrador');
  await p.getByRole('tab',{name:'Red de referencia',exact:true}).click();
  const mapa=await p.locator('.admin-red-referencia__mapa').elementHandle();
  await p.getByRole('tab',{name:'Reglas',exact:true}).click();
  await p.getByRole('tab',{name:'Red de referencia',exact:true}).click();
  assert.equal(await mapa.evaluate(n=>n.isConnected),true,'Cambiar pestañas no reconstruye el mapa');
});

test('La puerta vuelve a la selección de niveles y protege cambios sin guardar',async t=>{
  const {pagina:p,solicitudes}=await abrirEditor(t);
  const salir=p.getByRole('button',{name:'Volver a los niveles para editar',exact:true});
  assert.equal(await salir.count(),1,'Existe una puerta de salida en lugar del menú de cambio');
  assert.equal(await salir.locator('svg').count(),1);
  assert.equal(await p.getByText('Cambiar de nivel',{exact:true}).count(),0);
  const ruta=p.url();
  await salir.click();
  await p.getByRole('button',{name:'Editar',exact:true}).waitFor();
  assert.equal(p.url(),ruta,'La salida es interna, sin recargar el documento');
  assert.equal(await p.locator('[data-editor-nivel]').count(),0);
  await p.getByRole('button',{name:'Editar',exact:true}).click();
  const nombre=p.getByRole('tabpanel',{name:'Desafío',exact:true}).getByLabel('Nombre',{exact:true});
  await nombre.fill('Edición pendiente de guardar');
  await salir.click();
  await p.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await nombre.inputValue(),'Edición pendiente de guardar');
  await salir.click();
  await p.getByRole('button',{name:'Confirmar',exact:true}).click();
  await p.getByRole('button',{name:'Editar',exact:true}).waitFor();
  assert.equal(await p.locator('[data-editor-nivel]').count(),0);
  assert.equal(solicitudes.filter(s=>s.method!=='GET').length,0,'Salir no guarda ni publica por su cuenta');
});

test('Limpieza del historial exige confirmación y conserva los cambios del borrador',async t=>{
  let versiones=[6,5,4,3,2,1].map(version=>({version,publicadoEn:'2026-10-08',redReferencia:{}})),eliminaciones=0;
  const {pagina:p}=await abrirEditor(t,{width:1280,height:720},10,req=>{
    const url=new URL(req.url());
    if(url.pathname.endsWith('/10/versiones'))return {json:versiones};
    if(req.method()==='DELETE') {
      assert.equal(url.searchParams.get('versionEsperada'),'6');eliminaciones++;
      versiones=versiones.filter(v=>[6,1].includes(v.version));
      return {json:{versionesEliminadas:[2,3,4,5],versionesConservadas:2}};
    }
  });
  const nombre=p.getByRole('tabpanel',{name:'Desafío',exact:true}).getByLabel('Nombre',{exact:true});
  await nombre.fill('Borrador pendiente');
  await p.getByRole('tab',{name:'Historial',exact:true}).click();
  assert.equal(await p.locator('.admin-niveles__version').count(),4);
  for(const nombre of ['Anterior','Siguiente']) {
    const flecha=p.getByRole('button',{name:nombre,exact:true});
    assert.equal(await flecha.locator('svg').count(),1);
    assert.equal(await flecha.innerText(),'');
    assert((await flecha.boundingBox()).width===32,'Flecha compacta del sistema común');
  }
  assert.equal(await p.getByRole('button',{name:'Anterior',exact:true}).isDisabled(),true);
  if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-historial-flechas.png`});
  await p.getByRole('button',{name:'Siguiente',exact:true}).click();
  assert.equal(await p.locator('.admin-niveles__version').count(),2);
  assert.equal(await p.getByRole('button',{name:'Siguiente',exact:true}).isDisabled(),true);
  await p.getByRole('button',{name:'Anterior',exact:true}).click();
  assert.equal(await p.locator('.admin-niveles__version').count(),4);
  const borrar=p.getByRole('button',{name:'Borrar historial',exact:true});
  assert.equal(await borrar.locator('svg').count(),0);
  assert.equal(await borrar.textContent(),'Borrar historial');
  assert(await borrar.evaluate(n=>n.scrollWidth<=n.clientWidth),'El texto cabe dentro del botón');
  assert.equal((await borrar.boundingBox()).height,32,'Borrar historial conserva la altura común');
  assert.equal(await borrar.evaluate(n=>getComputedStyle(n).getPropertyValue('--boton-fondo').trim()),
    await borrar.evaluate(n=>getComputedStyle(n).getPropertyValue('--control-peligro').trim()));
  await borrar.click();
  assert.equal(await p.locator('dialog.metronet-dialogo-sistema--peligro').count(),1);
  assert.equal(await p.getByRole('button',{name:'Cancelar',exact:true}).evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(112, 229, 177)');
  assert.equal(await p.getByRole('button',{name:'Eliminar',exact:true}).evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 141, 169)');
  await p.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(eliminaciones,0);
  await borrar.click();
  await Promise.all([p.waitForResponse(r=>r.request().method()==='DELETE'),p.getByRole('button',{name:'Eliminar',exact:true}).click()]);
  await p.locator('.admin-niveles__version').nth(2).waitFor({state:'detached'});
  assert.equal(eliminaciones,1);
  assert.equal(await p.locator('.admin-niveles__version').count(),2);
  await p.getByRole('tab',{name:'Desafío',exact:true}).click();
  assert.equal(await nombre.inputValue(),'Borrador pendiente');
  assert.equal(await p.locator('.admin-niveles__estado-texto').textContent(),'Cambios sin guardar');
});

test('Condiciones visibles y elementos de referencia conservan su edición',async t=>{
  const {pagina:p,solicitudes}=await abrirEditor(t,{width:1280,height:720});
  await p.getByRole('tab',{name:'Reglas',exact:true}).click();
  assert.equal(await p.getByLabel('Condición de la consigna',{exact:true}).count(),0);
  const reglas=p.locator('.admin-niveles__reglas > [data-regla-nivel]');
  assert((await reglas.count())>1,'Las condiciones se muestran juntas');
  for(const regla of await reglas.all())assert.equal(await regla.isVisible(),true);
  await p.locator('[data-regla-nivel="minimoEstaciones"]').getByLabel('Mínimo de estaciones',{exact:true}).fill('9');
  await p.getByRole('tab',{name:'Red de referencia',exact:true}).click();
  await p.getByRole('button',{name:'Agregar estaciones',exact:true}).click();
  const nombreReferencia=p.locator('.admin-niveles__tablas-red').getByLabel('Nombre',{exact:true});
  await nombreReferencia.fill('Estación de prueba');
  await p.getByLabel('Elementos de referencia',{exact:true}).selectOption('lineas');
  await p.getByRole('button',{name:'Agregar líneas',exact:true}).click();
  await nombreReferencia.fill('Línea de prueba');
  await p.getByLabel('Elementos de referencia',{exact:true}).selectOption('estaciones');
  assert.equal(await nombreReferencia.inputValue(),'Estación de prueba');
  if(process.env.METRONET_CAPTURAS_ADMIN)
    await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-editor-referencia.png`});
  const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
  assert(medidas.contenido<=medidas.alto+1,`Referencia sin desplazamiento (${medidas.contenido}/${medidas.alto})`);
  await p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('[data-estado-borrador]').classList.contains('admin-niveles__estado--pendiente'));
  const body=solicitudes.find(s=>s.method==='PUT').body;
  assert.equal(body.reglasExito.minimoEstaciones,9);
  assert.equal(body.redReferencia.estaciones[0].nombre,'Estación de prueba');
  assert.equal(body.redReferencia.lineas[0].nombre,'Línea de prueba');
});

test('Selectores de tarjetas e imágenes compactos, con teclado y sin desplazar el formulario',async t=>{
  const {pagina:p}=await abrirEditor(t,{width:1280,height:720});
  await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();
  const selectorTarjeta=p.getByLabel('Tarjeta de aprendizaje',{exact:true});
  assert(await p.getByRole('button',{name:'Anterior',exact:true}).isDisabled());
  await p.getByRole('button',{name:'Siguiente',exact:true}).click();
  assert.equal(await selectorTarjeta.inputValue(),'1');
  await p.getByRole('button',{name:'Anterior',exact:true}).click();
  assert.equal(await selectorTarjeta.inputValue(),'0');
  for(const nombre of ['Tarjeta de aprendizaje','Elegir imagen del catálogo']) {
    const select=p.getByLabel(nombre,{exact:true}).filter({visible:true});
    const antes=await p.locator('.admin-niveles__paneles').boundingBox();
    const caja=await select.boundingBox();assert(caja.width<=520);
    await select.click();
    const estilo=await select.evaluate(n=>({
      alto:parseFloat(getComputedStyle(n,'::picker(select)').maxBlockSize),
      ancho:parseFloat(getComputedStyle(n,'::picker(select)').maxInlineSize),
      opcion:parseFloat(getComputedStyle(n.options[0]).minHeight),
    }));
    assert(estilo.alto<=248&&estilo.ancho<=520,'Menú limitado al tamaño compacto');
    assert(estilo.opcion<=30,'Opciones compactas');
    if(process.env.METRONET_CAPTURAS_ADMIN)
      await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-selector-${nombre}.png`});
    await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
    assert.deepEqual(await p.locator('.admin-niveles__paneles').boundingBox(),antes,'Abrir y elegir no mueve el formulario');
  }
  const ficha=p.locator('[data-tarjeta-nivel]:visible');
  assert.equal(await ficha.locator('img').getAttribute('src'),`${await ficha.getByLabel('Elegir imagen del catálogo').inputValue()}#svgView(preserveAspectRatio(none))`);
  const imagen=await ficha.locator('img').boundingBox(),cuadro=await ficha.locator('.admin-niveles__ilustracion').boundingBox();
  assert(Math.abs(imagen.y+imagen.height-cuadro.y-cuadro.height)<2,'La imagen ocupa hasta el borde inferior de su área');
});

for(const viewport of [{width:1280,height:720},{width:1470,height:745}])
test(`Las 70 tarjetas y las reglas de los diez niveles caben a ${viewport.width}×${viewport.height}`,async t=>{
  for(let nivel=1;nivel<=10;nivel++) {
    const {pagina:p,contexto}=await abrirEditor(t,viewport,nivel);
    await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();
    for(let tarjeta=0;tarjeta<7;tarjeta++) {
      await p.getByLabel('Tarjeta de aprendizaje',{exact:true}).selectOption(String(tarjeta));
      const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
      assert(medidas.contenido<=medidas.alto+1,`Nivel ${nivel}, tarjeta ${tarjeta+1}: sin scroll del formulario (${medidas.contenido}/${medidas.alto})`);
      assert.equal(await p.locator('[data-tarjeta-nivel]:visible').locator('input,textarea,select').count(),6);
      for(const campo of await p.locator('[data-tarjeta-nivel]:visible textarea').evaluateAll(ns=>ns.map(n=>({nombre:n.getAttribute('aria-label'),alto:n.clientHeight,contenido:n.scrollHeight,fuente:getComputedStyle(n).font,padding:getComputedStyle(n).padding}))))
        assert(campo.contenido<=campo.alto+1,`Nivel ${nivel}, tarjeta ${tarjeta+1}, ${campo.nombre}: texto completo (${campo.contenido}/${campo.alto}), ${campo.fuente}, ${campo.padding}`);
      assert.equal(await p.locator('[data-tarjeta-nivel]:visible img').getAttribute('src'),
        `${catalogo[nivel-1].tarjetas[tarjeta].imagen}#svgView(preserveAspectRatio(none))`,
        `Nivel ${nivel}, tarjeta ${tarjeta+1}: conserva la imagen original`);
      if(process.env.METRONET_CAPTURAS_ADMIN&&nivel===10&&tarjeta===0)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/tarjetas-nivel-10-${viewport.width}.png`});
    }
    await p.getByRole('tab',{name:'Reglas',exact:true}).click();
    for(const regla of await p.locator('.admin-niveles__reglas > [data-regla-nivel]').all())
      assert.equal(await regla.isVisible(),true,`Nivel ${nivel}: cantidad disponible directamente`);
    const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
    if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-reglas-nivel-${nivel}.png`});
    assert(medidas.contenido<=medidas.alto+1,`Nivel ${nivel}: todas las cantidades sin scroll (${medidas.contenido}/${medidas.alto})`);
    await contexto.close();
  }
});

for(const viewport of [{width:1280,height:720},{width:1920,height:1080}]) {
  test(`Agregar regla con cantidad previa y menú hacia abajo dentro de pantalla a ${viewport.width}`,async t=>{
    const {pagina:p,solicitudes}=await abrirEditor(t,viewport,1);
    await p.getByRole('tab',{name:'Reglas',exact:true}).click();
    const agregar=p.getByLabel('Regla admitida para agregar',{exact:true});
    await agregar.selectOption('minimoMetros');
    const cantidad=p.locator('.admin-niveles__valor-nueva-regla').getByLabel('Mínimo de unidades',{exact:true});
    await cantidad.fill('6');
    assert.equal(await p.locator('.admin-niveles__estado-texto').textContent(),'Borrador guardado','Preparar no agrega ni ensucia el borrador');
    await p.getByRole('button',{name:'Agregar regla admitida',exact:true}).click();
    assert.equal(await p.locator('[data-regla-nivel="minimoMetros"]').getByLabel('Mínimo de unidades',{exact:true}).inputValue(),'6');
    await p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();
    await p.waitForFunction(()=>!document.querySelector('[data-estado-borrador]').classList.contains('admin-niveles__estado--pendiente'));
    assert.equal(solicitudes.find(s=>s.method==='PUT').body.reglasExito.minimoMetros,6);
    const formulario=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
    assert(formulario.contenido<=formulario.alto+1,'Guardar no desplaza las acciones del formulario fuera de pantalla');
    await agregar.click();
    const caja=await agregar.boundingBox();
    const opcion=await agregar.locator('option').first().boundingBox();
    if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-reglas-abierto-${viewport.width}.png`});
    assert(opcion.y>=0&&opcion.y+opcion.height<=viewport.height,'Primera opción completa dentro de la pantalla');
    assert(opcion.y>=caja.y+caja.height,'El menú abre hacia abajo sin tapar el selector');
    await agregar.locator('option').last().click();
    assert.equal(await agregar.inputValue(),await agregar.locator('option').last().getAttribute('value'),'La última opción se puede seleccionar');
    await p.keyboard.press('Escape');
  });
}

test('Casillas próximas al texto, papelera alineada y objetivos de simulación claros',async t=>{
  const {pagina:p}=await abrirEditor(t,{width:1440,height:900},10);
  await p.getByRole('tab',{name:'Reglas',exact:true}).click();
  assert.equal(await p.getByText('Prácticas de simulación',{exact:true}).count(),0);
  for(const clave of ['requiereGeografiaValida','requiereSimulacion']) {
    const regla=p.locator(`[data-regla-nivel="${clave}"]`);
    const medidas=await regla.evaluate(n=>{
      const label=n.querySelector('label'),texto=document.createRange();texto.selectNodeContents(label.firstChild);
      const t=texto.getBoundingClientRect(),check=n.querySelector('input').getBoundingClientRect(),b=n.querySelector('button').getBoundingClientRect();
      return {separacion:t.left-check.right,centroCheck:check.y+check.height/2,centroBorrar:b.y+b.height/2};
    });
    assert(medidas.separacion>=0&&medidas.separacion<=9,'Casilla junto al texto');
    assert(Math.abs(medidas.centroCheck-medidas.centroBorrar)<1,'Papelera alineada con la casilla');
  }
  for(const titulo of ['Cantidades de la red','Condiciones de funcionamiento','Objetivos específicos'])
    assert.equal(await p.getByRole('heading',{name:titulo,exact:true}).isVisible(),true);
  const panel=await p.getByRole('tabpanel',{name:'Reglas',exact:true}).boundingBox();
  const herramientas=await p.locator('.admin-niveles__herramientas').boundingBox();
  assert(herramientas.height<=180,'Herramientas ocupa una columna compacta');
  assert(herramientas.y+herramientas.height<panel.y+panel.height,'Queda espacio debajo de las herramientas');
  if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-reglas-cantidades.png`});
  await p.getByText('Objetivos de simulación',{exact:true}).first().click();
  const objetivos=p.locator('[data-regla-nivel="aprendizajeSimulacion"]');
  assert.equal(await objetivos.isVisible(),true);
  const global=objetivos.getByLabel('Global',{exact:true});
  await global.uncheck();assert.equal(await global.isChecked(),false);
});

test('Cabecera usa los colores acordados y la lista omite la columna Borrador',async t=>{
  const {pagina:p}=await abrirEditor(t,{width:1440,height:900},1);
  const colores={guardar:'rgb(41, 159, 238)',previsualizar:'rgb(255, 208, 120)',publicar:'rgb(112, 229, 177)',salir:'rgb(255, 141, 169)'};
  for(const [accion,color] of Object.entries(colores))assert.equal(await p.locator(`.admin-niveles__utilidades [data-accion-ui="${accion}"]`).evaluate(n=>getComputedStyle(n).backgroundColor),color,accion);
  await p.locator('.admin-niveles__salir').click();
  await p.locator('.admin-niveles__lista').waitFor();
  assert.equal(await p.locator('.admin-niveles__lista').getAttribute('role'),'list');
  assert.equal(await p.locator('.admin-niveles__tarjeta').count(),1);
  assert.equal(await p.getByRole('button',{name:'Editar',exact:true}).evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 208, 120)');
});

for (const viewport of [{width:1280,height:720},{width:1440,height:900},{width:1920,height:1080}]) {
  test(`Ajustes del editor: dificultad, reglas compactas y menú contenido a ${viewport.width}`,async t=>{
    const {pagina:p,solicitudes}=await abrirEditor(t,viewport,10);
    assert.equal(await p.getByRole('tab',{name:'UV / UT',exact:true}).count(),0);
    const dificultad=p.getByRole('combobox',{name:'Dificultad',exact:true});
    assert.equal((await dificultad.boundingBox()).height,(await p.getByRole('tabpanel',{name:'Desafío',exact:true}).getByLabel('Nombre',{exact:true}).boundingBox()).height,'Nombre y dificultad de igual altura');
    assert.deepEqual(await dificultad.locator('option').allTextContents(),['Inicial','Media','Avanzada']);
    assert.equal(await dificultad.inputValue(),'Avanzado');
    await dificultad.selectOption('Intermedio');
    await Promise.all([
      p.waitForResponse(r=>r.url().endsWith('/10/borrador')&&r.request().method()==='PUT'),
      p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click(),
    ]);
    assert.equal(solicitudes.filter(s=>s.method==='PUT').at(-1).body.desafio.dificultad,'Intermedio');
    assert.deepEqual(solicitudes.filter(s=>s.method==='PUT').at(-1).body.criterioUvUt,{limiteUt:2,presupuestoUv:6.5});
    await p.getByRole('tab',{name:'Reglas',exact:true}).click();
    const quitar=p.locator('.admin-niveles__reglas .admin-niveles__quitar-regla').first();
    assert.equal((await quitar.boundingBox()).width,28);
    assert.equal((await quitar.locator('svg').boundingBox()).width,16);
    assert.equal(await quitar.locator('svg').evaluate(async e=>{
      const {iconoRetro}=await import('/src/interfaz/IconosRetro.js');
      const esperado=document.createElement('div');esperado.innerHTML=iconoRetro('eliminar');
      return e.querySelector('path').getAttribute('d')===esperado.querySelector('path').getAttribute('d');
    }),true);
    const herramientas=await p.locator('.admin-niveles__herramientas').boundingBox();
    const cantidades=await p.locator('.admin-niveles__grupo-reglas').first().boundingBox();
    assert(herramientas.width<350,'Herramientas compacto');
    assert(Math.abs(herramientas.x-cantidades.x)<10,'Herramientas alineadas al borde izquierdo');
    await quitar.click();
    const selector=p.getByLabel('Regla admitida para agregar',{exact:true});
    const numeros=await selector.locator('option').evaluateAll(ns=>ns.filter(n=>/^Mínimo|^Máximo/.test(n.textContent)).map(n=>n.value));
    assert(numeros.length>0);
    for(const clave of numeros){
      await selector.selectOption(clave);
      const numero=p.locator('.admin-niveles__valor-nueva-regla > label > input[type=number]');
      const caja=await numero.boundingBox(),menu=await selector.boundingBox(),label=await numero.locator('..').boundingBox();
      assert.equal(caja.width,80);
      assert(Math.abs(caja.x+caja.width/2-label.x-label.width/2)<1);
      assert(Math.abs(caja.y-menu.y)<2);
      assert.equal(await numero.evaluate(n=>getComputedStyle(n).textAlign),'center');
    }
    await selector.click();
    const opciones=await selector.locator('option').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON()));
    assert(opciones.length>0);
    for(const r of opciones)assert(r.width>0&&r.left>=0&&r.top>=0&&r.right<=viewport.width&&r.bottom<=viewport.height,'Cada opción visible sin desplazar');
    await p.keyboard.press('Escape');
  });
}

for(const viewport of [{width:1280,height:720},{width:1440,height:900},{width:1920,height:1080}]) {
  test(`Listas de reglas compactas, acciones separadas y títulos uniformes a ${viewport.width}`,async t=>{
    const {pagina:p}=await abrirEditor(t,viewport,1);
    await p.getByRole('tab',{name:'Reglas',exact:true}).click();
    const reglaPoi=p.locator('[data-regla-nivel="puntosInteresObjetivo"]');
    if(await reglaPoi.count()) {
      await p.getByLabel('Regla del nivel',{exact:true}).selectOption('puntosInteresObjetivo');
      await reglaPoi.getByRole('button',{name:'Quitar toda la regla de lugares objetivo',exact:true}).click();
    }
    const selector=p.getByLabel('Regla admitida para agregar',{exact:true});
    const bloque=p.locator('.admin-niveles__agregar-regla');
    for(const clave of ['puntosInteresObjetivo','areasObjetivo']) {
      await selector.selectOption(clave);
      const campos=bloque.locator('.admin-niveles__valor-nueva-regla');
      const controls=campos.locator('input,select').filter({visible:true});
      const medidas=await controls.evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect(),c=getComputedStyle(n);return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,align:c.textAlign,label:n.parentElement.getBoundingClientRect().toJSON()}}));
      for(const r of medidas){assert(r.w<=r.label.width&&r.w>0);assert.equal(r.align,'center');assert(Math.abs(r.x+r.w/2-r.label.x-r.label.width/2)<1);assert(r.right<=viewport.width&&r.bottom<=viewport.height);}
      assert(Math.max(...medidas.map(r=>r.y))-Math.min(...medidas.map(r=>r.y))<1,'Controles a la misma altura');
      const espacios=medidas.slice(1).map((r,i)=>r.label.x-medidas[i].label.right);
      assert(espacios.every(e=>Math.abs(e-espacios[0])<1),'Separación uniforme entre campos');
      const principal=await bloque.getByRole('button',{name:'Agregar regla admitida',exact:true}).boundingBox();
      const acciones=bloque.locator(':scope > .admin-niveles__acciones-lista');
      const grupo=await acciones.boundingBox();
      assert(Math.abs(principal.x+principal.width/2-grupo.x-grupo.width/2)<1,'Acciones debajo de Agregar');
      assert(grupo.y>=principal.y+principal.height);
      assert.equal(await bloque.getByRole('button',{name:'Agregar',exact:true}).count(),0,'La acción principal tiene nombre accesible específico');
      assert.equal(await acciones.locator('button').evaluateAll(ns=>ns.filter(n=>n.textContent.trim()==='Agregar').length),0,'No hay otro Agregar textual');
      const agregar=acciones.getByRole('button',{name:clave==='areasObjetivo'?'Agregar barrios y zonas objetivo':'Agregar lugares objetivo',exact:true});
      const elemento=campos.getByLabel('Elemento',{exact:true});
      const inicial=await elemento.locator('option').count();
      await agregar.click();assert.equal(await elemento.locator('option').count(),inicial+1);
      await elemento.selectOption(String(inicial));
      await acciones.getByRole('button',{name:clave==='areasObjetivo'?'Quitar zona seleccionada':'Quitar lugar seleccionado',exact:true}).click();
      assert.equal(await elemento.locator('option').count(),inicial);
      if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/compacto-${clave}-${viewport.width}.png`});
    }
    const titulos=await p.locator('.admin-niveles__grupo-reglas > h3,.admin-niveles__herramientas > h3,.admin-niveles__encabezado-reglas > h3').evaluateAll(ns=>ns.map(n=>{const c=getComputedStyle(n);return[c.fontSize,c.color,c.borderBottomWidth].join('|')}));
    assert(titulos.every(t=>t===titulos[0]));
    assert.equal(await p.locator('.admin-niveles__herramientas').evaluate(n=>getComputedStyle(n).borderTopWidth),'0px');
    const claves=await selector.locator('option').evaluateAll(ns=>ns.filter(n=>/minimo|Control/.test(n.value)).map(n=>n.value));
    if(claves.includes('minimoTransbordos')){
      await selector.selectOption('minimoTransbordos');
      const a=await selector.boundingBox(),b=await bloque.locator('.admin-niveles__valor-nueva-regla input[type=number]').boundingBox();
      assert.equal(a.height,b.height);assert(Math.abs(a.y-b.y)<1);
    }
  });
}

for(const viewport of [{width:1280,height:720},{width:1440,height:900},{width:1470,height:745},{width:1920,height:1080}]) {
  for(let nivel=1;nivel<=10;nivel++) {
    test(`Reglas existentes y nuevas sin desborde: nivel ${nivel} a ${viewport.width}`,async t=>{
      const {pagina:p}=await abrirEditor(t,viewport,nivel);
      await p.getByRole('tab',{name:'Reglas',exact:true}).click();
      const elegir=p.getByLabel('Regla del nivel',{exact:true});
      const opciones=await elegir.locator('option').evaluateAll(ns=>ns.map(n=>n.value));
      for(const opcion of opciones) {
        if(await elegir.isVisible())await elegir.selectOption(opcion);
        else assert.equal(opciones.length,1,'Se oculta el selector sin alternativas');
        const comprobar=async()=>{
          const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight,ancho:n.clientWidth,contenidoAncho:n.scrollWidth}));
          if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/reglas-nivel-${nivel}-${opcion}-${viewport.width}.png`});
          assert(medidas.contenido<=medidas.alto+1,`${opcion}: alto ${medidas.contenido}/${medidas.alto}`);
          assert(medidas.contenidoAncho<=medidas.ancho+1,`${opcion}: ancho contenido`);
          const controles=p.locator('.admin-niveles__panel--reglas input,.admin-niveles__panel--reglas select,.admin-niveles__panel--reglas button').filter({visible:true});
          for(const caja of await controles.evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON())))
            assert(caja.top>=0&&caja.bottom<=viewport.height&&caja.left>=0&&caja.right<=viewport.width,`${opcion}: control dentro de pantalla`);
          assert.equal(await p.locator('.admin-niveles__reglas-detalle > .admin-niveles__regla').filter({visible:true}).count(),opcion==='nueva'?0:1);
          if(opcion!=='nueva'&&await elegir.isVisible()) {
            const selector=await elegir.boundingBox();
            const papelera=await p.locator('.admin-niveles__regla--compuesta:not([hidden]) > .admin-niveles__quitar-regla').boundingBox();
            assert(Math.abs(selector.y+selector.height/2-papelera.y-papelera.height/2)<1,'Papelera centrada con el selector de regla');
          }
          if(opcion==='aprendizajeSimulacion') {
            const grupo=await p.locator('[data-regla-nivel="aprendizajeSimulacion"] > fieldset').boundingBox();
            const casillas=await p.locator('[data-regla-nivel="aprendizajeSimulacion"] label').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON()));
            const izquierda=Math.min(...casillas.map(r=>r.left)),derecha=Math.max(...casillas.map(r=>r.right));
            assert(Math.abs((izquierda+derecha)/2-grupo.x-grupo.width/2)<1,'Opciones de simulación centradas');
          }
          const texto=await p.locator('.admin-niveles__panel--reglas selectedcontent').filter({visible:true}).evaluateAll(ns=>ns.map(n=>{
            const rango=document.createRange();rango.selectNodeContents(n);
            const r=rango.getBoundingClientRect(),c=n.closest('select').getBoundingClientRect();
            return {error:Math.abs(r.x+r.width/2-c.x-c.width/2),valor:n.textContent};
          }));
          for(const t of texto)assert(t.error<2,`${t.valor}: contenido centrado en su selector (${t.error})`);
          const nombre=p.locator('.admin-niveles__panel--reglas input[aria-label="Nombre"]').filter({visible:true});
          if(await nombre.count())assert.equal(await nombre.evaluate(n=>{
            const estilo=getComputedStyle(n),canvas=document.createElement('canvas'),contexto=canvas.getContext('2d');
            contexto.font=estilo.font;
            const ancho=contexto.measureText(n.value).width+(parseFloat(estilo.letterSpacing)||0)*n.value.length;
            return ancho<=n.clientWidth-parseFloat(estilo.paddingLeft)-parseFloat(estilo.paddingRight);
          }),true,'Nombre completo sin recorte');
        };
        await comprobar();
        if(opcion==='nueva') {
          const nueva=p.getByLabel('Regla admitida para agregar',{exact:true});
          const claves=await nueva.locator('option').evaluateAll(ns=>ns.map(n=>n.value));
          for(const clave of claves){await nueva.selectOption(clave);await comprobar();}
        } else {
          const elemento=p.locator('.admin-niveles__reglas-detalle').getByLabel('Elemento',{exact:true}).filter({visible:true});
          if(await elemento.count()) {
            const cantidad=await elemento.locator('option').count();
            if(cantidad)await elemento.selectOption(String(cantidad-1));
            await comprobar();
          }
        }
      }
    });
  }
}
