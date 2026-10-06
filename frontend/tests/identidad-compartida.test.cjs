const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.METRONET_PLAYWRIGHT_PATH || 'playwright');
const { abrirPantalla } = require('./soporte/pantallas.cjs');
const { abrirEditor } = require('./soporte/editor.cjs');
let navegador;
before(async () => { navegador = await chromium.launch({ headless: true, channel: process.env.METRONET_BROWSER_CHANNEL }); });
after(async () => { await navegador?.close(); });

async function abrir(t, ruta, opciones) {
  const pantalla = ruta === 'constructor' ? await abrirEditor(navegador, opciones) : await abrirPantalla(navegador, ruta, opciones);
  t.after(async () => { await pantalla.contexto.close(); assert.deepEqual(pantalla.errores, []); });
  return pantalla.pagina;
}
async function estilo(elemento, propiedades) {
  return elemento.evaluate((e, claves) => {
    const css = getComputedStyle(e);
    return Object.fromEntries(claves.map(clave => [clave, css[clave]]));
  }, propiedades);
}
const aspecto = ['backgroundColor', 'color', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'boxShadow', 'fontFamily'];
function contraste(texto, fondo) {
  const luminancia = color => {
    const canales = color.match(/[\d.]+/g).slice(0, 3).map(n => Number(n) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
    return canales[0] * .2126 + canales[1] * .7152 + canales[2] * .0722;
  };
  const a = luminancia(texto), b = luminancia(fondo);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('acciones primarias y campos comparten identidad entre acceso, perfil, administración y simulación', async t => {
  let primario, campo, etiqueta;
  for (const [ruta, boton, entrada] of [
    ['/login.html', '#loginButton', '#email'],
    ['/perfil.html', '#guardarDatosPersonales', '#nombre'],
    ['/admin.html', '.admin-guardar', '.admin-filtros input'],
    ['/simulacion.html?idDiseno=77', '.simulacion-primario', '#duracionSimulacion'],
  ]) {
    const pagina = await abrir(t, ruta);
    const actual = await estilo(pagina.locator(boton).first(), aspecto);
    const actualCampo = await estilo(pagina.locator(entrada).first(), aspecto);
    primario ??= actual; campo ??= actualCampo;
    assert.deepEqual(actual, primario, `Acción primaria en ${ruta}`);
    if (ruta === '/admin.html') {
      const { fontFamily: fuenteAdmin, ...restoAdmin } = actualCampo;
      const { fontFamily: _fuenteBase, ...restoBase } = campo;
      assert.match(fuenteAdmin, /Silkscreen/);
      assert.deepEqual(restoAdmin, restoBase, `Campo en ${ruta}`);
    } else assert.deepEqual(actualCampo, campo, `Campo en ${ruta}`);
    assert.ok(contraste(actual.color, actual.backgroundColor) >= 4.5, `Texto de botón en ${ruta}`);
    assert.ok(contraste(actualCampo.color, actualCampo.backgroundColor) >= 4.5, `Texto de campo en ${ruta}`);
    if (ruta !== '/admin.html') assert.doesNotMatch(actualCampo.fontFamily, /Silkscreen/);
    if (ruta.startsWith('/simulacion.html')) {
      assert.equal(await pagina.locator(entrada).getAttribute('aria-label'), 'Duración simulada en horas');
      assert.equal(await pagina.locator('[data-icono-duracion] svg').count(), 1);
      continue; // El control operacional tiene icono y nombre accesible, no una etiqueta de formulario extensa.
    }
    const actualEtiqueta = await pagina.locator(entrada).first().evaluate(e => {
      const css = getComputedStyle(e.labels[0]);
      return Object.fromEntries(['color', 'fontFamily', 'fontSize', 'fontWeight'].map(clave => [clave, css[clave]]));
    });
    etiqueta ??= actualEtiqueta;
    if (ruta === '/admin.html') {
      const { fontFamily: fuenteAdmin, ...restoAdmin } = actualEtiqueta;
      const { fontFamily: _fuenteBase, ...restoBase } = etiqueta;
      assert.match(fuenteAdmin, /Silkscreen/);
      assert.deepEqual(restoAdmin, restoBase, `Etiqueta en ${ruta}`);
    } else assert.deepEqual(actualEtiqueta, etiqueta, `Etiqueta en ${ruta}`);
  }
});

test('hover, foco y pulsación son distinguibles; controles deshabilitados conservan legibilidad', async t => {
  const pagina = await abrir(t, '/login.html');
  const boton = pagina.locator('#loginButton');
  const normal = await estilo(boton, aspecto);
  await boton.hover();
  await pagina.waitForFunction(fondo => getComputedStyle(document.querySelector('#loginButton')).backgroundColor !== fondo, normal.backgroundColor);
  const caja = await boton.boundingBox();
  await pagina.mouse.move(caja.x + 5, caja.y + 5);
  await pagina.mouse.down();
  await pagina.waitForFunction(sombra => getComputedStyle(document.querySelector('#loginButton')).boxShadow !== sombra, normal.boxShadow);
  await pagina.mouse.move(1, 1); await pagina.mouse.up();
  await pagina.locator('#email').focus(); await pagina.keyboard.press('Tab');
  const foco = await estilo(pagina.locator('#password'), ['outlineWidth', 'outlineStyle', 'outlineColor']);
  assert.equal(foco.outlineStyle, 'solid'); assert.ok(parseFloat(foco.outlineWidth) >= 2);
  const simulacion = await abrir(t, '/simulacion.html?idDiseno=77');
  const pausa = simulacion.locator('#pausarSimulacion');
  assert.equal(await pausa.isDisabled(), true);
  const inactivo = await estilo(pausa, [...aspecto, 'opacity', 'cursor']);
  assert.equal(inactivo.opacity, '1'); assert.equal(inactivo.cursor, 'not-allowed');
  assert.ok(contraste(inactivo.color, inactivo.backgroundColor) >= 4.5);
  const velocidad = simulacion.locator('[data-paso-ritmo="1"]');
  assert.notEqual((await estilo(velocidad, aspecto)).borderTopColor, inactivo.borderTopColor);
});

test('modales administrativos, educativos y de eliminación comparten marco y fondo', async t => {
  const admin = await abrir(t, '/admin.html');
  await admin.locator('[data-editar-usuario]').first().click();
  const propiedades = ['backgroundColor', 'color', 'borderRadius', 'borderTopWidth', 'boxShadow'];
  const marco = await estilo(admin.locator('#editorUsuario'), propiedades);
  assert.match((await estilo(admin.locator('#editorUsuario h2'), ['fontFamily'])).fontFamily, /Silkscreen/);
  const editor = await abrir(t, 'constructor');
  await editor.evaluate(()=>editorPrueba.seleccionarElemento({tipo:'estacion',valor:editorPrueba.disenoActual.estaciones[0]}));
  await editor.getByRole('button', { name: 'Eliminar elemento seleccionado' }).click();
  assert.deepEqual(await estilo(editor.locator('.metronet-dialogo-eliminar'), propiedades), marco);
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const niveles = await abrir(t, '/escenarios.html', {
    responder: request => new URL(request.url()).pathname.endsWith('/iniciar')
      ? { json: { idDiseno: 77, idEscenario: 42, idIntento: 202 } } : null,
  });
  await niveles.clock.install();
  await niveles.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await niveles.locator('.metronet-viaje[open]').waitFor();
  assert.deepEqual(await estilo(niveles.locator('.metronet-viaje'), propiedades), marco);
});

test('notificaciones conservan el mismo marco con señales semánticas diferentes y cierre accesible', async t => {
  const pagina = await abrir(t, '/inicio.html');
  const colores = new Set(); let marco;
  for (const tipo of ['info', 'exito', 'advertencia', 'error']) {
    await pagina.evaluate(async tipo => {
      const { mostrarNotificacion } = await import('/src/componentes/NotificacionesMetronet.js');
      mostrarNotificacion(`Estado ${tipo}`, tipo);
    }, tipo);
    const aviso = pagina.locator('.metronet-notificacion');
    const actual = await estilo(aviso, ['backgroundColor', 'borderRadius', 'borderLeftWidth', 'boxShadow']);
    marco ??= actual; assert.deepEqual(actual, marco);
    colores.add((await estilo(aviso, ['borderLeftColor'])).borderLeftColor);
    assert.equal(await aviso.getAttribute('role'), tipo === 'error' ? 'alert' : 'status');
    await aviso.getByRole('button', { name: 'Cerrar notificación' }).click();
    assert.equal(await aviso.count(), 0);
  }
  assert.equal(colores.size, 4);
});

test('HUD Phaser utiliza los colores y la fuente de sistema compartidos con HTML', async t => {
  const pagina = await abrir(t, 'constructor');
  const resultado = await pagina.evaluate(async () => {
    const { COLORES_INTERFAZ_MAPA: colores, FUENTES_INTERFAZ_MAPA: fuentes } = await import('/src/mapa/configuracion/ColoresMapa.js');
    const css = getComputedStyle(document.documentElement);
    return { colores, fuente: fuentes.SISTEMA, fuenteHtml: css.getPropertyValue('--font-tecnica').trim(),
      fondo: css.getPropertyValue('--bg-primary').trim(), borde: css.getPropertyValue('--border').trim() };
  });
  assert.ok(Object.values(resultado.colores).every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffff));
  assert.equal(`#${resultado.colores.FONDO.toString(16).padStart(6, '0')}`, resultado.fondo);
  assert.equal(`#${resultado.colores.BORDE.toString(16).padStart(6, '0')}`, resultado.borde);
  assert.equal(resultado.fuente, resultado.fuenteHtml);
});
