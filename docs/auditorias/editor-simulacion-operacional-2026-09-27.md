# Editor y simulación operacional — 27/09/2026

## Alcance y fuentes

Se atendieron las dos instrucciones del usuario: corregir las inconsistencias del editor tras integrar Validar en Guardar y compactar la pantalla de Simulación. Se revisaron `AGENTS.md`, la skill `metronet-development`, Documento METRONET y las implementaciones y pruebas reales.

- **DEFINIDO:** edición gráfica de redes, validación de consistencia, identificación de transbordos, parámetros de simulación y consulta de resultados; arquitectura por capas y modelo vigente.
- **IMPLEMENTADO antes:** Guardar ya validaba y persistía, pero solamente evaluaba el progreso educativo de los niveles 1–3. Simulación repetía objetivos, criterios, referencias, puntaje, explicaciones y formularios por metro. La estación conservaba una propiedad explícita `transbordo`.
- **IMPLEMENTADO ahora:** evaluación tras Guardar en los diez niveles progresivos; interfaz operacional de simulación y controles compartidos descritos abajo.
- **PROPUESTO NO ADOPTADO:** inferir y persistir automáticamente el transbordo por pertenecer a dos líneas. El modelo actual requiere habilitar la propiedad de la estación; esta tarea no cambia esa regla.

No se modificaron tablas, columnas, entidades, relaciones, endpoints, autenticación, permisos, reglas de éxito, puntuación ni motor de circulación. Los cambios de backend se limitan al texto de un criterio y a actualizar las dos instrucciones originales conocidas de los niveles 8 y 10. La actualización es idempotente y exige coincidencia exacta de texto, reglas y herramientas; preserva consignas personalizadas y no cambia el esquema. No se modificó el documento académico oficial.

## Editor: causas y correcciones

| Hallazgo | Causa | Corrección |
| --- | --- | --- |
| “Asignar con teclado / elegir línea” permanecía visible | Era un panel de selección y confirmación del flujo anterior; no existía un atajo específico de asignación | Eliminados panel, botón, select y handler obsoletos. Metro + clic en vía conserva la creación directa. Si se superponen líneas, se ofrecen botones con sus nombres solamente en ese momento. Cambiar herramienta limpia esa elección. |
| Conexión y Transbordo parecían herramientas equivalentes | Había una herramienta adicional que activaba el mismo atributo ya editable en propiedades de estación | Retirada la herramienta duplicada. Se conserva **Permite transbordo** en propiedades. El símbolo de transbordo sigue requiriendo bandera activa y pertenencia a dos o más líneas. No se confunde con un tramo. |
| Guardar no actualizaba el progreso de los niveles 4–10 | La condición usaba `esEscenarioSinSimulacion()` | La condición ahora abarca todo escenario progresivo. Guardar valida, persiste y evalúa el avance. Una red parcial o inválida no se presenta como nivel completado. |
| Persistían instrucciones de validación manual | Textos de los niveles 8 y 10 y descripción del criterio de consistencia | Redacción alineada con Guardar y Simular; sin cambiar las condiciones de éxito. La ayuda del nivel 7 remite a propiedades para habilitar transbordo. |

Se conserva el teclado útil: foco, flechas/Enter para colocar estaciones y Escape para cancelar. También las restricciones por nivel, los diseños completados protegidos y la prevención de escrituras y navegaciones duplicadas.

Otra regresión sobre PostgreSQL reprodujo que las instrucciones antiguas permanecían al reiniciar el catálogo. La corrección comprueba dos inicializaciones consecutivas, reglas y herramientas intactas y preservación de texto personalizado.

La regresión inicial reprodujo el fallo del nivel 6: después de Guardar se esperaba una evaluación y se recibían cero. Tras corregirlo pasan los diez casos de avance parcial, uno por nivel.

## Simulación compacta

- Mapa principal y panel derecho de 248–280 px en escritorio. En pantallas pequeñas el panel pasa debajo del mapa; no se superpone ni causa desborde horizontal.
- Un único selector **Todas las unidades / Metro N · Línea** y un solo editor de velocidad física en **km/h**. Si las unidades difieren, muestra **MIXTO**, sin inventar un promedio.
- Aplicar velocidad utiliza las operaciones PATCH existentes: todas las unidades seleccionadas o únicamente la individual. Mantiene capacidad y línea.
- Velocidad física editable con la simulación detenida y la red habilitada conforme al comportamiento previo. Durante ejecución/pausa se bloquea la edición; sigue disponible seleccionar una unidad.
- Duración en **segundos**, entero mínimo 10, sin introducir un máximo no definido. Ritmo visual **0,5× / 1× / 2× / 4×** independiente de los km/h.
- Nuevos pictogramas propios de velocímetro y reloj en el registro retro compartido; se reutilizan botones, selector, tokens, estados de foco e iconos de ejecución.
- Play/Pause, Stop y Reiniciar permanecen junto al mapa y accesibles aun con el panel oculto.
- Selección en el mapa y en el selector sincronizada. Ficha mínima de la unidad seleccionada: identificador, línea y próxima estación; sin repetir la velocidad.
- Resultados plegados por defecto y acceso tras la ejecución. Se conservan resultados persistidos, evaluación, progreso y finalización de niveles.
- Retirados de la vista operacional los bloques repetidos de objetivo/consigna/checklist/dificultad/puntaje estimado/referencias textuales y formularios por unidad. El editor, los escenarios, Pista, glosario y resultados conservan esas funciones. La consulta de consigna sigue alimentando Pista.
- El glosario de velocidad, duración y ritmo sigue consultable con teclado y clic sin párrafos permanentes. Las definiciones no cambiaron.

La escritura global reutiliza endpoints individuales y no es una transacción nueva. Si falla parte del lote se informa cuántas unidades se guardaron y se recargan sus valores reales. No se reintenta automáticamente una escritura incierta ni se comunica un éxito total falso.

## Regresión adicional de navegación

La suite completa reprodujo un fallo anterior en HTML independientes: Chrome abortaba el snapshot de transición durante ciertos redirects y emitía `ViewTransition opt-in disabled`, incluso cuando permisos y destino eran correctos. El contenedor persistente no presentaba el problema.

Se reutiliza la entrada CSS de 180 ms también en los HTML de respaldo, retirando el opt-in de snapshots nativos. Se conserva el historial, la restauración de scroll, el contenedor musical, todos los temas y reduced-motion. No se oculta ni filtra el error de consola. La regresión de permisos y las de navegación/scroll pasan con movimiento normal y reducido. La prueba del logo espera el fin real de la entrada visual antes de medir su opacidad final; no utiliza una espera arbitraria.

## Verificación

### Línea base

- Build previo correcto.
- 45 pruebas focales del editor, preparación, organización y puntuación: correctas con Vite activo. La primera ejecución no pudo conectar porque el servidor estaba detenido; se repitió con el servidor disponible.
- Se conserva el logo: ningún asset ni estilo propio de su imagen fue modificado.

### Pruebas funcionales y persistencia

- 195 pruebas backend con PostgreSQL temporal: **195 correctas, cero fallos y cero omitidas**. Incluyen Services, Controllers, permisos, persistencia, escenarios, campañas y simulación.
- Recorrido de extremo a extremo adicional con Chrome, frontend real, backend empaquetado y PostgreSQL aislado: los **diez niveles** empiezan vacíos, se construyen mediante API oficial y se pulsa Guardar en el editor real. En 1–3 se registra la finalización; en 4–10 se registra avance parcial y luego se pulsa Simular. Se prueba detener y ejecutar nuevamente, completando la reproducción. Los diez llegan a progreso 100, estado COMPLETADO y campaña finalizada; resultados y progreso se leen nuevamente del backend. Cero errores JavaScript y HTTP en el recorrido.
- Ese recorrido usa únicamente cuentas y datos sintéticos temporales. Las redes se prepararon por API; no se presenta como una construcción manual de cada estación por mouse. Las interacciones gráficas se cubren en las pruebas específicas del editor.
- Regresiones de velocidad global/individual/MIXTO, fallo parcial, doble submit, límites de duración, diferencia km/h–ritmo, bloqueo durante ejecución y pausa, glosario, selección mapa/selector, cámara y resultados.
- Pruebas responsive a 1920×1080, 1440×900, 1366×768, 1280×720, 768×900, 390×844 y 320×740; capturas inspeccionadas fuera de Git. Panel derecho en escritorio, debajo en tamaños reducidos y sin overflow global.

### Build y volumen de código

Build final correcto, sin warnings. El chunk de Simulación pasa de 42,57 a 36,97 kB de JavaScript y de 18,83 a 7,36 kB de CSS (sin comprimir). Es una reducción de presentación duplicada, no una afirmación de mejora de FPS. No existe comando de lint configurado; se revisaron el diff, la sintaxis compilada y las pruebas.

Se ejecutó la suite completa de frontend: **705 casos, cero omitidos**. La primera pasada con el código final registró 681 correctos y 24 fallos: 21 mediciones capturaban el logo durante la opacidad temporal de entrada, dos expectativas aún pedían la herramienta/etiqueta retiradas y un caso importaba una segunda versión del módulo por timestamps de HMR de Vite. Se actualizaron las expectativas a la interfaz solicitada, se esperó el fin real de la entrada y se reinició Vite. Las cuatro suites afectadas se repitieron completas: **72/72 correctas, cero fallos y cero omitidas**. No se presenta la primera pasada como totalmente verde ni se filtraron errores de consola. Las demás comprobaciones de la suite completa pasaron.

## Copia local

El frontend quedó disponible en su servidor habitual y el backend final fue empaquetado e iniciado. La configuración privada de la Mac tenía una credencial distinta a la del rol técnico limitado `metronet_app`, lo que impedía iniciar el backend. Se verificaron cero conexiones activas, se conservó un respaldo privado excluido de Git y se sincronizó únicamente la credencial técnica con el archivo privado existente, conforme a la autorización previa de proteger el acceso interno. No se modificaron las cuentas ni permisos de METRONET.

La comprobación posterior devolvió `UP` y `CONNECTED`. En la base local los niveles 8 y 10 ya contienen “Guardá tu diseño y simulá” y no el texto original “Validá y simulá”. **Esquema sin cambios**; la modificación de datos de aplicación se limita a esos textos originales. Credenciales, respaldo técnico, capturas, logs, compilados y pruebas temporales quedaron fuera de Git.

## Archivos afectados

- Editor: `CreacionDirecta.js`, `EditorRedMetro.js`, `PanelHerramientasEditor.js`, `CapaRedMetro.js`.
- Educación: `niveles.json`, `AyudaContextual.js`; backend `JuegoEducativoService.java` (texto del criterio), `InicializadorCatalogoEscenariosProgresivos.java` (texto original conocido) y `CampanaPostgresTest.java` (regresión).
- Simulación: `simulacion.html`, `simulacion.css`, `simulacion.js`, `PanelDesempeno.js`, `OrganizacionSimulacion.js`, `EscenaSimulacion.js`.
- Sistema visual: `PictogramasMapa.js`, `navegacion-estable.css`, `transicion-pagina.js`; retirado `transiciones-documento.css`.
- Pruebas: nueva `simulacion-operacional.test.cjs`; actualizadas las de interacción directa, organización/viewport, glosario, puntuación, campaña, victoria/identificación, diálogos, feedback, estabilidad de mapa, apariencia y navegación.
- Este informe técnico; sin modificar documentación académica oficial.

## Límites conservados

1. Transbordo continúa siendo una propiedad explícita; no se altera automáticamente por conectar dos líneas.
2. Las velocidades globales se guardan mediante las operaciones individuales existentes; los fallos parciales quedan visibles.
3. Las transiciones visuales no se vinculan a operaciones ficticias ni modifican reglas de nivel.
4. No se agregan dependencias, tablas ni endpoints. Las verificaciones de campaña utilizan PostgreSQL aislado; la base local conserva usuarios, diseños, reglas y resultados.
