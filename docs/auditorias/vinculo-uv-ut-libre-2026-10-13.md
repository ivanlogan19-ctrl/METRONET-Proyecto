# Vínculo UV/UT exclusivo de Modo Libre — 13/10/2026

## Estado y autorización

- DEFINIDO: se conserva la equivalencia previa de 1 UT = 1 hora y 1 UV = 1 km/UT.
- Cambio formal confirmado y alcance aprobado por el usuario: cálculo automático según la distancia geográfica de cada recorrido, duraciones fraccionarias y controles existentes. Exclusivamente Modo Libre; niveles 1–10 independientes.
- IMPLEMENTADO: cálculo, previsualización, validación REST, persistencia, simulación, explicación en Administración y pasos del tutorial.
- El documento académico principal no fue modificado. Su adenda funcional/modelo/API debe incorporar este cambio aprobado; este registro conserva la trazabilidad.

## Comportamiento

Al elegir UV, UT = km de la línea / UV. Al elegir UT, UV = km de la línea / UT. El servidor usa DistanciasRedService (la misma cartografía y distancias geográficas de la regla). No usa píxeles, el total de otras líneas ni tráfico para alterar la velocidad.

En la primera versión (commit 3e8051a), cada metro guardaba su última referencia UV o UT. Al cambiar geometría o asignación se recalcula el valor dependiente. Todos los metros aplica el valor elegido al conjunto, calculando el dependiente por línea; la pantalla muestra MIXTO si corresponde. La selección individual conserva los otros metros.

El cambio se previsualiza al escribir y se persiste con los botones existentes de guardar o al iniciar la simulación. No se añadieron botones, iconos ni recuadros. Las líneas incompletas/desconectadas/bifurcadas no reciben una duración inventada; la validación estructural impide simular redes inválidas. Los GET no escriben datos.

Se conservan hasta ocho decimales, redondeando hacia arriba únicamente el valor dependiente para no detener la unidad antes de llegar por truncamiento. El reloj común termina con la mayor UT asignada. Las instantáneas históricas no se recalculan. Los diseños libres antiguos toman UV como referencia inicial.

## Persistencia y contratos

Migración 023: metro.velocidad_promedio, metro.duracion_ut y simulacion.duracion admiten NUMERIC(18,8); metro.referencia_uv_ut almacena UV/UT. Sin borrar diseños, intentos o resultados. Aplicada en la instalación local, después de respaldo completo privado validado con pg_restore --list.

Sin endpoints nuevos. PATCH /api/simulaciones/{id}/unidades/{idTren} admite parametroReferencia opcional (UV/UT) y duracionUt decimal sólo en Modo Libre. Los DTO de consulta/ejecución preservan decimales. Niveles siguen rechazando UT fraccionarias y conservan su validación de UV.

Capas afectadas: presentación y motor JavaScript, DTO/contratos, servicios de simulación y lecturas de evaluación, PostgreSQL y pruebas. Sin cambios de arquitectura.

## Evidencia fresca

- backend/scripts/probar-postgres.sh -Dtest=VinculoUvUtLibrePostgresTest,CampanaPostgresTest,VinculoUvUtLibreTest,DistanciasRedServiceTest,ParametrosSimulacionTest,SimulacionServiceEstadoTest,VerificadorEsquemaUvUtTest,EscalaSimulacionPostgresTest -DfailIfNoTests=true: **45 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0**. PostgreSQL temporal real, migraciones completas. Registro /tmp/metronet-uvut-real-final2.log.
- VinculoUvUtLibrePostgresTest ejecutó Chrome contra servidor HTTP real y PostgreSQL: **1 prueba de navegador aprobada**. Selección individual/global, UV→UT, UT→UV, recarga, cambio geográfico, ejecución, errores 400 y consulta directa de persistencia. Registro /tmp/metronet-vinculo-browser.log; captura /tmp/metronet-vinculo-uvut-simulacion.png.
- node --test frontend/tests/motor-velocidad.test.cjs frontend/tests/criterio-uv-ut.test.cjs: **17/17 aprobadas; salida 0**. Registro /tmp/metronet-uvut-front-final.log. Esta suite de controles usa respuestas preparadas; se distingue de la prueba integrada anterior.
- npm --prefix frontend run build: **salida 0**. Aviso existente de paquete grande; no error. Registro /tmp/metronet-uvut-build-final.log.
- Instalación local: migración comprobada en information_schema; arranque de frontend y backend actualizado; GET /api/estado devolvió 200 con mantenimiento=false y frontend 5173 devolvió 200. No se ejecutaron partidas destructivas sobre diseños del usuario.
- git diff --check: validado tras escribir este informe.

## Límites reales

No se ejecutó toda la suite histórica del repositorio ni una partida manual de cada nivel en el navegador. Sí se ejecutó CampanaPostgresTest completo (26 casos) y la regresión de unidades/históricos en PostgreSQL (4 casos). Las pruebas integradas usan una base aislada; en la base de uso cotidiano se verificaron migración y arranque. Publicación en Git autorizada posteriormente por el usuario; la verificación de ramas y hash se informa al completar la publicación.

## Referencia en Reglas

La página Reglas explica las fórmulas UV/UT, la distancia de cada línea, tiempos fraccionarios y la diferencia respecto de los niveles 1–10. Reutiliza la presentación existente.

Validación de esta ampliación: frontend/tests/reglas.test.cjs, 7/7 casos en Chrome (jugador/administrador a 1440, 390 y 320 píxeles y movimiento reducido), salida 0; compilación frontend y git diff --check correctos. La página local respondió HTTP 200 con ambas fórmulas; backend HTTP 200 y conexión PostgreSQL comprobados sin escribir datos.

## Archivos modificados

- `backend/src/main/java/com/metronet/backend/configuracion/VerificadorEsquemaUvUt.java`
- `backend/src/main/java/com/metronet/backend/dto/ActualizarUnidadMetroRequest.java`
- `backend/src/main/java/com/metronet/backend/dto/DesempenoNivelResponse.java`
- `backend/src/main/java/com/metronet/backend/dto/EjecutarSimulacionRequest.java`
- `backend/src/main/java/com/metronet/backend/dto/HorasSimuladasDeserializer.java`
- `backend/src/main/java/com/metronet/backend/dto/ResultadoSimulacionResponse.java`
- `backend/src/main/java/com/metronet/backend/dto/UnidadMetroSimulacionResponse.java`
- `backend/src/main/java/com/metronet/backend/service/CriterioUvUtService.java`
- `backend/src/main/java/com/metronet/backend/service/JuegoEducativoService.java`
- `backend/src/main/java/com/metronet/backend/service/ParametrosSimulacion.java`
- `backend/src/main/java/com/metronet/backend/service/PuntuacionService.java`
- `backend/src/main/java/com/metronet/backend/service/SimulacionService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/CampanaPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/EscalaSimulacionPostgresTest.java`
- `frontend/admin.html`
- `frontend/reglas.html`
- `frontend/src/educacion/TutorialSimulacion.js`
- `frontend/src/simulacion/EscalaSimulacion.js`
- `frontend/src/simulacion/MotorSimulacion.js`
- `frontend/src/simulacion/PanelDesempeno.js`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/criterio-uv-ut.test.cjs`
- `frontend/tests/motor-velocidad.test.cjs`
- `backend/src/main/java/com/metronet/backend/service/VinculoUvUtLibre.java`
- `backend/src/test/java/com/metronet/backend/configuracion/VinculoUvUtLibrePostgresTest.java`
- `backend/src/test/java/com/metronet/backend/service/VinculoUvUtLibreTest.java`
- `database/023_vinculo_uv_ut_libre.sql`
- `frontend/src/simulacion/VinculoUvUtLibre.js`
- `frontend/tests/vinculo-uv-ut-e2e.test.cjs`
- `docs/auditorias/vinculo-uv-ut-libre-2026-10-13.md`


## Aclaración adoptada: configuración común por línea

Decisión explícita posterior del usuario: «Una configuración común por línea». IMPLEMENTADO sólo en Modo Libre: todos los metros de una línea comparten UV, UT y su última referencia. Cada línea usa su propia longitud; cambiar una no cambia las otras. El selector existente ofrece una opción por línea y «Todas las líneas», sin controles adicionales. Las opciones de niveles 1–10 conservan su funcionamiento por metro.

El servidor propaga la configuración dentro de la línea en la misma transacción. Los metros nuevos heredan la configuración existente y los reasignados heredan la de destino. La capacidad permanece individual. Cambiar la geometría recalcula el valor dependiente. En diseños anteriores con valores distintos dentro de una línea se toma el metro de menor id como referencia común; el siguiente cambio o ejecución la persiste. Los GET no escriben y las instantáneas históricas no se alteran.

Persistencia: se reutilizan los campos de metro de la migración 023; sin nuevas tablas, columnas ni migraciones. Los contratos y rutas REST existentes se conservan, con alcance de actualización por línea únicamente en Modo Libre. Reglas, Administración y tutorial explican este alcance. El documento académico no fue editado.

### Verificación de este ajuste y la corrección de Extras

- RED: Chrome con API y PostgreSQL reprodujo que un metro nuevo recibía 9 UV en una línea de 4 UV y que un diseño nuevo no ofrecía Extras. Registro `/tmp/metronet-lineas-extras-red.log`.
- `METRONET_E2E_EXTRAS=true ... bash backend/scripts/probar-postgres.sh -Dtest=ExtrasModoLibrePostgresTest,VinculoUvUtLibrePostgresTest,CampanaPostgresTest,VinculoUvUtLibreTest,DistanciasRedServiceTest,ParametrosSimulacionTest,SimulacionServiceEstadoTest,EscalaSimulacionPostgresTest -DfailIfNoTests=true`: **46 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0**. Registro `/tmp/metronet-lineas-extras-validado.log`.
- Las pruebas anteriores incluyen **3 recorridos Chrome + API HTTP real + PostgreSQL temporal real**: bienvenida antes del tutorial, borrado/recreación, campaña nueva, persistencia de siete visitas y premio único; dos metros en L01 y otro en L02, configuración común, independencia entre líneas, cambio de línea, herencia, concurrencia, recarga, cambio geográfico y ejecución fraccionaria. Registros `/tmp/metronet-extras-browser.log` y `/tmp/metronet-vinculo-browser.log`.
- La prueba temporal de campaña ahora crea el registro padre de cada diseño, antes de sus intentos: permite comprobar el bloqueo transaccional sin depender de una referencia inexistente en el fixture. Las reglas de los niveles no se modifican.
- `node --test frontend/tests/motor-velocidad.test.cjs frontend/tests/criterio-uv-ut.test.cjs frontend/tests/reglas.test.cjs`: **24/24, salida 0**. Registro `/tmp/metronet-lineas-front.log`. Los controles aislados usan respuestas preparadas; las tres pruebas integradas anteriores usan el servidor real.
- `npm --prefix frontend run build`: **salida 0**, con el aviso conocido de tamaño del paquete. Registro `/tmp/metronet-lineas-build.log`.
- Arranque local actualizado con `npm start`; backend conectado a PostgreSQL 17.10. Registro `/tmp/metronet-arranque-lineas-extras.log`.
- Límites: no se ejecutó la totalidad de la suite histórica ni una partida manual de cada nivel. La campaña tiene regresión de servidor/PostgreSQL. Las partidas de prueba usan una base temporal que se elimina, no los diseños personales del usuario. No se verificaron otros navegadores.

### Archivos de esta entrega

- Backend: `service/SimulacionService.java`, `service/VinculoUvUtLibre.java`.
- Pruebas backend: `configuracion/CampanaPostgresTest.java`, `configuracion/VinculoUvUtLibrePostgresTest.java`.
- Frontend: `admin.html`, `reglas.html`, `src/educacion/PanelAyudaContextual.js`, `src/educacion/TutorialSimulacion.js`, `src/educacion/extras/PresentacionExtras.js`, `src/mapa/controles/EditorRedMetro.js`, `src/simulacion/PanelDesempeno.js`, `src/simulacion/VinculoUvUtLibre.js`, `src/simulacion/simulacion.js`.
- Pruebas frontend: `tests/extras-modo-libre-e2e.test.cjs`, `tests/vinculo-uv-ut-e2e.test.cjs`.
- Trazabilidad: este archivo y `docs/auditorias/extras-modo-libre-2026-10-13.md`.
