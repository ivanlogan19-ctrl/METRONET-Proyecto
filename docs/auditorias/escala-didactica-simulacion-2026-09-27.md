# Escala didáctica de simulación — 27/09/2026

## Estado, fuentes y alcance

- **DEFINIDO históricamente:** Documento METRONET, apartado de simulación y PU-03, describía duración mínima de diez segundos. Se revisaron el documento, `AGENTS.md` y la skill `metronet-development`.
- **CAMBIO FORMAL APROBADO:** velocidad de las unidades en UV, duración en horas simuladas y ritmo visual independiente; aprendizaje progresivo mediante comparación de ejecuciones. El usuario declaró completadas la confirmación, el análisis de impacto y la aprobación de ejecución.
- **IMPLEMENTADO antes:** `Metro.velocidad_promedio` se mostraba como km/h; `Simulacion.duracion` guardaba segundos enteros, mínimo 10; `Simulacion.velocidad` ya era el multiplicador visual. El motor combinaba estimaciones geográficas de minutos con una ventana visual acotada.
- **IMPLEMENTADO ahora:** escala UV/h/× separada, sin equivalencia física. Este informe técnico conserva la trazabilidad; no modifica el documento académico oficial.

No se agregan tablas, columnas, entidades, relaciones, endpoints, dependencias ni frameworks. Se mantienen autenticación, autorización, mantenimiento, arquitectura por capas y PostgreSQL. No se convierten ni eliminan registros históricos.

## Semántica y contratos

| Campo existente | Semántica implementada | Validación |
| --- | --- | --- |
| `metro.velocidad_promedio` / `velocidadPromedio` | UV de una unidad | Mayor que cero; hasta dos decimales y 9999,99 por representabilidad del `NUMERIC(6,2)` existente. No es un máximo físico ni un valor óptimo. |
| `simulacion.duracion` / `duracion` | Horas simuladas | Entero positivo, sin máximo didáctico de 24 h. Se conserva el tipo INTEGER existente. |
| `simulacion.velocidad` / `velocidad` | Ritmo visual × | 0,5 / 1 / 2 / 4, como en la implementación anterior. Nunca representa UV. |

La ejecución conserva su cuerpo `{ "velocidad": 2, "duracion": 6 }`: reproduce seis horas simuladas a 2×. Las UV se guardan mediante las operaciones existentes de unidades de metro. El Controller no incorpora conversiones; DTO y Service validan los valores. El DTO rechaza horas fraccionarias en vez de permitir que Jackson trunque 1,5 a 1.

Las respuestas de resultados incorporan `escala` y la instantánea de unidades. Las de desempeño sustituyen métricas físicas (`velocidadKmh`, `distanciaKm`, `tiempoMinutos`, objetivo/tolerancia km/h) por UV y cantidad de tramos; `aprendizajeCumplido` expresa las prácticas satisfechas. Progreso agrega `tutorialSimulacionDisponible`, calculado desde los intentos y simulaciones existentes de la campaña. No son campos nuevos de base de datos.

## Reloj y controles

`frontend/src/simulacion/EscalaSimulacion.js` centraliza valores iniciales, formato y reloj:

- Valores iniciales para nuevas unidades/ejecuciones: **4 UV, 6 h, 1×** (o el ritmo configurado existente).
- Ventana visual a 1×: `clamp(horas × 3000 ms, 5000 ms, 18000 ms)`. El ritmo divide el tiempo de observación; 6 h duran 18 s a 1× y 9 s a 2×. A 0,5× el máximo visual es 36 s. Las horas altas no producen esperas de horas reales.
- Avance didáctico: un tramo lógico por UV y hora simulada, centralizado en la misma fuente. No equivale a distancia física. Una unidad que llega al extremo permanece allí; no se inventan retornos ni teletransportes. Una red corta puede completar su recorrido antes de terminar las horas configuradas.
- Formateo compartido UV, h y ×; no se calculan minutos ferroviarios a partir de distancias reales y UV.
- Panel compacto: Todas/unidad, UV, h y × con controles +/−. UV y horas avanzan por pasos de uno; UV también admite entrada de dos decimales. `MIXTO` no calcula un promedio. En ese estado se ingresa un valor explícito antes de aplicar.
- Todas modifica todas las unidades permitidas; elegir una afecta solo a esa unidad. Se mantiene el guardado por PATCH individual y el aviso/recarga si parte del lote falla.
- Play mantiene validación y guardado automáticos. Se bloquean cambios de parámetros durante la solicitud para evitar inconsistencias y doble envío.
- Durante reproducción/pausa se conservan UV y horas; cambiar × conserva el instante simulado y acelera solamente la reproducción.
- Stop conserva la configuración. Restart conserva UV/h/×; si se cambiaron horas tras detener, ejecuta nuevamente el preflight y guarda una nueva ejecución con esas horas.

Los resultados muestran UV por metro, duración en h, estado y puntaje. El ritmo guardado se identifica como **ritmo inicial**, dado que los cambios visuales durante la reproducción continúan siendo locales. No se reintroduce Validar ni un checklist duplicado.

## Escenarios y aprendizaje

Se conservan las condiciones estructurales y geográficas de las redes. Niveles 1–3 permanecen sin simulación. Los niveles siguientes incorporan:

| Nivel | Comparaciones requeridas, además de construir su red |
| --- | --- |
| 4 | Cambiar UV, conservar horas y volver a ejecutar. |
| 5 | Cambiar horas, conservar UV y volver a ejecutar. |
| 6 | Comparar UV y horas por separado. |
| 7 | Cambiar solo una unidad de una red con varias y volver a ejecutar. |
| 8 | Comparar cambio individual y cambio global a una UV común. |
| 9 | Comparar duración y una combinación de UV + horas. |
| 10 | Comparar individual, global y combinación UV + horas. |

`reglas_exito.aprendizajeSimulacion` reutiliza la evaluación existente de condiciones; no existe un motor de progreso paralelo. Abrir un control, cambiar un valor sin ejecutar o pulsar Play una sola vez no satisface las prácticas avanzadas.

La evidencia se obtiene de ejecuciones consecutivas del mismo intento y de la misma estructura de red. Las instantáneas permiten comprobar cambios reales de UV/h; el ritmo no participa en esos criterios. Una modificación de estructura invalida comparaciones ajenas a la red actual. Además debe existir una ejecución de la red y UV actuales. No hay velocidad óptima ni puntos por elegir un número particular. Se mantiene la normalización de criterios obligatorios a 100 puntos.

El catálogo compartido actualiza consignas, instrucciones, preparación y pistas. El inicializador solo actualiza versiones originales conocidas si coinciden exactamente objetivo, instrucciones, reglas y herramientas. Se añadieron variantes antiguas de instrucciones comprobadas en el historial Git; una consigna personalizada queda intacta. Dos inicializaciones consecutivas son idempotentes. Una regla personalizada antigua que exige km/h se marca como pendiente de revisión, sin inventar una equivalencia.

## Tutorial, glosario y ayuda

Se reutiliza `RecorridoInicial` en modo no modal: siete explicaciones de mapa, unidad, UV, h, × y reproducción; luego tres prácticas que avanzan únicamente al guardar UV diferentes, cambiar horas e iniciar realmente. Los pasos prácticos no tienen Siguiente artificial. Se mantienen Pista y consigna independientes.

La disponibilidad se calcula con usuario/campaña e historial existente. El navegador recuerda una presentación interrumpida antes de ejecutar. Nueva campaña vuelve a habilitarla. No aparece en Modo Libre ni por repetir ejecuciones ya registradas. No se agrega `tutorial_visto`.

**Límite explícito:** si se abandona antes de cualquier ejecución y se usa otro navegador o se borra su almacenamiento, la presentación puede repetirse. Tras ejecutar, el historial del servidor ya impide esa repetición entre navegadores. Resolver exactamente una sola presentación por cuenta antes de ejecutar requeriría persistencia adicional, fuera de este cambio.

Glosario: UV, duración simulada y ritmo; eliminado el cálculo de minutos físicos. Las pistas piden comparar una magnitud manteniendo la otra y orientan según las condiciones reales pendientes.

## Históricos y datos locales

El inventario previo de la base local encontró **0 metros, 0 intentos y 0 simulaciones**. No fue necesario convertir, borrar ni migrar historial. Se conservaron usuarios y credenciales.

Cada ejecución nueva añade una instantánea versionada `METRONET-UV-H-v1` al campo TEXT `comentarios` existente, junto a la huella de red que ya se utilizaba. La marca se oculta del texto de usuario y permite conservar UV originales de resultados aunque luego cambien las unidades.

Un resultado sin esa marca se devuelve como `HISTORICA` y muestra la duración original en segundos identificada como escala anterior. No se presenta como horas ni se le atribuyen UV retrospectivas. Las pruebas insertan un histórico sintético y comprueban lectura sin conversión. Para otra instalación con metros antiguos, corresponde inventariar y revisar sus valores antes de adoptar la escala; no existe una conversión oficial km/h → UV.

La copia local ya carga las consignas y reglas nuevas de los niveles 4–10. Los niveles 1–3 y Modo Libre permanecen. Se actualizan datos del catálogo mediante el inicializador existente, **sin cambios de esquema ni migración SQL**. El respaldo local del catálogo, logs y capturas están fuera de Git.

## Validación

- Línea base: build correcto, 195 pruebas backend y 12 focales frontend correctas antes del cambio.
- Backend final: **201 pruebas correctas, cero fallos/errores/omitidas**, con PostgreSQL temporal; incluye API, servicios, persistencia, permisos, autenticación, diseños y campañas. Tras ampliar la compatibilidad de textos originales del catálogo, **23 pruebas relacionadas** volvieron a pasar.
- PU-03 actualizada: 1, 6, 9, 10 y 25 horas válidas; 0, negativo y nulo inválidos. Se prueban horas fraccionarias rechazadas, UV nulas/no positivas/no representables y ritmos inválidos.
- Integración con PostgreSQL: ADMIN y JUGADOR guardan 4 UV, ejecutan 6 h a 1× y 2× y recuperan los mismos valores. Incluye histórico original, propiedad, validaciones, todos los niveles y reinicio de campaña.
- Motor: cinco casos correctos de independencia, pausa/stop/restart, recorrido corto, formato y ventana visual acotada.
- Navegador: validaciones global/individual/MIXTO, fallos parciales, doble envío, preflight, reinicio, tutorial por acciones reales, campaña/repetición, glosario, resultados y permisos. La pasada final focal de controles, diálogos y tutorial en 1440/390 px pasó **22/22** casos.
- Responsive: 1920×1080, 1440×900, 1366×768, 1280×720, 768×900, 390×844 y 320×740. Capturas de escritorio y móvil inspeccionadas; sin overflow global ni solapamiento de controles.
- Build frontend y empaquetado backend correctos. No existe comando lint configurado. Se revisó el diff sin errores de whitespace; no se añadieron dependencias ni avisos de bundle.

Las suites gráficas usan Chrome/Phaser reales con respuestas API controladas; las pruebas de persistencia usan PostgreSQL real aislado. No se presentan como una construcción manual de cada estación por mouse.

Además se completó un recorrido integral de **los diez niveles con el build de producción, Chrome, backend empaquetado y PostgreSQL temporal reales**. Las redes se construyeron mediante API oficial y los controles de Guardar, Simular, UV/h y ejecución se usaron desde la interfaz. Los diez terminaron con progreso 100 y diseño COMPLETADO; la campaña quedó completada. Los niveles 4–10 permanecieron parciales tras Guardar y tras la ejecución inicial; solo completaron después de las comparaciones exigidas. Se recuperaron los resultados y progreso desde la API. Cero errores JavaScript y cero respuestas HTTP fallidas. Se eliminaron exclusivamente el entorno y los datos sintéticos temporales al terminar.

La primera preparación de ese recorrido sufrió una recarga de Vite mientras se corregía el aviso duplicado. Se repitió sobre el build estable. El backend temporal requirió declarar explícitamente el origen del preview; los rechazos CORS del intento de preparación no motivaron ningún cambio en la seguridad ni configuración de la aplicación local. El recorrido final pasó completo.

La validación detectó y corrigió un aviso duplicado: comprobar las horas con `checkValidity()` durante `change` disparaba un error antes del error normal de submit. El tutorial ahora consulta `validity.valid` sin emitir otro evento. Se verifica que haya un solo aviso y ninguna ejecución inválida.

La suite completa de frontend ejecutó **717 casos, sin omitidos**: 710 pasaron en esa corrida y siete fallaron. Cinco conservaban expectativas anteriores (40 como velocidad inicial, segundos/km/h, mínimo de 10 segundos y la antigua espera corta de carga sin catálogo). Se actualizaron a la semántica solicitada, sin debilitar sus comprobaciones. Dos casos de transición agotaron la espera del navegador; ambos pasaron al repetirlos sin modificar sus límites (22,5 s y 17,1 s de ejecución total). Las suites ajustadas pasaron 44/45 en su primera repetición, revelando el aviso duplicado descrito arriba; después de corregirlo, las 22 pruebas de controles/diálogos/tutorial pasaron completas. No se presenta la primera corrida como totalmente verde ni se ocultaron errores de consola. La sensibilidad temporal de esas dos pruebas de animación real queda registrada; no se atribuye a una causa de rendimiento que no se midió.

Como cierre, los **siete casos inicialmente fallidos se ejecutaron juntos con el código definitivo: 7/7 correctos, cero fallos y cero omitidos**. Los casos restantes de la corrida completa pasaron. El backend local responde `UP` y PostgreSQL `CONNECTED`.

Comandos reproducibles principales:

```sh
bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true
npm --prefix frontend run build
# Con Playwright y Chrome del entorno disponibles:
node --test --test-concurrency=1 frontend/tests/*.test.cjs
```

## Archivos afectados

- Simulación frontend: `simulacion.html`, `simulacion.css`, `simulacion.js`, `MotorSimulacion.js`, `PanelDesempeno.js`; nuevo `EscalaSimulacion.js`.
- Editor/administración: `CreacionDirecta.js`, `EditorRedMetro.js`, `administracion.js` (valor inicial y etiquetas UV).
- Educación frontend: `niveles.json`, `AyudaContextual.js`, `Conceptos.js`, `RecorridoInicial.js`, `tutorial-inicial.css`; nuevo `TutorialSimulacion.js`.
- Backend servicios: `SimulacionService`, `PuntuacionService`, `JuegoEducativoService`, `DisenoAdministracionService`, `DatosDemostrativosService`; nuevos `ParametrosSimulacion` y `RegistroSimulacionDidactica`.
- DTO: `EjecutarSimulacionRequest`, `DesempenoNivelResponse`, `ResultadoSimulacionResponse`, `ProgresoJuegoResponse`; nuevo `HorasSimuladasDeserializer`.
- Catálogo: `InicializadorCatalogoEscenariosProgresivos` y nuevo recurso `educacion/niveles-pre-uv.json` con las versiones originales implementadas para comparación exacta.
- Pruebas: unitarias del motor y parámetros, nueva integración `EscalaSimulacionPostgresTest`, fixtures/comparaciones de campañas, tutorial y regresiones UI relacionadas.
- Este informe técnico. Ningún Controller, entidad JPA, esquema, logo o archivo musical modificado.

## Documentación pendiente

Actualizar con autorización el documento académico y sus capturas: semántica de parámetros, PU-03, manual de simulación/resultados, glosario, consignas y tutorial. Las referencias antiguas a km/h y mínimo diez segundos quedan documentadas como históricas; no se alteró silenciosamente la fuente oficial.
