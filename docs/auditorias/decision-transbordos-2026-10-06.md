# Decisión de integración: transbordos con herramientas existentes

## Trazabilidad

El usuario pidió adaptar las consignas que requieren transbordos a las herramientas visibles y rechazó agregar un botón para marcarlos. El Documento METRONET define que una estación puede formar parte de varias líneas y actuar como transbordo; no prescribe una marca manual. La auditoría de 2026-09-27 registra la decisión anterior de exigir `estacion.transbordo` y, por trazabilidad, no se reescribe. El DOCX original tampoco se modifica.

## Regla implementada en la copia aislada

Para un nivel con `reglasExito.transbordosPorConexion=true`, `minimoTransbordos` cuenta estaciones distintas que sean extremo de tramos de **al menos dos líneas distintas**. Compartir coordenadas sin compartir la misma estación, crear líneas sin tramos o acumular tramos de una sola línea no satisface la condición. La marca almacenada `estacion.transbordo` no interviene en este criterio. El mínimo sigue siendo 1, 2, 2 y 3 en los niveles 7–10. El puntaje máximo, las restricciones geográficas, la conectividad por línea y UV/UT no cambian.

Los snapshots anteriores, que carecen de `transbordosPorConexion`, conservan la evaluación previa: estación compartida por tramos de dos líneas **y** marca manual. La propiedad persiste en el esquema y API para compatibilidad y administración, pero no se muestra al jugador como herramienta nueva. El resumen de Simulación y el símbolo del mapa describen la conexión estructural entre líneas. Una estación compartida no se infiere de un cruce gráfico.

| Niveles | Acción visible para cumplir la consigna | Otros criterios conservados |
| --- | --- | --- |
| 1–3 | Estaciones, Línea y desde el nivel 2 Conexión; Metro desde el 3 | Red válida desde el 3; sin transbordos |
| 4–6 | Estaciones, Línea, Conexión, Metro y Simular diseño | Cobertura, áreas, recorrido común, red válida y UV/UT |
| 7 | Hacer llegar tramos de dos líneas a una misma estación, usando Línea y Conexión | Un transbordo; cobertura, áreas y comparación UV individual |
| 8 | Compartir dos estaciones entre líneas mediante tramos reales | Dos transbordos; comparación UV individual y global |
| 9 | Compartir dos estaciones entre líneas mediante tramos reales | Dos transbordos; límite de estaciones y comparación de horas/UV |
| 10 | Compartir tres estaciones entre líneas mediante tramos reales | Tres transbordos; cobertura y comparación final de horas/UV |

La consigna 7 ya no pide «Permite transbordo». Los textos de 8–10 explican cómo formar las estaciones compartidas. La ayuda, el glosario y el mensaje de transición 7 usan el mismo criterio. El selector de Simulación se llama «Todos los metros» en la UI; el catálogo y la ayuda emplean ese nombre.

## Publicación pendiente en bases existentes

El catálogo empaquetado sirve para una preparación nueva y para el editor administrativo. Una base con `nivel_publicacion` conserva sus versiones y borradores; el inicializador omite esos niveles. Por tanto desplegar solo código **no publica** las nuevas consignas 7–10. Los intentos existentes conservan snapshots V1/V2 y su puntuación registrada. Los intentos incompletos 7–10 con snapshot anterior quedarían sin vía visible de marcar transbordo; requieren una decisión de migración o reinicio antes de liberar a jugadores.

Plan propuesto, sin ejecución sobre la base operativa:

1. Inventariar versiones publicadas, borradores e intentos 7–10 por estado y tipo de snapshot. Guardar recuentos y una copia verificada con `pg_dump` antes de escribir. Probar restauración en PostgreSQL aislado.
2. En la copia restaurada, preparar borradores 7–10 desde la última publicación, añadir `transbordosPorConexion=true`, actualizar instrucciones y ayudas, verificar que el mínimo y `puntuacion.maximo` no cambiaron. Validar referencias sin marca mediante el endpoint administrativo, y publicar nuevas versiones con revisión editorial. Registrar versiones, huellas y hora.
3. Elegir expresamente tratamiento de intentos incompletos previos: migrar solo sus snapshots y textos a la nueva regla dentro de una transacción auditada, o permitir reiniciar cada nivel con la versión nueva. No alterar intentos completados, resultados ni máximos históricos. Volver a probar reanudación y repetición.
4. Con autorización específica para la base operativa, repetir la secuencia con backup y comprobaciones antes/después. Si falla una comprobación, cancelar la transacción y restaurar desde el respaldo verificado.

El cambio no requiere alterar el esquema. No hay modificación de base operativa, documento académico, versión histórica publicada ni borrador real en esta integración.
