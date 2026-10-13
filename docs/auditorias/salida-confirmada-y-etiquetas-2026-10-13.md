# Salida confirmada y distancias visibles — 2026-10-13

## Alcance y estado

- **DEFINIDO:** se conserva la medición geográfica vigente de la API y la navegación con revisión previa del juego. No se modifican unidades, contratos ni reglas de negocio.
- **IMPLEMENTADO:** después de «Continuar sin revisar» se retira el aviso nativo de salida. Al restaurar una vista se registra nuevamente su protección. Cancelar conserva la advertencia ante recarga directa.
- **IMPLEMENTADO:** las etiquetas de distancia buscan también espacio lateral cuando estaciones o metros ocupan los candidatos superiores e inferiores. Se conservan kilómetros y total recibidos del servidor.
- **PROPUESTO:** no se agregan funcionalidades ni cambios de alcance.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `frontend/src/navegacion/NavegacionAplicacion.js` | Respeta la salida confirmada; protección al restaurar la vista o fallar la navegación. |
| `frontend/src/mapa/controles/MedicionDistancias.js` | Posiciones laterales para etiquetas de tramos cortos/verticales. |
| `frontend/tests/revision-pendiente.test.cjs` | Detecta diálogos reales de Chrome, comprueba cancelación/recarga y salida dentro del contenedor. |
| `frontend/tests/medicion-tramos-cercanos.test.cjs` | Reproduce cuatro tramos con marcadores próximos; exige cuatro etiquetas visibles, total 42,3 km y ausencia de colisiones. |
| `frontend/tests/calles-modo-libre-e2e.test.cjs` | Mueve una estación, sale mediante confirmación y recupera la red persistida sin aviso duplicado. |
| `frontend/tests/navegacion-estable.test.cjs` | Actualiza el recorrido de prueba: la bienvenida lleva a Inicio y desde allí se abre Administración. |
| Este informe | Evidencia y límites de la corrección. |

## Verificación fresca

1. Antes de corregir: la prueba de salida detectó un diálogo `beforeunload` adicional. La prueba de cuatro tramos solo obtuvo tres etiquetas visibles.
2. Regresiones Chrome (`medicion-tramos-cercanos`, `medicion-rendimiento`, `revision-pendiente`, `navegacion-estable`, `fluidez-campana`): **16/16 aprobadas, salida 0**, cero omitidas. Una expectativa antigua de la bienvenida falló en la primera ejecución; se actualizó al destino vigente antes de esta repetición completa. La regla conserva cero mutaciones DOM en 30 actualizaciones inmóviles.
3. `METRONET_E2E_CALLES=true ... bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest -DfailIfNoTests=true`: **1/1 Java y 1/1 recorrido Chrome aprobados, salida 0**, cero errores y omisiones. Spring Boot y PostgreSQL temporal reales, sin sustituir respuestas REST. Incluye edición, simulación, capas, persistencia, regla, cámara, tres tamaños de pantalla y salida confirmada. La nueva comprobación observa cero avisos nativos y recupera las estaciones modificadas del servidor.
4. `npm --prefix frontend run build`: **salida 0**.
5. `git diff --check`: **salida 0**.

Logs locales: `/tmp/metronet-fixes-final.log`, `/tmp/metronet-fixes-real.log`, `/tmp/metronet-calles-browser.log`, `/tmp/metronet-fixes-build.log`.

## Límites

- Cambios de producción únicamente en frontend. Sin cambios de backend, endpoints, esquema, migraciones ni datos personales. Base temporal eliminada por el script de pruebas.
- Se reprodujo una geometría representativa de la captura; no se verificó la geometría original completa del diseño 452. La validación integrada utiliza una red de prueba persistida.
- Si una vista realmente carece de espacio, las etiquetas siguen evitando superponer marcadores; se pueden recuperar cambiando el zoom.
- Comprobado en Chrome; no ejecutado en Safari ni Firefox. No se repitió en esta tarea toda la campaña de diez niveles ni toda la suite del backend.
- No se modificó el documento académico ni se publicaron commits en esta tarea.
