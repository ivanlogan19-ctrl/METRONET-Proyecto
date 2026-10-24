# Entrada de Modo Libre — 23 de octubre de 2026

## Alcance y estado

IMPLEMENTADO por solicitud aprobada del usuario: integrar la tarjeta y el túnel de la propuesta visual, permitir omitir el viaje, conservar la estética pixelada y publicar la versión revisada. No se redefine la arquitectura ni el modelo funcional del Documento METRONET.

- Entrada de 4,2 segundos: tren sobre los rieles, letrero «ESTACIÓN / MODO LIBRE» con alternancia de luminosidad y botón Continuar azul. Escape también permite omitirla.
- Movimiento reducido: acceso directo a la tarjeta, sin túnel ni parpadeo.
- Subtítulo definitivo: «Nuevas herramientas para llevar tu red a la próxima estación.»
- Siete temas de igual tamaño, colores diferenciados, nombres centrados y en negrita, iconos existentes de 32 px; acciones inferiores de igual tamaño.
- Eliminado el cartel pequeño «MODO LIBRE» anterior a la animación. Se conservan los carteles de los diez niveles y la celebración al completar la campaña.
- Música continua de animación, portada y siete tarjetas: `05-Wyald.mp3`, normalizada a −22 dBFS, con bucle de 189,72 segundos y unión de un segundo. Continuar omite únicamente la animación: no corta ni reinicia la pista. Al salir de las tarjetas se restaura el contexto musical de la pantalla. La duración visual de 4,2 segundos es independiente de la reproducción y se pausa al ocultar la pestaña. La selección inicial de Extra fue reemplazada antes de publicar, siguiendo la corrección del usuario. Procedencia y hashes en el manifiesto de audio.
- Privacidad/consentimiento usa la pista Portada del acceso y su control de volumen/silencio. Continúa dentro del contenedor y al volver al registro.
- La cobertura explícita de navegación ya no puede ser retirada por el primer render pendiente. Evita mostrar el mapa mientras se espera la presentación.
- Los botones de navegación de las siete tarjetas interiores disponen de ancho suficiente para «Finalizar recorrido» en Firefox.

## Capas y datos

Presentación, navegación y audio del frontend. Se reutilizan el gestor musical, sus preferencias, el diálogo de Extras, el registro de lecturas y los contratos existentes. Sin cambios de endpoints, esquema, migraciones o datos reales. Documento académico no modificado.

Se incluyen las dos pruebas pendientes de una línea de veinte estaciones, previamente solicitadas: recorrido visual y guardado/reapertura en PostgreSQL aislado. No se agregó un límite de estaciones ni se modificó la lógica de construcción.

## Verificación

Comando de navegador (se ejecuta con `METRONET_PLAYWRIGHT_PATH` configurado):

```sh
node --test --test-concurrency=1 --test-timeout=60000 --test-name-pattern='Modo Libre|Modo libre|Continuar omite|animación finaliza|Movimiento reducido|Abortar la entrada|Wyald acompaña|privacidad.html|Navegar entre formularios|Consentimiento dentro|Cambio de pantalla|Entrada al editor|Destino HTML|Editor: la lectura|veinte estaciones' frontend/tests/entrada-modo-libre.test.cjs frontend/tests/ranking-extras-layout.test.cjs frontend/tests/transicion-lista.test.cjs frontend/tests/musica-autenticacion.test.cjs frontend/tests/lineas-conexiones.test.cjs
```

Chrome: `METRONET_BROWSER_CHANNEL=chrome`. Firefox oficial: `METRONET_BROWSER=firefox METRONET_BROWSER_CHANNEL=moz-firefox`.

Las pruebas cubren omisión, final automático, cancelación, movimiento reducido, reproducción continua del audio real por las siete tarjetas y liberación al finalizar, silencio, navegación de Registro a Privacidad y retorno, las siete tarjetas en 1280×720, 1470×745 y 1920×1080, navegación lenta/fallida y mapa cubierto durante la entrada. Salida de audio de las pruebas silenciada; no cambia las preferencias de la sesión del usuario.

Resultados finales:

- Chrome: **19/19**, cero fallos, salida 0; registro local `/tmp/metronet-libre-chrome-publicacion.log`.
- Firefox oficial 158.0.1: **19/19**, cero fallos, salida 0; registro local `/tmp/metronet-libre-firefox-publicacion.log`.
- `npm --prefix frontend run build`: salida 0; registro `/tmp/metronet-libre-build-publicacion.log`.
- `bash backend/scripts/probar-postgres.sh -Dtest=ConexionesLineasPostgresTest#extenderMasDeOchoEstacionesConservaUnaLineaCompletaAlGuardar`: **1/1**, cero fallos/errores, salida 0; `/tmp/metronet-libre-postgres.log`.
- `git diff --check`, `node --check frontend/tests/entrada-modo-libre.test.cjs` y `node --check frontend/public/transicion-pagina.js`: salida 0.
- Inspección visual de tarjeta y túnel renderizados; recurso musical AAC de 189,72 s comprobado y reproducido mediante el motor real del navegador, sin salida audible durante QA.
- Backend local: `/api/health` devuelve `UP` y `database: CONNECTED`; frontend local sirve el consentimiento actualizado.

Límites: pruebas de navegador con respuestas HTTP controladas; persistencia real comprobada únicamente en PostgreSQL aislado mediante la prueba indicada. No se ejecutó una campaña completa contra cuentas reales, ni la suite integral, ni Safari en esta entrega. La suite `extras-modo-libre-e2e.test.cjs` conserva sus selectores actualizados pero no se ejecutó contra base real. Permanece el aviso previo de Vite sobre atributos de importación inconsistentes de `catalogo-svgs-niveles.json`; no impide la compilación y no fue alterado por este cambio. El sonido fue verificado técnicamente; la preferencia musical sigue siendo una valoración del usuario.

## Archivos modificados

- `backend/src/test/java/com/metronet/backend/configuracion/ConexionesLineasPostgresTest.java`
- `docs/auditorias/entrada-modo-libre-2026-10-23.md`
- `frontend/privacidad.html`
- `frontend/public/audio/modo-libre-theme.m4a`
- `frontend/public/audio/musica-manifiesto.json`
- `frontend/public/transicion-pagina.js`
- `frontend/src/audio/AudioAutenticacion.js`
- `frontend/src/audio/ConfiguracionAudio.js`
- `frontend/src/educacion/IdentificacionNivel.js`
- `frontend/src/educacion/extras/BienvenidaModoLibre.js`
- `frontend/src/educacion/extras/DibujoEntradaModoLibre.js`
- `frontend/src/educacion/extras/EntradaModoLibre.js`
- `frontend/src/educacion/extras/PresentacionExtras.js`
- `frontend/src/educacion/extras/bienvenida-modo-libre.css`
- `frontend/src/educacion/extras/entrada-modo-libre.css`
- `frontend/src/educacion/extras/extras.css`
- `frontend/src/interfaz/pestanas.css`
- `frontend/tests/entrada-modo-libre.test.cjs`
- `frontend/tests/extras-modo-libre-e2e.test.cjs`
- `frontend/tests/identificacion-nivel.test.cjs`
- `frontend/tests/lineas-conexiones.test.cjs`
- `frontend/tests/musica-autenticacion.test.cjs`
- `frontend/tests/ranking-extras-layout.test.cjs`
- `frontend/tests/transicion-lista.test.cjs`
