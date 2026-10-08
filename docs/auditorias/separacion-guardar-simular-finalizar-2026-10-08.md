# Separación de Guardar, Simular y Finalizar red — 2026-10-08

## Alcance y autoridad

- **DEFINIDO:** Documento METRONET contempla guardar diseños, ejecutar simulaciones, consultar resultados y progresión educativa. Sus casos de uso CU06, CU13 y CU14 son los puntos documentales afectados.
- **Cambio formal aprobado:** el usuario confirmó separar Guardar, Simular y Finalizar red y aprobó explícitamente ejecutar el análisis. La aprobación y el avance pasan a depender de Finalizar red. Las consignas, las condiciones de éxito y las reglas de puntuación se conservan.
- **IMPLEMENTADO previamente:** Guardar y el final de la animación de simulación solicitaban `POST /api/juego/disenos/{id}/evaluar`, que podía completar el intento y desbloquear el siguiente nivel.
- **PROPUESTO, no adoptado en esta tarea:** eliminar las prácticas sin descuento. No se modifican los cupos ni las penalizaciones.

## Implementación

| Acción | Persistencia y validación | Aprobación |
| --- | --- | --- |
| Guardar | Conserva el avance aunque la red esté incompleta; actualiza progreso y puntuación existentes | No |
| Simular | Preflight existente, guardado, ejecución y registro de objetivos/descuentos | No |
| Finalizar red | Espera la escritura pendiente, valida, guarda y solicita la evaluación completa del servidor | Sí, únicamente si se cumplen todas las condiciones vigentes |

- `JuegoEducativoService.actualizarProgreso` actualiza avance y puntos sin completar el intento, fechar su cierre, conceder trofeos ni habilitar otro nivel. El avance persistido queda como máximo en 99 hasta la entrega, siguiendo la convención existente de evaluación pendiente. La consulta de objetivos refleja las condiciones reales.
- El endpoint de evaluación conserva contrato, autorización y reglas. El editor lo utiliza exclusivamente desde la entrega explícita. El backend sigue comprobando que la ejecución corresponda a la red y UV actuales.
- `SimulacionService.guardarDiseno` y `ejecutarSimulacion` coordinan la actualización sin cierre. El bloqueo del usuario utiliza el mismo orden que ejecución/evaluación para serializar las escrituras del intento.
- El editor incorpora **Finalizar red**, con bandera pixel y texto visible, usando el sistema global de botones de éxito. Se oculta en Modo Libre y diseños ya completados. Guardar y Simular conservan sus controles.
- Las operaciones de preparación se excluyen entre sí. Una escritura fallida impide evaluar; una respuesta incompleta muestra los objetivos pendientes y permite continuar editando. No se muestra el aviso de puntuación retirado previamente.
- Simulación consulta resultados al terminar la animación y orienta hacia Edición. Se elimina su aprobación, celebración y navegación automática. La ventana de puntos, trofeos y transición existente queda en el cierre explícito del editor.
- Al abrir otro diseño, ruta, escenario y consigna se actualizan antes de notificar cambios de selección o POI. Esto evita consultar contenido del nivel anterior con el intento nuevo al pasar a Modo Libre.
- Modo Libre conserva el mensaje de simulación libre. Una red ya aprobada informa ese estado al repetir una ejecución, sin invitar a finalizar otra vez.
- Reglas y las ayudas de interacción explican las tres acciones. No se modifican los catálogos de consignas ni las reglas de éxito.

## Datos y contratos

Sin cambios de esquema, tablas, columnas, entidades, relaciones o migraciones. Sin endpoints nuevos ni cambios de DTO. Se reutilizan `intento.estado`, `progreso`, `puntaje`, `fecha_finalizacion` y la evidencia existente de simulación. No se convierten ni eliminan datos históricos.

No se cambia la autenticación ni la navegación persistente. La recarga completa conserva su comportamiento vigente de volver al login; la regresión vuelve a ingresar y retoma el mismo intento.

## Evidencia

- Línea base: build frontend, salida 0, 2,28 s; 12 pruebas backend de puntuación, 0 fallos/errores/omitidas, salida 0.
- Regresión RED: la nueva comprobación de progreso persistido al guardar falló en las cinco campañas; el guardado anterior no lo actualizaba sin evaluación. Tras la corrección: 13 pruebas de política, puntuación y matriz de niveles, 0 fallos/errores/omitidas, salida 0.
- Backend completo: `bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true`, salida 0; 260 pruebas, 0 fallos, 0 errores, 1 omitida. La omitida es la campaña de navegador, habilitada por separado con `METRONET_E2E_RECORRIDO=true`.
- Matriz PostgreSQL: cinco campañas de diez niveles, 50 aprobaciones; puntajes 100/90/80/70/60 en niveles 2–10 y 100 en nivel 1. Cada caso comprueba que guardar/simular no completan, no fijan fecha de finalización ni habilitan el siguiente. Finalizar mantiene exactamente el desglose de descuentos.
- Regresión adicional: ejecutar, cambiar UV, guardar y finalizar rechaza la evidencia antigua; ejecutar de nuevo permite aprobar. Repetir la evaluación no cobra, no duplica ejecuciones ni cambia la fecha de cierre. Otro jugador no puede finalizar la red ajena.
- Revisión visual Chrome: control de entrega a 1366×768, 1440×1000, 390×844 y 320×1000; texto visible, contraste verde, foco/hover y aviso compacto. Capturas temporales fuera del repositorio.
- Se reprodujo un aviso de entrega incompleta oculto por el filtro de notificaciones rutinarias. Se corrigió su clasificación; las cinco pruebas específicas de entrega, móvil, error de guardado y Modo Libre pasan, salida 0.
- Build frontend después de los cambios: salida 0, 3,98 s. Sin nuevas advertencias de tamaño.
- Regresión frontend ampliada: 183 casos, 181 correctos y dos fallos de sincronización en el tutorial (espera de un estado visual transitorio y lectura de posición durante resize). Los dos casos pasaron aislados; se actualizaron sus esperas a la respuesta real de ejecución y a la geometría estabilizada por actionability de Playwright. Reejecución completa de los dos archivos afectados: **57/57**, 0 fallos/omitidas, salida 0, 156,37 s. Los otros 126 casos no fallaron.
- Primera pasada completa UI con backend/PostgreSQL: los diez niveles llegaron a la aprobación explícita, pero la prueba terminó con fallo por un HTTP 404 al entrar a Modo Libre. La ayuda recibía el escenario anterior antes de actualizar el contexto del nuevo diseño. Se reprodujo en una prueba aislada y se corrigió el orden de actualización, sin ocultar el fallo de red en las pruebas.
- Tres regresiones finales de mensajes y cambio a Modo Libre: RED 0/3; GREEN **3/3**, salida 0, 23,82 s. Se comprueba ausencia de la consulta educativa improcedente y de instrucciones de aprobación fuera de contexto.
- Regresión frontend final después de todas las correcciones: **184/184**, 0 fallos/canceladas/omitidas, salida 0, 488,43 s. Incluye los doce archivos de editor, ayuda, preparación, simulación, reglas, tutorial, resultado, victoria y cancelación.
- Build frontend final: `npm --prefix frontend run build`, salida 0, **3,64 s**, sin advertencias.
- Recorrido completo final: `METRONET_E2E_RECORRIDO=true METRONET_BROWSER_CHANNEL=chrome METRONET_PLAYWRIGHT_PATH=<Playwright local> bash backend/scripts/probar-postgres.sh -Dtest=RecorridoIntegralE2EPostgresTest`, salida 0, `BUILD SUCCESS`, **15 min 38 s**. Chrome: **11/11** (diez niveles y campaña), 0 fallos/omitidas; contenedor JUnit: **1/1**, 0 fallos/errores/omitidas. Esta ejecución cubre el test condicional omitido en la suite general.
- Puntajes observados en la campaña UI, niveles 1 a 10: **100, 90, 80, 70, 100, 100, 100, 60, 90, 60**. Cada nivel conserva avance sin aprobar tras Guardar/Simular y solo avanza mediante Finalizar red. Nivel 1 incluye recarga y reingreso sobre el mismo intento. Nivel 10 verifica Modo Libre bloqueado antes de entregar y acceso real tras la victoria final, sin consultas 404 ni errores de página.
- JAR local reconstruido con `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./mvnw -DskipTests package`: salida 0, `BUILD SUCCESS`, 2,485 s. El empaquetado no vuelve a ejecutar tests; la evidencia de tests es la registrada por separado.

## Archivos afectados

Backend:

- `backend/src/main/java/com/metronet/backend/service/JuegoEducativoService.java`
- `backend/src/main/java/com/metronet/backend/service/SimulacionService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/MatrizPuntuacionRecorridoPostgresTest.java`

Frontend:

- `frontend/src/mapa/controles/EditorRedMetro.js`
- `frontend/src/mapa/estilos/editor-red.css`
- `frontend/src/simulacion/simulacion.js`
- `frontend/src/educacion/AyudaContextual.js`
- `frontend/src/educacion/TutorialInicial.js`
- `frontend/reglas.html`
- `frontend/tests/interaccion-directa.test.cjs`
- `frontend/tests/cancelacion-celebracion.test.cjs`
- `frontend/tests/victoria-nivel.test.cjs`
- `frontend/tests/reglas.test.cjs`
- `frontend/tests/tutorial-simulacion.test.cjs`
- `frontend/tests/recorrido-integral-e2e.test.cjs`

Este informe es evidencia operativa; no modifica el documento académico.

## Límites y documentación

- Documento METRONET, manual y capturas deben reflejar la entrega explícita y el nuevo momento de aprobación. No se editaron automáticamente.
- No se verifican Safari/Firefox ni escucha de audio en altavoces en esta tarea. El sistema de audio no se modifica.
- La matriz de puntuación se ejecuta con Services y PostgreSQL reales; la prueba de navegador separada comprueba la integración real. Las pruebas con API simulada se distinguen de ambas.
- Todas las pruebas PostgreSQL utilizan clústeres y usuarios temporales. No se borraron ni modificaron partidas de la instalación del usuario. Para cargar el JAR nuevo en un backend que ya estuviera abierto, reiniciar su proceso habitual de `npm start`.
- Advertencias existentes de Maven: carga dinámica del agente Mockito/ByteBuddy en Java 21. No equivalen a fallos de aplicación.
