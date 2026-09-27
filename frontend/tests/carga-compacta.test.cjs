// Chrome real; API simulada y catálogo real de niveles/mensajes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const niveles = require('../src/educacion/niveles.json');
const catalogo = require('../src/educacion/mensajesTransicion.json');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir(t, viewport) {
  const vista = await abrirPantalla(navegador, '/escenarios.html', { viewport });
  t.after(async () => { await vista.contexto.close(); assert.deepEqual(vista.errores, []); });
  await vista.pagina.evaluate(async () => (await import('/src/audio/GestorMusica.js')).gestorMusica.establecerSilencio(true));
  await vista.pagina.clock.install();
  return vista.pagina;
}

async function cargar(p, nivel, indice) {
  await p.evaluate(async ({ nivel, indice }) => {
    window.cargaCompacta?.cerrar();
    const { crearPreparacionNivel } = await import('/src/educacion/PantallaPreparacionNivel.js');
    const aleatorio = Math.random;
    if (indice !== undefined) {
      // Permite recorrer cada mensaje del catálogo real, sin cambiar producción.
      sessionStorage.setItem(`metronet:transicion:ultimo:${nivel.numero}`, 'sin-seleccion-previa');
      Math.random = () => (indice + 0.1) / 3;
    }
    try { window.cargaCompacta = crearPreparacionNivel(nivel); }
    finally { Math.random = aleatorio; }
  }, { nivel, indice });
  await p.clock.runFor(700);
  await p.waitForFunction(() => getComputedStyle(document.querySelector('.metronet-viaje__consigna')).opacity === '1');
  return p.locator('.metronet-viaje');
}

async function verificar(dialogo, viewport, sinScroll) {
  assert.equal(await dialogo.locator('[data-concepto], [data-concepto-destacado], [aria-haspopup], [role=tooltip], [popover], dialog, .metronet-glosario-preparacion').count(), 0);
  assert.equal(await dialogo.locator('button').count(), 2, 'Solo Volver y Jugar');
  assert.equal(await dialogo.locator('[data-mensaje-id]').count(), 1);
  assert.equal(await dialogo.locator('.metronet-viaje__recorrido svg').count(), 1);
  assert.equal(await dialogo.getByRole('progressbar').count(), 1);
  assert.equal(await dialogo.locator('.metronet-viaje__consigna').count(), 1);
  const datos = await dialogo.evaluate(d => {
    const rect = d.getBoundingClientRect();
    const bloques = [...d.querySelectorAll('.metronet-viaje__cabecera, .metronet-viaje__recorrido, .metronet-viaje__progreso, .metronet-viaje__dato, .metronet-viaje__consigna, .metronet-viaje__pie')];
    return { alto: rect.height, ancho: rect.width, desbordeY: d.scrollHeight > d.clientHeight + 1, desbordeX: d.scrollWidth > d.clientWidth + 1,
      fuente: [...d.querySelectorAll('.metronet-viaje__informacion p')].map(e => parseFloat(getComputedStyle(e).fontSize)),
      visibles: bloques.every(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }),
      interiores: bloques.every(e => e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1),
      opacidad: getComputedStyle(d.querySelector('.metronet-viaje__consigna')).opacity,
    };
  });
  assert.ok(datos.alto <= viewport.height && datos.ancho <= viewport.width);
  assert.equal(datos.desbordeX, false);
  assert.ok(datos.fuente.every(f => f >= 15));
  assert.equal(datos.opacidad, '1');
  assert.equal(datos.interiores, true, 'No esconder ni recortar texto en los bloques');
  if (sinScroll) { assert.equal(datos.desbordeY, false); assert.equal(datos.visibles, true); }
  return datos;
}

for (const [width, height] of [[1366,768], [1440,900], [1920,1080], [1024,768], [768,1024], [390,844], [375,667], [320,568]]) {
  test(`Carga ${width}×${height}: niveles 1, 4, 6 y 10 compactos y sin glosario`, async t => {
    const viewport = { width, height }, p = await abrir(t, viewport);
    for (const numero of [1,4,6,10]) {
      const nivel = niveles.find(n => n.numero === numero);
      const mensajes = catalogo.find(n => n.numero === numero).mensajes;
      const indice = mensajes.reduce((mayor, m, i) => m.texto.length > mensajes[mayor].texto.length ? i : mayor, 0);
      const dialogo = await cargar(p, nivel, indice);
      const datos = await verificar(dialogo, viewport, width >= 768);
      assert.equal(await dialogo.locator('.metronet-viaje__consigna p').textContent(), nivel.objetivo);
      assert.equal(await dialogo.locator('[data-mensaje-id] p').textContent(), mensajes[indice].texto);
      const antes = await dialogo.locator('.recorrido-tren').getAttribute('transform');
      await p.clock.runFor(500);
      assert.notEqual(await dialogo.locator('.recorrido-tren').getAttribute('transform'), antes);
      if (process.env.METRONET_CARGA_CAPTURAS && [1,10].includes(numero)) {
        fs.mkdirSync(process.env.METRONET_CARGA_CAPTURAS, { recursive: true });
        const base = path.join(process.env.METRONET_CARGA_CAPTURAS, `nivel-${numero}-${width}x${height}`);
        await p.screenshot({ path: base + '.png' });
        fs.writeFileSync(base + '.json', JSON.stringify(datos, null, 2));
      }
    }
    await p.evaluate(() => cargaCompacta.cerrar());
  });
}

test('Los 30 mensajes reales entran a 1366×768 sin scroll, enlaces ni definiciones adicionales', async t => {
  const viewport = { width:1366, height:768 }, p = await abrir(t, viewport);
  for (const nivel of niveles) for (let i = 0; i < 3; i++) {
    const dialogo = await cargar(p, nivel, i);
    await verificar(dialogo, viewport, true);
    assert.equal(await dialogo.locator('[data-mensaje-id]').getAttribute('data-mensaje-id'), catalogo.find(n => n.numero === nivel.numero).mensajes[i].id);
    assert.equal(await dialogo.locator('.metronet-viaje__informacion a, .metronet-viaje__informacion button').count(), 0);
  }
  await p.evaluate(() => cargaCompacta.cerrar());
});

test('La recarga varía el mensaje y mantiene una sola consigna; Jugar/cancelación conservan el foco', async t => {
  const p = await abrir(t, {width:1366,height:768});
  for (const numero of [1,6,10]) {
    const nivel = niveles.find(n => n.numero === numero);
    const dialogo = await cargar(p, nivel);
    const anterior = await dialogo.locator('[data-mensaje-id]').getAttribute('data-mensaje-id');
    assert.equal(await dialogo.getByRole('button',{name:'Jugar',exact:true}).isDisabled(),true);
    await p.evaluate(() => { window.resultadoCarga = undefined; cargaCompacta.marcarDatosListos(); cargaCompacta.finalizada.then(valor => window.resultadoCarga = valor); });
    await p.clock.runFor(1);
    assert.equal(await p.evaluate(() => window.resultadoCarga), undefined);
    await dialogo.getByRole('button',{name:'Jugar',exact:true}).press('Enter');
    assert.equal(await p.evaluate(() => window.resultadoCarga), true);
    await cargar(p, nivel);
    assert.notEqual(await dialogo.locator('[data-mensaje-id]').getAttribute('data-mensaje-id'), anterior);
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('.metronet-viaje').count(), 0);
  }
});

test('Sin objetivo ni catálogo: no inserta instrucciones largas ni bloquea el acceso', async t => {
  const p = await abrir(t,{width:1366,height:768});
  const dialogo = await cargar(p, {numero:999,nombre:'Actividad externa',instrucciones:'Instrucción extensa. '.repeat(80)});
  await verificar(dialogo,{width:1366,height:768},true);
  assert.equal(await dialogo.locator('.metronet-viaje__consigna p').textContent(),'Explorá el mapa y revisá la consigna completa dentro del nivel.');
  await p.evaluate(() => { cargaCompacta.marcarDatosListos(); cargaCompacta.finalizada.then(valor => window.resultadoCarga = valor); });
  await p.clock.runFor(2800);
  assert.equal(await p.evaluate(() => window.resultadoCarga),undefined, 'La transición respeta la duración musical aun sin catálogo');
  await p.clock.runFor(12500);
  assert.equal(await p.evaluate(() => window.resultadoCarga),true);
});
