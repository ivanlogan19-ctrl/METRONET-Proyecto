# Selección individual de línea — 15/10/2026

## Alcance y estado

- DEFINIDO para este cambio por solicitud explícita: quitar «Todas las líneas» de los diez niveles y también de Modo Libre.
- IMPLEMENTADO: seleccionar una línea por vez, compartir UV/UT únicamente entre sus metros y conservar las otras líneas. El selector recupera la primera línea disponible ante una selección ausente y normaliza la selección de cualquier metro al representante de su línea.
- Se reutilizan el selector, los cálculos y el guardado por línea existentes. Sin botones nuevos, cambios de API, backend, esquema o base de uso. Escenarios personalizados sin vínculo automático mantienen su contrato previo de selección de metros.

## Archivos modificados

- `frontend/src/simulacion/PanelDesempeno.js`: menú sin selección conjunta cuando hay vínculo por línea.
- `frontend/src/simulacion/VinculoUvUtLibre.js`: normalización y protección frente a la selección conjunta.
- `frontend/src/simulacion/simulacion.js`: mantener selección individual al recargar y cambiar de línea.
- `frontend/src/educacion/TutorialSimulacion.js`: ayudas sin ajuste conjunto; práctica individual del nivel 8.
- `frontend/reglas.html`: selección de una línea por vez en todos los modos vinculados.
- `frontend/tests/seleccion-linea.test.cjs`: tres líneas de distintas distancias, varios metros y guardado/recarga en NIVEL, LIBRE y EDICION_LIBRE.
- `frontend/tests/vinculo-redondeo.test.cjs`: regresión de selección válida, vacía, eliminada y protección contra agrupación.
- `frontend/tests/reglas.test.cjs`: regla visible actualizada.
- `frontend/tests/tutorial-simulacion.test.cjs`: regla del mapa con selección individual.
- `frontend/tests/vinculo-uv-ut-e2e.test.cjs`: guardado, Play y Reiniciar por línea frente a API/PostgreSQL reales de pruebas.
- `frontend/tests/recorrido-integral-e2e.test.cjs`: selección explícita de una línea en el recorrido de campaña.
- Este informe de validación.

## Evidencia fresca

- `node --test frontend/tests/vinculo-redondeo.test.cjs`: 3/3, salida 0.
- Chrome: `seleccion-linea.test.cjs`, `tutorial-recorrido-integral.test.cjs`, `reglas.test.cjs`: 34/34, salida 0. Una primera ejecución detectó una aserción antigua que esperaba «Mixto» en Reglas; se actualizó a la regla solicitada y la suite completa pasó.
- Chrome: selección por nombre de los dos tutoriales de Modo Libre y la regla en `tutorial-simulacion.test.cjs`: 3/3, salida 0.
- `bash backend/scripts/probar-postgres.sh -Dtest=VinculoUvUtLibrePostgresTest -DfailIfNoTests=true`: 1/1 Java y 1/1 recorrido navegador/API/PostgreSQL, salida 0. Base aislada de pruebas.
- `npm --prefix frontend run build`: salida 0; continúa la advertencia de tamaño del paquete de Administración (570,28 kB).
- `git diff --check`: salida 0.

Chrome utilizó `METRONET_BROWSER_CHANNEL=chrome`, el runtime Playwright instalado y Vite en `127.0.0.1:5198`. Logs: `/tmp/metronet-seleccion-linea.log`, `/tmp/metronet-seleccion-regla.log`, `/tmp/metronet-seleccion-postgres.log`, `/tmp/metronet-vinculo-browser.log` y `/tmp/metronet-seleccion-build.log`.

## Límites

No se volvió a jugar la campaña completa de diez niveles contra PostgreSQL en este cambio. Se comprobaron la selección compartida por todos los niveles, sus tutoriales y el recorrido completo de Modo Libre. No se modificó el documento académico. La publicación en Git fue autorizada posteriormente por el usuario; se verifica el hash remoto después del push.


## Consignas y carteles por línea

- DEFINIDO por la solicitud posterior: citar cada línea cuando la consigna requiere varias y hacer coincidir el cartel de entrada con las metas. Rótulos simples «Línea 1», «Línea 2», etc.; sin «nombre inicial» ni «por crear».
- IMPLEMENTADO en presentación: `IndicacionesLineas.mjs` obtiene aclaraciones de las condiciones y reglas publicadas existentes. El editor conserva nombres personalizados y presenta los nombres automáticos sin ceros iniciales. No renombra entidades, crea criterios de evaluación ni reparte requisitos globales entre líneas sin una regla explícita.
- Se reutilizan `renderizarConsigna`, `crearPreparacionNivel`, las condiciones REST y el catálogo publicado. Los carteles de campaña actual amplían el ancho disponible para mostrar las aclaraciones manteniendo tamaño de ilustración y fuentes legibles; el recorrido antiguo conserva su presentación.
- Nivel 8: se enumeran ambas alternativas, dejando claro que se modifica sólo una línea. Nivel 10: se explicita el transbordo entre las dos líneas y la comparación de ejecuciones. Las demás líneas conservan su configuración al seleccionar otra.
- El caso de nivel 4 revisado requería cambiar manualmente UV: modificar UT y obtener otra UV automáticamente no acredita esa práctica. La evaluación de negocio no se modificó.

Archivos adicionales:

- `frontend/src/educacion/IndicacionesLineas.mjs`
- `frontend/src/educacion/indicaciones-lineas.css`
- `frontend/src/educacion/PantallaPreparacionNivel.js`
- `frontend/src/mapa/controles/EditorRedMetro.js`
- `frontend/tests/indicaciones-lineas.test.cjs`
- `frontend/tests/indicaciones-lineas-browser.test.cjs`

Validación de cierre:

- Unitarias `indicaciones-lineas.test.cjs` y `vinculo-redondeo.test.cjs`: 7/7, salida 0.
- Backend `./mvnw -Dtest=ComparacionLineasVinculadasTest test`, Java 21: 5/5, salida 0. Valida referencias manuales UV/UT y comparaciones por línea; no equivale a jugar la campaña.
- Build de frontend: salida 0; advertencia ya existente de tamaño del paquete Administración (570,28 kB).
- El cartel real de nivel 10 fue inspeccionado visualmente; la comprobación de los diez carteles publicados exige no tener desplazamiento vertical a 1366 × 768 y mantener Jugar habilitado al recibir datos.
- No se modificaron entidades, endpoints, esquema, puntuación, publicaciones de niveles en PostgreSQL ni el documento académico. La revisión completa de campaña con persistencia real no se repitió en este cierre.

- Chrome de cierre: `indicaciones-lineas-browser`, `carga-compacta`, `seleccion-linea`, `tutorial-recorrido-integral` y `reglas`: 49/49, salida 0. API simulada para estas suites; incluye los diez carteles publicados, nombres reales en editor y selección independiente. Log `/tmp/metronet-lineas-final-browser.log`.
- `git diff --check`: salida 0 antes del commit.
