const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { build, preview } = require('vite');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');

let navegador, servidor, directorio, origen;
const urlAnterior = process.env.METRONET_URL_PRUEBAS;
before(async () => {
  // Probar el artefacto publicado: Vite puede fusionar scripts async/defer
  // aunque el servidor de desarrollo los ejecute de forma independiente.
  directorio = await fs.mkdtemp(path.join(os.tmpdir(), 'metronet-audio-build-'));
  const opciones = { root: path.resolve(__dirname, '..'), logLevel: 'error', build: { outDir: directorio, emptyOutDir: true } };
  await build(opciones);
  servidor = await preview({ ...opciones, preview: { host: '127.0.0.1', port: 0, open: false } });
  origen = `http://127.0.0.1:${servidor.httpServer.address().port}`;
  process.env.METRONET_URL_PRUEBAS = origen;
  navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL,
    args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => {
  await navegador?.close();
  await new Promise(resolve => servidor ? servidor.httpServer.close(resolve) : resolve());
  if (directorio) await fs.rm(directorio, { recursive: true, force: true });
  if (urlAnterior === undefined) delete process.env.METRONET_URL_PRUEBAS;
  else process.env.METRONET_URL_PRUEBAS = urlAnterior;
});

for (const cargaLenta of ['pantalla', 'estilos']) {
  test(`Build publicado: reanuda la música aunque siga pendiente la carga de ${cargaLenta}`, async t => {
    const { contexto, pagina, errores } = await abrirPantalla(navegador, '/inicio.html');
    t.after(async () => { await contexto.close(); assert.deepEqual(errores, []); });
    await pagina.waitForFunction(() => document.querySelector('audio')?.volume === .35 && !document.querySelector('audio').paused);
    await pagina.locator('audio').evaluate(audio => { audio.currentTime = 3; });
    let liberar;
    const pendiente = new Promise(resolve => { liberar = resolve; });
    const patron = cargaLenta === 'pantalla' ? /\/assets\/escenarios-[^/]+\.js$/ : /\.css$/;
    await pagina.route(patron, async ruta => { await pendiente; await ruta.continue(); });
    try {
      await pagina.goto(`${origen}/escenarios.html`, { waitUntil: 'commit' });
      await pagina.waitForFunction(() => {
        const audio = document.querySelector('audio');
        return audio && !audio.paused && audio.currentTime >= 3 && audio.volume === .35;
      // CSS pendiente impide pintar: consultar audio sin depender de RAF.
      }, null, { timeout: 5000, polling: 50 });
      assert.equal(await pagina.locator('script[async][src*="reanudacionMusica-"]').count(), 1);
      assert.equal(await pagina.locator('.metronet-navegacion').count(), 0);
      await pagina.evaluate(() => { window.audioTemprano = document.querySelector('audio'); });
    } catch (error) {
      const estado = await pagina.evaluate(() => {
        const gestor = window[Symbol.for('metronet:gestor-musica')];
        return { documento: document.readyState, oculto: document.hidden, audio: gestor?.obtenerEstado(),
          continuidad: Boolean(gestor?.continuidad), inicializado: gestor?.inicializado };
      });
      throw new Error(`${error.message}\nEstado del audio: ${JSON.stringify(estado)}`, { cause: error });
    } finally { liberar(); }
    await pagina.waitForLoadState('load');
    await pagina.locator('.metronet-escenarios-pagina__tarjeta').first().waitFor();
    assert.equal(await pagina.evaluate(() => audioTemprano === document.querySelector('audio')), true);
    assert.equal(await pagina.locator('audio').count(), 1);
  });
}

test('Build publicado: primer render del editor completo y HUD educativo sin reflow', async t => {
  const { contexto, pagina:p, errores } = await abrirPantalla(navegador, '/', { responder:req=>new URL(req.url()).pathname==='/api/juego/escenarios'?{json:[]}:null });
  t.after(async()=>{await contexto.close();assert.deepEqual(errores,[]);});
  await p.locator('.metronet-hud>summary').waitFor();
  await p.waitForFunction(()=>{const m=document.querySelector('#metronet-mapa'),c=m.querySelector('canvas');return c&&Math.abs(c.height-m.getBoundingClientRect().height)<3;});
  const medidas=()=>p.evaluate(()=>Object.fromEntries(['#metronet-aplicacion','#metronet-mapa','.metronet-navegacion'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{y:r.y,h:r.height}];})));
  const antes=await medidas();assert.equal(antes['#metronet-aplicacion'].y+antes['#metronet-aplicacion'].h,1000);
  await p.locator('.metronet-hud>summary').click();await p.locator('.metronet-hud__panel').waitFor();assert.deepEqual(await medidas(),antes);
  assert.equal(await p.locator('script[type="module"][blocking="render"]').count(),1);
  assert.equal(await p.locator('script[async][blocking="render"]').count(),0);
  await p.keyboard.press('Escape');await p.locator('.metronet-poi>summary').click();
  const lupa=p.getByRole('button',{name:'Buscar punto de interés',exact:true});assert.deepEqual(await lupa.evaluate(e=>{const r=e.getBoundingClientRect();return[r.width,r.height]}),[44,44]);
});
