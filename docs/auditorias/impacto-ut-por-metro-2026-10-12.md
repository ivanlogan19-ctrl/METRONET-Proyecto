# Impacto aprobado: UT global e individual por metro

Estado: APROBADO para ejecución el 12/10/2026. Tras la confirmación formal «CONFIRMO CAMBIO FORMAL DE METRONET: permitir UT global e individual por metro», el usuario aprobó el alcance de migración compatible, contratos, motor, evaluación, tutoriales y documentación con «Apruebo ejecutar ese alcance». El análisis siguiente conserva la situación previa y el alcance aprobado; la evidencia final se registra en `campana-2026-10-12.md`.

## Estado previo inspeccionado

IMPLEMENTADO: UV pertenece a cada metro; la duración se aplica globalmente a la ejecución. `ActualizarUnidadMetroRequest` no contiene UT. `simulacion.duracion` guarda un entero global; `MotorSimulacion` usa un reloj compartido. El texto de selección debe reflejar este comportamiento mientras no se adopte el cambio.

DEFINIDO: la documentación vigente conserva la simulación y su duración global. La confirmación solicita ampliar el alcance a UT por unidad. La adenda autorizada del Documento METRONET conserva la trazabilidad de esta ampliación.

## Comportamiento aprobado

- Seleccionar Todos los metros permite aplicar UV o UT a todas las unidades; seleccionar un metro modifica solo esa unidad.
- La selección no modifica valores. Cuando difieren entre unidades se muestra un estado mixto, sin inventar un valor común.
- Todos comparten un reloj. Cada metro dispone de su propia duración; la ejecución termina al alcanzar la mayor UT. Se conserva la regla actual de final del recorrido.
- Los diseños y ejecuciones anteriores mantienen su duración global como valor de respaldo. Las nuevas ejecuciones guardan una copia de los valores por metro para reproducir y evaluar correctamente lo sucedido.

## Componentes afectados

| Área | Cambio necesario |
|---|---|
| Requerimientos/casos de uso | Configurar, ejecutar, consultar y comparar simulaciones con duración individual o global |
| Interfaz | Selector, controles UT, detalle de metros, estados mixtos y tutoriales |
| Motor Phaser | Tiempo disponible por unidad, progreso global, pausa, reinicio y finalización |
| Backend | Validación en Services, actualización de unidades, ejecución y evaluación educativa |
| Datos | Campo opcional de duración por metro y snapshot por ejecución; migración compatible, sin borrar datos |
| API | Extender actualización/consulta de unidades y contratos de ejecución con UT por unidad; conservar compatibilidad con solicitudes antiguas |
| Evaluación | Comparar UV y UT efectivamente utilizadas por cada unidad; mantener cinco metas y los tres POI donde corresponda |
| Documentación | Documento METRONET, modelo de datos, contratos, reglas UV/UT y casos de prueba requieren actualización autorizada |

## Validación y riesgos

Pruebas necesarias: aplicación global e individual, aislamiento entre unidades, valores mixtos, validaciones, persistencia, compatibilidad histórica, pausa/reinicio, evaluación y recorrido completo de diez niveles con PostgreSQL real temporal.

Riesgos: modificar involuntariamente otras unidades, interpretar ejecuciones históricas con reglas nuevas o completar una ejecución antes de tiempo. Se controlan con snapshots, valores de respaldo y pruebas del reloj y evaluación.

Se mantiene la arquitectura cliente-servidor, JavaScript/Phaser, Spring Boot y PostgreSQL. Es una ampliación funcional en varias capas, independiente de la reorganización visual; requiere una nueva ronda completa de validación antes de publicarse.
