# Cálculo automático por línea: apertura y cambio de selección

## Estado y alcance

- DEFINIDO por el cambio formal aprobado y ratificado por el usuario: en Modo Libre, UT = km de la línea / UV y UV = km de la línea / UT. Todos los metros de una línea comparten la configuración; otras líneas son independientes. Los niveles 1–10 conservan su funcionamiento.
- IMPLEMENTADO previamente: distancia geográfica, UV inicial 4 al asignar un metro desde el editor, cálculo bidireccional, fracciones y persistencia común por línea mediante los campos existentes de `metro`.
- IMPLEMENTADO en esta corrección: Simulación abre seleccionando la primera línea con metro, de modo que ambos valores sean visibles. Al cambiar de línea se guarda primero el parámetro pendiente de la línea de origen; después se muestran los valores de destino. Guardar e iniciar siguen disponibles como antes.
- No se agregan controles, botones, iconos ni recuadros. No se cambian reglas de niveles, motor, esquema, endpoints ni documento académico.

## Flujo y causas reproducidas

La apertura seleccionaba «Todas las líneas», mostrando UT mixta cuando las longitudes eran diferentes. Además, `seleccionarUnidad` borraba `vinculoPendiente` antes de guardar: al editar UV/UT y elegir otra línea se perdía el cálculo visible.

Se reutilizan `guardarVinculoLibre`, los PATCH existentes, la recarga del servidor y su propagación transaccional por línea. El panel delega el cambio de selección al coordinador para que no sobrescriba los campos antes de guardar. Una selección repetida de la misma línea conserva la edición pendiente.

La configuración se sigue inicializando al asignar el primer metro. Una línea sin metros no tiene controles UV/UT operativos ni una configuración persistida propia: no se añadió almacenamiento por línea sin unidades en esta entrega.

## Evidencia fresca

- RED: `VinculoUvUtLibrePostgresTest` reprodujo la apertura con «todas» en lugar de la primera línea (`/tmp/metronet-auto-linea-rojo.log`, salida 1). Una segunda ejecución reprodujo la pérdida de UV al cambiar de línea (`/tmp/metronet-auto-cambio-linea-rojo.log`, salida 1).
- `METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=VinculoUvUtLibrePostgresTest,VinculoUvUtLibreTest,DistanciasRedServiceTest,ParametrosSimulacionTest,SimulacionServiceEstadoTest,EscalaSimulacionPostgresTest,CampanaPostgresTest -DfailIfNoTests=true`: **44 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0**. Registro `/tmp/metronet-auto-lineas-integracion.log`.
- Incluye **1 recorrido Chrome completo con API HTTP y PostgreSQL temporal reales**: dos líneas de longitud diferente, una de tres estaciones, tres metros, UV y UT al cambiar de selección, persistencia y recarga, independencia entre líneas, herencia, reasignación, concurrencia, modificación geográfica, ejecución y errores de validación. Captura inspeccionada `/tmp/metronet-vinculo-uvut-simulacion.png`.
- `METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright METRONET_BROWSER_CHANNEL=chrome METRONET_URL_PRUEBAS=http://127.0.0.1:5198 node --test frontend/tests/motor-velocidad.test.cjs frontend/tests/criterio-uv-ut.test.cjs`: **18 aprobadas, 0 fallos, 0 omitidas; salida 0**. Registro `/tmp/metronet-auto-lineas-frontend.log`. Los controles de niveles aquí utilizan respuestas preparadas, a diferencia del recorrido integrado anterior.
- `npm --prefix frontend run build`: **salida 0**. Aviso previo de paquete superior a 500 kB. Registro `/tmp/metronet-auto-lineas-build.log`.
- Instalación local, solo lectura: frontend 5173 sirve la selección inicial por línea y el guardado al cambiar con HTTP 200; backend 8080 responde HTTP 200; PostgreSQL confirma escala 8 en `metro.velocidad_promedio` y `metro.duracion_ut`. Las escrituras de prueba se realizaron únicamente en la base temporal.
- `git diff --check`: ejecutado después de escribir este informe.

## Archivos y límites

- `frontend/src/simulacion/simulacion.js`
- `frontend/src/simulacion/PanelDesempeno.js`
- `frontend/tests/vinculo-uv-ut-e2e.test.cjs`
- Este informe.

No se ejecutó toda la suite histórica, ni una partida completa de los diez niveles en navegador, ni Safari/Firefox. Se verificó la campaña mediante 26 pruebas de servidor/PostgreSQL y la regresión de unidades/históricos mediante 4. El documento académico no se modifica; su adenda pendiente sigue siendo la indicada en la auditoría original del vínculo UV/UT. No se crearon commits ni se publicó esta corrección durante esta entrega.
