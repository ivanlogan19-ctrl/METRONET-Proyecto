# Correcciones de conexiones y consignas — 23/10/2026

> Registro histórico v9. La aclaración posterior sustituye la fusión por prolongación sin mover estaciones: ver [revisión v10](conexiones-sin-desplazar-estaciones-2026-10-23.md).

## Alcance y estado

- DEFINIDO: el documento académico conserva su versión previa y requiere actualización autorizada.
- Cambio formal aprobado por el usuario: conexiones en estaciones, sin vía, metro ni UV/UT propios. Aclaraciones posteriores: Línea no depende del orden de los clics; Conexión permite fusionar estaciones de líneas existentes y también trazar una nueva línea pasando por una estación de otra.
- IMPLEMENTADO en esta revisión: ambas formas de conexión, prolongación bidireccional desde un extremo y catálogo v9, comprobados y publicados en el servidor local.
- El documento académico no se modifica. Queda pendiente incorporar la distinción entre estación individual y conexión, y el conteo de las estaciones integradas.

## Comportamiento

1. Línea: libre → extremo y extremo → libre prolongan la misma línea. Tras prolongar, la siguiente estación continúa desde el extremo nuevo. Para unir líneas distintas se usa Conexión.
2. Conexión con líneas existentes: la primera estación se integra en la segunda ubicación. Se sustituyen sus referencias dentro de su línea; no se agrega un tramo. Cada línea conserva nombre, color, trenes y UV/UT. Una estación ya compartida se puede usar como destino; no se fusiona como origen una estación que afectaría silenciosamente a otras líneas.
3. Conexión al trazar: estación libre → estación de otra línea crea una línea nueva y marca la conexión. Otro clic en una estación libre continúa esa misma línea. La creación del primer tramo y la conexión se guardan en una única transacción.
4. Una conexión no requiere que ambas líneas continúen: admite cruce, T y extremos.
5. Las metas v9 reconocen las estaciones integradas en conexiones. Para no contar dos veces un mismo par, se cuentan membresías distintas de líneas por punto de conexión, no simplemente el número de conexiones. El conteo se activa explícitamente en el catálogo nuevo; no reinterpreta resultados completados.

## Consignas v9

Todas conservan cinco metas. POI sin cambios; conexiones desde N4, POI desde N6.

| Nivel | Estaciones antes de fusionar | Estaciones por línea | Conexiones |
|---|---:|---|---:|
| 1 | 2 | 2 | 0 |
| 2 | 3 | 3 | 0 |
| 3 | 4 | 2, 2 | 0 |
| 4 | 5 | 3, 2 | 1 |
| 5 | 8 | 3, 3, 2 | 2 |
| 6 | 9 | 4, 3, 2 | 2 |
| 7 | 10 | 4, 4, 2 | 2 |
| 8 | 11 | 4, 4, 3 | 2 |
| 9 | 13 | 4, 4, 3, 2 | 3 |
| 10 | 16 | 5, 4, 4, 3 | 3 |

Las soluciones de referencia rodean el puerto en N10; no se desactiva la validación geográfica para aceptarlas. Las historias no incluyen cantidades contradictorias y mantienen su hilo narrativo.

## Capas, datos y compatibilidad

Frontend: interacción y tutoriales. Backend: reglas de conexión, conteo y publicación; repositorios para escritura transaccional. Se conserva Phaser/JavaScript, Spring/Java 25 y PostgreSQL. Sin nuevas dependencias, endpoints ni cambios de esquema en esta revisión.

El endpoint de conexiones admite que la línea de origen sea nueva cuando la primera estación está libre; nombres existentes no se reutilizan para unir redes ajenas. Fusionar una estación sí modifica la geometría solicitada por el jugador y retira el punto individual absorbido. No se fusionan automáticamente diseños anteriores.

Los intentos v7/v8 abiertos de la campaña actual, sin contrato UV/UT histórico, adoptan las consignas nuevas con archivo del contrato previo y respaldo local. Los intentos de campañas anteriores y los completados se conservan, al igual que puntajes y desbloqueos. La primera copia archivada de un intento no se sobrescribe; el respaldo previo a la publicación conserva también su estado v8.

La corrección previa de líneas vacías elimina únicamente filas sin estaciones, tramos, metros ni conexiones al guardar o editar. No retira trenes de una línea real. El color de las líneas numeradas permanece estable cuando desaparece una fila vacía.

## Archivos de esta revisión

- `frontend/src/mapa/controles/CreacionDirecta.js`
- `frontend/src/educacion/recorrido-integral.json`
- `frontend/src/educacion/{TutorialInicial,RecorridoInicial,PanelTutorialInicial,AyudaContextual,FuncionesCampana}.js`
- `frontend/src/educacion/glosario/Conceptos.js`
- `backend/src/main/java/com/metronet/backend/service/{ConexionesLineasService,JuegoEducativoService,MetasRecorrido,RecorridoIntegralService}.java`
- `backend/src/main/java/com/metronet/backend/repository/{ConexionesLineasRepository,JuegoEducativoRepository,RecorridoIntegralRepository}.java`
- Pruebas de conexiones, catálogo, tutoriales, campaña integral y soporte del editor; pruebas Java de conexiones y publicación del recorrido.

## Límites de verificación

No se observa ni manipula la ventana personal de Firefox. Las pruebas de navegador usan sesiones aisladas y sin sonido. No se verifica Safari ni se publica Git en esta revisión. Los resultados previos del informe de estaciones compartidas corresponden a la versión anterior; no sustituyen las comprobaciones actuales.

## Verificación de esta revisión

- Pruebas de catálogo, motor y paleta: 46 aprobadas, 0 fallos, 0 omitidas (`/tmp/metronet-catalogo-fusion-node-final.log`).
- Editor y tutoriales: 39 aprobadas en Chrome y 39 en Firefox, sin fallos ni omisiones (`/tmp/metronet-fusion-editor-chrome-final.log`, `/tmp/metronet-fusion-editor-firefox-final.log`).
- Java 25/PostgreSQL aislado: `ConexionesLineasServiceTest`, `ConexionesLineasPostgresTest`, `RecorridoIntegralPostgresTest` y `MatrizPuntuacionRecorridoPostgresTest`: 29 aprobadas, 0 fallos, 0 errores, 0 omitidas; salida 0 (`/tmp/metronet-fusion-catalogo-final.log`). Incluye adopción de intentos v7/v8, conservación de completados, conteo tras fusionar y puntuaciones de los diez niveles.
- Compilación frontend: salida 0, 3,93 segundos (`/tmp/metronet-fusion-build-final.log`).
- Primera campaña Firefox: niveles 1–9 aprobados con 100 puntos y reapertura comprobada; N10 quedó bloqueado antes de simular porque la colocación de los metros no cubría todas las líneas. La prueba se reforzó para verificar la línea de cada metro inmediatamente después del clic y utilizar un segmento más separado. La campaña completa se repite; este intento no se considera aprobado.

- Repetición completa Firefox + backend Java 25 + PostgreSQL aislado: diez niveles aprobados con 100 puntos, guardado y reapertura de cada red, metas, POI, UV/UT y puntajes conservados, acceso final a Modo Libre. 11 comprobaciones de navegador aprobadas (diez niveles y campaña), 0 fallos/omisiones; prueba Java envolvente 1/1, salida 0. Duración Maven 6:39 minutos (`/tmp/metronet-fusion-campana-firefox-final.log`, `/tmp/metronet-fusion-campana-firefox-browser-final.log`). La selección de un segmento más separado resolvió el clic incorrecto del ensayo anterior; no se debilitó la exigencia de un metro por línea.

## Publicación local y conservación de datos

- Respaldo PostgreSQL completo antes de publicar: `.local/respaldos/consignas-fusion-v9.AsXVW5/metronet.dump`. `pg_dump` y lectura del índice mediante `pg_restore -l`: salida 0. No se ensayó restaurar este respaldo.
- Arranque local con Java 25 después de empaquetar el código actual. El publicador validó y publicó los diez niveles v9 a las 20:00 del 23/10/2026 (`/tmp/metronet-fusion-v9-local.log`). Sin migración ni cambio de esquema adicional en esta revisión.
- SQL confirma las diez cantidades de la tabla anterior. El intento actual #822, nivel 5/campaña 50, adoptó v9. Los tres intentos abiertos de la campaña 49 mantienen v8 deliberadamente.
- Comparación antes/después: idénticos usuarios, intentos salvo su vínculo de publicación, simulaciones, diseños, estaciones, líneas, paradas, tramos, metros y conexiones. Huellas y consulta en el directorio del respaldo; `diff` salida 0. El contrato educativo del intento actual sí cambia intencionalmente.
- Frontend `/escenarios.html` y backend `/api/estado`: HTTP 200. La partida abierta requiere recargar la pantalla para leer el contrato nuevo.

El alcance anterior no equivale a ejecutar toda la suite del repositorio ni la campaña completa en Chrome. Chrome sí pasó las 39 comprobaciones de editor y tutoriales citadas. El documento académico sigue pendiente y no se creó commit ni se publicó Git.
