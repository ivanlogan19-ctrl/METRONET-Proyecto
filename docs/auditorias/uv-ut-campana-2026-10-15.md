# UV/UT automáticas por línea en los diez niveles — 2026-10-15

## Estado y autorización

- DEFINIDO por la confirmación formal y aprobación posterior del usuario: extender a los diez niveles la relación automática por distancia y por línea que existía en Modo Libre, sincronizar la animación y adaptar consignas, evaluación, tutoriales, tarjetas y Reglas, sin controles adicionales.
- IMPLEMENTADO en esta entrega: extensión del cálculo existente, publicación `integral-2026-10-lineas-automaticas-v4` y evaluación didáctica versionada `UV_KM_UT_LINEA_V4`.
- El documento académico `Documento METRONET.docx` no se editó. Debe incorporarse allí esta decisión aprobada al actualizar los requerimientos de simulación. Esta nota complementa y sustituye el alcance exclusivo de Modo Libre descrito en la auditoría del 13 de octubre; no reescribe aquella evidencia histórica.

## Comportamiento

Cada línea comienza con 1 UV al agregar su primer metro. Sus metros comparten UV, UT y el último parámetro elegido. Las otras líneas conservan sus valores. Se reutilizan los campos y controles existentes.

- UV elegida: UT = distancia geográfica de la línea / UV.
- UT elegida: UV = distancia geográfica de la línea / UT.
- Presentación: hasta dos decimales. Cálculo y persistencia: hasta ocho decimales; el valor derivado se redondea hacia arriba para no detenerse antes del extremo.
- Cambiar la geometría recalcula el parámetro dependiente. Guardar no sustituye la precisión interna por el número redondeado visible.
- El motor compartido avanza por kilómetros con el tiempo simulado. Cada línea llega según su propio tiempo; el reloj común acaba con la mayor duración. Una línea corta puede terminar antes que otra y permanecer en su terminal.

La evaluación registra qué parámetro eligió el jugador. El recálculo dependiente no acredita una segunda acción. El nivel 4 practica UV y UT en una línea con dos metros; el nivel 8 practica el ajuste de una línea sin alterar las demás. Las comparaciones V4 no reinterpretan las instantáneas V1/V2/V3.

## Capas, datos y compatibilidad

- Frontend: selector y controles existentes usan el vínculo por línea también en la campaña; textos y tutoriales explican la misma relación.
- Negocio: cálculo por línea, validación fraccionaria, comparación de ejecuciones, referencias de publicación y lectura de resultados históricos.
- Persistencia: sin tablas, columnas ni migraciones nuevas. Se reutiliza NUMERIC(18,8), la referencia UV/UT y las instantáneas JSON existentes.
- REST: mismas rutas. El detalle de simulación agrega `vinculoUvUtPorLinea` para que la interfaz respete el alcance decidido por el servidor. Nuevas ejecuciones devuelven escala `UV_KM_UT_LINEA_V4`; los registros anteriores conservan su escala.
- Escenarios personalizados posteriores a los diez niveles conservan su contrato anterior.
- Publicación explícita mediante el servicio existente, con validación transaccional de los diez recorridos. Actualiza las siete tarjetas de cada nivel conservando su contenido e imágenes, con la explicación proporcional en la tarjeta de aplicación.
- Intentos activos del recorrido canónico v3 reciben las consignas nuevas conservando diseño, puntos y simulaciones. Las publicaciones anteriores y los intentos completados permanecen intactos. No se convierten silenciosamente intentos de catálogos anteriores o personalizados.

## Archivos de implementación

Backend (`backend/src/main/java/com/metronet/backend/`):

- `dto/SimulacionDetalleResponse.java`
- `service/VinculoUvUtLibre.java`, `ParametrosSimulacion.java`, `SimulacionService.java`
- `service/ComparacionLineasVinculadas.java`, `RegistroSimulacionDidactica.java`, `PuntuacionService.java`, `CriterioUvUtService.java`
- `service/RecorridoIntegralService.java`, `ValidacionPublicacionNivelService.java`

Frontend:

- `frontend/src/simulacion/VinculoUvUtLibre.js`, `simulacion.js`
- `frontend/src/educacion/FuncionesCampana.js`, `TutorialSimulacion.js`, `recorrido-integral.json`, `catalogo-svgs-niveles.json`
- `frontend/reglas.html`

Pruebas nuevas: `ComparacionLineasVinculadasTest.java`, `VinculoUvUtNivelesPostgresTest.java`. Pruebas adaptadas: publicación/recorrido, matriz de puntuación, escala, vínculo, campaña de navegador, tutorial y Reglas. El detalle completo de archivos está en el commit de esta entrega.

## Evidencia ejecutada

Todos los clústeres de prueba PostgreSQL fueron temporales y eliminados al terminar. Chrome utilizó Vite en 127.0.0.1:5198 y la API real del servidor de pruebas para las dos pruebas integradas.

| Comprobación | Resultado |
| --- | --- |
| `bash backend/scripts/probar-postgres.sh -Dtest=VinculoUvUtNivelesPostgresTest,RecorridoIntegralPostgresTest,MatrizPuntuacionRecorridoPostgresTest,ComparacionLineasVinculadasTest,VinculoUvUtLibreTest,PuntuacionServiceTest,VinculoUvUtLibrePostgresTest,EscalaSimulacionPostgresTest,ParametrosSimulacionTest,SimulacionControllerTest,SimulacionServiceEstadoTest -DfailIfNoTests=true` | 49 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0 |
| `METRONET_E2E_RECORRIDO=true bash backend/scripts/probar-postgres.sh -Dtest=RecorridoIntegralE2EPostgresTest,ComparacionLineasVinculadasTest -DfailIfNoTests=true` | 6 pruebas Java; salida 0. El recorrido Chrome incluido aprobó los diez niveles, premios, tarjetas y acceso a Modo Libre: 11 comprobaciones, 0 fallos |
| `node --test frontend/tests/motor-velocidad.test.cjs frontend/tests/vinculo-redondeo.test.cjs` | 17/17; salida 0 |
| `node --test frontend/tests/tutorial-recorrido-integral.test.cjs frontend/tests/reglas.test.cjs` | 31/31; salida 0. Incluye tamaños de escritorio y móvil; utiliza datos preparados |
| `npm --prefix frontend run build` | Salida 0; advertencia de chunk de Administración de 570,28 kB |
| Empaquetado backend mediante `iniciar-local.sh` | Salida 0; servidor actualizado arrancado |

Los fallos iniciales fueron corregidos antes de estas comprobaciones: texto largo en Reglas, almacenamiento esperado por la prueba de tutorial y nombre de pestaña anterior en la prueba de Modo Libre. El recorrido de campaña se ejecutó antes de los últimos ajustes de texto/compatibilidad; estos se comprobaron con las suites posteriores y el build.

Registros locales: `/tmp/metronet-campana-aceptacion.log`, `/tmp/metronet-campana-e2e.log`, `/tmp/metronet-recorrido-browser.log`, `/tmp/metronet-motor-check.log`, `/tmp/metronet-tutorial-reglas-check2.log`, `/tmp/metronet-campana-frontend-build.log`.

## Instalación local y límites

Se respaldó la base en `.local/respaldos/antes-uv-ut-campana-20261015.dump`, fuera de Git, y se comprobó su índice con `pg_restore --list`. La cuenta restringida de la aplicación no podía leer una secuencia para el respaldo completo; se utilizó la cuenta propietaria local sin modificar permisos.

Se reinició METRONET y se publicaron las diez versiones mediante `METRONET_RECORRIDO_PUBLICAR=true METRONET_RECORRIDO_ADMINISTRADOR=2 npm start`. PostgreSQL confirmó las diez versiones V4 y 70 tarjetas publicadas. No había intentos de campaña activos en esta instalación antes de publicar. El frontend responde en 127.0.0.1:5173.

No se probó Safari/Firefox ni se jugó manualmente con la cuenta personal del usuario. No se afirma haber ejecutado toda la suite del repositorio. No se verificó la restauración completa del respaldo en otra instalación. No se cambió el esquema ni se añadieron controles.
