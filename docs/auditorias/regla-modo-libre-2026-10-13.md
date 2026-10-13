# Regla de distancias en Modo Libre — 2026-10-13

## Alcance y estado

DEFINIDO: la equivalencia vigente es 1 UV = 1 km por UT, y 1 UT = una hora del escenario. La solicitud de esta tarea autoriza mostrar las distancias existentes en edición y simulación de Modo Libre, con regla integrada en la cabecera y total pequeño arriba a la derecha del mapa. La publicación fue autorizada posteriormente por el usuario mediante «subi los utimos cambios al git».

IMPLEMENTADO: presentación de `tramo.distanciaKm` recibido por la API existente. Botón en Diseño de la red (editor) y Capas del mapa (simulación), inicialmente apagado. Etiquetas marfil por tramo y total compacto; con varias líneas, el total corresponde a la red hasta seleccionar una línea, tramo o metro. La selección de una estación vuelve al total de red. Los kilómetros no se recalculan en el navegador. Cada respuesta actualizada del servidor renueva las mediciones después de editar la red.

Las etiquetas mantienen tamaño al acercar, desplazar o girar la cámara, no capturan clics y evitan solaparse con estaciones, trenes y otras etiquetas. Si no hay espacio visible, se omite la etiqueta hasta que la vista permita mostrarla. Los tramos sin una distancia válida no se inventan y un total incompleto no se presenta. La regla no aparece en niveles de campaña.

Se incorpora un paso explicativo en los tutoriales de Modo Libre, con nueva versión de su registro local. Los controles existentes se conservan. Capa afectada: presentación. Sin modificaciones de backend, contratos REST, esquema, migraciones, base personal ni documento académico.

## Archivos

- `frontend/src/mapa/controles/MedicionDistancias.js`: componente compartido y ciclo de vida.
- `frontend/src/mapa/controles/medicion-distancias.css`: regla integrada y etiquetas compactas.
- `frontend/src/mapa/capas/CapaRedMetro.js`: integración, actualización y limpieza.
- `frontend/src/interfaz/PictogramasMapa.js`: pictograma de regla.
- `frontend/src/educacion/TutorialCalles.js`: explicación en edición libre.
- `frontend/src/educacion/TutorialSimulacion.js`: explicación en simulación libre y versión de visita.
- `frontend/src/educacion/RecorridoInicial.js`: incluye los pasos de Modo Libre en la repetición manual.
- `frontend/src/mapa/controles/PanelCalles.js`: versión de bienvenida del editor.
- `frontend/tests/calles-modo-libre-e2e.test.cjs`: comprobación integrada de medidas y tutoriales.
- `frontend/tests/tutorial-simulacion.test.cjs`: regresión de tutoriales, teclado, selección por línea y ausencia de distancias.
- Este registro de auditoría.

## Validación

La evidencia integrada usa Chrome, Spring Boot y PostgreSQL temporal real aislado, sin reemplazar respuestas REST del flujo de edición/simulación. El correo se sustituye en esta suite; algunas fuentes cartográficas se interrumpen deliberadamente para probar recuperación.

- `METRONET_E2E_CALLES=true METRONET_PLAYWRIGHT_PATH=… METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`: una prueba integrada aprobada, cero errores, fallos u omisiones; salida 0. Incluye construir, mover, guardar, recuperar, comparar kilómetros de ambas pantallas, zoom/rotación, simulación/pausa, visibilidad y comprobación de que alternar medidas no escribe en el servidor. Geometría comprobada a 1280×720, 1440×1000 y 1920×1080.
- `METRONET_URL_PRUEBAS=http://127.0.0.1:5198 METRONET_PLAYWRIGHT_PATH=… METRONET_BROWSER_CHANNEL=chrome node --test frontend/tests/tutorial-simulacion.test.cjs`: 17 aprobadas, cero errores/omisiones, salida 0. Contratos controlados para los tutoriales y casos de varias líneas, teclado, datos ausentes y exclusión de niveles. Primer intento descartado por apuntar al puerto 5173 sin servidor; repetido correctamente en 5198.
- `npm --prefix frontend run build`: salida 0; compilación Vite correcta.
- `git diff --check`: salida 0.

No se ejecutó nuevamente la campaña de diez niveles ni la suite completa de backend: no se modificó su lógica. No verificado en Safari/Firefox, pantallas móviles para la regla, ni rendimiento con redes masivas. Al cerrar la implementación todavía no se habían creado commits. Para la publicación posterior autorizada se repitieron la compilación y `git diff --check` (salida 0); se conservaron las pruebas integradas y de tutoriales ya aprobadas para el mismo código. El respaldo personal `metronet.dump` permanece fuera del repositorio.

## Corrección del arranque local

IMPLEMENTADO: después de publicar la regla en `bec2be9`, se reprodujo en la aplicación personal el botón activado sin valores. El servidor del puerto 8080 ejecutaba un JAR antiguo que no incluía `DistanciasRedService`; el arranque reutilizaba ese archivo sin compilar. Se corrigió `backend/scripts/iniciar-local.sh` para empaquetar el código actual antes de ejecutarlo. Si falla la compilación, el arranque se detiene, sin recurrir al JAR anterior.

El cálculo geográfico existente se conserva: distancias entre las coordenadas de las estaciones, en kilómetros, independientes del zoom. No son distancias por calles. Una comprobación independiente sobre las coordenadas guardadas del diseño 451 dio 22,489773 km, que la regla redondea a 22,5 km. No se cambiaron entidades, esquema, contratos REST ni datos del diseño personal.

Validación posterior a la corrección:

- `bash -n backend/scripts/iniciar-local.sh` y `git diff --check`: salida 0.
- `METRONET_E2E_CALLES=true METRONET_PLAYWRIGHT_PATH=… METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=DistanciasRedServiceTest,CallesModoLibreE2EPostgresTest`: salida 0; tres pruebas aprobadas, cero fallos, errores u omisiones. Incluye Chrome, servidor real y PostgreSQL temporal real, mediciones en edición/simulación y conservación de kilómetros al cambiar la cámara.
- `npm start` recompiló el JAR y arrancó el servidor actualizado, conectado a PostgreSQL local. Se comprobó que el paquete contiene `DistanciasRedService`.
- La comprobación visual posterior con la cuenta personal quedó pendiente: la pestaña anterior se cerró y la nueva navegación mostró el inicio de sesión. El valor del diseño 451 se verificó por coordenadas, no visualmente después del reinicio. La prueba integrada con su cuenta de prueba sí aprobó ambas pantallas.

Capas afectadas por esta corrección: arranque local y registro de auditoría. Sin cambios al documento académico. Continúan las limitaciones de navegadores y campaña completa indicadas arriba.
