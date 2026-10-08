# Validación de puntuación en los diez niveles — 2026-10-08

## Alcance y estado

- **DEFINIDO:** evaluación del cumplimiento del escenario y registro del resultado. El Documento METRONET académico se conserva sin modificaciones.
- **IMPLEMENTADO:** política aprobada de 100 puntos iniciales, descuentos de 10 por ejecución sin objetivos nuevos después de las prácticas gratuitas, tope de 40, consigna completa y mínimo de 60 para aprobar. Esta pasada no modifica el cálculo, los cupos, el catálogo ni la persistencia.
- **PROPUESTO, no adoptado:** quitar el cupo de prácticas gratuitas y evaluar el avance desde la primera ejecución. También se está considerando una acción explícita «Finalizar red», separada de Guardar progreso y Simular, para solicitar la comprobación y el cierre del nivel. Ninguna de estas alternativas forma parte de los cambios publicados en esta pasada.

La solicitud es comprobar los cinco puntajes finales posibles, el avance al siguiente nivel y el reinicio de puntos del siguiente intento. Las correcciones de presentación incluyen la página Reglas, los avisos al guardar y la ficha por Metro.

## Matriz de aprobación

`MatrizPuntuacionRecorridoPostgresTest` ejecuta cinco campañas completas mediante Services reales contra PostgreSQL temporal. Construye redes, registra simulaciones, provoca descuentos y completa las consignas usando la referencia publicada; no asigna puntos, progreso o aprobación mediante SQL.

| Nivel | Puntajes finales comprobados |
| --- | --- |
| 1 | 100 |
| 2–10, cada uno | 100, 90, 80, 70, 60 |

Son 50 cierres de nivel y 46 combinaciones distintas. En el nivel 1, una red que satisface el mínimo para simular cumple su consigna en la primera ejecución válida. No se alteraron sus reglas para fabricar penalizaciones que ese flujo no permite.

Se comprueba además:

- Tener puntos suficientes con objetivos pendientes no aprueba ni desbloquea el siguiente nivel.
- Cada ejecución penalizada descuenta una sola vez, con motivos registrados.
- Al llegar a 60 se puede seguir practicando sin más descuentos y completar el nivel.
- Cumplir nuevos objetivos conserva el puntaje; guardar y reevaluar no duplican descuentos.
- El siguiente nivel comienza con 100 puntos, sin ejecuciones ni descuentos heredados.
- Los diez niveles completados habilitan Modo Libre y conservan los puntos persistidos.

## Evidencia de esta pasada

- Matriz PostgreSQL: 5 casos parametrizados aprobados, 50 cierres verificados.
- Pruebas de política y descuentos: 7 casos aprobados.
- Chrome, Reglas y ventana de resultado: 14 casos aprobados, sin omisiones, salida 0. Incluyen roles, anchos 1440/390/320, cabecera fija, teclado y movimiento reducido.
- Recorrido integral Chrome → REST real → PostgreSQL: 11/11 (campaña y diez niveles), sin errores de página ni respuestas REST fallidas. Puntajes por nivel: **100, 90, 80, 70, 100, 100, 100, 60, 90, 60**; suma persistida **850**. Acceso final a Modo Libre comprobado. Duración de navegador: 881,56 s.
- Corrida combinada de backend: **13 pruebas, 0 fallos, 0 errores, 0 omitidas, salida 0**. Incluye matriz, política, descuentos y el recorrido de navegador anterior.
- Build de producción después de los últimos cambios visuales: **salida 0**, 5,64 s, sin warnings nuevos.
- Ajustes finales de interfaz: **130/130, 0 fallos, 0 omitidas, salida 0**, en Chrome. Incluyen Guardar en los diez niveles sin aviso de puntuación, objetivos conservados, ficha por Metro a 1440/390, controles y parámetros, Reglas, resultado, cancelaciones, victoria y navegación posterior. Duración: 297,28 s.
- Inspección visual de las capturas de la ficha: nivel centrado, nombre de línea sin duplicación y datos UV/UT legibles a 1440 y 390 px. Capturas fuera del repositorio.
- `git diff --check`: salida 0 después del informe final y antes de los commits.

Las primeras ejecuciones del recorrido detectaron dos problemas del test: una expectativa de texto anterior al nuevo modal y una lectura prematura del iframe entrante. Se corrigieron las esperas y la comprobación del texto visible. La prueba aislada del modal también necesitaba esperar su apertura asíncrona antes de abortar o abrir el siguiente. No se cambió código de producción para resolver esas carreras del fixture.

## Límites

La matriz de servicios cubre todos los puntajes posibles por nivel. El navegador recorre una campaña con los cinco puntajes, no las 46 combinaciones visualmente. Ese recorrido terminó antes de los últimos ajustes de presentación del aviso al guardar y la ficha por Metro; estos se verifican por separado con pruebas de navegador y API interceptada. PostgreSQL y los usuarios son temporales; no se modifican los datos del usuario de desarrollo. No se ejecutó toda la suite del sistema ni Safari/Firefox en esta pasada. No hay script de lint en `frontend/package.json`.

No hay cambios de esquema, entidades, relaciones, endpoints, reglas de negocio ni dependencias. Capturas, logs y respaldos locales permanecen fuera de Git. Se excluyen también los documentos y vistas previas ajenos a esta tarea que ya estaban sin seguimiento.

## Presentación y archivos afectados

- `frontend/reglas.html`, `frontend/src/educacion/reglas.css` y `frontend/src/educacion/reglas.js`: reglas actuales sin explicación de modelos anteriores, jerarquía más clara y dos hojas decorativas que se escriben al entrar; título y hojas permanecen fijos al desplazarse. Movimiento reducido conserva el dibujo sin animación.
- `frontend/src/mapa/controles/EditorRedMetro.js`: se retira el aviso genérico de puntuación después de Guardar. Se conservan la confirmación de guardado, la evaluación, los objetivos y el resultado final.
- `frontend/src/simulacion/PanelDesempeno.js` y `frontend/src/simulacion/simulacion.css`: una sola identificación de línea por Metro y encabezado del nivel centrado. Se conservan UV/UT y selección.
- `frontend/tests/reglas.test.cjs`, `resultado-nivel.test.cjs`, `recorrido-integral-e2e.test.cjs`, `interaccion-directa.test.cjs`, `ayuda-contextual-interfaz.test.cjs` y `simulacion-operacional.test.cjs`: regresiones afectadas.
- `backend/src/test/java/com/metronet/backend/configuracion/MatrizPuntuacionRecorridoPostgresTest.java` y `RecorridoIntegralE2EPostgresTest.java`: matriz de puntajes y verificación persistida del recorrido completo.
- Este informe operativo. No se modifica documentación académica oficial.

## Comandos

Con Vite activo en 127.0.0.1:5198 y Playwright disponible mediante `METRONET_PLAYWRIGHT_PATH`:

```sh
METRONET_E2E_RECORRIDO=true METRONET_BROWSER_CHANNEL=chrome \
  bash backend/scripts/probar-postgres.sh \
  -Dtest=RecorridoIntegralE2EPostgresTest,MatrizPuntuacionRecorridoPostgresTest,PoliticaPuntuacionTest,PuntuacionDescuentosPostgresTest

METRONET_URL_PRUEBAS=http://127.0.0.1:5198 METRONET_BROWSER_CHANNEL=chrome \
  node --experimental-vm-modules --test --test-timeout=90000 --test-concurrency=2 \
  frontend/tests/{interaccion-directa,ayuda-contextual-interfaz,simulacion-operacional,criterio-uv-ut,resultado-nivel,reglas,cancelacion-celebracion,victoria-nivel}.test.cjs

npm --prefix frontend run build
git diff --check
```
