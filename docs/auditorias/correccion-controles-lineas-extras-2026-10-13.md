# Corrección de controles por línea y presentación de Extras

## Estado y alcance

- DEFINIDO por el cambio formal aprobado y la aclaración posterior: únicamente en Modo Libre, cada línea comparte UV/UT entre sus metros, según su distancia geográfica. UT = km / UV y UV = km / UT; las otras líneas conservan su configuración.
- IMPLEMENTADO en esta corrección: pasos decimales, validación de campos calculados con valores distintos por línea, guardado al iniciar/reiniciar y presentación solicitada de Extras.
- No se modifica el modelo relacional, los endpoints, el servidor ni el documento académico. Se reutilizan los módulos y contratos existentes. No se cambia la independencia UV/UT de niveles 1–10.

## Causas reproducidas y correcciones

1. El botón de reducir UT restaba una unidad completa y limitaba el resultado a 0,00000001. En recorridos de menos de una hora provocaba una velocidad imposible de guardar. Los pasos ahora admiten décimas y fracciones menores, evitan saltar casi a cero y conservan hasta ocho decimales al sumar/restar. Los pasos UV de Modo Libre también preservan esa precisión; los de niveles mantienen su conducta anterior.
2. Tras una duración común, elegir otra UV podía producir tiempos diferentes por línea. El campo vacío con «MIXTO» seguía siendo obligatorio y la validación nativa impedía iniciar. La obligatoriedad se actualiza con la previsualización. Ambos disquetes guardan el último parámetro editado aunque el otro tenga valores distintos.
3. Reiniciar con UV pendiente y UT mixta reutilizaba los parámetros anteriores. Ahora aplica el último valor y ejecuta la configuración actual.
4. En Modo Libre, los rótulos y el detalle muestran líneas, con una única fila de configuración y la cantidad de metros de cada una.
5. Extras usa la misma caja de 30 px y pictograma de 18 px en edición y simulación. «Anterior» es amarillo cuando está habilitado; «Cerrar tarjetas» y la salida del recorrido son rojos. Se elimina la sombra lateral azul de todos los títulos de las tarjetas y su bienvenida. Se conserva la fuente pixelada y el estado deshabilitado del primer «Anterior».

## Evidencia de esta corrección

- RED: el recorrido Chrome/HTTP/PostgreSQL falló al reducir una UT fraccionaria por producir UV superior a 9999,99 (`/tmp/metronet-uvut-regresion-rojo.log`). Otra ejecución reprodujo el bloqueo nativo con UT mixta (`/tmp/metronet-uvut-mixto-rojo.log`). La prueba numérica reprodujo el salto de 1,00000001 a 0,00000001 (`/tmp/metronet-pasos-limite-rojo.log`).
- `METRONET_E2E_EXTRAS=true METRONET_PLAYWRIGHT_PATH=… METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=VinculoUvUtLibrePostgresTest,ExtrasModoLibrePostgresTest,EscalaSimulacionPostgresTest -DfailIfNoTests=true`: **7 pruebas Java, 0 fallos, 0 errores, 0 omitidas; salida 0**. Incluyen **3 recorridos Chrome aprobados** contra el servidor HTTP y PostgreSQL temporal real. Registro: `/tmp/metronet-lineas-extras-final.log`.
- Se verificaron dos líneas de diferente longitud, tres metros, aislamiento entre líneas, configuración común dentro de una línea, pasos fraccionarios, guardar desde cualquiera de los controles, iniciar/reiniciar con valores mixtos, recarga, edición geográfica, reasignación de metros, escrituras concurrentes y resultados persistidos. La regresión de niveles/históricos se ejecutó en `EscalaSimulacionPostgresTest`.
- Extras: igualdad de caja/pictograma entre pantallas, colores calculados en el navegador, siete títulos sin barra, fuente pixelada, recorrido/salida/reintento, premio persistido único y nueva bienvenida antes del tutorial. Capturas a 1440×900, 1280×720 y 390×844; inspección visual de `/tmp/metronet-extras-tarjeta-1440.png`.
- `node --test frontend/tests/motor-velocidad.test.cjs frontend/tests/criterio-uv-ut.test.cjs` con Chrome y Vite 5198: **18 aprobadas, 0 fallos, 0 omitidas; salida 0**. Los controles de niveles de esta suite usan respuestas preparadas, a diferencia de la integración anterior. Registro: `/tmp/metronet-uvut-controles-final.log`.
- `npm --prefix frontend run build`: **salida 0**. Conserva el aviso previo de paquetes de más de 500 kB. Registro: `/tmp/metronet-uvut-extras-build.log`.
- `git diff --check`: **salida 0**, repetido después de guardar el informe y antes de publicar.
- Instalación de uso cotidiano: frontend 5173 sirve el cálculo y CSS actualizados con HTTP 200; backend 8080 responde HTTP 200. Consulta PostgreSQL de solo lectura confirma ocho decimales en `metro.velocidad_promedio` y `metro.duracion_ut`. No fue necesario reiniciar ni modificar el backend.

## Archivos modificados

- `frontend/src/simulacion/VinculoUvUtLibre.js`
- `frontend/src/simulacion/PanelDesempeno.js`
- `frontend/src/simulacion/simulacion.js`
- `frontend/src/educacion/extras/PresentacionExtras.js`
- `frontend/src/educacion/extras/extras.css`
- `frontend/tests/vinculo-uv-ut-e2e.test.cjs`
- `frontend/tests/motor-velocidad.test.cjs`
- `frontend/tests/extras-modo-libre-e2e.test.cjs`
- Este informe.

## Límites

No se ejecutó toda la suite histórica ni partidas completas de los diez niveles en navegador. No se probaron Safari ni Firefox. Las escrituras de prueba se hicieron en una base temporal que se elimina al terminar; no se alteraron diseños o cuentas personales. La validación no constituye una nueva auditoría global de rendimiento.
