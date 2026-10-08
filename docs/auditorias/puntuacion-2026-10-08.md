# Puntuación por progreso y ventana de éxito — 2026-10-08

## Estado y autorización

- **DEFINIDO por Documento METRONET:** evaluación del cumplimiento de escenarios y registro del resultado. El documento académico no se reescribió.
- **IMPLEMENTADO antes de esta pasada:** porcentaje de condiciones cumplidas; aprobar exigía todas, por lo que otorgaba 100 puntos. Existía una ventana anterior a victoria sin un registro de descuentos.
- **CAMBIO FORMAL ADOPTADO:** el usuario confirmó 100 puntos iniciales, descuentos de 10, tope de 40 y aprobación con toda la consigna y mínimo 60; aprobó posteriormente ejecutar el análisis presentado. La autorización y el análisis precedieron al código. El informe anterior `interfaz-resultados-2026-10-08.md` conserva su estado histórico previo a esa aprobación.
- **IMPLEMENTADO ahora:** política `puntuacion-progreso-v1`, evaluación transaccional en backend, registro por ejecución, desglose y reglas visibles. No queda esta política clasificada como propuesta pendiente.

## Regla aplicada

Cada intento nuevo de la versión publicada empieza con 100 puntos posibles. El progreso de objetivos es independiente del puntaje. Para adjudicar el resultado hay que cumplir toda la consigna.

Después de las prácticas gratuitas, una ejecución aceptada por el servidor descuenta 10 puntos solamente si hay condiciones pendientes y no satisface ninguna condición nueva respecto del conjunto alcanzado en ejecuciones anteriores del mismo intento. Una ejecución con varios motivos cobra una sola vez. Perder y recuperar una condición anterior no borra el historial. Una ejecución que completa toda la consigna nunca descuenta.

| Nivel | Prácticas gratuitas |
| --- | --- |
| 1 | 1 |
| 2 | 2 |
| 3 | 2 |
| 4 | 3 |
| 5 | 1 |
| 6 | 1 |
| 7 | 1 |
| 8 | 2 |
| 9 | 2 |
| 10 | 4 |

Resultados al completar: 100, 90, 80, 70 o 60. Tope de descuento: 40. Con objetivos pendientes no se aprueba, aunque el puntaje posible sea 100. Tutorial, tiempo, guardar, cámara, pausa, errores técnicos y ajustes sin ejecutar no descuentan. Las solicitudes rechazadas no consumen prácticas. Detener la animación no anula una ejecución ya aceptada.

## Ventana de éxito

Antes de la animación, un diálogo muestra:

1. «Nivel completado» y nombre del nivel.
2. «Ganaste X puntos», destacado en verde.
3. Confirmación breve: «Toda la consigna cumplida».
4. «Tu cuenta de puntos»: base 100, una fila por ejecución penalizada y total.
5. Por cada −10: número de ejecución y falta de nuevos avances visibles. Cada fila se despliega para consultar los objetivos pendientes registrados en ese momento. No se reconstruyen motivos desde el diseño actual.
6. Explicación breve del tope cuando corresponde. La página Reglas conserva la tabla completa de prácticas y el mínimo.
7. «Continuar» verde a todo el ancho para iniciar la animación, que permanece sin el puntaje del nivel.

El usuario rechazó la primera composición de la ventana; se sustituyó por un marcador arcade centrado, jerarquía clara y cuenta compacta. Se redujeron párrafos repetidos y se retiró el marco de foco decorativo del título no interactivo. Texto explicativo legible, cifras tabulares, motivos desplegables con ajuste de línea, altura limitada al viewport y desplazamiento interno. Escape, cancelación y navegación no dejan una transición tardía. El historial sin la nueva política se identifica expresamente y no inventa descuentos.

Revisión visual en Chrome: escritorio 1440 × 900, móvil 390 × 900, máximo de cuatro descuentos en 320 × 568. La prueba pequeña verifica que el diálogo queda dentro del viewport, no desborda horizontalmente y permite enfocar y activar Continuar por teclado. Capturas en `/tmp`, fuera de Git.

## Backend y persistencia

- `PoliticaPuntuacion` consume un único JSON de política compartido con la página Reglas.
- `SimulacionService` adquiere el bloqueo de usuario existente, acepta la ejecución y registra puntuación en la misma transacción.
- `PuntuacionService` calcula el descuento con condiciones reales y lo persiste una sola vez. GET y reevaluación solo consumen el registro.
- `RegistroSimulacionDidactica` amplía el formato versionado existente de `simulacion.comentarios`; mantiene lectura de V1 y huella de red. Metadatos no visibles en comentarios de UI.
- Los DTO existentes agregan desglose/registro. No hay rutas REST nuevas ni cambio de permisos.
- Los intentos conservan la política de su publicación. No se convierten resultados antiguos. El ranking sigue sumando el mejor resultado por nivel completado.
- **Esquema PostgreSQL, tablas, columnas, relaciones y entidades: sin cambios.** No hay migraciones nuevas.
- La publicación explícita adopta solamente la puntuación en el recorrido integral vigente. Conserva contenido, tarjetas y referencia y rechaza borradores pendientes. No se activa automáticamente al iniciar normalmente.

## Instalación local

Se empaquetó el backend después de validar. Se identificó ADMIN interno 2 y diez publicaciones del recorrido integral sin borradores pendientes. Inventario local: 0 intentos y 0 simulaciones; no se borraron datos.

Respaldo privado en `.local/respaldo/puntuacion-2026-10-08/`: exportación de registros y comparación antes/después; permisos restrictivos y fuera de Git. El intento de `pg_dump` fue rechazado por falta de lectura de una secuencia del rol limitado. Se conservó esa restricción y se respaldaron las filas mediante SELECT; no se ampliaron privilegios.

Se ejecutó el publicador oficial con la bandera explícita y ADMIN 2: **10 publicaciones**. Nuevas versiones: niveles 1–3 V5; 4–6 V6; 7–10 V7. Comparación automatizada: únicamente cambió `reglasExito.puntuacion` dentro del contenido; consignas, herramientas, tarjetas, referencias y cantidades de intentos/simulaciones intactas. Se cerró el backend temporal; el arranque habitual usa el JAR actualizado. Se comprobó también el comando conjunto de frontend y backend.

## Evidencia

- RED: la prueba de progreso parcial esperaba base 100 y recibió 50 con la lógica anterior; la regresión de publicación esperaba versión de puntuación y no existía.
- Backend completo, antes del último ajuste de presentación y sin cambios posteriores en backend, con PostgreSQL temporal y E2E habilitado: **254 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0**.
- Recorrido de navegador real contra esa API: **11/11** (campaña + diez niveles), todos resueltos y acceso final a Modo Libre. Nivel 2 probó descuento real de 10, completó con 90; los demás con 100. Suma verificada: 990.
- PostgreSQL: secuencia 100/100/90/80/70/60/60, mínimo, objetivos obligatorios, GET/reevaluación sin duplicar, solicitud inválida sin consumo y nuevo intento con 100. Dos solicitudes concurrentes registran ordinales 3/4 y 90/80, sin pérdida ni doble cobro de una fila.
- Compatibilidad: publicación nueva preserva intento con política antigua; lectura V1/V2 y comentario limpio; configuración no aprobada rechazada.
- Ventana de éxito: **7/7, salida 0**, incluyendo 80 puntos con motivos en 1440/390 y tope de 60 en 320 × 568.
- Build frontend tras el rediseño del cartel: **salida 0**, 8,22 s, sin warnings nuevos. Empaquetado backend: **salida 0**.

La primera corrida backend tuvo dos fallos: fixture H2 sin la tabla usuario necesaria para el bloqueo y navegación E2E interrumpida durante una edición con HMR. Se corrigió el fixture y la repetición completa estable produjo el resultado de 254 pruebas anterior. No se presenta aquella primera corrida como verde.

La primera regresión amplia frontend terminó con **876 casos: 847 correctos, 28 fallos y 1 omisión**, salida distinta de cero. No se presenta como una suite verde. Se interrumpieron dos archivos que habían quedado pendientes durante cambios con HMR; se repitieron con código estable. Otros fallos correspondían a expectativas anteriores al menú Reglas, a la ventana de puntos, al panel por Metro y a un relato actualizado; se adaptaron las pruebas sin alterar esos flujos de aplicación. Una prueba VM requería el flag de módulos experimentales.

Repetición estable de contenedor, duración musical, UV/UT, glosario e identificación: **73/73, salida 0**. La repetición de bienvenida, campaña y categorías POI pasó todos sus casos; las cuatro expectativas obsoletas de los otros tres archivos de esa misma corrida se resolvieron en la repetición anterior. El E2E omitido por defecto en la suite frontend se ejecutó contra PostgreSQL desde la suite backend. **Regresión final después del rediseño del cartel: 114/114, sin fallos ni omisiones; salida 0.** Incluye reglas, resultado, ranking, navegación responsive, logo, orientación y victoria integrada (repetición, ADMIN, error al iniciar, Modo Libre, consigna incompleta). No se volvió a ejecutar toda la suite de 876 después del último ajuste visual: se repitieron las suites afectadas. Todos los casos fallidos de aquella pasada se cubrieron en las repeticiones indicadas; no se suman esas corridas como si fueran una sola suite.

Regresión adicional: conservar 100 puntos con objetivos pendientes no muestra «Nivel aprobado». El aviso diferencia «Puntaje posible» del resultado adjudicado. Prueba RED por el aviso antiguo, seguida de GREEN con el mensaje corregido.

Arranque local: el primer test sin servicios activos falló por conexión; tras `npm start`, **3/3, salida 0** (frontend, validación de login y CORS). No se utilizaron credenciales de usuario. Se usan Chrome, Vite en 5198 y `--experimental-vm-modules` para los tests que importan módulos con VM. No hay script de lint configurado en frontend/package.json.

## Límites y documentación

La campaña completa con API y PostgreSQL se probó antes del último ajuste visual; después se validaron los flujos y la nueva presentación mediante navegador con API interceptada. No se probó Safari ni Firefox en esta pasada; tampoco escucha manual en altavoces. Las pruebas de audio automatizadas verifican estados/eventos del reproductor, no percepción auditiva. El código no modifica pistas ni duraciones musicales.

El documento académico necesita una actualización autorizada de las secciones de puntuación, aprobación, manual, API de resultados y casos de aceptación. Se preservó el documento original, evitando reconciliarlo silenciosamente.

## Comandos reproducibles

```sh
# Vite para tests de navegador
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5198 --strictPort

# Backend completo, PostgreSQL temporal y recorrido E2E real
METRONET_E2E_RECORRIDO=true METRONET_BROWSER_CHANNEL=chrome \
  METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
  bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true

# Regresión final de 114 casos de interfaz (no equivale a la suite completa)
METRONET_URL_PRUEBAS=http://127.0.0.1:5198 METRONET_BROWSER_CHANNEL=chrome \
  METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
  node --experimental-vm-modules --test --test-timeout=90000 --test-concurrency=2 \
  frontend/tests/{logo-pixel,navegacion-mantenimiento,orientacion-jugador,victoria-nivel,puntuacion-ranking,resultado-nivel,reglas}.test.cjs

npm --prefix frontend run build
git diff --check
# Con npm start activo:
node --test tests/arranque-local.test.cjs
```

Los logs y capturas quedaron en `/tmp`; respaldos y aprobaciones de trabajo locales, en `.local`, excluidos de Git. Las pruebas finales no registraron errores de página nuevos. El comando de arranque se verificó y sus procesos temporales se cerraron para dejar libres 5173/8080.

## Archivos de esta pasada

- `backend/pom.xml`
- `backend/src/main/java/com/metronet/backend/dto/DesempenoNivelResponse.java`
- `backend/src/main/java/com/metronet/backend/dto/DesglosePuntuacionResponse.java`
- `backend/src/main/java/com/metronet/backend/dto/ResultadoSimulacionResponse.java`
- `backend/src/main/java/com/metronet/backend/service/AdministracionNivelesService.java`
- `backend/src/main/java/com/metronet/backend/service/JuegoEducativoService.java`
- `backend/src/main/java/com/metronet/backend/service/PoliticaPuntuacion.java`
- `backend/src/main/java/com/metronet/backend/service/PuntuacionService.java`
- `backend/src/main/java/com/metronet/backend/service/RecorridoIntegralService.java`
- `backend/src/main/java/com/metronet/backend/service/RegistroSimulacionDidactica.java`
- `backend/src/main/java/com/metronet/backend/service/SimulacionService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/PuntuacionDescuentosPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralE2EPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/service/PoliticaPuntuacionTest.java`
- `backend/src/test/java/com/metronet/backend/service/PuntuacionServiceTest.java`
- `backend/src/test/java/com/metronet/backend/service/RestriccionesGeograficasIntegrationTest.java`
- `docs/auditorias/puntuacion-2026-10-08.md`
- `frontend/reglas.html`
- `frontend/src/educacion/PantallaResultadoNivel.js`
- `frontend/src/educacion/puntuacion-progreso.json`
- `frontend/src/educacion/reglas.js`
- `frontend/src/educacion/resultado-nivel.css`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/criterio-uv-ut.test.cjs`
- `frontend/tests/glosario-contextual.test.cjs`
- `frontend/tests/identificacion-nivel.test.cjs`
- `frontend/tests/logo-pixel.test.cjs`
- `frontend/tests/navegacion-mantenimiento.test.cjs`
- `frontend/tests/orientacion-jugador.test.cjs`
- `frontend/tests/puntuacion-ranking.test.cjs`
- `frontend/tests/recorrido-integral-e2e.test.cjs`
- `frontend/tests/reglas.test.cjs`
- `frontend/tests/resultado-nivel.test.cjs`
- `frontend/tests/victoria-nivel.test.cjs`
