# Auditoría de estabilidad y rendimiento — 26/09/2026

Informe técnico de esta pasada; no reemplaza ni modifica Documento METRONET.

## Alcance y fuentes

- **DEFINIDO:** Documento METRONET exige respuesta menor a un segundo para acciones básicas de selección, movimiento y edición bajo condiciones normales. Define persistencia relacional y arquitectura cliente-servidor por capas; no fija un requisito formal de 60 FPS.
- **IMPLEMENTADO:** JavaScript, Phaser 4, Vite, documentos HTML independientes, Spring Boot y PostgreSQL. Se revisaron AGENTS.md, la skill del proyecto y el documento vigente antes de intervenir. La referencia inicial del repositorio fue `d8f401ab1c26b9dfac7e6075d03847d073e439c0`.
- **PROPUESTO NO ADOPTADO:** dividir o sustituir Phaser, cambiar la arquitectura de navegación, introducir un reproductor externo persistente o cambiar la resolución interna del motor. No fueron necesarios para las correcciones comprobadas.

Esta pasada modifica presentación, ciclo de vida y reutilización de cálculos/lecturas frontend. **Backend, endpoints, entidades, reglas de negocio, esquema PostgreSQL y datos reales: sin cambios.** Las escrituras funcionales se probaron en un backend y un clúster PostgreSQL desechables, con una cuenta sintética; se eliminaron al terminar.

## Línea base

| Comprobación anterior a los cambios | Resultado |
| --- | --- |
| Backend completo, PostgreSQL temporal | 194 pruebas aprobadas; 0 fallos, errores u omitidas; 41,780 s |
| Frontend completo, Chrome | 638 pruebas: 637 aprobadas, 1 fallo, 0 omitidas; 790,588 s |
| Build frontend | Correcto; 2,27 s |
| Mayor chunk JavaScript | 1.516,35 kB; gzip 405,79 kB; incluye Phaser |
| Veinte avisos de resize sin cambiar dimensiones | 20 reconstrucciones completas; 141,6 ms acumulados |
| Cien actualizaciones en pausa | 100 cálculos de recorrido/posición innecesarios |

El único fallo frontend inicial era una expectativa obsoleta de la prueba de audio: después de cerrar sesión y restaurar una página, la protección de sesión navega al login. La prueba observaba indistintamente el reproductor del documento anterior o la música válida del login. Se corrigió la espera y se comprueba que desaparezca la pista de gameplay y quede un único reproductor de autenticación. No se cambió la regla de audio para hacer pasar la prueba.

En una repetición completa apareció otra carrera del fixture: `/auth/perfil` devolvía siempre JUGADOR, incluso para ADMIN. La carga del perfil podía invalidar esa sesión sintética antes de que la prueba pulsara Cerrar sesión. Se corrigió el rol de la respuesta simulada, se espera la carga real del perfil y se exige su rol visible. Los seis casos de navegación por rol/ancho y el zoom 80% pasaron juntos (7/7). No se modificó autenticación productiva.

## Hallazgos y correcciones

| Hallazgo reproducido | Causa | Corrección y regresión |
| --- | --- | --- |
| Avisos de posición reconstruían geografía y red sin cambio de tamaño | El evento `resize` de Phaser también informa movimientos; el HUD y el contenedor repetían la actualización | Un observador compartido compara dimensiones positivas y actualiza solo el tamaño real. Se retiraron el observador redundante del HUD y el callback RAF del panel del simulador. Veinte avisos conservan los mismos objetos y cámara. |
| Liberación incompleta al destruir el juego | Solo se escuchaba `shutdown`; la destrucción de Phaser también puede terminar directamente mediante `destroy` | Limpieza única para ambos eventos; desconexión de observador, controles, teclado y listeners propios. Destruir el visor libera controles una vez; cuatro reinicios de escena conservan las cantidades. |
| Volver desde una página conservada podía encontrar el simulador destruido | `pagehide` destruía el juego incluso con `persisted=true` | En historial conservado se pausa; `pageshow` reanuda únicamente si antes estaba ejecutándose, sin sumar el tiempo congelado. La salida definitiva sí destruye. |
| Simulación pausada seguía calculando movimiento y notificando el HUD | El ciclo `update` trabajaba para cualquier estado del motor | Solo actualiza por cuadro durante `EN_CURSO`. Las acciones de pausa, reinicio y detención mantienen su actualización explícita. |
| Conversión de toda la ruta de cada metro en cada cuadro | Geometría estática recalculada por unidad | Recorridos por línea y trazados proyectados reutilizados. Se invalidan al dibujar tras editar o cambiar el tamaño. No se alteran velocidad, duración ni puntuación. |
| Diseños propios solicitaban consignas de campaña inexistentes | El simulador consultaba `/consigna` para cualquier escenario | Se reutiliza el catálogo educativo ya solicitado para omitir esa consulta cuando el escenario no pertenece al catálogo. Instrucciones y validación se conservan. Si el catálogo aún no está disponible se mantiene el comportamiento anterior, sin bloquear el inicio. |
| Cabecera y simulador/ranking pedían simultáneamente el mismo progreso | Consumidores independientes de `/progreso` | Se comparte solo la promesa pendiente, separada por sesión. Al resolver o fallar se elimina; la siguiente lectura vuelve al backend. Pruebas de frescura, error/reintento y cambio de cuenta. |

Durante la integración del observador se detectó además una regresión: un guard anterior del simulador esperaba argumentos del evento de Phaser y salía al recibir la nueva llamada sin argumentos. La inspección visual mostró que el canvas tenía tamaño correcto pero la red conservaba la geometría anterior. Se retiró ese guard, ya sustituido por el observador común, y se agregó una prueba que exige que las tres estaciones estén realmente dentro de la vista en 1280, 390 y 1440 px. La corrida en curso se interrumpió y se repitió después de corregirlo; no se cuenta como validación final.

Después de la suite completa verde se forzó otro caso límite: ocultar el visor, cargar la red con tamaño 0 y volver a mostrarlo con el mismo tamaño anterior. Se reprodujeron tres estaciones fuera de vista porque el observador no recordaba el paso por 0. La corrección registra ese tamaño sin dibujar, para reconstruir al reaparecer. Se agregó el caso y se repitió la regresión final del mapa/cámara/consultas sobre esa última corrección; se informa por separado de la suite completa.

## Mediciones

Las mediciones son locales, con Chrome y aceleración gráfica Apple M5. No representan una prueba de carga multiusuario ni una garantía para todos los equipos. Las muestras pequeñas se informan con su cantidad; no se presenta una única ejecución como un P95 representativo.

| Operación | Antes | Después |
| --- | --- | --- |
| 20 avisos sin cambio de tamaño | 20 redraws; 141,6 ms | 0 redraws; mismos objetos y cámara |
| 100 cuadros en pausa | 100 cálculos de posición | 0 cálculos y 0 notificaciones de HUD |
| 600 actualizaciones; 60 estaciones, 5 líneas, 20 metros | 144.000 conversiones; 70,5 ms acumulados; P95 0,2 ms | 0 conversiones de geometría durante el movimiento; 5,6 ms acumulados; P95 0,1 ms |
| Progreso simultáneo, cabecera + simulador | 2 GET | 1 GET, sin cachear la respuesta resuelta |
| Consignas inexistentes en recorrido de diseños libres | 5 respuestas 404 | 0 respuestas 404 en la repetición del recorrido |
| Transición global entre documentos | 180 ms | Se conserva 180 ms; no se añadieron esperas |

Las duraciones musicales de intro/outro y bienvenida previamente solicitadas se conservan. No son latencia del backend ni se utilizaron para calcular tiempos de acciones básicas. Se mantienen cancelación, reduced-motion, contenido educativo y el botón para comenzar sin esperar la presentación.

Se midieron 20 selecciones de estación, 20 cambios de herramienta y 20 búsquedas POI, hasta observar la respuesta de UI, con datos controlados. Los P95 fueron respectivamente **82,5 ms, 293,2 ms y 120,4 ms**. Incluyen el costo de automatización de Chrome; no son tiempos puros de una función JavaScript.

En el recorrido integrado se midieron 20 lecturas de diseño y 20 guardados reales: P95 **10,5 ms** y **12,0 ms**, respectivamente. En esa misma corrida la navegación de 24 visitas (tres vueltas por ocho pantallas) estuvo entre **144.6 y 802.2 ms**. Diez inicios de simulación, incluyendo validación/guardado y la espera de automatización hasta el estado en ejecución, tuvieron P95 **1.312,3 ms**. Otra corrida concurrente alcanzó 1.323,5 ms de carga de pantalla; la suite de navegadores se estaba ejecutando a la vez. No se demuestra un P95 universal menor a un segundo para abrir/iniciar todo el simulador, ni se atribuye una mejora global de carga sin una comparación controlada equivalente.

La repetición final sin suites simultáneas registró **6,7 ms P95** de lectura de diseño, **5,7 ms P95** de guardado y **496,6 ms P95** de inicio completo de simulación (10 ejecuciones). La comparación con 1.312,3 ms bajo concurrencia indica influencia de las condiciones de prueba, no una nueva optimización del backend.

Medición final de 180 intervalos RAF por caso:

- Red pequeña (3 estaciones, 1 metro): **59,0 FPS** aproximados; P95 de intervalo 16,8 ms; 2 intervalos mayores a 25 ms; 0 tareas largas observadas.
- Red de 60 estaciones, 5 líneas y 20 metros: **30,2 FPS** aproximados; P95 de intervalo 33,4 ms; 0 tareas largas observadas. Esta cadencia permanece como límite medido del render en esta prueba; su causa completa no se aisló y no se promete 60 FPS. No se infiere una mejora de FPS a partir de la reducción de cálculos JavaScript.
- Después de 5/10/15 ciclos y GC: **454 objetos Phaser, 1.354 nodos DOM, 240 listeners, 1 audio, 0 tweens y 0 temporizadores Phaser** al detener, sin crecimiento de cantidades. Heap JS entre **16,95 y 17,23 MB** decimales; no incluye VRAM. Es evidencia acotada de 15 ciclos, no una demostración de ausencia de toda fuga posible.

Datos detallados: [métricas de la auditoría](estabilidad-2026-09-26-metricas.json).

## Revisión de interfaz y matriz de cobertura

La matriz adicional verifica 9 pantallas × 5 resoluciones = **45 combinaciones**, tanto en Vite como en el build de producción: 1920×1080, 1440×900, 1366×768, 1280×720 y 390×844. En ambas: **0 errores JavaScript, 0 errores/warnings de consola, 0 respuestas HTTP fallidas y 0 desbordes horizontales**. Se inspeccionaron capturas locales de editor, simulador y administración en escritorio/móvil; no se versionaron.

| Pantalla/flujo | Comprobación realizada | Resultado |
| --- | --- | --- |
| Login, registro, recuperación, post-login, logout | Suites de autenticación, música, foco, destinos por rol y bienvenida; login/logout reales de ADMIN de prueba | Sin nuevas regresiones |
| Inicio y Escenarios | Matriz desktop/móvil, navegación real repetida, campaña y transiciones de los diez niveles | Contenido y destinos preservados |
| Ranking y Mis Diseños | Primer render, tabla/estado vacío, scroll, eliminación, permisos y responsive | Sin overflow horizontal ni dependencia de abrir un menú |
| Editor/Nivel | Herramientas, teclado, pan/touch, doble clic, creación, guardado incompleto, tutorial y pista | Suite funcional; pan no crea estaciones |
| Mapa y cámara | DPR 1/1,25/2; canvas/CSS 1:1; paneles, zoom, pan, resize, simulación y retorno | Sin filtros de nitidez ni offsets artificiales; red visible después del resize |
| POI, barrios y zonas | 256 combinaciones de capas en cuatro estados de cámara; búsqueda, selección y cierre; labels | Independencia conservada; sin acumulación de objetos |
| Simulador y resultados | Iniciar/pausar/reanudar/detener/reiniciar; cámara en 1440/768/390; ejecución y resultado persistidos en PostgreSQL temporal | Flujo integrado correcto |
| Administración/configuración/perfil | Matriz, recorrido integrado real, acceso a configuración, tests de permisos/mantenimiento y formularios | Sin modificaciones funcionales |
| Header, iconos y overlays | Header estable de 76 px desktop/60 px móvil; cajas de iconos y dropdowns existentes; cierre/teclado | No se justificó un rediseño CSS |
| Audio | Instancias, continuidad de pista, cambio de contexto, logout, errores y reduced-motion | No se modificaron pistas ni se duplicó el gestor |

La suite incluye más anchos (320/768 px y orientación horizontal) y estados de error que la matriz adicional. La revisión de captura no equivale a una exploración manual exhaustiva de cada combinación.

## Rendimiento, ciclo de vida y límites

- El mapa deja de reconstruirse ante avisos sin cambio de dimensión. Un resize real continúa actualizando geografía y red; no se añadió un debounce con espera artificial.
- Se eliminó un observador extra del HUD y un RAF adicional del panel de simulación. Los observadores y listeners propios se liberan también al destruir el juego.
- La limpieza del editor detiene animación sin redibujar objetos que inmediatamente se destruirán.
- Se probaron 12 ciclos de reproducción y 4 reinicios de escena; se midieron además objetos, heap tras GC, DOM, audio, tweens y timers en 15 ciclos. Los valores finales se adjuntan en las métricas.
- Las rutas reutilizadas no dependen del zoom/pan; se invalidan con edición y resize. No se cachean datos mutables del backend de forma permanente.
- Las pantallas generales ya emplean la transición compartida de 180 ms y protección contra navegación duplicada. No se sustituyó la navegación HTML por una SPA.
- No se encontró una acción REST básica lenta que justificara modificar Services/Repository/DTOs. No se cambió ninguna relación a EAGER. **IMPLEMENTADO:** listado/detalle de diseños en `SimulacionService` usan consultas `JdbcTemplate` dentro del servicio, no navegación de colecciones JPA; es una implementación preexistente distinta de la recomendación Repository de AGENTS.md y no se reorganizó silenciosamente. El listado utiliza un JOIN único. La preparación sí hace una comprobación SQL de ruta por cada línea distinta con metros (`evaluarPreparacionSimulacion` → `tieneRutaOperable`); su cantidad crece con las líneas. **PROPUESTO NO ADOPTADO:** agrupar esa lectura si mediciones con redes mayores demuestran un cuello de botella; no se modificaron validaciones con lecturas de diseño locales de 10–34 ms P95. Queda como riesgo de escalabilidad, no como una consulta ya optimizada. Esta pasada no afirma una auditoría exhaustiva de SQL bajo carga multiusuario.
- Bundle: el chunk que contiene Phaser sigue en torno a **1,517 MB / 406 kB gzip**, cargado por editor/simulador. Los menús no incorporan ese motor. Se conserva la advertencia previa de Vite para chunks mayores a 500 kB; no se ocultó aumentando el umbral. El catálogo de audio existente ocupa aproximadamente 13 MB y el gestor carga por contexto, sin precarga global nueva.
- No existe comando de lint configurado; no se agregó una dependencia para simular esa validación. Se revisó el diff y su whitespace.
- Se probó zoom real de Chrome mediante su configuración de apariencia al 80%, 125%, 200% y 300%; el 100% es el estado normal de la matriz. Es independiente de las pruebas DPR 1/1,25/2. Queda ampliar compatibilidad a otros navegadores/equipos; no se afirma que un cambio de DPR equivalga a zoom real.
- El canvas conserva la política de resolución de Phaser 4 y relación geométrica CSS correcta. No se afirma render nativo Retina 2× ni se aplicaron filtros artificiales.
- Entre documentos HTML independientes puede existir una discontinuidad breve de audio aunque se conserve la posición. Eliminar completamente ese límite requeriría otro alcance; no se promete audio continuo entre documentos destruidos.

## Comandos y validación final

```sh
npm --prefix frontend run build
METRONET_PLAYWRIGHT_PATH=<runtime-local>/playwright METRONET_BROWSER_CHANNEL=chrome \
  node --test --test-concurrency=2 frontend/tests/*.test.cjs
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true
git diff --check
```

- Regresión focalizada final: **31/31** pruebas, incluidas cámara, geometría visible, consultas simultáneas y ciclo de vida y recuperación desde tamaño 0; 0 omitidas.
- Backend: **194/194**, PostgreSQL real temporal; no hubo cambios backend posteriores.
- Build final: correcto, **5,08 s**; únicamente la advertencia preexistente del chunk de Phaser.
- Recorrido integrado: tres vueltas, guardado, validación, simulación, resultado, configuración y logout; **0 errores de página y 0 llamadas fallidas**.
- Suite frontend completa: **655/655**, 0 fallos, canceladas u omitidas; **624,289 s** (concurrencia 3). La corrección posterior del tamaño 0 se cubre con la regresión final indicada arriba, no se presenta como una nueva ejecución de toda la suite.

## Archivos y trazabilidad

| Archivo | Cambio |
| --- | --- |
| `frontend/src/mapa/ObservarTamanoMapa.js` | Observador común con comparación de dimensiones y cleanup |
| `frontend/src/mapa/MapaScene.js` | Integración del observador y limpieza shutdown/destroy |
| `frontend/src/mapa/controles/BarraEstadoEditor.js` | Retiro del observador redundante |
| `frontend/src/mapa/controles/EditorRedMetro.js` | Retiro de refresh duplicado y redraw al destruir |
| `frontend/src/mapa/capas/CapaRedMetro.js` | Recorridos y geometría reutilizados con invalidación |
| `frontend/src/simulacion/EscenaSimulacion.js` | Update solo en ejecución, cleanup y resize común |
| `frontend/src/simulacion/OrganizacionSimulacion.js` | Retiro de RAF de resize duplicado |
| `frontend/src/simulacion/simulacion.js` | Historial conservado y consulta de consigna solo cuando corresponde |
| `frontend/src/educacion/ClientePuntuacion.js` | Compartir lectura de progreso en curso por sesión |
| `frontend/tests/estabilidad-mapa.test.cjs` | 13 regresiones del mapa/simulador |
| `frontend/tests/consultas-concurrentes.test.cjs` | 4 regresiones de lecturas simultáneas |
| `frontend/tests/musica-contextual.test.cjs` | Expectativa correcta tras logout y restauración de página |
| `frontend/tests/soporte/pantallas.cjs` | Perfil simulado con el rol correspondiente a la sesión |
| `frontend/tests/navegacion-mantenimiento.test.cjs` | Esperar el perfil y verificar el rol antes de cerrar sesión |
| `frontend/tests/pista-hud.test.cjs` | Ampliación de zoom real al 80% |
| `docs/auditorias/estabilidad-2026-09-26.*` | Evidencia de esta auditoría; sin cambiar el documento académico |

No se versionaron capturas, trazas, dumps, contraseñas, datos de usuarios ni los scripts temporales de medición. La documentación académica puede referenciar este informe como evidencia de mantenimiento y testing; su contenido oficial no se modificó.
