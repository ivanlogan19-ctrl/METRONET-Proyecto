# Validación previa a publicación — 13/10/2026

## Alcance autorizado

Publicación de los cambios pendientes aprobados: música por actividad y recursos AAC, presentación de Inicio y consultas de Administración, fuentes fuera de Reglas, siete tarjetas Extras de Modo Libre, su progreso persistente, premio oculto y orden anterior al tutorial.

**IMPLEMENTADO:** lo anterior, detallado en los informes de música y Extras de esta carpeta. **PROPUESTO, no implementado:** vinculación automática inversa de UV y UT por distancia. No se modifica el motor ni la escala física en esta publicación.

## Comprobaciones ejecutadas

- `git diff --check` y `git diff --cached --check`: salida 0.
- `npm --prefix frontend run build`: salida 0. Conserva el aviso de tamaño de algunos paquetes; no es un error de compilación.
- Integridad de ocho recursos de audio: 8/8 hashes coincidentes con el manifiesto, salida 0.
- Pruebas de integración: `CallesModoLibreE2EPostgresTest`, `ExtrasModoLibrePostgresTest`, `AprendizajeTrofeosPostgresTest`, `TrofeosServiceTest`, `AprendizajeTrofeosHttpTest`: 8/8, sin fallos, errores ni omisiones, salida 0. Incluyen tres recorridos de Chrome con servidor real y PostgreSQL temporal aislado.
- Revisión ampliada de 14 archivos frontend modificados: 170 casos, inicialmente 159 aprobados y 11 fallidos. No se presenta esa ejecución como completamente aprobada.
- Reejecución dirigida de los 11 casos pendientes: 11/11 aprobados, sin omisiones, salida 0. Se actualizaron expectativas de canción de construcción, entrada al tutorial, datos de ejemplo con distancia y UT, selección de biblioteca de niveles y acceso informativo del jugador. La prueba del reloj oculto ahora espera el último frame pendiente antes de comparar imágenes; sigue verificando 18 segundos ocultos sin consumir tiempo visible.
- Un primer intento no inició Chrome por faltar la variable que señala Playwright; se repitió con el runtime local correcto.

La ampliación de pruebas usa contratos HTTP controlados para música y presentación; la integración PostgreSQL citada arriba verifica el flujo real. Ninguna corrección realizada durante la publicación alteró la lógica de producción: los cuatro archivos ajustados fueron `identificacion-nivel.test.cjs`, `musica-bienvenida.test.cjs`, `musica-nueva-asignacion.test.cjs` y `reanudacion-temprana.test.cjs`, dentro de `frontend/tests/`.

## Límites

No se realizó una nueva campaña integral de los diez niveles contra PostgreSQL, una escucha en parlantes ni pruebas en Safari/Firefox. No se cambió el documento académico principal. La migración 022 ya se aplicó a la base local; cualquier otra instalación debe aplicarla antes de iniciar esta versión del backend. La vinculación automática UV/UT sigue siendo una propuesta y requiere su alcance específico antes de implementarse.
