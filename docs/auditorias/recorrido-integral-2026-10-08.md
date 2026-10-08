# Verificación del recorrido integral de METRONET — 8 de octubre de 2026

## Alcance y estado

- **DEFINIDO:** se conserva la arquitectura cliente-servidor por capas, Phaser/JavaScript, API REST, PostgreSQL y el modelo vigente. La instrucción de rediseño de los diez niveles declara el cambio formal aprobado para ejecución.
- **IMPLEMENTADO:** catálogo `integral-2026-10`, publicación explícita mediante borradores/validación/versiones existentes, todos los niveles con Editor y Simulación, tutoriales incrementales y selección corregida. Las comparaciones usan ejecuciones guardadas, según la decisión del usuario.
- **PROPUESTO/PENDIENTE:** actualizar las secciones académicas de progresión, consignas, tutoriales, capturas y pruebas de aceptación. No se modificó el Documento METRONET ni se redefinió silenciosamente su contenido.

Este informe es evidencia técnica de la tarea, no una sustitución del documento académico. El catálogo histórico `niveles.json` se conserva para compatibilidad; `recorrido-integral.json` es la fuente única del nuevo recorrido y también se empaqueta como recurso backend.

## Inventario de herramientas y tutoriales

| Herramienta | Primera presentación | Interacción y evidencia real | Evaluación |
|---|---:|---|---|
| Mapa / Selección | 1 | Cámara, elección de objetos; recorrido de pantalla | Controles de presentación, sin puntaje artificial |
| Estación | 1 | Seleccionar herramienta → clic válido → estación confirmada | Cantidad y ubicación persistidas |
| Línea / Conexión | 1 | Dos estaciones crean primera vía; Conexión extiende la línea | Tramos, continuidad y red válida |
| Metro | 1 | Clic sobre vía → asignación persistida | Cantidad; desde 7, al menos uno por línea |
| Guardar | 1 | PUT de guardado, validación y consigna actualizada | No completa las reglas de simulación |
| Simular / Play | 1 | Preflight estructural → pantalla → Play manual → ejecución terminada | Ejecución real, evaluación y persistencia |
| Pause / Stop / Restart / Ritmo | 1 | Coach marks; controles propios de reproducción | No alteran UV ni horas por abrirlos |
| UV | 2 | Ejecución base → aplicar UV distinta → ejecutar | Comparación de ejecuciones guardadas |
| Horas simuladas | 3 | Ejecución base → aplicar horas distintas → ejecutar | Comparación, manteniendo UV |
| Todas / unidad individual | 4 | Aplicar global y ejecutar; seleccionar unidad, aplicar y ejecutar | Se comprueban ambos ajustes por ejecuciones |
| POI / búsqueda / cobertura | 5 | Estrella → lupa → Palacio Legislativo → localizar → estación en radio | Catálogo real y distancia geométrica compartida |
| Transbordo | 7 | Dos líneas comparten una estación real | Pertenencia/conexión entre líneas, no cruce decorativo |
| Comparar configuraciones | 9 | A → UV + horas → B | No basta con modificar un input |

Las prácticas no ofrecen Siguiente para simular una acción: observan estado confirmado del editor y eventos posteriores a guardado/ejecución. Se ofrecen en 1, 5 y 7 en Edición, y en 1, 2, 3, 4 y 9 en Simulación. El resto reutiliza controles; la ayuda manual y Pista siguen disponibles. El conteo de intentos se limita a usuario + nivel + campaña. Reiniciar campaña permite volver a presentar la introducción, conservando el histórico.

## Niveles publicados

### Nivel 1 — Primer recorrido (Inicial)

**Historia:** Una red comienza con un trayecto sencillo. Construí tu primer enlace y observá cómo una unidad recorre lo que diseñaste.

**Consigna:** Construí dos estaciones y una línea que las una con un tramo. Asignale un Metro. Guardá, entrá a Simulación e iniciá Play. El nivel termina al completar el recorrido.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":2,"minimoLineas":1,"minimoTramos":1,"minimoMetros":1,"requiereSimulacion":true}`.

### Nivel 2 — Ampliar el recorrido (Inicial)

**Historia:** El primer enlace debe llegar más lejos. Extendé el recorrido y observá cómo cambia el movimiento cuando ajustás la velocidad de la unidad.

**Consigna:** Construí al menos tres estaciones y una línea continua con al menos dos tramos. Asignale un Metro. Guardá y ejecutá una primera simulación. Cambiá UV, aplicá el valor y volvé a ejecutar manteniendo las mismas horas simuladas.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereSimulacion":true,"aprendizajeSimulacion":{"velocidad":true}}`.

### Nivel 3 — Tiempo simulado (Básico)

**Historia:** La red ya conecta varios puntos. Ahora decidí cuánto tiempo simulado observar y distinguí esa duración de la velocidad del metro y del ritmo de reproducción.

**Consigna:** Construí al menos cuatro estaciones y una línea continua con al menos tres tramos. Asignale un Metro. Guardá y ejecutá una primera simulación. Cambiá las horas simuladas, aplicá la duración y volvé a ejecutar manteniendo UV. El ritmo × solo cambia la reproducción visual.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":4,"minimoLineas":1,"minimoTramos":3,"minimoMetros":1,"requiereSimulacion":true,"aprendizajeSimulacion":{"duracion":true}}`.

### Nivel 4 — Varias unidades (Básico)

**Historia:** Dos unidades comparten una línea. Probá una configuración común y después una individual para reconocer qué unidades cambian en cada caso.

**Consigna:** Construí al menos cuatro estaciones y una línea continua con al menos tres tramos. Asignale al menos dos Metros. Guardá y ejecutá una primera simulación. Con Todos los metros aplicá una misma UV nueva y ejecutá. Después seleccioná un Metro, cambiá solo su UV y ejecutá nuevamente. Conservá las mismas horas en las tres ejecuciones.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":4,"minimoLineas":1,"minimoTramos":3,"minimoMetros":2,"requiereSimulacion":true,"aprendizajeSimulacion":{"global":true,"individual":true}}`.

### Nivel 5 — Un lugar al que llegar (Intermedio)

**Historia:** La red empieza a dialogar con Montevideo. El Palacio Legislativo será la primera referencia concreta para decidir dónde colocar una estación.

**Consigna:** Buscá Palacio Legislativo desde la estrella POI. Colocá una estación dentro de su radio de cobertura y otra en una ubicación distinta; unilas con una línea y asignale un Metro. Guardá y completá una simulación de la red. La estación debe quedar dentro del radio marcado, no solo cerca de la estrella.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":2,"minimoLineas":1,"minimoTramos":1,"minimoMetros":1,"requiereSimulacion":true,"requiereObjetivosMismaLinea":true,"puntosInteresObjetivo":[{"idPunto":1,"radioCobertura":25}]}`.

### Nivel 6 — Dos lugares, un recorrido (Intermedio)

**Historia:** Un lugar atendido no basta para formar un recorrido útil. Vinculá el Palacio Legislativo y la Torre de las Comunicaciones por una línea continua.

**Consigna:** Buscá Palacio Legislativo y Torre de las Comunicaciones. Cubrí ambos radios con estaciones y unilos por una misma línea continua de al menos tres estaciones y dos tramos. Asignale un Metro. Guardá y completá una simulación. La cobertura y la continuidad deben cumplirse en la misma red.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereSimulacion":true,"requiereObjetivosMismaLinea":true,"puntosInteresObjetivo":[{"idPunto":1,"radioCobertura":25},{"idPunto":3,"radioCobertura":25}]}`.

### Nivel 7 — Dos líneas, un intercambio (Avanzado)

**Historia:** Una segunda línea abre otra posibilidad de viaje. Hacé que ambas se encuentren en una estación y observá sus unidades circulando.

**Consigna:** Construí al menos cuatro estaciones, dos líneas y tres tramos. Compartí una estación entre ambas líneas para formar un transbordo. Asigná un Metro a cada línea. Guardá y completá una simulación de ambas líneas. Un cruce de vías sin estación compartida no cuenta como transbordo.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":4,"minimoLineas":2,"minimoTramos":3,"minimoMetros":2,"requiereSimulacion":true,"minimoTransbordos":1,"transbordosPorConexion":true,"requiereMetroPorLinea":true}`.

### Nivel 8 — Red territorial integrada (Avanzado)

**Historia:** Una red combina lugares y sectores de la ciudad. Integrá dos líneas, un intercambio y referencias del territorio sin perder la continuidad de cada recorrido.

**Consigna:** Construí al menos cinco estaciones, dos líneas y cuatro tramos, con un transbordo. Cubrí Palacio Legislativo y Torre de las Comunicaciones por una misma línea continua e incluí una estación en el barrio AGUADA. Asigná un Metro a cada línea. Guardá y ejecutá. Seleccioná un Metro, cambiá solo su UV y repetí con las mismas horas simuladas.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":5,"minimoLineas":2,"minimoTramos":4,"minimoMetros":2,"requiereSimulacion":true,"aprendizajeSimulacion":{"individual":true},"requiereObjetivosMismaLinea":true,"puntosInteresObjetivo":[{"idPunto":1,"radioCobertura":25},{"idPunto":3,"radioCobertura":25}],"minimoTransbordos":1,"transbordosPorConexion":true,"areasObjetivo":[{"tipo":"barrio","nombre":"AGUADA","minimoEstaciones":1}],"requiereMetroPorLinea":true}`.

### Nivel 9 — Comparar ejecuciones (Desafío)

**Historia:** El diseño está listo para experimentar. Compará dos ejecuciones de la misma red cambiando conjuntamente velocidad y duración simulada.

**Consigna:** Construí al menos cinco estaciones, dos líneas y cuatro tramos, con un transbordo. Asigná un Metro a cada línea. Guardá y completá la ejecución A. Cambiá UV y horas simuladas y completá la ejecución B sin modificar la estructura de la red.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":5,"minimoLineas":2,"minimoTramos":4,"minimoMetros":2,"requiereSimulacion":true,"aprendizajeSimulacion":{"combinacion":true},"minimoTransbordos":1,"transbordosPorConexion":true,"requiereMetroPorLinea":true}`.

### Nivel 10 — Desafío integrador (Desafío)

**Historia:** Es momento de reunir lo aprendido. Construí una red compacta con cobertura e intercambio, probá controles globales e individuales y compará configuraciones antes de pasar a Modo Libre.

**Consigna:** Construí al menos seis estaciones, dos líneas y cinco tramos, con un transbordo. Cubrí Palacio Legislativo y Torre de las Comunicaciones por una misma línea continua. Asigná un Metro a cada línea. Guardá y ejecutá A. Aplicá una nueva UV común a Todos los metros y ejecutá B con las mismas horas. Cambiá solo un Metro y ejecutá C conservando horas. Finalmente cambiá UV y horas y ejecutá D. El nivel termina al comprobar la red y las comparaciones.

**Herramientas:** estaciones, lineas, conexiones, metros, simulacion.

**Reglas verificadas:** `{"minimoEstaciones":6,"minimoLineas":2,"minimoTramos":5,"minimoMetros":2,"requiereSimulacion":true,"aprendizajeSimulacion":{"global":true,"individual":true,"combinacion":true},"requiereObjetivosMismaLinea":true,"puntosInteresObjetivo":[{"idPunto":1,"radioCobertura":25},{"idPunto":3,"radioCobertura":25}],"minimoTransbordos":1,"transbordosPorConexion":true,"requiereMetroPorLinea":true}`.

## Correcciones y causa raíz

- **Conexión:** el hit test consideraba solo el nodo matemático y el orden del array, aunque el marcador de estación se dibuja más arriba. Ahora incluye la caja visible y prioriza la estación más cercana de forma determinista.
- **Metro:** los tramos cercanos se ofrecían sin separar cercanía inequívoca de superposición real. Se usa distancia al segmento en píxeles de pantalla, orden estable y margen de ambigüedad de 2 px. Solo una superposición real abre el selector existente.
- **Zoom máximo:** la tolerancia fija podía ser menor que el nodo o la vía dibujada. La regresión falló antes de la corrección. Se reutilizan radio/grosor del dibujo para el mínimo interactivo visible, sin incluir el halo decorativo. Base: estación 18 px, vía 11 px y margen del marcador 4 px.
- **Tutorial y desplegables:** la tarjeta conservaba la posición anterior al abrir un menú. Se reposiciona tras `toggle` mediante un rAF cancelable y vuelve a consultar el target. Se limpia el listener y el rAF al cerrar.
- **Tutoriales repetidos:** la presentación completa pertenece al nivel 1. Los niveles que reutilizan herramientas no abren una guía completa automáticamente; pueden solicitarla manualmente. Los pasos prácticos esperan eventos reales.
- **Contenido histórico:** se publican versiones nuevas; no se reescriben las publicaciones enlazadas a intentos anteriores. El presupuesto UV/UT de versiones anteriores se mantiene allí; el nuevo recorrido usa UV y horas simuladas.

## POI y geometría

Se reutilizan Palacio Legislativo (id 1) y Torre de las Comunicaciones (id 3) del catálogo existente, sin inventar ubicaciones. La cobertura usa radio 25 en coordenadas normalizadas del mapa. El dibujo transforma el mismo centro/radio a los ejes del mapa (por eso puede verse elíptico), sin asumir kilómetros. Se verifican centro, punto a 24,99, borde 25 incluido y exterior 25,01 tanto en la geometría visual como en el evaluador backend. La búsqueda de POI y la animación de cámara conservan su comportamiento.

## Arquitectura, API y datos

- Sin tablas, columnas, entidades, migraciones, dependencias o endpoints nuevos.
- Se reutilizan `Escenario`, `Intento`, `Simulacion`, `nivel_publicacion` y los servicios de borrador/publicación.
- El DTO de progreso agrega relato, marcador de recorrido y cantidad de intentos de campaña; los consumidores anteriores conservan sus campos.
- Se incorpora `requiereMetroPorLinea` al evaluador y al conjunto de reglas admitidas. Las reglas de comparación de ejecuciones ya existían.
- La red de referencia es privada y solo valida la viabilidad durante publicación. Nunca se entrega al jugador. El E2E comprueba que cada nuevo nivel empieza sin estaciones.
- La publicación es transaccional, requiere un ADMIN existente y es idempotente por versión. Solo se activa con `--metronet.recorrido.publicar=true --metronet.recorrido.administrador=<id>`. Un arranque normal no cambia los niveles.
- Reparación local autorizada: credencial del rol técnico `metronet_app`, conservando sus permisos limitados y sin tocar cuentas de la aplicación. Configuración y respaldos privados con permisos 600, fuera de Git.

## Matriz de aceptación

Última pasada completa: 11 pruebas de navegador correctas (campaña + diez subpruebas), 409,75 s, cero fallos/omisiones. Todos los clics y ajustes se hicieron mediante UI, sin bypass. Cero excepciones JS y cero respuestas REST fallidas durante el recorrido.

| Nivel | Editor | Guardar | Simular | Tutorial | POI | Reglas | 100 % | Siguiente |
|---|---|---|---|---|---|---|---|---|
| 1 | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| 2 | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| 3 | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| 4 | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| 5 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 6 | PASS | PASS | PASS | PASS (reutiliza) | PASS | PASS | PASS | PASS |
| 7 | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| 8 | PASS | PASS | PASS | PASS (reutiliza) | PASS | PASS | PASS | PASS |
| 9 | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS |
| 10 | PASS | PASS | PASS | PASS (reutiliza) | PASS | PASS | PASS | Modo Libre: acceso real PASS |

PostgreSQL aislado confirmó diez intentos completos con progreso/puntaje 100, campaña completada y al menos 19 simulaciones asociadas al jugador. Se realizaron varias campañas limpias durante la corrección; la última pasó completa. El reinicio de campaña y la conservación del histórico tienen además regresión focal.

## Pruebas y evidencia

- Backend completo con E2E habilitada: **242 pruebas, cero fallos, cero errores, cero omisiones**, 7 min 21 s. Comando: `METRONET_E2E_RECORRIDO=true bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true` (más variables de Chrome/Playwright).
- Arranque explícito de publicación: **2 pruebas correctas**, código de salida 0, y empaquetado backend correcto en 8,21 s. Se corrigió una colisión de nombre entre la clase de configuración y su bean ApplicationRunner; el arranque normal sigue sin publicar.
- Cierre frontend: 62 pruebas correctas (interacción, navegación, ranking, selección).
- Regresión frontend final: 75 pruebas correctas (tutoriales, catálogo, mapa, capas y simulación).
- Suite focal final: **21 pruebas correctas** — selección (5, incluyendo veinte combinaciones de longitud/dirección/zoom/pan), tutorial (3; 1440 y 390 px), audio (13). La instrumentación de audio no equivale a escucha física por altavoces.
- Build frontend: `npm run build`, código de salida 0; 5,00 s, sin aviso de tamaño nuevo.
- No existe script lint en package.json. `git diff --check`: código de salida 0. No hay nuevas advertencias de build; los avisos de JVM/Mockito y el rechazo de seguridad provocado por las pruebas negativas no indican fallos funcionales.

Comandos de reproducción (Chrome local y Playwright disponible mediante METRONET_PLAYWRIGHT_PATH):

```sh
METRONET_E2E_RECORRIDO=true METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true
cd frontend
METRONET_URL_PRUEBAS=http://127.0.0.1:5198 METRONET_BROWSER_CHANNEL=chrome node --test --test-concurrency=1 tests/recorrido-integral.test.cjs tests/seleccion-red-regresion.test.cjs tests/tutorial-recorrido-integral.test.cjs
npm run build
git diff --check
```

El E2E arranca Spring Boot real contra PostgreSQL temporal. El navegador hace login y todas las acciones de construcción, guardado, ajustes y simulación mediante UI; no escribe progreso por SQL ni llama endpoints de avance por fuera de la interfaz. La exposición de Phaser en la prueba solo sirve para leer la posición de cámara y ubicar clics.

## Instalación local

El ADMIN existente identificado para publicar es id 2. Se publicaron diez nuevas versiones mediante validación e historial existentes. No se crearon usuarios ni se modificó el progreso local para demostrar niveles.

Comparación con respaldo privado previo: dos diseños, dos intentos, cero simulaciones y una cuenta de usuario conservan exactamente sus huellas. Las 41 publicaciones anteriores conservan su contenido. El esquema comparado mediante dump/pg_dump permanece idéntico. Las diez publicaciones vigentes llevan `integral-2026-10`.

La credencial técnica fue reparada con autorización explícita. Backend local activo en 8080; endpoint protegido sin sesión devuelve 401, frontend login devuelve 200. Los respaldos quedan bajo `.local/respaldos/recorrido-integral-20261008`, ignorados por Git y con acceso privado.

Los intentos ya iniciados mantienen su versión anterior. Para recorrer los diez nuevos desde el inicio se usa la acción existente **Reiniciar recorrido**, que conserva el histórico. No se reinició la campaña del ADMIN automáticamente.

## Archivos afectados

- `backend/pom.xml`
- `backend/src/main/java/com/metronet/backend/dto/EscenarioJuegoResponse.java`
- `backend/src/main/java/com/metronet/backend/service/AdministracionNivelesService.java`
- `backend/src/main/java/com/metronet/backend/service/CriterioUvUtService.java`
- `backend/src/main/java/com/metronet/backend/service/JuegoEducativoService.java`
- `backend/src/main/java/com/metronet/backend/service/PublicacionNivelService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/ValidacionPublicacionNivelPostgresTest.java`
- `frontend/src/educacion/ContenidoPreparacion.js`
- `frontend/src/educacion/PanelTutorialInicial.js`
- `frontend/src/educacion/PantallaPreparacionNivel.js`
- `frontend/src/educacion/RecorridoInicial.js`
- `frontend/src/educacion/TutorialInicial.js`
- `frontend/src/educacion/TutorialSimulacion.js`
- `frontend/src/educacion/tutorial-inicial.css`
- `frontend/src/mapa/capas/CapaRedMetro.js`
- `frontend/src/navegacion/escenarios.js`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/fluidez-campana.test.cjs`
- `frontend/tests/interaccion-directa.test.cjs`
- `frontend/tests/puntos-interes.test.cjs`
- `frontend/tests/puntuacion-ranking.test.cjs`
- `frontend/tests/tutorial-inicial.test.cjs`
- `frontend/tests/tutorial-simulacion.test.cjs`
- `backend/src/main/java/com/metronet/backend/configuracion/PublicarRecorridoIntegral.java`
- `backend/src/main/java/com/metronet/backend/service/RecorridoIntegralService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/PublicarRecorridoIntegralTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralE2EPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/service/CoberturaRecorridoTest.java`
- `frontend/src/educacion/recorrido-integral.json`
- `frontend/tests/recorrido-integral-e2e.test.cjs`
- `frontend/tests/recorrido-integral.test.cjs`
- `frontend/tests/seleccion-red-regresion.test.cjs`
- `frontend/tests/tutorial-recorrido-integral.test.cjs`

Se conservaron las modificaciones de tutorial y las vistas previas/DOCX que ya estaban en el workspace antes de esta tarea. No se modificó el logo ni las pistas musicales.

## Límites de verificación

Chrome automatizado fue el navegador de aceptación de esta pasada. Safari sigue pendiente por decisión previa del usuario; Firefox y escucha física en altavoces no se repitieron en esta tarea. No se creó commit ni se publicó a Git: la autorización anterior correspondía al commit 64f792b, no a este nuevo conjunto de cambios.

## Conclusión de aceptación

**REDISEÑO DE NIVELES APROBADO:** los diez se completaron al 100 % desde la interfaz real y el último permitió entrar a Modo Libre. La implementación está aplicada en la instalación local. Las limitaciones de navegadores/escucha y la publicación Git están descritas arriba, sin presentarlas como verificadas.
