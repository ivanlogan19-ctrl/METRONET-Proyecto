# Optimización de render y compilación — 26/09/2026

Informe técnico; no modifica Documento METRONET.

- **DEFINIDO:** respuesta menor a un segundo para acciones básicas bajo condiciones normales; representación de varias líneas y metros; arquitectura cliente-servidor por capas. No existe un requisito formal de 60 FPS.
- **IMPLEMENTADO antes:** Phaser 4.1.0 completo, geometría estática dibujada con Graphics y etiquetas que alternaban Rectangle/Text. La auditoría anterior ya reutilizaba los cálculos de recorridos, pero mantenía una cadencia cercana a 30 FPS con 60 estaciones, 5 líneas y 20 metros.
- **IMPLEMENTADO después:** mismo motor y datos, geometría vectorial preparada y marcos de etiquetas reutilizados como texturas. Se compilan los módulos de Phaser que usa METRONET, conservando WebGL y Canvas. No se cambian simulación, reglas, APIs, backend, persistencia, esquema ni datos reales.

## Causas verificadas

El perfil de CPU detectó triangulación Earcut dentro del render de Graphics. El fondo geográfico es estático entre redibujos, pero se volvía a triangular en cada cuadro. Los objetos Polygon de Phaser conservan los índices: se reconstruyen con los cambios reales de capa/tamaño y siguen siendo vectoriales durante zoom/pan. No se aplica una imagen rasterizada al mapa ni filtros de nitidez.

El segundo costo era la alternancia de figuras y texturas en cada rótulo: Rectangle/Text provocaba vaciados repetidos del lote WebGL y llamadas de carga de buffers. Eliminar temporalmente los rótulos en el diagnóstico elevó la cadencia aproximadamente de 28–30 a 53–58 FPS. La solución conserva los nombres, tamaños y bordes; convierte únicamente sus pequeños marcos estáticos en texturas reutilizadas por tamaño. Fondo y texto ahora usan el mismo tipo de lote. Las texturas propias se liberan al destruir la capa. Quince ciclos mantienen las cantidades; hay regresiones de liberación y recreación.

Una prueba intermedia sustituyendo fillPath por muchos fillTriangle no mejoró los FPS y fue descartada. Durante el armado del motor reducido las regresiones detectaron registros de plugins y una exportación de escala faltantes; fueron corregidos antes de la validación final. No se modificó node_modules ni se guardó una copia editada del motor.

## Mediciones comparables

Chrome 153, Apple M5, ANGLE Metal. FPS medidos en Vite de desarrollo; el build de producción se valida aparte. Muestras locales de 180 intervalos RAF por caso; no equivalen a una garantía universal ni a una prueba multiusuario.

| Medida | Antes | Después |
| --- | --- | --- |
| Red moderada: 60 estaciones / 5 líneas / 20 metros | 30,68 FPS | 59,67 FPS |
| P95 de intervalo en esa red | 33,4 ms | 16,7 ms |
| Intervalos mayores a 25 ms | 169/180 | 1/180 |
| Tareas largas observadas | 0 | 0 |
| Cálculos de geometría durante 600 actualizaciones | 0 conversiones | 0 conversiones |
| Tiempo acumulado de esas actualizaciones | 5,6 ms | 5,2 ms |
| JS compartido que incluía Phaser | 1.517,11 kB / 406,09 kB gzip | 949,12 kB / 261,85 kB gzip, repartidos en cuatro archivos |
| Mayor archivo resultante | 1.517,11 kB | 410,15 kB |

Se reduce aproximadamente 37,4% el tamaño sin comprimir y 35,5% comprimido de ese conjunto comparable. Los cuatro archivos nuevos suman el motor y el código de aplicación que antes compartían el mismo chunk: no se compara un único fragmento pequeño con todo el paquete anterior. El umbral de 500 kB de Vite no se modifica. Los menús siguen sin cargar Phaser.

La red pequeña conserva aproximadamente 59 FPS. En 5/10/15 ciclos se mantienen 454 objetos de primer nivel Phaser, 1.355 nodos DOM, 240 listeners y un audio; al detener quedan cero tweens y temporizadores Phaser. El heap observado tras GC oscila entre 17,61 y 17,83 MB, frente a aproximadamente 16,9–17 MB antes. Es un intercambio acotado de geometría/texturas preparadas por tiempo de render; no se afirma medir VRAM ni demostrar ausencia de cualquier fuga posible.

## Compilación y mantenimiento

`frontend/build/phaser-metronet.cjs` registra explícitamente los plugins, fábricas y API utilizados. `configuracion-phaser.cjs` aplica los interruptores del propio motor de la misma manera en desarrollo y producción. Se omiten sistemas no usados como física, audio de Phaser y herramientas de depuración; el AudioManager de METRONET permanece intacto. No se añaden dependencias ni se cambia la versión.

Los tres módulos del motor se agrupan por núcleo, render y geometría junto con sus dependencias transitivas. Una primera división solamente por carpetas generaba ciclos entre chunks; se corrigió siguiendo el grafo real y el build final no emite esa advertencia. Son JavaScript generado por Vite, no fuentes copiadas al repositorio. Las licencias de Phaser, EventEmitter3 y Earcut acompañan el build. Al agregar funcionalidades gráficas o actualizar Phaser se deberá verificar la entrada acotada y ejecutar las regresiones; editar esa configuración requiere reiniciar Vite para renovar su caché de dependencias.

La técnica de entrada selectiva está descrita por el [proyecto oficial de compilación personalizada de Phaser](https://github.com/phaserjs/custom-build). La integración de esta tarea fue contrastada con el código instalado de Phaser 4.1.0; no se sustituyeron sus implementaciones por ejemplos de versiones anteriores.

## Validaciones

- 16/16 regresiones focalizadas finales: resize, cámara, DPR, recuperación de tamaño cero, ciclos de escena/simulación, geometría preparada, liberación de texturas y fallback Canvas.
- Matriz del build de producción: 9 pantallas × 5 resoluciones = 45 combinaciones; cero errores JavaScript, avisos de consola, solicitudes fallidas y overflow horizontal. Resoluciones: 1920×1080, 1440×900, 1366×768, 1280×720 y 390×844. Capturas de editor/simulador desktop y móvil inspeccionadas; fuera de Git.
- Integración con backend y PostgreSQL temporales: login ADMIN sintético, tres vueltas de navegación, lecturas/guardados, diez simulaciones y diez resultados persistidos, configuración y logout. Cero errores JavaScript o llamadas fallidas. No se tocaron datos reales.
- Build final: correcto, 2,12 s, sin advertencia de tamaño. No existe un comando de lint configurado; se revisa el diff.
- Primera suite completa: 658/659. La única falla fue una carrera de la prueba musical: la espera aceptaba volumen mayor a 34 %, pero la aserción posterior exigía exactamente 35 % antes de terminar el fade. Se ajustó la espera al valor final esperado, sin cambiar audio productivo. Repetición completa final: **659/659 aprobadas**, cero fallos, omitidas o canceladas; **600,56 s**.

Evidencia numérica: [métricas](optimizacion-render-2026-09-26-metricas.json).

## Audio y alcance pendiente

El reproductor sigue siendo único por documento y conserva pistas y posición. Esta pasada todavía no convierte la navegación a un contenedor persistente. Se explicó el impacto y se solicitó la aprobación de ejecución prevista por AGENTS.md después de la confirmación formal del usuario. Ese cambio conservaría todas las canciones actuales y sus contextos; no implica una única canción para toda la aplicación. Su implementación no se presenta como realizada mientras esté pendiente esa aprobación.

## Archivos afectados

- `frontend/src/mapa/capas/CapaBarrios.js`: fondo vectorial con índices preparados.
- `frontend/src/mapa/capas/CapaRedMetro.js`: marcos reutilizados y liberación de texturas.
- `frontend/build/phaser-metronet.cjs`, `frontend/build/configuracion-phaser.cjs`, `frontend/vite.config.js`: selección y organización del motor.
- `frontend/public/licenses/{Phaser,EventEmitter3,Earcut}.txt`: licencias de distribución.
- `frontend/tests/rendimiento-render.test.cjs`: tres regresiones nuevas.
- `frontend/tests/musica-contextual.test.cjs`: espera al volumen final de la transición para evitar la carrera detectada.
- Este informe y sus métricas: evidencia técnica; documentación académica sin cambios.
