# Interfaz en pantallas grandes y Safari — 23/10/2026

## Solicitud y alcance

Adaptar toda la interfaz a pantallas grandes conservando la composición y el funcionamiento del juego. Comprobar consentimiento y entrada a Modo Libre en Safari real, con música.

**IMPLEMENTADO:** ajuste de escala en el contenedor común de navegación. Aumenta textos, controles y mapa proporcionalmente por encima de la referencia de 1470 × 840 píxeles CSS. El factor usa la dimensión más restrictiva; en monitores ultrapanorámicos se conservan márgenes laterales para no recortar el contenido. Cambiar el tamaño no recarga el documento ni borra formularios.

No se modificaron reglas, partidas, persistencia, API, backend ni documento académico. No se modificaron las preferencias de música del usuario.

## Archivos

- `frontend/src/navegacion/EscalaInterfaz.js`: cálculo de escala y eventos de tamaño.
- `frontend/src/navegacion/ContenedorAplicacion.js`: integración en el marco común.
- `frontend/src/navegacion/contenedor.css`: ampliación nativa del marco.
- `frontend/tests/escala-interfaz.test.cjs`: tamaños, navegación, formularios y coordenadas del mapa.
- `frontend/tests/escala-interfaz-unidad.test.cjs`: agrupación de eventos y conservación del zoom con cambio de densidad.
- `frontend/tests/soporte/editor.cjs`: opción de probar el editor dentro del contenedor real.
- Este informe de evidencia.

## Comprobaciones ejecutadas

Se usaron perfiles y respuestas API de prueba, sin operaciones sobre diseños o usuarios reales. La salida de sonido se silenció únicamente en los entornos de prueba.

| Comprobación | Resultado |
| --- | --- |
| Chrome: escala, consentimiento, entrada Modo Libre y transición | 23/23, salida 0 |
| Firefox: escala, consentimiento y entrada Modo Libre | 16/16, salida 0 |
| Unidad: escala, zoom del usuario y eventos de tamaño | 1/1, salida 0 |
| Recorrido de 12 pantallas a 2560 × 1440 en Chrome | Sin desbordamiento horizontal/vertical ni errores JavaScript, salida 0 |
| Safari real: siete tarjetas con clics nativos | 7/7, salida 0 |
| Compilación del frontend | Salida 0 |
| Revisión de diferencias (`git diff --check`) | Salida 0 |

Tamaños de la prueba de escala: 1470 × 840, 1920 × 1080, 2560 × 1440, 3840 × 2160 y 3440 × 1440. En Chrome y Firefox se hicieron clics reales para crear estaciones a 2560 × 1440 y 3840 × 2160: las coordenadas geográficas coincidieron con las solicitadas. También se comprobó que redimensionar conserva el contenido del formulario y la instancia del documento.

El recorrido incluyó acceso, registro, consentimiento, inicio, niveles, aprendizaje, reglas, ranking, diseños, perfil, administración y simulación. Los datos de ese recorrido son fixtures: no certifica todos los estados posibles de cada pantalla.

Comandos reproducibles (Playwright instalado en `/private/tmp/metronet-compatibilidad-runtime/node_modules/playwright`):

```sh
METRONET_PLAYWRIGHT_PATH=/private/tmp/metronet-compatibilidad-runtime/node_modules/playwright METRONET_BROWSER_CHANNEL=chrome node --test --test-concurrency=1 --test-timeout=40000 frontend/tests/escala-interfaz.test.cjs frontend/tests/privacidad-layout.test.cjs frontend/tests/entrada-modo-libre.test.cjs frontend/tests/transicion-lista.test.cjs
METRONET_PLAYWRIGHT_PATH=/private/tmp/metronet-compatibilidad-runtime/node_modules/playwright METRONET_BROWSER=firefox METRONET_BROWSER_CHANNEL=moz-firefox node --test --test-concurrency=1 --test-timeout=40000 frontend/tests/escala-interfaz.test.cjs frontend/tests/privacidad-layout.test.cjs frontend/tests/entrada-modo-libre.test.cjs
node --test frontend/tests/escala-interfaz-unidad.test.cjs
npm --prefix frontend run build
git diff --check
```

La compilación conserva el aviso previo sobre atributos de importación inconsistentes de `catalogo-svgs-niveles.json`; no impide generar el frontend.

## Safari real

Safari 27.0.1 se ejecutó mediante SafariDriver, sin habilitar la excepción de reproducción automática. Se utilizó un proxy local aislado en 5188 que sirve los recursos actuales y sustituye las respuestas API por fixtures.

La prueba de audio conecta la salida a un analizador antes de una ganancia cero: verifica tiempo de reproducción, volumen, estado y muestras PCM distintas de cero sin emitir sonido en la Mac. No equivale a una escucha humana de los altavoces.

Se comprobó música en consentimiento (`portada-theme.m4a`), portada de Modo Libre y primera tarjeta (`modo-libre-theme.m4a`). Las capturas de consentimiento y portada se inspeccionaron sin deformaciones. El cuadro de portada quedó dentro del área visible (1440 × 848), sin errores JavaScript registrados.

Se verificó además la pista exacta `modo-libre-theme.m4a` mientras seguía presente la animación (tiempo 18,66 s, volumen 0,175, pico PCM 0,02194, sin error de audio). Continuar llevó a la portada y la misma pista siguió reproduciéndose (21,12 s, pico 0,01799). La portada conservó sus límites dentro de la ventana y no registró errores JavaScript.

El recorrido de las siete tarjetas se completó en una comprobación separada con clics nativos de SafariDriver: 7/7, salida 0. La pista seguía activa en las tarjetas (pico PCM 0,01104, sin error de audio). Se usaron clics nativos porque la primera automatización por coordenadas no abrió el botón de tarjetas; no fue necesario modificar el producto.

Las ejecuciones completas iniciales tuvieron interrupciones: Safari informó ventanas ocultas y METRONET pausó la música conforme a su comportamiento existente. La evidencia anterior corresponde a comprobaciones reales realizadas por etapas; no se presenta como una suite única e ininterrumpida. Una repetición adicional se canceló al volver a quedar oculta la ventana. No se alteraron las restricciones de reproducción ni el tratamiento de visibilidad para forzar un resultado.

## Límites de la evidencia

- Los tamaños grandes son áreas de navegador configuradas para las pruebas, no monitores físicos de cada resolución.
- No se certifica Safari real en un monitor físico 4K ni todas las preferencias de zoom del navegador.
- El ajuste se aplica a la navegación habitual mediante el contenedor. La ruta técnica directa con `documento=1` conserva su comportamiento anterior.
- No se reejecutaron pruebas de backend ni de persistencia: este cambio no toca esas capas.
- No se publicó esta adaptación en Git durante esta revisión.
