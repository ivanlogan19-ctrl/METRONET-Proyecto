# Reglas por pestañas y publicación de ajustes por línea

## Estado y alcance

- DEFINIDO: se conservan la política vigente de puntuación y las equivalencias aprobadas de Modo Libre. Esta entrega no modifica las reglas de negocio ni el documento académico.
- IMPLEMENTADO: los cinco diseños de consulta aprobados por el usuario, con pestañas Puntuación, Cómo aprobar, Acciones, Modo Libre y Ranking. Se mantienen las fuentes Silkscreen, la navegación global y las hojas animadas junto al título (60 × 72 px en escritorio). El contenido extenso de descuentos y configuración por línea permanece disponible en desplegables.
- IMPLEMENTADO y publicado junto a esta entrega: la corrección pendiente de apertura y cambio de línea descrita en `seleccion-calculo-por-linea-2026-10-14.md`. Ese informe documenta su validación previa; la presente entrega incorpora una comprobación integrada nueva antes de publicarla.
- PROPUESTO: no quedan alternativas visuales pendientes dentro del alcance aprobado.

## Cambios

- Navegación de pestañas con ratón y teclado: flechas, Inicio y Fin; selección, foco y relaciones ARIA sincronizados.
- Tarjetas, tablas y ejemplos con tipografía pixelada. Estado activo legible incluso al pasar el puntero.
- Las cinco vistas caben, con detalles cerrados, en 1440 × 900, 1470 × 800 y 1366 × 768. En 390 y 320 px se apilan sin desbordamiento horizontal. Se conserva el desplazamiento vertical necesario en móvil y al abrir información ampliada.
- Las ilustraciones del título conservan su tamaño y quedan separadas de la sombra del menú. Se respeta la preferencia de movimiento reducido.
- Simulación de Modo Libre abre con una línea concreta y guarda sus ajustes UV/UT pendientes antes de mostrar otra; no mezcla las distancias entre líneas. La configuración continúa inicializándose al asignar el primer metro, sin crear persistencia para líneas sin unidades.
- Se actualizaron comprobaciones antiguas que omitían el tutorial de Simulación y una respuesta preparada del guardado de duración; no se alteró la aplicación para satisfacer esos supuestos antiguos.

## Archivos modificados

- `frontend/reglas.html`
- `frontend/src/educacion/reglas.css`
- `frontend/src/educacion/reglas.js`
- `frontend/src/simulacion/PanelDesempeno.js`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/reglas.test.cjs`
- `frontend/tests/puntuacion-ranking.test.cjs`
- `frontend/tests/calles-modo-libre-e2e.test.cjs` (nombre actualizado de la cabecera de Reglas)
- `frontend/tests/vinculo-uv-ut-e2e.test.cjs`
- `docs/auditorias/seleccion-calculo-por-linea-2026-10-14.md`
- Este informe.

## Validación ejecutada

Las pruebas Chrome utilizan `METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright` y `METRONET_BROWSER_CHANNEL=chrome`. Las de interfaz con respuestas preparadas utilizan además `METRONET_URL_PRUEBAS=http://127.0.0.1:5198`.

1. RED: la prueba de navegación por pestañas falló antes de implementar la interfaz, al no existir Puntuación. Salida **1**, registro `/tmp/metronet-reglas-pestanas-red.log`.
2. `node --experimental-vm-modules --test --test-concurrency=2 frontend/tests/reglas.test.cjs frontend/tests/puntuacion-ranking.test.cjs frontend/tests/resultado-nivel.test.cjs frontend/tests/navegacion-estable.test.cjs frontend/tests/musica-nueva-asignacion.test.cjs frontend/tests/motor-velocidad.test.cjs frontend/tests/criterio-uv-ut.test.cjs`: **60 pruebas aprobadas, 0 fallos, 0 omitidas; salida 0**. Registro `/tmp/metronet-reglas-publicacion-final-frontend.log`.
3. Después del último ajuste de márgenes, `node --test frontend/tests/reglas.test.cjs`: **12 pruebas aprobadas, 0 fallos, 0 omitidas; salida 0**. Incluye ambos roles, cinco tamaños, ausencia de desplazamiento en escritorio con detalles cerrados, teclado y movimiento reducido. Registro `/tmp/metronet-reglas-validacion-cierre.log`.
4. `bash backend/scripts/probar-postgres.sh -Dtest=VinculoUvUtLibrePostgresTest,VinculoUvUtLibreTest,DistanciasRedServiceTest,ParametrosSimulacionTest,SimulacionServiceEstadoTest,EscalaSimulacionPostgresTest,CampanaPostgresTest,PoliticaPuntuacionTest,PuntuacionServiceTest,PuntuacionDescuentosPostgresTest -DfailIfNoTests=true`: **66 pruebas aprobadas, 0 fallos, 0 errores, 0 omitidas; salida 0**. Registro `/tmp/metronet-reglas-publicacion-final-integracion.log`.
5. Esa ejecución incluye **un recorrido Chrome con servidor HTTP y PostgreSQL reales**, sin respuestas preparadas: inicio de sesión, las cinco pestañas de Reglas, regreso a Inicio, dos líneas de distancias diferentes, tres metros, guardado y recarga de UV/UT e independencia entre líneas. La base temporal se elimina al terminar; no se escriben datos de prueba en la base personal.
6. `npm --prefix frontend run build`: **salida 0**, después del último cambio de CSS. Registro `/tmp/metronet-reglas-build-cierre.log`. Persiste el aviso de un paquete de Administración mayor de 500 kB, fuera de esta modificación.
7. Capturas de las cinco pestañas en 1470 × 800 y de Modo Libre en 390 × 900, revisadas visualmente. Archivos `/tmp/metronet-reglas-cierre-0.png` a `-4.png` y `/tmp/metronet-reglas-cierre-movil.png`.
8. `git diff --check`: se ejecuta tras escribir este informe y antes de publicar.

## Capas y límites

Cambios de presentación, coordinación del frontend, pruebas y auditorías. Sin cambios de esquema, migraciones, endpoints, código del servidor ni documento académico.

No se ejecutó toda la suite histórica, la prueba completa de capas/calles (sólo se actualizó su expectativa del título), una partida manual completa de los diez niveles ni Safari/Firefox. La campaña y la puntuación sí se comprobaron mediante las pruebas de servidor y PostgreSQL indicadas. Las capturas de presentación utilizan una cuenta preparada; el recorrido integrado usa una sesión real de prueba independiente.
