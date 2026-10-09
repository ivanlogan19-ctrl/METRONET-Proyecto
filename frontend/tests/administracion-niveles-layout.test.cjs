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
    const claves=await selector.locator('option').evaluateAll(ns=>ns.map(n=>n.value));
    for(const clave of claves) {
      await selector.selectOption(clave);
      const bloque=p.locator('.admin-niveles__agregar-regla');
      const campos=p.locator('.admin-niveles__valor-nueva-regla');
      const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
      assert(medidas.contenido<=medidas.alto+1,`${clave}: formulario sin desplazamiento (${medidas.contenido}/${medidas.alto})`);
      const borde=await bloque.boundingBox(),menu=await selector.boundingBox();
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
        const controles=campos.locator('input');
        const cajas=await Promise.all((await controles.all()).map(n=>n.boundingBox()));
        assert(cajas.every(c=>Math.abs(c.y-cajas[0].y)<2),`${clave}: campos en una fila`);
        for(const nombre of ['Quitar',`Agregar ${(await selector.locator('option:checked').innerText()).toLowerCase()}`]) {
          const boton=campos.getByRole('button',{name:nombre,exact:true});
          const caja=await boton.boundingBox();
          assert(caja.y>=Math.max(...cajas.map(c=>c.y+c.height))+5,`${clave}: ${nombre} debajo de los campos`);
          const color=await boton.evaluate(n=>getComputedStyle(n).backgroundColor);
          assert.equal(color,nombre==='Quitar'?'rgb(255, 141, 169)':'rgb(112, 229, 177)');
        }
      }
      if(process.env.METRONET_CAPTURAS_ADMIN&&['areasObjetivo','aprendizajeSimulacion','maximoEstaciones'].includes(clave))
        await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-regla-${clave}-${viewport.width}.png`});
    }
    const subtitulos=await p.locator('.admin-niveles__grupo-reglas h3, .admin-niveles__herramientas legend').evaluateAll(ns=>ns.map(n=>{
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
  await guardar.click();await p.getByText(/Borrador del nivel 1 guardado, revisión 2/).waitFor();
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
  await publicar.click();await p.getByText(/Nivel 1 publicado como versión 3/).waitFor();
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
  await nombre.fill('Edición posterior');resolver();
  await p.getByText(/revisión 2/).first().waitFor();
  assert.equal(await nombre.inputValue(),'Edición posterior');
  assert.equal(await p.locator('[data-estado-borrador]').textContent(),'Cambios sin guardar');
  await guardar.click();await p.getByText(/revisión 3/).first().waitFor();
  assert.equal(solicitudes.filter(s=>s.method==='PUT')[1].body.desafio.nombre,'Edición posterior');
  assert.equal(await p.locator('[data-estado-borrador]').textContent(),'Borrador guardado');
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
  await p.getByText('Referencia viable').waitFor();await p.locator('[data-confirmacion-editorial]').check();
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
  await p.locator('.admin-niveles__detalle-regla > summary').filter({hasText:'Lugares objetivo'}).click();
  const regla=p.locator('[data-regla-nivel="puntosInteresObjetivo"]');
  await regla.getByRole('button',{name:'Quitar',exact:true}).click();
  await regla.getByRole('button',{name:'Quitar',exact:true}).click();
  const agregar=regla.getByRole('button',{name:'Agregar lugares objetivo',exact:true});
  assert.equal(await agregar.isEnabled(),true);
  await agregar.click();await regla.getByLabel('Id Punto',{exact:true}).fill('18');
  await regla.getByLabel('Radio Cobertura',{exact:true}).fill('20');
  await p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();
  await p.getByText(/Borrador del nivel 1 guardado/).waitFor();
  assert.deepEqual(solicitudes.find(s=>s.method==='PUT').body.reglasExito.puntosInteresObjetivo,[{idPunto:18,radioCobertura:20}]);
});

for(const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:1366,height:768},{width:1280,height:720},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]) {
  test(`Editor de niveles compacto, secciones accesibles y sin overflow a ${viewport.width}`,async t=>{
    const {pagina:p}=await abrirEditor(t,viewport);
    assert.equal(await p.getByRole('button',{name:/Agregar pista|Quitar pista|Quitar Regla histórica/}).count(),0);
    assert.equal(await p.getByRole('tabpanel').count(),1);
    for(const nombre of ['Desafío','Reglas','Red de referencia','UV / UT','Tarjetas','Vista previa','Historial']) {
      await p.getByRole('tab',{name:nombre,exact:true}).click();
      assert.equal(await p.getByRole('tabpanel').count(),1);
      assert.equal(await p.getByRole('tabpanel',{name:nombre,exact:true}).isVisible(),true);
      const medidas=await p.evaluate(()=>({ancho:innerWidth,alto:innerHeight,scrollAncho:document.documentElement.scrollWidth,
        scrollAlto:document.documentElement.scrollHeight,guardar:document.querySelector('.admin-niveles__acciones').getBoundingClientRect().toJSON(),
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
    assert.equal(await p.getByRole('tab',{name:'Reglas',exact:true}).getAttribute('aria-selected'),'true');
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
  await p.getByText('Borrador del nivel 3 guardado, revisión 2.').waitFor();
  assert.equal(await guardar.evaluate(n=>n.classList.contains('admin-niveles__estado--pendiente')),false);
  const guardados=solicitudes.filter(s=>s.method==='PUT');
  assert.equal(guardados.length,2);
  assert.equal(guardados[1].body.desafio.nombre,'Nivel editado desde el disquete');
});

test('Desafío expandido, cabecera alineada y reglas simples compactas',async t=>{
  const {pagina:p}=await abrirEditor(t,{width:1280,height:720},3);
  const panel=p.getByRole('tabpanel',{name:'Desafío',exact:true});
  const caja=await panel.boundingBox();
  for(const nombre of ['Relato','Objetivo','Instrucciones']) {
    const area=await panel.getByLabel(nombre,{exact:true}).boundingBox();
    assert(area.height>caja.height*.6,`${nombre} ocupa la altura disponible desde el primer render`);
    assert(Math.abs(area.y+area.height-(caja.y+caja.height-13))<3,`${nombre} llega al borde inferior`);
  }
  assert((await panel.getByLabel('Nombre',{exact:true}).boundingBox()).width<=440);
  assert((await panel.getByLabel('Dificultad',{exact:true}).boundingBox()).width<=180);
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
  assert(herramientas.y>=cajaRegla.y+cajaRegla.height,'Herramientas debajo de las condiciones');
  const condiciones=await p.locator('.admin-niveles__condiciones').boundingBox();
  assert(Math.abs(herramientas.x-condiciones.x)<1&&Math.abs(herramientas.width-condiciones.width)<1,'Herramientas alineadas con el ancho total de las condiciones');
  assert((await regla.getByLabel('Mínimo de líneas',{exact:true}).boundingBox()).width<(await regla.boundingBox()).width,'Valor numérico dentro de su condición');
  assert((await regla.getByRole('button',{name:'Quitar Mínimo de líneas'}).boundingBox()).width<=44,'Acción quitar compacta');
  if(process.env.METRONET_CAPTURAS_ADMIN)
    await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-editor-regla-simple.png`});
  await regla.getByLabel('Mínimo de líneas',{exact:true}).fill('2');
  await p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();
  await p.getByText('Borrador del nivel 3 guardado, revisión 2.').waitFor();
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
  assert(boton.y>=lista.y+lista.height&&Math.abs(boton.x-lista.x)<2,'Agregar queda debajo y alineado con el selector');
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
  await p.getByText('Borrador del nivel 10 guardado, revisión 2.').waitFor();
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
  assert.equal(await p.locator('[data-estado-borrador]').textContent(),'Borrador guardado','Elegir tarjeta no ensucia el borrador');
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
  await p.getByRole('button',{name:'Aceptar',exact:true}).click();
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
    assert((await flecha.boundingBox()).width<=30,'Flecha compacta');
  }
  assert.equal(await p.getByRole('button',{name:'Anterior',exact:true}).isDisabled(),true);
  if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-historial-flechas.png`});
  await p.getByRole('button',{name:'Siguiente',exact:true}).click();
  assert.equal(await p.locator('.admin-niveles__version').count(),2);
  assert.equal(await p.getByRole('button',{name:'Siguiente',exact:true}).isDisabled(),true);
  await p.getByRole('button',{name:'Anterior',exact:true}).click();
  assert.equal(await p.locator('.admin-niveles__version').count(),4);
  const borrar=p.getByRole('button',{name:'Borrar registro de versiones'});
  assert.equal(await borrar.locator('svg').count(),1);
  assert((await borrar.boundingBox()).width<=44,'Borrar historial usa una papelera compacta');
  assert.equal(await borrar.evaluate(n=>getComputedStyle(n).getPropertyValue('--boton-fondo').trim()),
    await borrar.evaluate(n=>getComputedStyle(n).getPropertyValue('--control-peligro').trim()));
  await borrar.click();await p.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(eliminaciones,0);
  await borrar.click();await p.getByRole('button',{name:'Aceptar',exact:true}).click();
  await p.getByText('Se eliminaron 4 versiones sin uso. Se conservaron 2.').waitFor();
  assert.equal(eliminaciones,1);
  assert.equal(await p.locator('.admin-niveles__version').count(),2);
  await p.getByRole('tab',{name:'Desafío',exact:true}).click();
  assert.equal(await nombre.inputValue(),'Borrador pendiente');
  assert.equal(await p.locator('[data-estado-borrador]').textContent(),'Cambios sin guardar');
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
  await p.getByText('Borrador del nivel 10 guardado, revisión 2.').waitFor();
  const body=solicitudes.find(s=>s.method==='PUT').body;
  assert.equal(body.reglasExito.minimoEstaciones,9);
  assert.equal(body.redReferencia.estaciones[0].nombre,'Estación de prueba');
  assert.equal(body.redReferencia.lineas[0].nombre,'Línea de prueba');
});

test('Selectores de tarjetas e imágenes compactos, con teclado y sin desplazar el formulario',async t=>{
  const {pagina:p}=await abrirEditor(t,{width:1280,height:720});
  await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();
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

test('Las 70 tarjetas y las reglas de los diez niveles caben a 1280×720',async t=>{
  for(let nivel=1;nivel<=10;nivel++) {
    const {pagina:p,contexto}=await abrirEditor(t,{width:1280,height:720},nivel);
    await p.getByRole('tab',{name:'Tarjetas',exact:true}).click();
    for(let tarjeta=0;tarjeta<7;tarjeta++) {
      await p.getByLabel('Tarjeta de aprendizaje',{exact:true}).selectOption(String(tarjeta));
      const medidas=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
      assert(medidas.contenido<=medidas.alto+1,`Nivel ${nivel}, tarjeta ${tarjeta+1}: sin scroll del formulario (${medidas.contenido}/${medidas.alto})`);
      assert.equal(await p.locator('[data-tarjeta-nivel]:visible').locator('input,textarea,select').count(),6);
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
  test(`Agregar regla con cantidad previa y menú hacia abajo a ${viewport.width}`,async t=>{
    const {pagina:p,solicitudes}=await abrirEditor(t,viewport,1);
    await p.getByRole('tab',{name:'Reglas',exact:true}).click();
    const agregar=p.getByLabel('Regla admitida para agregar',{exact:true});
    await agregar.selectOption('minimoMetros');
    const cantidad=p.locator('.admin-niveles__valor-nueva-regla').getByLabel('Mínimo de unidades',{exact:true});
    await cantidad.fill('6');
    assert.equal(await p.locator('[data-estado-borrador]').textContent(),'Borrador guardado','Preparar no agrega ni ensucia el borrador');
    await p.getByRole('button',{name:'Agregar regla admitida',exact:true}).click();
    assert.equal(await p.locator('[data-regla-nivel="minimoMetros"]').getByLabel('Mínimo de unidades',{exact:true}).inputValue(),'6');
    await p.getByRole('button',{name:'Guardar cambios del nivel',exact:true}).click();
    await p.getByText('Borrador del nivel 1 guardado, revisión 2.').waitFor();
    assert.equal(solicitudes.find(s=>s.method==='PUT').body.reglasExito.minimoMetros,6);
    const formulario=await p.locator('.admin-niveles__paneles').evaluate(n=>({alto:n.clientHeight,contenido:n.scrollHeight}));
    assert(formulario.contenido<=formulario.alto+1,'Guardar no desplaza las acciones del formulario fuera de pantalla');
    await agregar.click();
    const caja=await agregar.boundingBox();
    const opcion=await agregar.locator('option').first().boundingBox();
    if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-reglas-abierto-${viewport.width}.png`});
    assert(opcion.y>=caja.y+caja.height,`La lista abre por debajo del selector (${opcion.y}/${caja.y+caja.height})`);
    assert(opcion.y+opcion.height<=viewport.height,'Primera opción dentro de la pantalla');
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
  assert(Math.abs(panel.y+panel.height-herramientas.y-herramientas.height-13)<3,'Los grupos ocupan hasta el borde inferior disponible');
  if(process.env.METRONET_CAPTURAS_ADMIN)await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/admin-reglas-cantidades.png`});
  await p.getByText('Objetivos de simulación',{exact:true}).first().click();
  const objetivos=p.locator('[data-regla-nivel="aprendizajeSimulacion"]');
  assert.equal(await objetivos.isVisible(),true);
  const global=objetivos.getByLabel('Global',{exact:true});
  await global.uncheck();assert.equal(await global.isChecked(),false);
});
