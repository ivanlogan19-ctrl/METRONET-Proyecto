const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(() => navegador?.close());
for (const ruta of ['/?idDiseno=77', '/simulacion.html?idDiseno=77']) {
 for (const width of [1440, 800, 390]) test(`Cerrar sesión encima de los controles: ${ruta}, ${width}px`, async t => {
  const v = await abrirPantalla(navegador, ruta, { viewport: { width, height: 900 }, responder: r => new URL(r.url()).pathname.startsWith('/auth/logout') ? { status: 204 } : undefined });
  t.after(() => v.contexto.close());
  const p = v.pagina;
  if (ruta.startsWith('/simulacion')) await p.locator('[data-oferta-tutorial]').getByRole('button', { name:'Continuar', exact:true }).click();
  await p.locator('.metronet-navegacion__usuario > summary').click();
  const boton = p.getByRole('button', { name: 'Cerrar sesión', exact: true });
  await boton.waitFor();
  const visible = await boton.evaluate(e => {
   const r = e.getBoundingClientRect();
   const puntos = [.2, .5, .8].flatMap(x => [.2, .5, .8].map(y => [r.x + r.width * x, r.y + r.height * y]));
   return { dentro: r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight,
    tapadoPor: puntos.map(([x, y]) => document.elementFromPoint(x, y)).filter(n => !e.contains(n)).map(n => n?.outerHTML.slice(0, 180)) };
  });
  assert.ok(visible.dentro, 'El botón entra completo en la pantalla');
  assert.deepEqual(visible.tapadoPor, [], 'Ningún icono intercepta el botón');
  await boton.click();
  await p.waitForURL('**/login.html');
  assert.ok(v.solicitudes.some(r => r.path.startsWith('/auth/logout') && r.method === 'POST'));
  assert.deepEqual(v.errores, []);
 });
}
