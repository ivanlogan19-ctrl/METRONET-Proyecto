const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.METRONET_PLAYWRIGHT_PATH||'playwright');
const {abrirPantalla}=require('./soporte/pantallas.cjs');
const niveles=require('../src/educacion/recorrido-integral.json');
let navegador;
before(async()=>{navegador=await chromium.launch({channel:process.env.METRONET_BROWSER_CHANNEL})});
after(async()=>{await navegador?.close()});

for(const viewport of [{width:1280,height:720},{width:1440,height:900},{width:1920,height:1080},{width:768,height:1024},{width:390,height:844}]) {
  test(`Lista de diez niveles: datos legibles y acciones alineadas a ${viewport.width}`,async t=>{
    const {contexto,pagina:p,errores}=await abrirPantalla(navegador,'/admin.html',{viewport,responder:req=>{
      if(new URL(req.url()).pathname==='/api/admin/niveles')return {json:niveles.map(n=>({
        numero:n.numero,nombre:n.nombre,versionPublicada:7,revisionBorrador:12+n.numero,
      }))};
    }});
    t.after(async()=>{await contexto.close();assert.deepEqual(errores,[])});
    const menuAntes=await p.locator('.admin-menu').boundingBox();
    const senalAntes=await p.locator('.admin-senal-ferroviaria').boundingBox();
    await p.getByRole('button',{name:'Experiencia de juego',exact:true}).click();
    const tabla=p.getByRole('table',{name:'Niveles de la experiencia de juego'});
    await tabla.getByRole('button',{name:'Editar',exact:true}).nth(9).waitFor();
    assert.deepEqual(await tabla.locator('thead th').allTextContents(),['Nivel','Nombre','Publicación','Borrador','Acción']);
    assert.equal(await tabla.locator('tbody tr').count(),10);
    for(let n=1;n<=10;n++) {
      const fila=tabla.locator('tbody tr').nth(n-1);
      assert.equal(await fila.locator('th').textContent(),niveles[n-1].nombre.replace(/^Nivel\s+\d+\s*[·:–-]\s*/i,''));
      assert.match(await fila.textContent(),new RegExp(`Publicada v7.*Revisión ${12+n}`));
      assert.match(await fila.locator('th').evaluate(el=>getComputedStyle(el).fontFamily),/Silkscreen/);
      assert.equal(await fila.getByRole('button',{name:'Editar',exact:true}).getAttribute('data-editar-nivel'),String(n));
    }
    const medidas=await tabla.evaluate(el=>({tabla:el.getBoundingClientRect().toJSON(),
      ancho:document.documentElement.scrollWidth,alto:document.documentElement.scrollHeight,
      filas:[...el.tBodies[0].rows].map(f=>({celdas:[...f.cells].map(c=>c.getBoundingClientRect().toJSON()),boton:f.querySelector('button').getBoundingClientRect().toJSON()}))}));
    assert(medidas.ancho<=viewport.width+1,'La tabla no ensancha la página');
    if(viewport.width>=1280) {
      assert(medidas.tabla.bottom<=viewport.height,`Los diez niveles entran: ${medidas.tabla.bottom}/${viewport.height}`);
      assert(medidas.alto<=viewport.height+1,`No hace falta desplazamiento vertical: ${medidas.alto}/${viewport.height}`);
      assert.equal((await p.locator('.admin-menu').boundingBox()).width,menuAntes.width,'El menú conserva su ancho');
      assert.equal((await p.locator('.admin-senal-ferroviaria').boundingBox()).height,senalAntes.height,'La ilustración conserva su tamaño');
    }
    const primera=medidas.filas[0];
    for(const fila of medidas.filas) {
      assert.equal(fila.boton.width,primera.boton.width);
      assert.equal(fila.boton.height,primera.boton.height);
      fila.celdas.forEach((celda,i)=>assert.equal(celda.x,primera.celdas[i].x,'Columnas alineadas'));
    }
    if(process.env.METRONET_CAPTURAS_ADMIN)
      await p.screenshot({path:`${process.env.METRONET_CAPTURAS_ADMIN}/lista-niveles-${viewport.width}.png`,fullPage:true});
  });
}
